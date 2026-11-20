// Module worker of the SAM tool (see index.js): downloads and caches the runtime and the model,
// encodes an image once, decodes prompts into a mask and returns the mask's outline.
import { traceContour } from "../analysis/core.js";
import { BACKENDS, CACHE, SIDE, totalBytes } from "./files.js";

let ort = null, encoder = null, decoder = null, backend = null, loading = null;
const embeddings = new Map(); // image key -> { emb, pos, s, w, h }; the last two images
const MEAN = [0.485, 0.456, 0.406], STD = [0.229, 0.224, 0.225];

// Fetches a file from the Cache API, or from the network (then stores it), reporting received bytes.
async function getFile(f, onBytes) {
  const cache = await caches.open(CACHE).catch(() => null);
  const hit = await cache?.match(f.url);
  if (hit) {
    const blob = await hit.blob();
    onBytes(blob.size);
    return blob;
  }
  const net = await fetch(f.url, { mode: "cors" });
  if (!net.ok) throw new Error(`${f.url.split("/").pop()}: HTTP ${net.status}`);
  const reader = net.body.getReader(), chunks = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    onBytes(value.length);
  }
  const blob = new Blob(chunks);
  await cache?.put(f.url, new Response(blob)).catch(() => { /* quota: works now, downloads again next time */ });
  return blob;
}

const isCached = async (b) => {
  const cache = await caches.open(CACHE).catch(() => null);
  if (!cache) return false;
  for (const f of BACKENDS[b]) if (!(await cache.match(f.url))) return false;
  return true;
};

// WebGPU when the browser offers an adapter with "shader-f16" (the GPU encoder is the fp16 export;
// without that feature its shaders do not compile), unless the caller asked for a backend; else WebAssembly.
let picked = null;
const pickBackend = (requested) => (picked ??= (async () => {
  if (BACKENDS[requested]) return requested;
  try { return (await self.navigator.gpu?.requestAdapter())?.features.has("shader-f16") ? "webgpu" : "wasm"; } catch { return "wasm"; }
})());

async function loadBackend(b, post) {
  const total = totalBytes(b);
  let got = 0;
  const onBytes = (n) => { got += n; post({ progress: Math.min(1, got / total) }); };
  const [mod, glue, wasm, enc, dec] = await Promise.all(BACKENDS[b].map((f) => getFile(f, onBytes)));
  // The runtime is imported from blob: URLs so that it also works offline, from the cache.
  const js = (blob) => URL.createObjectURL(new Blob([blob], { type: "text/javascript" }));
  ort = await import(js(mod));
  ort.env.wasm.wasmPaths = { mjs: js(glue), wasm: URL.createObjectURL(new Blob([wasm], { type: "application/wasm" })) };
  ort.env.wasm.numThreads = 1; // GitHub Pages is not cross-origin isolated: no SharedArrayBuffer
  const opts = (ep) => ({ executionProviders: [ep], graphOptimizationLevel: "all" });
  encoder = await ort.InferenceSession.create(new Uint8Array(await enc.arrayBuffer()), opts(b));
  decoder = await ort.InferenceSession.create(new Uint8Array(await dec.arrayBuffer()), opts("wasm"));
  backend = b;
}

async function load(post, requested) {
  const b = await pickBackend(requested);
  try {
    await loadBackend(b, post);
  } catch (err) {
    if (b !== "webgpu") throw err;
    console.warn("SAM: WebGPU failed, using WebAssembly", err);
    picked = Promise.resolve("wasm");
    await loadBackend("wasm", post);
  }
  return backend;
}

// rgba: the image resized so its long side is SIDE (w × h); padded bottom/right to SIDE × SIDE.
async function encode(key, rgba, w, h, s) {
  const px = new Float32Array(3 * SIDE * SIDE);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4, o = y * SIDE + x;
      for (let c = 0; c < 3; c++) px[c * SIDE * SIDE + o] = (rgba[i + c] / 255 - MEAN[c]) / STD[c];
    }
  }
  const t0 = performance.now();
  const out = await encoder.run({ pixel_values: new ort.Tensor("float32", px, [1, 3, SIDE, SIDE]) });
  if (backend === "webgpu" && !plausible(out.image_embeddings.data)) {
    // WebGPU errors do not always reach ORT: the result is then NaN or constant. Use the CPU instead.
    console.warn("SAM: invalid WebGPU embeddings, using WebAssembly");
    picked = Promise.resolve("wasm");
    loading = loadBackend("wasm", () => {});
    await loading;
    return encode(key, rgba, w, h, s);
  }
  embeddings.delete(key);
  embeddings.set(key, { emb: out.image_embeddings, pos: out.image_positional_embeddings, s, w, h });
  while (embeddings.size > 2) embeddings.delete(embeddings.keys().next().value);
  return { ms: performance.now() - t0, backend };
}

function plausible(a) {
  let sum = 0, sq = 0, n = 0;
  for (let i = 0; i < a.length; i += 97, n++) {
    if (!Number.isFinite(a[i])) return false;
    sum += a[i]; sq += a[i] * a[i];
  }
  return sq / n - (sum / n) ** 2 > 1e-6;
}

// points: [[x, y, label]] in model-frame pixels; label 1 positive, 0 negative, 2/3 box corners.
async function decode(key, points) {
  const e = embeddings.get(key);
  if (!e) throw new Error("image not encoded");
  const n = points.length;
  const t0 = performance.now();
  const out = await decoder.run({
    input_points: new ort.Tensor("float32", Float32Array.from(points.flatMap((p) => [p[0], p[1]])), [1, 1, n, 2]),
    input_labels: new ort.Tensor("int64", BigInt64Array.from(points.map((p) => BigInt(p[2]))), [1, 1, n]),
    image_embeddings: e.emb,
    image_positional_embeddings: e.pos,
  });
  const ms = performance.now() - t0;
  const iou = out.iou_scores.data, masks = out.pred_masks.data; // [1,1,3], [1,1,3,256,256]
  const box = points.some((p) => p[2] >= 2);
  // Box prompts are unambiguous: SAM's first mask is the box's own; points: highest predicted IoU.
  let k = 0;
  if (!box) for (let j = 1; j < 3; j++) if (iou[j] > iou[k]) k = j;
  const low = masks.subarray(k * 65536, (k + 1) * 65536);
  const mask = upsample(low, e.w, e.h);
  const keep = largestComponent(mask, e.w, e.h, points.filter((p) => p[2] === 1));
  const contour = keep ? traceContour(keep, e.w, e.h) : [];
  return { contour, score: iou[k], ms, s: e.s };
}

// Bilinear upsampling of the 256² logits to the SIDE² frame (align_corners = false, like SAM),
// cropped to the image's w × h; thresholded at 0.
function upsample(low, w, h) {
  const m = new Uint8Array(w * h), f = 256 / SIDE;
  const xs0 = new Int32Array(w), xs1 = new Int32Array(w), xw = new Float32Array(w);
  for (let x = 0; x < w; x++) {
    const sx = Math.min(255, Math.max(0, (x + 0.5) * f - 0.5));
    xs0[x] = Math.floor(sx); xs1[x] = Math.min(255, xs0[x] + 1); xw[x] = sx - xs0[x];
  }
  for (let y = 0; y < h; y++) {
    const sy = Math.min(255, Math.max(0, (y + 0.5) * f - 0.5));
    const y0 = Math.floor(sy), y1 = Math.min(255, y0 + 1), wy = sy - y0;
    const r0 = y0 * 256, r1 = y1 * 256;
    for (let x = 0; x < w; x++) {
      const a = low[r0 + xs0[x]] + (low[r0 + xs1[x]] - low[r0 + xs0[x]]) * xw[x];
      const b = low[r1 + xs0[x]] + (low[r1 + xs1[x]] - low[r1 + xs0[x]]) * xw[x];
      m[y * w + x] = a + (b - a) * wy > 0 ? 1 : 0;
    }
  }
  return m;
}

// Largest 4-connected component (preferring one that contains a positive point), holes filled.
function largestComponent(m, w, h, positives) {
  const lab = new Int32Array(w * h), stack = new Int32Array(w * h), areas = [0];
  let n = 0;
  for (let i = 0; i < w * h; i++) {
    if (!m[i] || lab[i]) continue;
    n++; let sp = 0, a = 0; stack[sp++] = i; lab[i] = n;
    while (sp) {
      const p = stack[--sp], x = p % w; a++;
      if (x > 0 && m[p - 1] && !lab[p - 1]) { lab[p - 1] = n; stack[sp++] = p - 1; }
      if (x < w - 1 && m[p + 1] && !lab[p + 1]) { lab[p + 1] = n; stack[sp++] = p + 1; }
      if (p >= w && m[p - w] && !lab[p - w]) { lab[p - w] = n; stack[sp++] = p - w; }
      if (p < w * (h - 1) && m[p + w] && !lab[p + w]) { lab[p + w] = n; stack[sp++] = p + w; }
    }
    areas.push(a);
  }
  if (!n) return null;
  const hit = new Set(positives.map(([x, y]) => lab[Math.round(y) * w + Math.round(x)] || 0).filter(Boolean));
  let best = 0;
  for (let k = 1; k <= n; k++) if ((!hit.size || hit.has(k)) && (!best || areas[k] > areas[best])) best = k;
  // Fill holes: background not 4-connected to the border becomes foreground.
  const out = new Uint8Array(w * h);
  let sp = 0;
  const push = (p) => { if (lab[p] !== best && !out[p]) { out[p] = 2; stack[sp++] = p; } };
  for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
  while (sp) {
    const p = stack[--sp], x = p % w;
    if (x > 0) push(p - 1); if (x < w - 1) push(p + 1); if (p >= w) push(p - w); if (p < w * (h - 1)) push(p + w);
  }
  for (let i = 0; i < w * h; i++) out[i] = out[i] === 2 ? 0 : 1;
  return out;
}

self.onmessage = async (e) => {
  const { id, type } = e.data;
  const post = (msg, transfer) => self.postMessage({ id, ...msg }, transfer || []);
  try {
    if (type === "info") {
      const b = await pickBackend(e.data.backend);
      return post({ result: { backend: b, bytes: totalBytes(b), cached: await isCached(b) } });
    }
    if (type === "load") return post({ result: await (loading ??= load(post, e.data.backend).catch((err) => { loading = null; throw err; })) });
    if (type === "has") return post({ result: embeddings.has(e.data.key) });
    if (type === "encode") {
      const { key, buffer, w, h, s } = e.data;
      return post({ result: await encode(key, new Uint8ClampedArray(buffer), w, h, s) });
    }
    if (type === "decode") return post({ result: await decode(e.data.key, e.data.points) });
    throw new Error(`unknown message ${type}`);
  } catch (err) {
    post({ error: String(err?.message || err) });
  }
};

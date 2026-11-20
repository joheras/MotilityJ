// Module worker of the Deep-Motility tool (see index.js): downloads and caches onnxruntime-web and the two
// distilled models, then segments the growth and classifies the plate as complete / incomplete.
import { WORK, findPlate, resizeArea, rgbaToGray, traceContour } from "../analysis/core.js";
import { CACHE, CLS, FILES, SEG } from "./files.js";

let ort = null, seg = null, cls = null, loading = null;
const MEAN = [0.485, 0.456, 0.406], STD = [0.229, 0.224, 0.225];

// Fetches a file from the Cache API (any cache: the SAM tool may already hold the runtime), or from the
// network, then stores it in our cache. Reports received bytes.
async function getFile(f, onBytes) {
  const cache = await caches.open(CACHE).catch(() => null);
  let res = await caches.match(f.url).catch(() => null);
  if (res) {
    const blob = await res.blob();
    if (cache && !(await cache.match(f.url))) await cache.put(f.url, new Response(blob)).catch(() => {});
    onBytes(blob.size);
    return blob;
  }
  const net = await fetch(f.url, { mode: "cors" });
  if (!net.ok) throw new Error(`${f.name}: HTTP ${net.status}`);
  const reader = net.body.getReader(), chunks = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    onBytes(value.length);
  }
  const blob = new Blob(chunks);
  await cache?.put(f.url, new Response(blob, { headers: { "Content-Type": "application/octet-stream" } }))
    .catch(() => { /* quota: works this session, downloads again next time */ });
  return blob;
}

async function load(post) {
  const total = FILES.reduce((s, f) => s + f.size, 0);
  let got = 0;
  const onBytes = (n) => { got += n; post({ progress: Math.min(1, got / total) }); };
  const [mod, glue, wasm, segFile, clsFile] = await Promise.all(FILES.map((f) => getFile(f, onBytes)));
  const js = async (b) => URL.createObjectURL(new Blob([await b.arrayBuffer()], { type: "text/javascript" }));
  ort = await import(await js(mod));
  // Blob URLs have no base: give the runtime the URLs of both the WebAssembly binary and its JS glue.
  ort.env.wasm.wasmPaths = { mjs: await js(glue), wasm: URL.createObjectURL(wasm) };
  ort.env.wasm.numThreads = 1; // GitHub Pages is not cross-origin isolated: no SharedArrayBuffer
  const opts = { executionProviders: ["wasm"], graphOptimizationLevel: "all" };
  seg = await ort.InferenceSession.create(new Uint8Array(await segFile.arrayBuffer()), opts);
  cls = await ort.InferenceSession.create(new Uint8Array(await clsFile.arrayBuffer()), opts);
}

async function isCached() {
  const cache = await caches.open(CACHE).catch(() => null);
  if (!cache) return false;
  for (const f of FILES) if (!(await cache.match(f.url))) return false;
  return true;
}

// PIL's Image.resize(BILINEAR) of one axis: triangle filter widened by the reduction factor (antialiased).
function pilWeights(n, m) {
  const scale = n / m, support = Math.max(scale, 1), out = [];
  for (let i = 0; i < m; i++) {
    const c = (i + 0.5) * scale;
    const lo = Math.max(0, Math.floor(c - support + 0.5)), hi = Math.min(n, Math.floor(c + support + 0.5));
    const list = [];
    let sum = 0;
    for (let k = lo; k < hi; k++) {
      const w = Math.max(0, 1 - Math.abs((k - c + 0.5) / support));
      list.push(k, w); sum += w;
    }
    for (let k = 1; k < list.length; k += 2) list[k] /= sum;
    out.push(list);
  }
  return out;
}

function resizePil(src, W, H, w, h) {
  const wx = pilWeights(W, w), wy = pilWeights(H, h);
  const tmp = new Float32Array(w * H), out = new Float32Array(w * h);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < w; x++) {
      const l = wx[x]; let s = 0;
      for (let k = 0; k < l.length; k += 2) s += src[y * W + l[k]] * l[k + 1];
      tmp[y * w + x] = Math.min(255, Math.max(0, Math.round(s))); // PIL works on 8-bit images
    }
  }
  for (let y = 0; y < h; y++) {
    const l = wy[y];
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let k = 0; k < l.length; k += 2) s += tmp[l[k] * w + x] * l[k + 1];
      out[y * w + x] = Math.min(255, Math.max(0, Math.round(s)));
    }
  }
  return out;
}

// Grey S×S image -> 1×3×S×S ImageNet-normalised tensor (grey replicated, as Deep-Motility does).
function toTensor(g, S) {
  const n = S * S, px = new Float32Array(3 * n);
  for (let c = 0; c < 3; c++) for (let i = 0; i < n; i++) px[c * n + i] = (g[i] / 255 - MEAN[c]) / STD[c];
  return new ort.Tensor("float32", px, [1, 3, S, S]);
}

// Bilinear upsampling (align_corners = false) of S×S logits to w×h, thresholded at 0.
function upsampleMask(low, S, w, h) {
  const m = new Uint8Array(w * h), fx = S / w, fy = S / h;
  const xs0 = new Int32Array(w), xs1 = new Int32Array(w), xw = new Float32Array(w);
  for (let x = 0; x < w; x++) {
    const sx = Math.min(S - 1, Math.max(0, (x + 0.5) * fx - 0.5));
    xs0[x] = Math.floor(sx); xs1[x] = Math.min(S - 1, xs0[x] + 1); xw[x] = sx - xs0[x];
  }
  for (let y = 0; y < h; y++) {
    const sy = Math.min(S - 1, Math.max(0, (y + 0.5) * fy - 0.5));
    const y0 = Math.floor(sy), y1 = Math.min(S - 1, y0 + 1), wy = sy - y0, r0 = y0 * S, r1 = y1 * S;
    for (let x = 0; x < w; x++) {
      const a = low[r0 + xs0[x]] + (low[r0 + xs1[x]] - low[r0 + xs0[x]]) * xw[x];
      const b = low[r1 + xs0[x]] + (low[r1 + xs1[x]] - low[r1 + xs0[x]]) * xw[x];
      m[y * w + x] = a + (b - a) * wy > 0 ? 1 : 0;
    }
  }
  return m;
}

// Biggest 4-connected particle with its holes filled, like the Java MotilityJ (Analyze Particles + keepBiggestROI).
function biggestFilled(m, w, h) {
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
  let best = 1;
  for (let k = 2; k <= n; k++) if (areas[k] > areas[best]) best = k;
  // Background not 4-connected to the border becomes foreground.
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

// Plate circle as in js/analysis (ring search on the ~256 px image), in input pixels.
function plateOf(gray, W, H) {
  const sc = WORK / Math.max(W, H), w = Math.round(W * sc), h = Math.round(H * sc);
  const p = findPlate(resizeArea(gray, W, H, w, h), w, h), sx = W / w, sy = H / h;
  return { cx: (p.cx + 0.5) * sx - 0.5, cy: (p.cy + 0.5) * sy - 0.5, r: p.r * (sx + sy) / 2 };
}

const MASK_SIDE = 1024; // long side of the frame the mask is traced in

async function analyse(rgba, W, H, wantPlate, progress) {
  const gray = rgbaToGray(rgba, W * H);
  progress(0.1, "segmentation");
  let t0 = performance.now();
  const segOut = await seg.run({ input: toTensor(resizePil(gray, W, H, SEG.side, SEG.side), SEG.side) });
  const segMs = performance.now() - t0;
  progress(0.6, "classification");
  t0 = performance.now();
  const clsOut = await cls.run({ input: toTensor(resizePil(gray, W, H, CLS.side, CLS.side), CLS.side) });
  const clsMs = performance.now() - t0;
  const [l0, l1] = clsOut.logits.data;
  const pComplete = 1 / (1 + Math.exp(l1 - l0)); // softmax, class 0 = complete
  progress(0.85, "outline");
  const k = Math.min(1, MASK_SIDE / Math.max(W, H)), w = Math.round(W * k), h = Math.round(H * k);
  const mask = biggestFilled(upsampleMask(segOut.logits.data, SEG.side, w, h), w, h);
  const contour = mask ? traceContour(mask, w, h).map(([x, y]) => [(x + 0.5) * W / w - 0.5, (y + 0.5) * H / h - 0.5]) : [];
  return { contour, pComplete, plate: wantPlate ? plateOf(gray, W, H) : null, ms: { seg: segMs, cls: clsMs }, frame: W / w };
}

self.onmessage = async (e) => {
  const { id, type } = e.data;
  const post = (msg) => self.postMessage({ id, ...msg });
  try {
    if (type === "cached") return post({ result: await isCached() });
    if (type === "load") {
      await (loading ??= load(post).catch((err) => { loading = null; throw err; }));
      return post({ result: true });
    }
    if (type === "analyse") {
      await (loading ??= load(() => {}).catch((err) => { loading = null; throw err; }));
      const { buffer, width, height, plate } = e.data;
      const result = await analyse(new Uint8ClampedArray(buffer), width, height, plate,
        (fraction, label) => post({ progress: [fraction, label] }));
      return post({ result });
    }
    if (type === "clear") {
      seg = cls = null; loading = null;
      return post({ result: await caches.delete(CACHE) });
    }
    throw new Error(`unknown message ${type}`);
  } catch (err) {
    post({ error: String(err?.message || err) });
  }
};

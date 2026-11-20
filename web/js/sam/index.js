// Interactive Segment Anything (SlimSAM-77) for the review page. Optional refinement tool: the
// automatic analyzer (js/analysis/) stays the default. Everything heavy runs in worker.js.
//
// modelInfo() -> Promise<{backend, bytes, cached}>  "webgpu" if available, else "wasm"; download size;
//                                               whether the runtime and weights are in the Cache API
// loadModel(onProgress(fraction)) -> Promise<backend>  download on first use, then from the cache
// prepare(key, blob) -> Promise<{ms, backend}> encodes the image once (ms = 0 if it was cached)
// segment(key, {box, points}) -> Promise<{contour, score, ms}>
//   box: [x0, y0, x1, y1] | null, points: [[x, y, positive]], contour: [[x, y]], all in stored-image
//   pixels (pixel-centre coordinates, like the analysis contour). Runs only the decoder.
import { simplify } from "../geometry.js";
import { SIDE } from "./files.js";

let worker = null, nextId = 0;
const pending = new Map();
const frames = new Map(); // key -> { sx, sy } stored-image -> model-frame scale of each encoded image

function call(type, data = {}, transfer = [], onProgress = null) {
  if (!worker) {
    worker = new Worker(new URL("./worker.js", import.meta.url), { type: "module" });
    worker.onmessage = (e) => {
      const { id, progress, result, error } = e.data;
      const p = pending.get(id);
      if (!p) return;
      if (progress != null) return p.onProgress?.(progress);
      pending.delete(id);
      error ? p.reject(new Error(error)) : p.resolve(result);
    };
    worker.onerror = (e) => {
      for (const p of pending.values()) p.reject(new Error(e.message || "SAM worker failed"));
      pending.clear();
      worker = null;
      frames.clear();
    };
  }
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject, onProgress });
    worker.postMessage({ id, type, ...data }, transfer);
  });
}

export const samSupported = () => typeof Worker === "function" && typeof WebAssembly === "object" && "caches" in self;
// backend: optional "wasm" | "webgpu" to force one (dev pages); the first call decides.
export const modelInfo = (backend) => call("info", { backend });
export const loadModel = (onProgress, backend) => call("load", { backend }, [], onProgress);

export async function prepare(key, blob) {
  if (frames.has(key) && (await call("has", { key }))) return { ms: 0, backend: frames.get(key).backend };
  const bmp = await createImageBitmap(blob, { imageOrientation: "from-image" });
  const W = bmp.width, H = bmp.height, k = SIDE / Math.max(W, H);
  const w = Math.round(W * k), h = Math.round(H * k);
  const c = new OffscreenCanvas(w, h), ctx = c.getContext("2d", { willReadFrequently: true });
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close?.();
  const { buffer } = ctx.getImageData(0, 0, w, h).data;
  const r = await call("encode", { key, buffer, w, h, s: k }, [buffer]);
  frames.set(key, { sx: w / W, sy: h / H, backend: r.backend });
  return r;
}

export async function segment(key, { box = null, points = [] }) {
  const f = frames.get(key);
  if (!f) throw new Error("image not prepared");
  // Pixel-centre coordinates in the stored image -> pixel-centre coordinates in the model frame.
  const to = ([x, y]) => [(x + 0.5) * f.sx - 0.5, (y + 0.5) * f.sy - 0.5];
  const prompt = points.map(([x, y, pos]) => [...to([x, y]), pos ? 1 : 0]);
  if (box) {
    const [x0, y0] = to([Math.min(box[0], box[2]), Math.min(box[1], box[3])]);
    const [x1, y1] = to([Math.max(box[0], box[2]), Math.max(box[1], box[3])]);
    prompt.push([x0, y0, 2], [x1, y1, 3]);
  }
  if (!prompt.length) return { contour: [], score: 0, ms: 0 };
  const r = await call("decode", { key, points: prompt });
  const back = r.contour.map(([x, y]) => [(x + 0.5) / f.sx - 0.5, (y + 0.5) / f.sy - 0.5]);
  return { contour: back.length >= 3 ? simplify(back, 0.6 / f.sx) : [], score: r.score, ms: r.ms };
}

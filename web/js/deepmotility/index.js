// Optional Deep-Motility analyzer: students distilled from the original MotilityJ deep models (HRNet
// segmentation + ResNet50 complete/incomplete classifier), run with onnxruntime-web in worker.js.
// The models are downloaded on first use (TOTAL_BYTES) and kept in the Cache API; see README.md.
//
// dmSupported() -> boolean
// isModelCached() -> Promise<boolean>
// loadModel(onProgress(fraction)) -> Promise           download (or read from the cache) and start the runtime
// removeModel() -> Promise                             delete the downloaded files
// analyzeImageDM(imageData, {plate, onProgress}) -> Promise<Result>
//   Same Result as js/analysis/index.js (klass, confidence, plate, contour, areaPx, growthContour), plus
//   analyzer: "deepmotility" and ms: {seg, cls}. plate: keep this circle (e.g. the one on the review page)
//   instead of detecting it. The contour is the biggest segmented region, holes filled (like the Java app).
import { polygonArea, simplify } from "../geometry.js";
import { TOTAL_BYTES } from "./files.js";

export { TOTAL_BYTES };

let worker = null, nextId = 0;
const pending = new Map();

function call(type, data = {}, transfer = [], onProgress = null) {
  if (!worker) {
    worker = new Worker(new URL("./worker.js", import.meta.url), { type: "module" });
    worker.onmessage = (e) => {
      const { id, progress, result, error } = e.data;
      const p = pending.get(id);
      if (!p) return;
      if (progress != null) return p.onProgress?.(...(Array.isArray(progress) ? progress : [progress]));
      pending.delete(id);
      error ? p.reject(new Error(error)) : p.resolve(result);
    };
    worker.onerror = (e) => {
      for (const p of pending.values()) p.reject(new Error(e.message || "Deep-Motility worker failed"));
      pending.clear();
      worker = null;
    };
  }
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject, onProgress });
    worker.postMessage({ id, type, ...data }, transfer);
  });
}

export const dmSupported = () => typeof Worker === "function" && typeof WebAssembly === "object" && "caches" in self;
export const isModelCached = () => (dmSupported() ? call("cached").catch(() => false) : Promise.resolve(false));
export const loadModel = (onProgress) => call("load", {}, [], onProgress);
export const removeModel = () => call("clear");

export async function analyzeImageDM(imageData, { plate = null, onProgress } = {}) {
  const { width: W, height: H } = imageData;
  const buffer = imageData.data.slice().buffer; // copy: the caller keeps its ImageData
  const r = await call("analyse", { buffer, width: W, height: H, plate: !plate }, [buffer], onProgress);
  const p = plate || r.plate;
  // Drop the staircase of the traced mask (0.6 px of the tracing frame), like the SAM tool.
  const outline = r.contour.length >= 3 ? simplify(r.contour, 0.6 * r.frame) : [];
  const klass = r.pComplete >= 0.5 ? "complete" : "incomplete";
  return {
    klass,
    confidence: klass === "complete" ? r.pComplete : 1 - r.pComplete,
    plate: p,
    contour: klass === "complete" ? [] : outline,
    areaPx: klass === "complete" ? Math.PI * p.r * p.r : polygonArea(outline),
    growthContour: outline,
    analyzer: "deepmotility",
    ms: r.ms,
  };
}

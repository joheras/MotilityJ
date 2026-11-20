// Contract between the UI and the image-analysis module.
// The UI only imports analyzeImage() from this file; everything else in js/analysis/ is private.
//
// analyzeImage(imageData, options) -> Promise<Result>
//   imageData: ImageData (RGBA, any size; the module downsamples internally as needed)
//   options:   { onProgress?: (fraction 0..1, label) => void }
//
// Result = {
//   klass: "complete" | "incomplete",   // complete = growth covers the whole plate
//   confidence: number,                 // 0..1
//   plate: { cx, cy, r } | null,        // detected Petri dish, in input-image pixels
//   contour: [[x, y], ...],             // growth region outline in input-image pixels ([] when complete)
//   areaPx: number,                     // area of the growth region in px² (plate area when complete)
// }
//
// Area in mm² is computed by the UI: mmPerPx = plateDiameterMm / (2 * plate.r) (default 90 mm),
// complete -> π (plateDiameterMm/2)², incomplete -> areaPx * mmPerPx².
// The user can always override klass and redraw the contour by hand.

// Implementation: the pipeline lives in core.js (pure JS) and runs in a module Web Worker (worker.js);
// model weights are in models.json. See README.md for the method and its measured accuracy.
// Extra field: growthContour is the segmented outline even when klass is "complete" (for UI overrides).

let worker = null, nextId = 0;
const pending = new Map();

function getWorker() {
  if (worker) return worker;
  worker = new Worker(new URL("./worker.js", import.meta.url), { type: "module" });
  worker.onmessage = (e) => {
    const { id, progress, result, error } = e.data;
    const p = pending.get(id);
    if (!p) return;
    if (progress) return p.onProgress?.(...progress);
    pending.delete(id);
    error ? p.reject(new Error(error)) : p.resolve(result);
  };
  worker.onerror = (e) => {
    for (const p of pending.values()) p.reject(new Error(e.message || "analysis worker failed"));
    pending.clear();
    worker = null;
  };
  return worker;
}

// Fallback when module workers are unavailable: same code on the main thread.
async function analyzeHere(imageData, options) {
  const [{ analyzeGray, rgbaToGray }, models] = await Promise.all([
    import("./core.js"),
    fetch(new URL("./models.json", import.meta.url)).then((r) => r.json()),
  ]);
  const { width, height, data } = imageData;
  return analyzeGray(rgbaToGray(data, width * height), width, height, models, options.onProgress);
}

export async function analyzeImage(imageData, options = {}) {
  let w;
  try { w = getWorker(); } catch { return analyzeHere(imageData, options); }
  const id = nextId++;
  const buffer = imageData.data.slice().buffer; // copy: the caller keeps its ImageData
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject, onProgress: options.onProgress });
    w.postMessage({ id, width: imageData.width, height: imageData.height, buffer }, [buffer]);
  });
}

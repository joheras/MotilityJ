// Module worker: runs the whole analysis off the main thread (see index.js for the contract).
import { analyzeGray, rgbaToGray } from "./core.js";

let modelsPromise = null;
const loadModels = () => (modelsPromise ??= fetch(new URL("./models.json", import.meta.url)).then((r) => {
  if (!r.ok) throw new Error(`models.json: HTTP ${r.status}`);
  return r.json();
}));

self.onmessage = async (e) => {
  const { id, width, height, buffer } = e.data;
  try {
    const models = await loadModels();
    const gray = rgbaToGray(new Uint8ClampedArray(buffer), width * height);
    const result = analyzeGray(gray, width, height, models, (fraction, label) => self.postMessage({ id, progress: [fraction, label] }));
    self.postMessage({ id, result });
  } catch (err) {
    self.postMessage({ id, error: String(err?.stack || err) });
  }
};

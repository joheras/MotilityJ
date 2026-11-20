// What the Deep-Motility tool downloads on first use (not precached by sw.js), pinned to exact versions.
// Sizes are the uncompressed bytes, used for the progress bar and the size shown to the user.
// Cache API storage. Not "motilityj-…": sw.js deletes those caches when the app updates.
export const CACHE = "deepmotility-v1";

// Same onnxruntime-web build as the SAM tool (js/sam/files.js); if SAM already downloaded it, it is reused.
const ORT = "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0/dist/";
const model = (name) => new URL(`../../models/${name}`, import.meta.url).href;

export const SEG = { name: "dm-seg-v1.onnx", url: model("dm-seg-v1.onnx"), size: 9177533, side: 512 };
export const CLS = { name: "dm-cls-v1.onnx", url: model("dm-cls-v1.onnx"), size: 6457817, side: 384 };

export const FILES = [
  { name: "ort.wasm.min.mjs", url: `${ORT}ort.wasm.min.mjs`, size: 48259 },
  { name: "ort-wasm-simd-threaded.mjs", url: `${ORT}ort-wasm-simd-threaded.mjs`, size: 20856 },
  { name: "ort-wasm-simd-threaded.wasm", url: `${ORT}ort-wasm-simd-threaded.wasm`, size: 11210254 },
  SEG,
  CLS,
];

export const TOTAL_BYTES = FILES.reduce((s, f) => s + f.size, 0);

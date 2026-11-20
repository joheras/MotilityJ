// What the SAM tool downloads on first use (not precached by sw.js), pinned to exact versions.
// Sizes are the uncompressed bytes, used for the progress bar and the size shown to the user.
export const SIDE = 1024; // model input: long side resized to 1024, padded bottom/right to 1024²
// Cache API storage. Not "motilityj-…": sw.js deletes those caches when the app updates.
export const CACHE = "sam-slimsam77-v1";

const ORT = "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0/dist/";
const HF = "https://huggingface.co/Xenova/slimsam-77-uniform/resolve/5850ab45f587c112167512ffef949107115e26a0/onnx/";

const DECODER = {
  // Xenova's prompt_encoder_mask_decoder_quantized.onnx with the box-corner embeddings restored
  // (tools/patch_decoder.py); served from this site. Runs on the CPU (WebAssembly) in both backends.
  name: "decoder", url: new URL("./slimsam-77-decoder-box-q8.onnx", import.meta.url).href, size: 4906866,
};

// Each backend: [runtime module, its Emscripten glue, its WebAssembly, image encoder, decoder].
export const BACKENDS = {
  // Default: CPU, one thread (GitHub Pages is not cross-origin isolated: no SharedArrayBuffer).
  wasm: [
    { name: "runtime", url: `${ORT}ort.wasm.min.mjs`, size: 48259 },
    { name: "glue", url: `${ORT}ort-wasm-simd-threaded.mjs`, size: 20856 },
    { name: "wasm", url: `${ORT}ort-wasm-simd-threaded.wasm`, size: 11210254 },
    { name: "encoder", url: `${HF}vision_encoder_quantized.onnx`, size: 8882165 },
    DECODER,
  ],
  // When the browser has WebGPU with 16-bit float shaders: the encoder runs on the GPU, ~10× faster.
  webgpu: [
    { name: "runtime", url: `${ORT}ort.webgpu.min.mjs`, size: 357582 },
    { name: "glue", url: `${ORT}ort-wasm-simd-threaded.jsep.mjs`, size: 44677 },
    { name: "wasm", url: `${ORT}ort-wasm-simd-threaded.jsep.wasm`, size: 21872216 },
    { name: "encoder", url: `${HF}vision_encoder_fp16.onnx`, size: 12170657 },
    DECODER,
  ],
};

export const totalBytes = (backend) => BACKENDS[backend].reduce((s, f) => s + f.size, 0);

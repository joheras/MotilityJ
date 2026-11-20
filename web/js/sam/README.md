# Interactive Segment Anything (`web/js/sam/`)

Optional refinement tool on the review page (**✦ AI outline**). The automatic analyzer in `js/analysis/` stays the
default. When its outline is wrong, the user drags a box around the growth or taps points on it (Include / Exclude;
<kbd>Alt</kbd>/<kbd>Shift</kbd>+click excludes too). SAM turns the prompts into a mask. The mask's largest component
(the one under a positive point, if there is one) has its holes filled and becomes the editable contour. Each prompt
is one undo step; the step also restores the prompts.

| File | Role |
|---|---|
| `index.js` | Main-thread API: `modelInfo`, `loadModel`, `prepare(key, blob)`, `segment(key, {box, points})`. Maps coordinates (see below). Imported lazily by `pages/review.js` only when the tool is opened. |
| `worker.js` | Module worker. Downloads and caches the runtime and the model, runs the encoder once per image, runs the decoder per prompt, and post-processes the mask (upsampling, largest component, hole filling, `traceContour` from `analysis/core.js`). |
| `files.js` | Pinned URLs and sizes of everything downloaded on first use. |
| `slimsam-77-decoder-box-q8.onnx` | Prompt encoder + mask decoder, 4.9 MB, int8. Patched (see below). Excluded from the service-worker precache. |
| `tools/patch_decoder.py` | Reproduces the patched decoder from the public export. |
| `eval.html` | Dev page (not linked from the app). Compares SAM prompts with the automatic analyzer on the test set. |

## Model choice: SlimSAM-77 (uniform), int8

[SlimSAM-77](https://github.com/czg1225/SlimSAM) is SAM ViT-B pruned to 23 % of its parameters (and distilled back).
The [Xenova/slimsam-77-uniform](https://huggingface.co/Xenova/slimsam-77-uniform) ONNX export was used, pinned to
commit `5850ab45`. It is the smallest public SAM conversion: the int8 encoder is 8.9 MB and the decoder 4.9 MB.

Candidates measured with the GT-box prompt on the same 32 test images (Python onnxruntime, CPU):

| Model | Download | Box mIoU |
|---|---|---|
| **SlimSAM-77 int8** (chosen) | 8.9 + 4.9 MB | 0.814 |
| EfficientSAM-Ti fp32 | 24.8 + 16.6 MB | 0.837 |

The 0.02 IoU gain of EfficientSAM-Ti does not justify a 3× larger download. MobileSAM (28 + 16 MB fp32) and
SAM 2.1-tiny (≥ 28 MB for the encoder alone) are larger still.

### The decoder had to be patched (box prompts)

Xenova's export was traced from transformers' `SamPromptEncoder`. That version adds only the type embeddings of
labels 0 (negative) and 1 (positive). The box-corner embeddings (labels 2 = top-left, 3 = bottom-right) were
pruned from the graph, so a box given as two labelled points behaves like two untyped points. On 8 images, box
mIoU was 0.32 with the unpatched decoder and 0.83 with the patched one.

`tools/patch_decoder.py` fetches the two 256-float vectors `prompt_encoder.point_embed.{2,3}` from the original
weights ([nielsr/slimsam-77-uniform](https://huggingface.co/nielsr/slimsam-77-uniform), commit `72a5ae6c`, 2 KB via
HTTP range requests). It then inserts `pe = where(label == k, pe + embed[k], pe)` for k = 2, 3 after the existing
label == 1 branch. Nothing else in the graph changes.

The patched file is served from this site (same origin, so no CORS question). GitHub release assets cannot be
used because they are served without CORS headers. Licence: SAM and SlimSAM are Apache-2.0.

```
pip install onnx numpy
python3 tools/patch_decoder.py prompt_encoder_mask_decoder_quantized.onnx slimsam-77-decoder-box-q8.onnx
```

## Runtime and download (lazy, cached, not precached)

[onnxruntime-web](https://www.npmjs.com/package/onnxruntime-web) **1.22.0** is loaded from jsDelivr. Nothing is
fetched until the user opens the tool. The first time, a dialog shows the size, and the download has a progress
bar. All files are then kept in the Cache API (`sam-slimsam77-v1`). That cache is separate from the app's
`motilityj-*` caches, which `sw.js` deletes on updates. Later uses, including offline use, read the files from
the cache. The runtime module and its Emscripten glue are imported from `blob:` URLs, so the cached copies are
used. The `.onnx` suffix is excluded from `tools/build_sw.py`, so the model never enters the app precache. The
app precache grows only by the ~25 KB of JavaScript in this folder.

| Backend | When | Files | Total (uncompressed) |
|---|---|---|---|
| `wasm` | default | `ort.wasm.min.mjs`, glue, `ort-wasm-simd-threaded.wasm` (11.2 MB, 1.8 MB brotli on the wire), int8 encoder, decoder | **25.1 MB** (≈ 15.6 MB transferred) |
| `webgpu` | WebGPU adapter with `shader-f16` | `ort.webgpu.min.mjs`, glue, `…jsep.wasm` (21.9 MB, 4.2 MB brotli), **fp16** encoder (12.2 MB), decoder | 39.4 MB (≈ 21.7 MB transferred) |

WebAssembly runs with one thread. Threads need `SharedArrayBuffer`, which needs cross-origin isolation, and GitHub
Pages cannot send COOP/COEP headers. The decoder always runs on the CPU, because WebGPU dispatch overhead would
outweigh its ~4 M parameters.

The fp16 encoder's shaders need `shader-f16`; without it they fail to compile. These WebGPU errors do not always
reach ORT, and the embeddings then come out as garbage. For that reason the GPU path is chosen only when the
adapter has the feature, and the worker also checks that the embeddings are finite and non-constant. If they are
not, it switches to the `wasm` backend. This fallback was tested by forcing `webgpu` on a GPU without
`shader-f16`.

## Coordinates

- **Stored image (W × H, ≤ 2000 px).** The canvas resizes it to `w × h`, with `w = round(W·1024/max(W,H))` and
  `h` likewise. It is normalized with the ImageNet mean/std and padded bottom/right to 1024 × 1024. This matches
  transformers' `SamProcessor` (`longest_edge` 1024, `pad_size` 1024).
- **Prompts.** Prompts are in pixel-centre coordinates, the same convention as the analysis contour and the SVG
  overlay. They map to the model frame as `x' = (x + 0.5)·w/W − 0.5`, and likewise for y. A box becomes two points
  with labels 2 and 3. The overlay's `getScreenCTM()` already gives stored-image pixels at any zoom/pan, for both
  mouse and touch.
- **Mask.** The 256 × 256 logits of the padded frame are upsampled bilinearly (align-corners false, as in SAM)
  straight into the unpadded `w × h` region and thresholded at 0. The traced outline (pixel-edge midpoints) is
  mapped back with `x = (x' + 0.5)·W/w − 0.5`. It is then simplified with Douglas–Peucker at ε = 0.6 model pixels.
- **Mask choice.** The export returns 3 masks. For a box, the first one is used; on the 32-image check it matched
  the best-scored mask (0.813 vs 0.814). For points only, the mask with the highest predicted IoU is used.

Gestures in SAM mode: a tap or click adds a point. A drag longer than 8 screen px draws a box, and a new box starts
a new selection. Two fingers still pinch-zoom. <kbd>Esc</kbd> / **Clear prompts** forget the prompts without
changing the outline.

## Measured accuracy (`eval.html`, Chromium, JS code path of the app)

There are 30 images from `Segmentation/dataset/Labels/test`: every 10th file in name order, all incomplete,
with growth from 0.2 % to 93 % of the plate. The prompts come from the ground truth:

- **box** is the bounding box of the GT mask;
- **point** is the GT pixel nearest to the GT centroid;
- **box+pt** uses both.

IoU is computed at label resolution with the contour rasterized, the same way as in `analysis/eval.html`.

| Method | mIoU | median IoU | images with IoU < 0.5 |
|---|---|---|---|
| automatic analyzer (same 30 images) | 0.820 | 0.893 | 1 |
| automatic analyzer (all 313 test images, from `analysis/README.md`) | **0.863** | 0.912 | — |
| **SAM, box prompt** | **0.839** | 0.839 | 0 |
| SAM, single centre point | 0.449 | 0.409 | 16 |
| SAM, box + centre point | 0.815 | 0.834 | 0 |
| best of (automatic, SAM box) per image | **0.903** | — | 0 |

Reading:

- **A box is the prompt to use.** On this subset its mIoU is slightly above the automatic method, and it never
  fails badly. It helps most where the analyzer fails: tiny colonies and faint halos. For example, G215b goes from
  0.13 to 0.92, G157b from 0.56 to 0.90, and PA14-C from 0.52 to 0.84.
- **The analyzer is better on large, well-contrasted growth** (e.g. G179c 0.98 vs 0.76 with SAM). There the SAM
  outline tends to follow the inner, denser ring. This is why SAM is a refinement tool and not the default.
  Keeping the better of the two outlines per image gives 0.903.
- **A single point is ambiguous.** On a motility plate, a point at the centre can mean the inoculation spot, the
  dense core or the whole halo. SAM often picks the spot, so a lone point is a poor prompt for large growth. It
  works well on small colonies (≥ 0.85 on most of the < 2 % ones). Adding include/exclude points to a box is for
  local corrections. With a centroid point the mean does not improve (0.815), but in interactive use the user
  places the points where the outline is wrong.

Python (onnxruntime CPU, same model) gives the same picture on 32 images: box 0.814, point 0.48–0.51. With the
fp16 encoder (the WebGPU variant, run on the CPU), box is 0.844 on 8 images vs 0.827 for int8.

## Speed

Desktop: Intel Core Ultra 7 265H, Chrome 151/152, Linux.

| Step | WebAssembly (1 thread) | WebGPU (NVIDIA, Blackwell) |
|---|---|---|
| model load from cache (session creation) | ~1–2 s | ~1–2 s |
| **encoder, once per image** | **8.5 s** median (headless Chrome); 16–23 s in an embedded, throttled Chromium view | 1.3 s with the fp32 encoder; fp16 ~0.9 s in a bench. This GPU lacks `shader-f16`, so that bench is not valid and the fp16 path is not measured end to end. |
| **decoder, per prompt** | **0.17 s** median (0.1–0.4 s), including mask post-processing | same, since it runs on the CPU |

The int8 and fp32 encoders run at the same speed on WebAssembly. The int8 encoder on WebGPU is slower (3.4 s),
because the int8 ops fall back to the CPU.

**Phones (estimate, not measured).** Single-thread WASM on a recent mid/high-end phone is typically 2–4× slower
than this desktop. That puts the encoder at ~20–35 s once per image, with each prompt at ~0.3–0.8 s. Phones whose browser
offers WebGPU with `shader-f16` should prepare an image in a few seconds. The model takes 25–40 MB of storage;
memory use while it runs was not measured. Embeddings are cached in memory for the
last two images, so returning to an image is instant.

## Reproducing the evaluation

```
mkdir serve && cd serve
ln -s /path/to/Motilidad data; ln -s /path/to/repo/web web
python3 -m http.server 8771
# open http://127.0.0.1:8771/web/js/sam/eval.html?data=/data/&n=30&step=10   (&backend=wasm|webgpu)
```

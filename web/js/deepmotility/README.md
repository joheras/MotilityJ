# Deep-Motility in the browser (`web/js/deepmotility/`)

This folder holds an optional, more accurate analyzer. It is built from the deep models of the original MotilityJ (the [Deep-Motility](https://github.com/joheras/Deep-Motility) package):
- an HRNet-W30 that segments the growth;
- a ResNet-50 that classifies a plate as complete or incomplete.

These models are too large for a web page (~104 MB each), so they were **distilled** into two MobileNetV3-Large students. The students run with onnxruntime-web (WASM) in a Web Worker.

The built-in analyzer (`js/analysis/`) stays the default. Deep-Motility is used in two places:
- **Review page → "Refine with Deep-Motility".** The model runs on the current image. Its outline is drawn as a dashed yellow proposal, with its complete/incomplete suggestion. The user can choose:
  - **Accept**: apply the outline and the class (undoable);
  - **Outline only**: apply the outline and keep the current class;
  - **Discard**.
- **Settings → Automatic analysis → Deep-Motility.** "Analyse" then uses it for whole experiments. This option is only available once the models are downloaded. If they are missing (e.g. the cache was cleared), the built-in analyzer runs instead and a notice is shown.

| File | Role |
|---|---|
| `index.js` | Public API: `isModelCached`, `loadModel(onProgress)`, `removeModel`, `analyzeImageDM(imageData, {plate, onProgress})`. The result follows the same contract as `js/analysis/index.js`, plus `analyzer` and `ms`. |
| `worker.js` | Module worker. It downloads the runtime and models into the Cache API, then runs preprocessing, the two networks and post-processing. |
| `files.js` | Download list: pinned onnxruntime-web 1.22.0 (the same build as the SAM tool, and reused if SAM already cached it) and the two models with their sizes. |
| `review-tool.js` | The review-page button, proposal overlay, Accept / Outline only / Discard, and the download confirmation. |
| `settings-section.js` | The settings card: default analyzer, model state, and Download / Remove. |
| `analyzer.js` | The hook used by `js/analyze.js` when Deep-Motility is the default analyzer. |
| `strings.js` | UI and Help strings. They are merged into `js/i18n.js`. |
| `eval.html` | Dev page, not linked from the app. It evaluates the pipeline on the datasets and benchmarks ONNX files in WASM. |
| `tools/*.py` | Teacher evaluation, eager HRNet rebuild, distillation, ONNX export and quantization, and ONNX evaluation (see the end of this file). |

Models (`web/models/`, ~15.6 MB) are **not precached**: `tools/build_sw.py` skips `models/`. They are fetched on first use from GitHub Pages (same origin), with progress shown. The runtime (11.3 MB) comes from jsdelivr. Everything is kept in the `deepmotility-v1` Cache API store, so it then works offline.

## The original models (teachers)

The models come from the Dropbox folder linked in the MotilityJ README: `HRNet Seg.pth` and `resnet50Motility.pth`. They are TorchScript files saved with PyTorch 1.7. The inference preprocessing of `deep_motility/predict_seg.py` and `predict_clas.py` is reproduced exactly:
- grey images are replicated to RGB;
- the image is resized to a square with PIL bilinear: **1002×1002** for segmentation, **512×512** for classification;
- `ToTensor` and ImageNet mean/std normalisation are applied;
- the output is the argmax. Segmentation class 1 = growth; classification class 0 = complete.

The Java app then keeps the biggest particle (`keepBiggestROI`). The browser does the same, with holes filled.

- **HRNet** = SemTorch `hrnet_w30` + a 1×1 head with 2 classes, 26.0 M parameters.
  - Its TorchScript calls an `aten::__interpolate` overload that current exporters cannot freeze. `tools/teacher_eager.py` therefore re-implements the standard HRNet with the same module names and loads the scripted weights. The max |Δ| against the scripted model is < 1e-3.
  - It is very scale-sensitive. At its native 1002 px it gives test Dice 0.931. At 768 / 512 / 384 px it drops to 0.885 / 0.749 / 0.662. Simply running it smaller is not an option.
- **ResNet-50**, 25.6 M parameters. Valid accuracy is 0.996 at 512 px, 0.989 at 384 and 0.954 at 256.

## Students (distillation)

- **Segmentation**: a U-Net decoder (128/64/48/32 channels) on an ImageNet MobileNetV3-Large encoder, 4.6 M parameters, input 512×512.
  - Trained on all 1154 images of `Segmentation/Images/train`, of which 444 have a label.
  - Target = the teacher's P(growth), computed at its native 1002 px, mixed 50/50 with the ground truth where a label exists.
  - Loss = BCE + soft Dice. 60 epochs with flips / rot90 / contrast / gamma / inversion / resample jitter.
  - With the ground truth and the extra unlabelled images, the student **beats its teacher** on the test split.
- **Classification**: an ImageNet MobileNetV3-Large + a 256-unit head, 3.2 M parameters, input 384×384.
  - Trained on `Clasificacion/train` (2409 images). Loss = cross-entropy on the label + KL to the teacher's softmax at T = 2. 30 epochs.
  - A 512 px student reached 0.989, which is not worth 1.8× the compute.
- The test and valid splits were never used for training or model selection; the last epoch is kept.

The ONNX models use opset 17 (WASM and WebGPU compatible). Variants:
- fp32;
- fp16 (fp16 compute, `onnxconverter-common`);
- **fp16w**: fp16-stored weights + `Cast` to fp32, folded by onnxruntime at load. This halves the download with fp32 kernels and fp32 accuracy;
- dynamic INT8 (`quantize_dynamic`);
- static INT8 QDQ (per-channel, calibrated on 64 train images).

## Results

Segmentation is scored on the test split (313 images), at full label resolution, on the biggest region with holes filled. Classification is scored on the valid split (565 images). The metric columns come from onnxruntime CPU in Python (`tools/eval_onnx.py`).

Latency was measured with onnxruntime-web 1.22.0 WASM, 1 thread (GitHub Pages is not cross-origin isolated). The machine is a desktop-class laptop CPU in Chromium (`eval.html?bench=…`); the figure is the model run only. Mobile is an **estimate** (×3–5 for a mid-range phone, not measured on a device).

### Segmentation

| Model | Size (MB) | WASM desktop | Mobile (est.) | mIoU | Dice | Median area err. |
|---|---|---|---|---|---|---|
| Built-in JS analyzer (`js/analysis/`) | 0.2 | ~0.1 s (whole pipeline) | 0.5–0.8 s | 0.863 | 0.914 | 5.2 % |
| Teacher HRNet, PyTorch, 1002 px | 104 | — | — | 0.891 | 0.930 | 3.3 % |
| Teacher ONNX fp32 | 104.2 | (≈ fp16) | — | 0.891 | 0.930 | 3.4 % |
| Teacher ONNX fp16 | 52.4 | 8.0 s | 25–40 s | 0.891 | 0.930 | 3.4 % |
| Teacher ONNX INT8 (dynamic) | 27.1 | 5.6 s | 17–28 s | 0.831 | 0.875 | 4.9 % |
| Student fp32, 512 px | 18.3 | 0.31 s | 0.9–1.6 s | 0.918 | 0.949 | 2.3 % |
| Student fp16 | 9.2 | 0.35 s | 1.1–1.8 s | 0.918 | 0.949 | 2.3 % |
| **Student fp16w (shipped `dm-seg-v1.onnx`)** | **9.2** | **0.32 s** | **1.0–1.6 s** | **0.918** | **0.949** | **2.3 %** |
| Student INT8 dynamic | 4.8 | 0.27 s | 0.8–1.4 s | 0.906 | 0.941 | 2.6 % |
| Student INT8 static QDQ | 5.1 | 0.31 s | 0.9–1.5 s | 0.908 | 0.944 | 3.7 % |

The pooled-pixel Dice of the student (all test pixels together) is 0.962. The paper reports a Dice of 95.66 % for the original model, presumably aggregated in another way and on its own split. In the same per-image metric, the original HRNet scores 0.930 here.

### Classification

| Model | Size (MB) | WASM desktop | Mobile (est.) | Accuracy | F1 complete | F1 incomplete |
|---|---|---|---|---|---|---|
| Built-in JS analyzer | (incl. above) | — | — | 0.956 | 0.947 | 0.962 |
| Teacher ResNet-50, PyTorch / ONNX fp32, 512 px | 102.4 | (≈ fp16) | — | 0.996 | 0.996 | 0.997 |
| Teacher ONNX fp16 | 51.2 | 1.07 s | 3–5 s | 0.996 | 0.996 | 0.997 |
| Teacher ONNX INT8 (dynamic) | 25.8 | 0.71 s | 2–3.5 s | 0.986 | 0.982 | 0.988 |
| Student fp32, 384 px | 12.9 | 44 ms | 0.13–0.22 s | 0.988 | 0.985 | 0.990 |
| Student fp16 | 6.5 | 59 ms | 0.2–0.3 s | 0.988 | 0.985 | 0.990 |
| **Student fp16w (shipped `dm-cls-v1.onnx`)** | **6.5** | **43 ms** | **0.13–0.22 s** | **0.988** | **0.985** | **0.990** |
| Student INT8 dynamic | 3.4 | 58 ms | 0.2–0.3 s | 0.988 | 0.985 | 0.990 |
| Student INT8 static QDQ | 3.7 | 85 ms | 0.25–0.4 s | 0.991 | 0.989 | 0.993 |

### Choice

**fp16w students**: 9.2 + 6.5 = **15.6 MB** of models, within the ~20 MB budget for same-origin hosting, plus the 11.3 MB runtime from the CDN.
- They have exactly the fp32 accuracy and are the fastest in WASM.
- Compared with the built-in analyzer, they gain:
  - segmentation: +0.055 mIoU, +0.035 Dice, and the median area error drops from 5.2 % to 2.3 %;
  - classification: +3.2 points of accuracy.
- The INT8 variants would halve the download again (8.5 MB), at a cost of about −0.01 mIoU. They are the fallback if the size budget tightens.
- The original teachers cannot be shipped: ≥ 53 MB even in INT8, 5–8 s per image on a desktop, and INT8 loses 0.06 Dice.

### Measured in the browser (whole pipeline, `eval.html`)

- **Segmentation (test)**: mIoU **0.918**, Dice **0.949**, median relative area error **2.3 %**. 1 of 313 test images was classified complete.
  - mIoU by growth fraction:

    | Growth fraction | mIoU |
    |---|---|
    | < 2 % | 0.85 |
    | 2–10 % | 0.95 |
    | 10–30 % | 0.97 |
    | 30–60 % | 0.96 |
    | > 60 % | 0.90 |

  - Time: median **0.42 s** per image end to end, including decode → grey → resize, both networks, outline tracing and the worker round trip. Segmentation alone is 0.32 s and classification 0.05 s.
- **Classification (valid)**: accuracy **0.988**, F1 complete 0.985, F1 incomplete 0.990. Confusion: TP 227, TN 331, FP 6 (incomplete→complete), FN 1. Median time is 0.40 s per image end to end.
  - The errors are mostly incomplete plates with growth reaching the rim on most sides (G4a, G56a, G60b, G20a, G67c). The built-in analyzer also confuses these.

The JS port matches the Python numbers to the third decimal. The input resize reproduces PIL's antialiased bilinear filter on 8-bit grey (`resizePil` in `worker.js`).

## Known limitations

- **Failure cases.** The worst test images are the ones that also defeat the built-in analyzer and the teacher:
  - halo vs. core ambiguity (G97c-0.3, G226b-0.3, G93b-0.3, G215b-0.3);
  - PA7 b 0.5, where the biggest region is the wrong one.
- **Plate circle.** It still comes from the built-in ring search (`findPlate`). The networks do not predict it.
- **Threads.** Single-threaded WASM, because GitHub Pages cannot send COOP/COEP headers. WebGPU would be faster, but the `ort.wasm` build is used to share the runtime with the SAM tool.

## Reproducing

The datasets and the original models are not in the repository. Python needs torch, torchvision, Pillow, scipy, onnx, onnxruntime and onnxconverter-common.

```bash
M=/path/to/deep-motility-models   # HRNet Seg.pth, resnet50Motility.pth (Dropbox folder in the MotilityJ README)
D=/path/to/Motilidad; W=/path/to/work; O=/path/to/onnx; T=web/js/deepmotility/tools
python3 $T/eval_teacher.py $M $D $W --sizes 1002,768,512,384,256 --cls-sizes 512,384,256,224   # teacher metrics
python3 $T/export_teacher.py $M $O                                    # teacher ONNX fp32/fp16/int8
python3 $T/train_seg.py $M $D $W --size 512                           # ~40 min on a laptop GPU
python3 $T/train_cls.py $M $D $W --size 384                           # ~20 min
python3 $T/export_student.py $D $W $O                                 # student variants
python3 $T/eval_onnx.py $D --seg $O/seg512_fp16w.onnx:512 --cls $O/cls384_fp16w.onnx:384
cp $O/seg512_fp16w.onnx web/models/dm-seg-v1.onnx; cp $O/cls384_fp16w.onnx web/models/dm-cls-v1.onnx
```

When the models change:
1. Give them a new name (`dm-seg-v2.onnx`) and update the names and sizes in `files.js`.
2. Bump `CACHE` in `files.js`.

The browser evaluation works like `js/analysis/eval.html`: serve a folder that links `web/` and the dataset as `data/`, then open `/web/js/deepmotility/eval.html?data=/data/&auto=1`.

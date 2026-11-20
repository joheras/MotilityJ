# Image analysis (`web/js/analysis/`)

This folder holds the browser-only replacement for the two Deep-Motility PyTorch models used by the Java MotilityJ.
It is plain JavaScript: no build step, no WebAssembly, no OpenCV.js, no ONNX. Two small learned models are stored as JSON:
- a 27→32→16→1 per-pixel MLP (~1.5 k weights);
- 200 depth-limited decision trees.

| File | Role |
|---|---|
| `index.js` | Public contract `analyzeImage(imageData, {onProgress})`. A thin wrapper that posts the pixels to the worker. If module workers are unavailable, it runs the same code on the main thread. |
| `worker.js` | Module Web Worker. Loads `models.json` once and runs `core.analyzeGray`. |
| `core.js` | The whole pipeline (pure functions, no DOM). |
| `models.json` | Weights (segmentation MLP + complete/incomplete trees), 195 KB. |
| `eval.html` | Dev page, not linked from the app. Runs the pipeline on the datasets and prints metrics. |
| `tools/train.py` | Python reference of `core.js`; retrains and re-exports `models.json`. |

The result also carries a `growthContour` field. It holds the segmented outline even when `klass` is `"complete"`, so the UI can offer it if the user overrides the class.

## Method

1. **Grayscale and downsampling.** The image is converted with luma 0.299/0.587/0.114, then area-resampled so its long side is 256 px.
2. **Plate detection.** The dataset images are crops around the dish. The algorithm searches for the circle with the largest mean |radial gradient| along its rim, sampled at 128 angles.
   - Coarse search at 128 px: centre within ±5 % of the image middle, radius in [0.38, 0.53] × the short side.
   - Refinement at 256 px: ±2 px in cx, cy and r.
3. **Plate normalisation.** The plate is cropped bilinearly to a 128×128 image with centre at (64, 64) and diameter 128. This makes all later steps scale-free.
4. **Per-pixel features (27).** They are normalised by the plate's own statistics, so light/dark backgrounds and inverted contrast are handled:
   - `bg` = median of the annulus 0.75–0.9 r;
   - `sc` = 5–95 percentile range inside 0.92 r;
   - `cen` = median of the inoculation spot (< 0.05 r).

   | Feature group | Count |
   |---|---|
   | Gaussian blur at σ ∈ {1, 2, 4, 8, 16}: (b−bg)/sc, \|b−bg\|/sc, (b−cen)/sc | 15 |
   | Local std at σ ∈ {2, 4, 8} | 3 |
   | Gradient magnitude at σ ∈ {1, 2, 4} | 3 |
   | Normalised radius | 1 |
   | Plate-level constants: (cen−bg)/sc, (median−bg)/sc, bg/255, sc/255, std(annulus)/sc | 5 |
5. **Pixel classifier.** An MLP (32, 16), ReLU, trained with sklearn on 3000 random pixels from each of the 444 labelled training images, gives P(growth).
6. **Region selection.** This mirrors `keepBiggestROI` in the Java app, but anchored at the inoculation point.
   - Threshold at 0.5 inside 0.92 r.
   - Label the 4-connected components and fill holes in each one.
   - Keep the largest component that overlaps the central disc (< 0.1 r). If none does, keep the component nearest the centre.
   - Satellite colonies that do not touch the main region are excluded, like in the ground truth.
7. **Contour.** Crack-following of the mask, using the midpoints of pixel edges (the 0.5 iso-line). The result is mapped back to input-image pixels. `areaPx` is the polygon area (shoelace formula), so it equals what the UI measures on the same polygon.
8. **Complete vs incomplete.** 32 plate-level features from the crop, the probability map and the mask:
   - segmented fraction, fraction of P > 0.5, and mean P;
   - for 5 radial bins: mean P, mask coverage, median intensity offset, intensity std and edge density;
   - rim coverage over 16 angular sectors at 0.8–0.9 r.

   A sklearn `HistGradientBoostingClassifier` (200 trees, ≤ 15 leaves) outputs P(complete). `confidence` is the probability of the chosen class.
   - When the plate is classified complete: `contour = []` and `areaPx` = plate area.

The method was chosen by measurement. Classical alternatives were prototyped first:
- plate-background difference + Otsu + morphology + component nearest the centre;
- the same with texture terms and a threshold multiplier.

They reached only mIoU 0.63 on the test set (about 0.78 on train after tuning). They break when growth covers most of the plate, because the "background" annulus is then itself growth, and when the colony interior has the same grey level as the agar. Swapping the MLP for logistic regression on the same features gives 0.70; gradient-boosted trees give 0.84. A larger MLP (64, 32) and a second-pass refinement for tiny colonies gave no gain.

Interactive refinement with Segment Anything (box / point prompts on the review page) is a separate, optional
module; its method and its comparison with this analyzer are in [`../sam/README.md`](../sam/README.md).

## Measured accuracy (JS port, `eval.html` in Chromium)

Segmentation is scored on the **test split** (313 labelled images, all incomplete). IoU is computed at full label resolution, with the predicted polygon rasterised by the canvas.

| Metric | Value |
|---|---|
| mean IoU | **0.863** |
| median IoU | 0.912 |
| mean Dice | **0.914** |
| median relative area error | **5.2 %** |
| mean relative area error | 33 % (dominated by a few failures, see below) |
| test images wrongly classified "complete" | 7 / 313 |

| Growth / plate area | n | mIoU |
|---|---|---|
| < 2 % | 96 | 0.80 |
| 2–10 % | 80 | 0.90 |
| 10–30 % | 47 | 0.93 |
| 30–60 % | 48 | 0.91 |
| > 60 % | 42 | 0.81 |

Classification is scored on the **valid split** (565 images: 228 complete, 337 incomplete).

| Metric | Value |
|---|---|
| accuracy | **0.956** |
| F1 (complete) | 0.947 |
| F1 (incomplete) | 0.962 |
| confusion | TP 222, TN 318, FP 19 (incomplete→complete), FN 6 |

`tools/train.py` produced the shipped `models.json`. In Python it scores 0.862 mIoU (at 256 px) and 0.956 accuracy on the same splits. Spot checks of the classification probabilities agree between JS and Python to three decimals; the small segmentation differences come from JPEG decoding and bilinear rounding. The Deep-Motility baseline was not available here, so there is no direct comparison.

**Speed.** On a desktop Chromium the median is 70–165 ms per image for the segmentation set (~1000 px images, including the worker round trip). The range covers two runs, with the browser pane hidden and visible; the 90th percentile is ≤ 200 ms. Classification-set images take 64–71 ms. The cost does not depend on input size beyond the initial resampling. I estimate 0.5–0.8 s on a mid-range phone, but this was not measured on a device.

## Known failure cases

- **Halo vs. core ambiguity.** In a few images the label is the bright/dark core only, and a diffuse halo around it is excluded (e.g. G97c-0.3, G93b-0.3, G226b-0.3, G215b-0.3, IoU < 0.15). The model includes the halo, because other labels do include halos. These cases dominate the mean area error.
- **Near-complete growth with a faint outer edge.** Examples: G118b-0.3, G77b-0.3, G56a 0.5. The model stops at an inner ring and under-segments.
- **Satellite colonies.** When they touch the main region they merge with it, giving over-segmentation (G152c-0.5, G155a-0.5). When a satellite lies closer to the centre than the real colony, or the real colony does not reach the central disc, the wrong component is chosen and IoU is about 0 (G188a-0.5, PA7 b 0.5, G155c-0.3).
- **Tiny colonies (< 2 % of the plate).** These are only ~5 px across in the 128 px crop, so boundary errors weigh more (mIoU 0.80).
- **Complete vs. incomplete.** Most errors are incomplete plates whose growth reaches the rim on most sides, with lobes at the edge (G51b/c, G4a, G60b, G144b). These are predicted complete, often with high confidence. The class boundary is subjective for such plates. Complete plates with a clear central region and satellite colonies are sometimes predicted incomplete.
- **Plate detection** assumes the photo is cropped around the dish, like the datasets and the MotilityJ workflow: centre within ±5 % of the middle, diameter ≥ 76 % of the short side. Uncropped photos with a small dish will fail. The UI lets the user correct the result.

## Re-running the evaluation

The datasets are not in the repository. Serve a folder that links both the dataset and `web/`:

```bash
mkdir -p /tmp/motility-eval && cd /tmp/motility-eval && ln -sfn /path/to/Motilidad data && ln -sfn /path/to/MotilityJ/web web && python3 -m http.server 8791
```

Open `http://127.0.0.1:8791/web/js/analysis/eval.html?data=/data/&auto=1`. Optional query parameters: `n=20` limits the number of images per set, and `sets=seg` or `sets=cls` runs one set only. When the page finishes, `window.evalResults` holds the per-image rows.

To retrain the models, run the following. It takes ~20 min on 8 cores and prints the test/valid metrics.

```bash
python3 web/js/analysis/tools/train.py /path/to/Motilidad web/js/analysis/models.json
```

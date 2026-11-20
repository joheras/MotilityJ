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

export async function analyzeImage(imageData, options = {}) {
  // Placeholder until the real algorithm lands: a centred circle of a quarter of the image.
  const r = Math.min(imageData.width, imageData.height) / 2;
  const cx = imageData.width / 2, cy = imageData.height / 2;
  const contour = Array.from({ length: 64 }, (_, i) => {
    const a = (i / 64) * 2 * Math.PI;
    return [cx + (r / 4) * Math.cos(a), cy + (r / 4) * Math.sin(a)];
  });
  options.onProgress?.(1, "done");
  return { klass: "incomplete", confidence: 0, plate: { cx, cy, r: r * 0.95 }, contour, areaPx: Math.PI * (r / 4) ** 2 };
}

// Plate thumbnails with the analysis drawn on top (plate circle + growth outline), so wrong results stand out
// at a glance in the experiment gallery and the phone results list. The SVG uses the stored image's pixel
// coordinates and "slice" scaling, matching the <img>'s object-fit: cover.
import { h, s } from "./dom.js";

export const REVIEW_CONFIDENCE = 0.8; // below this an unedited automatic result is flagged for review

export const needsReview = (result) => !!result && !result.edited && result.confidence != null && result.confidence < REVIEW_CONFIDENCE;

export function overlayThumb(img, url, { className = "thumb-frame" } = {}) {
  const r = img.result;
  const W = img.width || 1, H = img.height || 1;
  const svg = r?.plate ? s("svg", { class: "thumb-overlay", viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: "xMidYMid slice", "aria-hidden": "true" },
    r.klass === "complete"
      ? s("circle", { class: "t-fill", cx: r.plate.cx, cy: r.plate.cy, r: r.plate.r })
      : r.contour?.length > 2 ? s("polygon", { class: "t-contour", points: r.contour.map((p) => p.join(",")).join(" ") }) : null,
    s("circle", { class: "t-plate", cx: r.plate.cx, cy: r.plate.cy, r: r.plate.r })) : null;
  return h("span", { class: className, style: { "--sw": `${Math.max(W, H) / 110}px` } },
    h("img", { src: url, alt: img.name, loading: "lazy" }), svg);
}

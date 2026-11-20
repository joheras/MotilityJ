// Shape measurements of the growth region (pure functions, no DOM).
// Polygons are [[x, y], ...] in stored-image pixels; measure() converts them to mm with mmPerPx().
// Complete plates are measured on the plate circle (the growth covers the whole dish).
import { areaMm2, mmPerPx, polygonArea } from "./geometry.js";

/** Length of the closed polygon. */
export function perimeter(pts) {
  let p = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) p += Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1]);
  return pts.length > 1 ? p : 0;
}

/** Area centroid of a simple polygon (vertex mean when the area is ~0). */
export function centroid(pts) {
  if (!pts.length) return null;
  let a = 0, cx = 0, cy = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const c = pts[j][0] * pts[i][1] - pts[i][0] * pts[j][1];
    a += c;
    cx += (pts[j][0] + pts[i][0]) * c;
    cy += (pts[j][1] + pts[i][1]) * c;
  }
  if (Math.abs(a) < 1e-9) return [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length];
  return [cx / (3 * a), cy / (3 * a)];
}

/** Convex hull (Andrew's monotone chain), counter-clockwise, without repeated end point. */
export function convexHull(pts) {
  const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return p;
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [], upper = [];
  for (const q of p) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop();
    lower.push(q);
  }
  for (let i = p.length - 1; i >= 0; i--) {
    const q = p[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop();
    upper.push(q);
  }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}

/** Maximum and minimum Feret (caliper) diameters, from the convex hull.
 *  max = largest distance between two hull vertices; min = smallest width over the hull edge directions
 *  (the minimum caliper width is always attained with one side flush to a hull edge). */
export function feret(pts) {
  const hull = convexHull(pts);
  if (hull.length < 2) return { max: 0, min: 0 };
  let max = 0;
  for (let i = 0; i < hull.length; i++) {
    for (let j = i + 1; j < hull.length; j++) max = Math.max(max, Math.hypot(hull[i][0] - hull[j][0], hull[i][1] - hull[j][1]));
  }
  if (hull.length < 3) return { max, min: 0 };
  let min = Infinity;
  for (let i = 0; i < hull.length; i++) {
    const a = hull[i], b = hull[(i + 1) % hull.length];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (!len) continue;
    let w = 0;
    for (const q of hull) w = Math.max(w, Math.abs((b[0] - a[0]) * (q[1] - a[1]) - (b[1] - a[1]) * (q[0] - a[0])) / len);
    min = Math.min(min, w);
  }
  return { max, min: Number.isFinite(min) ? min : 0 };
}

/** Circularity 4πA/P²: 1 for a circle, smaller for elongated or ragged outlines. */
export const circularity = (area, per) => (per > 0 ? (4 * Math.PI * area) / (per * per) : null);

/** Diameter of the circle with the same area. */
export const equivalentDiameter = (area) => (area > 0 ? 2 * Math.sqrt(area / Math.PI) : 0);

export const MEASURES = ["areaMm2", "eqDiameterMm", "feretMaxMm", "feretMinMm", "perimeterMm", "circularity", "coveragePct", "centroidOffsetMm"];

/**
 * All measurements of an image, or null when it has no result. `settings` must already carry the effective
 * plate diameter (see metadata.measureSettings). Values that need a scale are null when there is none.
 * -> { areaMm2, eqDiameterMm, feretMaxMm, feretMinMm, perimeterMm, circularity, coveragePct, centroidOffsetMm, mmPerPx }
 */
export function measure(image, settings) {
  const r = image.result;
  if (!r) return null;
  const k = mmPerPx(image, settings);
  if (r.klass === "complete") {
    const d = settings.plateDiameterMm;
    return { areaMm2: areaMm2(image, settings), eqDiameterMm: d, feretMaxMm: d, feretMinMm: d, perimeterMm: Math.PI * d,
      circularity: 1, coveragePct: 100, centroidOffsetMm: 0, mmPerPx: k };
  }
  const pts = r.contour || [];
  const area = areaMm2(image, settings);
  const out = { areaMm2: area, eqDiameterMm: null, feretMaxMm: null, feretMinMm: null, perimeterMm: null,
    circularity: null, coveragePct: null, centroidOffsetMm: null, mmPerPx: k };
  const polyArea = polygonArea(pts);
  if (pts.length >= 3) out.circularity = circularity(polyArea, perimeter(pts));
  const plate = r.plate;
  if (plate?.r > 0) out.coveragePct = (100 * (r.areaPx ?? polyArea)) / (Math.PI * plate.r * plate.r);
  if (k == null) return out;
  out.eqDiameterMm = area == null ? null : equivalentDiameter(area);
  if (pts.length >= 2) {
    const f = feret(pts);
    out.feretMaxMm = f.max * k;
    out.feretMinMm = f.min * k;
    out.perimeterMm = perimeter(pts) * k;
  }
  const c = centroid(pts);
  if (c && plate) out.centroidOffsetMm = Math.hypot(c[0] - plate.cx, c[1] - plate.cy) * k;
  return out;
}

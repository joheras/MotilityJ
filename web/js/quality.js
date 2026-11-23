// Photo quality check: fast, non-blocking warnings about a plate photo before it is analysed (AntibiogramJ-web style).
// Runs on a copy whose long side is WORK px, plus a crop of the full-resolution photo around the plate for the
// focus measure, so the cost does not depend on the camera resolution: median 36 ms, p95 58 ms per photo on a
// desktop over the 1080 calibration images, decoding excluded (expect 2-3 times that on a phone). Reuses the image helpers and the
// plate finder of js/analysis/core.js; the analysis itself is not changed.
//
// export async function checkPhoto(blob | bitmap | canvas, { origWidth? }): Promise<Report | null>  // null: undecodable
// export function measure(rgba, W, H, { origScale, crop? }): Metrics   // pure: work copy RGBA (long side <= WORK)
// export function judge(metrics): Report                               // pure: THRESHOLDS below
// export function qualityItems(report): [{ level, code, params, message, tip }]  // texts in the current language
// export async function cropToPlate(blob, plate, margin = 1.1): Promise<Blob>   // square JPEG around the plate
//
// Report = { version, score 0..100 (100 - 15 per warning - 40 per serious one), level "ok"|"warn"|"bad",
//            items: [{ level "warn"|"bad", code, params }], metrics, plate: { cx, cy, r } | null (pixels of the
//            checked photo), canCrop (plate whole in the frame but small / off-centre: cropToPlate helps), checkedAt }
// codes: plate_not_found, plate_cut, plate_small, off_centre, plate_frame, tilt, low_resolution, blur, dark,
//        overexposed, glare, low_contrast (texts q_<code> and q_<code>_tip in i18n.js)
//
// Measures (inside the detected plate, or a central disc when no plate is found):
// * plate: rim consistency (ring below: mean of the gradient across the rim, saturated at CAP x the mean gradient)
//   of circles anywhere in the frame (searched at 96 px, refined at 256 px; the outermost near-best one, so a dark
//   colony or a swim halo is not taken for the rim) compared with the circle js/analysis/ will use (findPlate:
//   centre near the middle, r 0.38-0.53 of the short side, as the training images are crops around the dish).
//   `analysisMatch` false means the analysis will look elsewhere: the photo should be cropped to the plate.
// * tilt: the best ellipse around the plate (axis ratio, orientation); aspect = minor / major axis.
// * sharpness: width of the rim edge: at 128 angles, max slope / (max - min) of the radial grey profile across the
//   rim, median x 10, on the plate rescaled to SHARP_D px across (motility agar is smooth; the rim is the one
//   sharp feature every photo has). Pixels outside the photo are ignored.
// * exposure: median and 99th percentile of the grey levels; clipped = fraction of the plate at >= 250.
// * glare: fraction of the plate with all channels >= 235 that is > 35 grey levels brighter than its surroundings
//   (box mean, side r/4): lamp reflections on the lid or the agar.
// * resolution: plate diameter in pixels of the original photo.
//
// Thresholds (THRESHOLDS below) were calibrated with tools/quality_calibrate.py + tools/quality-calibrate.html on
// 240 photos of the Motilidad dataset and on synthetically degraded copies of 60 of them. Result: 13 of the 240
// dataset photos get a warning (7 of them for real lamp reflections, 3 blur, 3 rim touching the frame) and none a
// serious one; flagged copies: blur σ 6 px 58/60, dark 60/60, over-exposed 57/60, low contrast 60/60, small
// plate 60/60, off-centre 60/60, low resolution 60/60, no plate 60/60, cut 60/60 (41 as plate_cut, the others
// as small or off-centre plate); weaker: synthetic lamp reflections 12/60 (only large ones are flagged, as the
// dataset has smaller ones) and plates squashed to 0.8 (59/60 warned, 12 as tilt, the others as off-centre).

import { findPlate, gaussianBlur, resizeArea, sobel } from "./analysis/core.js";
import { t } from "./i18n.js";

export const QUALITY_VERSION = 1;
export const WORK = 384;     // long side of the analysed copy
const SEARCH = 96;           // long side for the coarse plate search
const FINE = 256;            // long side for the refinement (same as js/analysis/)
const SHARP_D = 512;         // plate diameter for the sharpness measure (the input size of js/deepmotility/)
const OUTER = 0.75;          // see searchPlate
const KEEP_ANALYSIS = 0.75;  // see searchPlate
const CAP = 3;               // see ring

export const THRESHOLDS = {
  // Calibration (tools/quality_calibrate.py, 2026-11): 240 dataset photos ("good"), 60 of them also degraded each way.
  // Ranges are min-max (p5-p95) of the measure.
  // rim consistency of the plate: dataset 0.51-0.99 (p5 0.64); images without a plate 0.26-0.33
  minStrength: 0.4,
  // fraction of the radius outside the frame: dataset 0-0.08 (p95 0.03); copies with 20-35 % of the width cut 0.4-0.7
  cutWarn: 0.06, cutBad: 0.15,
  // plate diameter / short side: dataset p5 0.94; js/analysis/ needs >= 0.76; plate at 44 % of the frame 0.42-0.45
  smallWarn: 0.74, smallBad: 0.35,
  // centre offset / short side: dataset 0-0.056 (p95 0.023); js/analysis/ searches ±0.05
  offWarn: 0.06,
  // plate diameter in px of the original photo: dataset p5 944; copies reduced to 250 px 227-252
  resWarn: 600, resBad: 300,
  // rim sharpness: dataset p5 2.0 (noise σ 8: p5 2.2, JPEG q35: p5 2.1); Gaussian blur σ 6 px at 1000 px 0.5-1.4;
  // σ 3 px (1.2-2.4, under 1 px at the 256 px of the analysis) is borderline on purpose
  blurWarn: 1.6, blurBad: 1.0,
  // contrast (p99 - p1 grey levels in the plate): dataset 45-206 (p5 93); contrast x 0.2 copies 11-39
  contrastWarn: 42, contrastBad: 20,
  // 99th percentile of the grey levels: dataset 115-255 (p5 166); darkened x 0.2 copies 33-51
  darkP99: 70, darkBad: 35,
  // fraction of the plate at >= 250: dataset 0-0.075 (p95 0.027); brightened x 2.5 copies p5 0.08, median 0.91
  clipWarn: 0.08, clipBad: 0.3,
  // glare fraction: dataset 0-0.052 (p95 0.027: some dataset photos show lamp reflections, which are real glare);
  // copies with 1-2 synthetic lamp reflections 0.005-0.06 (median 0.019). Only large reflections are flagged.
  glareWarn: 0.03, glareBad: 0.08,
  // ellipse aspect (minor / major axis): dataset 0.86-1 (p5 1.0); copies squashed to 0.8 0.76-1 (median 0.91)
  tiltWarn: 0.9, tiltBad: 0.8,
};

const PENALTY = { ok: 0, warn: 15, bad: 40 };

// ------------------------------------------------------------------ pure measures

function toGray(rgba, n) {
  const g = new Float32Array(n), lo = new Uint8Array(n);
  for (let i = 0, j = 0; i < n; i++, j += 4) {
    const r = rgba[j], gg = rgba[j + 1], b = rgba[j + 2];
    g[i] = 0.299 * r + 0.587 * gg + 0.114 * b;
    lo[i] = Math.min(r, gg, b);
  }
  return { g, lo };
}

const NA = 64;
const CA = new Float64Array(NA), SA = new Float64Array(NA);
for (let i = 0; i < NA; i++) { const a = (2 * Math.PI * i) / NA; CA[i] = Math.cos(a); SA[i] = Math.sin(a); }
const MIN_INSIDE = 0.55; // a candidate rim must be at least this much inside the frame

/**
 * Rim consistency of an ellipse (r(1+e), r(1-e), major axis at angle phi): mean over its rim points inside the frame
 * of min(|gradient across the rim|, cap) / cap, in [0, 1]. Saturating at cap (a few times the mean gradient of the
 * image) makes a faint rim seen all around beat a few strong unrelated edges. 0 when less than MIN_INSIDE is in the frame.
 */
function ring(gx, gy, W, H, cx, cy, r, cap, step = 1, e = 0, phi = 0) {
  let s = 0, n = 0;
  if (e === 0) { // circle: the normal is the radius
    for (let i = 0; i < NA; i += step) {
      const xi = Math.round(cx + r * CA[i]), yi = Math.round(cy + r * SA[i]);
      if (xi < 0 || xi >= W || yi < 0 || yi >= H) continue;
      const k = yi * W + xi;
      s += Math.min(cap, Math.abs(gx[k] * CA[i] + gy[k] * SA[i]));
      n++;
    }
    return n * step >= MIN_INSIDE * NA ? s / n / cap : 0;
  }
  const cp = Math.cos(phi), sp = Math.sin(phi);
  for (let i = 0; i < NA; i += step) {
    const u = r * (1 + e) * CA[i], v = r * (1 - e) * SA[i];
    const xi = Math.round(cx + u * cp - v * sp), yi = Math.round(cy + u * sp + v * cp);
    if (xi < 0 || xi >= W || yi < 0 || yi >= H) continue;
    const nx = (1 - e) * CA[i], ny = (1 + e) * SA[i], nn = Math.hypot(nx, ny);
    const ux = (nx * cp - ny * sp) / nn, uy = (nx * sp + ny * cp) / nn;
    const k = yi * W + xi;
    s += Math.min(cap, Math.abs(gx[k] * ux + gy[k] * uy));
    n++;
  }
  return n * step >= MIN_INSIDE * NA ? s / n / cap : 0;
}

function meanMag(gx, gy) {
  let s = 0;
  for (let i = 0; i < gx.length; i++) s += Math.hypot(gx[i], gy[i]);
  return s / gx.length;
}

function refine(gx, gy, W, H, c, cap) {
  let v = ring(gx, gy, W, H, c.cx, c.cy, c.r, cap);
  for (const [span, step] of [[5, 1], [1, 0.5]]) {
    const c0 = c;
    for (let dx = -span; dx <= span; dx += step)
      for (let dy = -span; dy <= span; dy += step)
        for (let dr = -span; dr <= span; dr += step) {
          const x = ring(gx, gy, W, H, c0.cx + dx, c0.cy + dy, c0.r + dr, cap);
          if (x > v) { v = x; c = { cx: c0.cx + dx, cy: c0.cy + dy, r: c0.r + dr }; }
        }
  }
  return { ...c, v };
}

/**
 * Plate in the frame: { cx, cy, r, strength, aspect, analysis } in the coordinates of g (W x H).
 * Two candidates: the circle js/analysis/ will use (findPlate: near the middle, r 0.38-0.53 of the short side) and the
 * best circle anywhere (centre anywhere, r 0.12-0.62 of the short side, the largest one scoring >= OUTER x the best,
 * so a dark colony or a swim halo inside the dish is not taken for the rim). The analysis' circle is kept when it
 * scores >= KEEP_ANALYSIS x the other one, or contains it (a colony inside the dish) and scores >= 0.5;
 * `analysis` tells whether it was kept.
 */
function searchPlate(g, W, H) {
  const k2 = FINE / Math.max(W, H), w2 = Math.round(W * k2), h2 = Math.round(H * k2);
  const g2raw = resizeArea(g, W, H, w2, h2);
  const g2 = gaussianBlur(g2raw, w2, h2, 0.7);
  const [bx, by] = sobel(g2, w2, h2);
  const cap2 = CAP * meanMag(bx, by) + 1e-6;
  const a = refine(bx, by, w2, h2, findPlate(g2raw, w2, h2), cap2);

  const k1 = SEARCH / Math.max(W, H), w1 = Math.max(8, Math.round(W * k1)), h1 = Math.max(8, Math.round(H * k1));
  const g1 = gaussianBlur(resizeArea(g, W, H, w1, h1), w1, h1, 1);
  const [ax, ay] = sobel(g1, w1, h1);
  const cap1 = CAP * meanMag(ax, ay) + 1e-6;
  const s1 = Math.min(w1, h1);
  const radii = [];
  for (let r = 0.12 * s1; r <= 0.62 * s1; r += 1.5) radii.push(r);
  const best = radii.map(() => ({ v: -1, cx: 0, cy: 0 }));
  for (let cy = 1; cy < h1 - 1; cy += 3) {
    for (let cx = 1; cx < w1 - 1; cx += 3) {
      for (let j = 0; j < radii.length; j++) {
        const v = ring(ax, ay, w1, h1, cx, cy, radii[j], cap1, 2);
        if (v > best[j].v) best[j] = { v, cx, cy };
      }
    }
  }
  const top = Math.max(...best.map((b) => b.v));
  let j = radii.length - 1;
  while (j > 0 && best[j].v < OUTER * top) j--;
  const f = w2 / w1;
  const b = refine(bx, by, w2, h2, { cx: best[j].cx * f, cy: best[j].cy * f, r: radii[j] * f }, cap2);
  const inside = Math.hypot(a.cx - b.cx, a.cy - b.cy) + b.r <= 1.02 * a.r; // b is a circle within the dish a
  const useA = a.v >= KEEP_ANALYSIS * b.v || (inside && a.v >= 0.5);
  let c = useA ? a : b;
  // Perspective (phone not parallel to the plate): best ellipse around the circle, coarse then fine; kept only
  // when it fits clearly better than the circle. Its centre and mean radius then replace the circle's.
  let ell = { e: 0, v: c.v * 1.04, cx: c.cx, cy: c.cy, r: c.r, phi: 0 };
  for (let e = 0.03; e <= 0.241; e += 0.03)
    for (let o = 0; o < 12; o++)
      for (let sr = 0.88; sr <= 1.121; sr += 0.02) {
        const v = ring(bx, by, w2, h2, c.cx, c.cy, c.r * sr, cap2, 2, e, (o * Math.PI) / 12);
        if (v > ell.v) ell = { e, v, cx: c.cx, cy: c.cy, r: c.r * sr, phi: (o * Math.PI) / 12 };
      }
  if (ell.e > 0) {
    const e0 = ell;
    for (const de of [-0.015, 0, 0.015])
      for (const dp of [-0.13, 0, 0.13])
        for (const dr of [-1, 0, 1])
          for (let dx = -3; dx <= 3; dx++)
            for (let dy = -3; dy <= 3; dy++) {
              const v = ring(bx, by, w2, h2, e0.cx + dx, e0.cy + dy, e0.r + dr, cap2, 1, e0.e + de, e0.phi + dp);
              if (v > ell.v) ell = { e: e0.e + de, v, cx: e0.cx + dx, cy: e0.cy + dy, r: e0.r + dr, phi: e0.phi + dp };
            }
  }
  if (ell.e > 0) c = { ...c, cx: ell.cx, cy: ell.cy, r: ell.r };
  const back = W / w2;
  return { cx: c.cx * back, cy: c.cy * back, r: c.r * back, strength: c.v, aspect: (1 - ell.e) / (1 + ell.e), analysis: useA,
    analysisPlate: { cx: a.cx * back, cy: a.cy * back, r: a.r * back } };
}

/**
 * Focus measure on the rim: at 128 angles, the radial grey profile across the rim (0.9-1.1 r, averaged over 5
 * tangential offsets) gives max |slope| / (max - min) = 1 / edge width in px. Returns the median over the angles
 * with enough contrast, x 10 (a perfectly sharp step scores ~5-10, Gaussian blur σ px about 4 / σ), or null.
 */
export function rimSharpness(g, w, h, cx, cy, r, valid = { x0: 0, y0: 0, x1: w, y1: h }) {
  // valid: part of g that holds image pixels (a crop around a plate touching the frame edge has empty borders)
  const X0 = Math.max(0, valid.x0 + 1), Y0 = Math.max(0, valid.y0 + 1), X1 = Math.min(w, valid.x1 - 1) - 1, Y1 = Math.min(h, valid.y1 - 1) - 1;
  const at = (x, y) => {
    const x0 = Math.floor(x), y0 = Math.floor(y);
    if (x0 < X0 || y0 < Y0 || x0 >= X1 || y0 >= Y1) return NaN;
    const fx = x - x0, fy = y - y0, k = y0 * w + x0;
    return (g[k] * (1 - fx) + g[k + 1] * fx) * (1 - fy) + (g[k + w] * (1 - fx) + g[k + w + 1] * fx) * fy;
  };
  const vals = [];
  const N = 128, step = 0.5;
  for (let i = 0; i < N; i++) {
    const a = (2 * Math.PI * i) / N, c = Math.cos(a), s = Math.sin(a);
    const prof = [];
    let ok = true;
    for (let t = 0.9 * r; t <= 1.1 * r && ok; t += step) {
      let sum = 0;
      for (let o = -2; o <= 2; o++) {
        const v = at(cx + t * c - o * s, cy + t * s + o * c);
        if (Number.isNaN(v)) { ok = false; break; }
        sum += v;
      }
      prof.push(sum / 5);
    }
    if (!ok || prof.length < 8) continue;
    let lo = Infinity, hi = -Infinity, slope = 0;
    for (let k = 0; k < prof.length; k++) {
      lo = Math.min(lo, prof[k]); hi = Math.max(hi, prof[k]);
      if (k >= 2) slope = Math.max(slope, Math.abs(prof[k] - prof[k - 2]) / (2 * step));
    }
    if (hi - lo >= 20) vals.push(slope / (hi - lo));
  }
  if (vals.length < N / 4) return null;
  vals.sort((x, y) => x - y);
  return 10 * vals[Math.floor(vals.length / 2)];
}

/** Mean of g over a (2 rad + 1)^2 box around each pixel (integral image; the box is clipped at the borders). */
function boxMean(g, W, H, rad) {
  const I = new Float64Array((W + 1) * (H + 1));
  for (let y = 0; y < H; y++) {
    let row = 0;
    for (let x = 0; x < W; x++) { row += g[y * W + x]; I[(y + 1) * (W + 1) + x + 1] = I[y * (W + 1) + x + 1] + row; }
  }
  const out = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    const y0 = Math.max(0, y - rad), y1 = Math.min(H, y + rad + 1);
    for (let x = 0; x < W; x++) {
      const x0 = Math.max(0, x - rad), x1 = Math.min(W, x + rad + 1);
      out[y * W + x] = (I[y1 * (W + 1) + x1] - I[y0 * (W + 1) + x1] - I[y1 * (W + 1) + x0] + I[y0 * (W + 1) + x0]) / ((y1 - y0) * (x1 - x0));
    }
  }
  return out;
}

function hist(values, mask) {
  const hgm = new Uint32Array(256);
  let n = 0;
  for (let i = 0; i < values.length; i++) if (mask[i]) { hgm[Math.max(0, Math.min(255, Math.round(values[i])))]++; n++; }
  return { hgm, n };
}
function pct({ hgm, n }, q) {
  const target = q * (n - 1);
  let acc = 0;
  for (let v = 0; v < 256; v++) { acc += hgm[v]; if (acc > target) return v; }
  return 255;
}

/**
 * Measures of a work copy. rgba: Uint8ClampedArray (W x H, long side <= WORK). origScale: original px per work px.
 * crop (optional): (plate in work px) => { rgba, w, h, cx, cy, r }, the plate at about SHARP_D px across from the
 * original photo, for the sharpness (else it is measured on the work copy).
 */
export function measure(rgba, W, H, { origScale = 1, crop = null } = {}) {
  const n = W * H;
  const { g, lo } = toGray(rgba, n);
  const s = Math.min(W, H);
  const found = searchPlate(g, W, H);
  const plateFound = found.strength >= THRESHOLDS.minStrength;
  const p = plateFound ? found : { cx: W / 2, cy: H / 2, r: 0.45 * s };

  // Whether js/analysis/ will find the same plate (else the photo should be cropped to the plate).
  const analysisMatch = plateFound ? found.analysis : null;
  const ap = found.analysisPlate;
  const analysisPlate = plateFound ? { cx: ap.cx * origScale, cy: ap.cy * origScale, r: ap.r * origScale } : null;

  // Plate pixels (inner 0.95 r, inside the frame).
  const inner = new Uint8Array(n);
  const ri = 0.95 * p.r;
  let area = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if ((x - p.cx) ** 2 + (y - p.cy) ** 2 <= ri * ri) { inner[y * W + x] = 1; area++; }
  }
  const hg = hist(g, inner);
  const p01 = pct(hg, 0.01), p50 = pct(hg, 0.5), p99 = pct(hg, 0.99);
  let clipped = 0, glare = 0;
  const local = boxMean(g, W, H, Math.max(2, Math.round(p.r / 8)));
  for (let i = 0; i < n; i++) {
    if (!inner[i]) continue;
    if (g[i] >= 250) clipped++;
    if (lo[i] >= 235 && g[i] - local[i] > 35) glare++;
  }

  const c = crop?.(p);
  const sharpness = !plateFound ? null : c
    ? rimSharpness(toGray(c.rgba, c.w * c.h).g, c.w, c.h, c.cx, c.cy, c.r, c.valid)
    : rimSharpness(g, W, H, p.cx, p.cy, p.r);

  const outside = plateFound ? Math.max(0, p.r - p.cx, p.r - p.cy, p.cx + p.r - W, p.cy + p.r - H) / p.r : 0;
  const r3 = (x) => Math.round(x * 1000) / 1000;
  return {
    width: Math.round(W * origScale), height: Math.round(H * origScale),
    plateFound,
    strength: r3(found.strength),
    plate: plateFound ? { cx: p.cx * origScale, cy: p.cy * origScale, r: p.r * origScale } : null,
    plateDiameterPx: plateFound ? Math.round(2 * p.r * origScale) : null,
    plateFraction: plateFound ? r3((2 * p.r) / s) : null,
    offCentre: plateFound ? r3(Math.hypot(p.cx - W / 2, p.cy - H / 2) / s) : null,
    outside: r3(outside),
    aspect: plateFound && found.aspect != null ? r3(found.aspect) : null,
    analysisMatch, analysisPlate,
    sharpness: sharpness == null ? null : Math.round(sharpness * 100) / 100,
    contrast: p99 - p01, median: p50, p99,
    clipped: area ? Math.round((clipped / area) * 10000) / 10000 : 0,
    glare: area ? Math.round((glare / area) * 10000) / 10000 : 0,
  };
}

// ------------------------------------------------------------------ judgement

/** Warnings for the measures: { version, score, level, items: [{ level, code, params }], metrics, plate, canCrop }. */
export function judge(m) {
  const T = THRESHOLDS, items = [];
  const add = (level, code, params = {}) => items.push({ level, code, params });
  const pctOf = (x) => Math.round(x * 100);
  if (!m.plateFound) add("bad", "plate_not_found");
  else {
    if (m.outside > T.cutBad) add("bad", "plate_cut", { pct: pctOf(m.outside) });
    else if (m.outside > T.cutWarn) add("warn", "plate_cut", { pct: pctOf(m.outside) });
    if (m.plateFraction < T.smallBad) add("bad", "plate_small", { pct: pctOf(m.plateFraction) });
    else if (m.plateFraction < T.smallWarn) add("warn", "plate_small", { pct: pctOf(m.plateFraction) });
    else if (m.offCentre > T.offWarn && m.outside <= T.cutWarn) add("warn", "off_centre", { pct: pctOf(m.offCentre) });
    else if (m.analysisMatch === false && m.outside <= T.cutWarn) add("warn", "plate_frame");
    if (m.aspect != null && m.aspect < T.tiltBad) add("bad", "tilt", { pct: pctOf(1 - m.aspect) });
    else if (m.aspect != null && m.aspect < T.tiltWarn) add("warn", "tilt", { pct: pctOf(1 - m.aspect) });
  }
  const diam = m.plateDiameterPx ?? Math.min(m.width, m.height);
  if (diam < T.resBad) add("bad", "low_resolution", { px: diam });
  else if (diam < T.resWarn) add("warn", "low_resolution", { px: diam });
  if (m.sharpness != null && m.sharpness < T.blurBad) add("bad", "blur");
  else if (m.sharpness != null && m.sharpness < T.blurWarn) add("warn", "blur");
  if (m.p99 < T.darkBad) add("bad", "dark");
  else if (m.p99 < T.darkP99) add("warn", "dark");
  if (m.clipped > T.clipBad) add("bad", "overexposed", { pct: pctOf(m.clipped) });
  else if (m.clipped > T.clipWarn) add("warn", "overexposed", { pct: pctOf(m.clipped) });
  if (m.glare > T.glareBad) add("bad", "glare", { pct: (m.glare * 100).toFixed(1) });
  else if (m.glare > T.glareWarn) add("warn", "glare", { pct: (m.glare * 100).toFixed(1) });
  if (m.contrast < T.contrastBad) add("bad", "low_contrast");
  else if (m.contrast < T.contrastWarn && m.p99 >= T.darkP99) add("warn", "low_contrast");
  const score = Math.max(0, 100 - items.reduce((s, i) => s + PENALTY[i.level], 0));
  const level = items.some((i) => i.level === "bad") ? "bad" : items.length ? "warn" : "ok";
  const canCrop = m.plateFound && m.outside <= T.cutWarn
    && items.some((i) => ["plate_small", "off_centre", "plate_frame"].includes(i.code));
  return { version: QUALITY_VERSION, score, level, items, metrics: m, plate: m.plate, canCrop, checkedAt: Date.now() };
}

/** Texts of a report's warnings in the current language. */
export function qualityItems(report) {
  return (report?.items || []).map((i) => ({
    ...i, message: t(`q_${i.code}`, i.params || {}), tip: t(`q_${i.code}_tip`, i.params || {}),
  }));
}

/** One-line summary ("Good photo" / "2 warnings: blur, glare"). */
export function qualitySummary(report) {
  if (!report) return "";
  if (!report.items.length) return t("qualityOk");
  return qualityItems(report).map((i) => i.message).join(" ");
}

// ------------------------------------------------------------------ DOM wrapper

function canvasOf(w, h) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  return c;
}

async function sourceOf(input) {
  if (input instanceof Blob) {
    const bmp = await createImageBitmap(input, { imageOrientation: "from-image" });
    return { src: bmp, width: bmp.width, height: bmp.height, close: () => bmp.close?.() };
  }
  const width = input.width || input.naturalWidth, height = input.height || input.naturalHeight;
  return { src: input, width, height, close: () => {} };
}

/**
 * Checks a photo (Blob/File, ImageBitmap or canvas). origWidth: width of the original photo when `input` is a
 * downscaled copy (for the resolution check). Never throws for an undecodable image: returns null.
 */
export async function checkPhoto(input, { origWidth = null } = {}) {
  let s;
  try { s = await sourceOf(input); } catch { return null; }
  try {
    const t0 = performance.now();
    const k = Math.min(1, WORK / Math.max(s.width, s.height));
    const W = Math.max(1, Math.round(s.width * k)), H = Math.max(1, Math.round(s.height * k));
    const c = canvasOf(W, H);
    const ctx = c.getContext("2d", { willReadFrequently: true });
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(s.src, 0, 0, W, H);
    const work = ctx.getImageData(0, 0, W, H).data;
    const origScale = (origWidth || s.width) / W;
    // The sharpness is measured on a crop of the full-resolution source around the plate, SHARP_D px across.
    const srcPerWork = s.width / W;
    const crop = (p) => {
      const half = 1.2 * p.r * srcPerWork;
      const side = Math.max(16, Math.round(2 * half * Math.min(1, SHARP_D / (2 * p.r * srcPerWork)))); // never upsample
      const cc = canvasOf(side, side);
      const cctx = cc.getContext("2d", { willReadFrequently: true });
      cctx.imageSmoothingQuality = "high";
      cctx.drawImage(s.src, p.cx * srcPerWork - half, p.cy * srcPerWork - half, 2 * half, 2 * half, 0, 0, side, side);
      const k = side / (2 * half), x0 = p.cx * srcPerWork - half, y0 = p.cy * srcPerWork - half;
      const valid = { x0: Math.ceil(-x0 * k), y0: Math.ceil(-y0 * k), x1: Math.floor((s.width - x0) * k), y1: Math.floor((s.height - y0) * k) };
      return { rgba: cctx.getImageData(0, 0, side, side).data, w: side, h: side, cx: side / 2, cy: side / 2, r: side / 2 / 1.2, valid };
    };
    const m = measure(work, W, H, { origScale, crop });
    m.ms = Math.round(performance.now() - t0); // excluding the decoding of the file
    return judge(m);
  } finally {
    s.close();
  }
}

/** Square JPEG crop around the plate (plate in the blob's pixels), with `margin` x r on each side. */
export async function cropToPlate(blob, plate, margin = 1.1) {
  const bmp = await createImageBitmap(blob, { imageOrientation: "from-image" });
  try {
    const half = margin * plate.r, side = Math.max(16, Math.round(2 * half));
    const c = canvasOf(side, side);
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, side, side);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bmp, plate.cx - half, plate.cy - half, 2 * half, 2 * half, 0, 0, side, side);
    return await new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error("Cannot encode the image"))), "image/jpeg", 0.92));
  } finally {
    bmp.close?.();
  }
}

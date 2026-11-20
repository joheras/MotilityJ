// Plate time series (expansion kinetics): time points from file names or capture times, registration of
// frames on the detected plate circle, and the kinetics of a series (area and equivalent radius vs time,
// linear-fit and frame-to-frame expansion rates, lag time, time to complete coverage).
// Pure functions without DOM or storage, so that they can be checked in isolation.
//
// A series groups the images of one physical plate photographed over time: image.seriesId, and
// image.timeH = time point in hours (relative to the first photo unless set by hand).
import { areaMm2 } from "./geometry.js";

export const DEFAULT_PARAMS = {
  fitStartH: null, // linear-fit window; null = from the first frame
  fitEndH: null, //   null = up to the last incomplete frame (complete frames are capped at the plate area)
  lagThresholdMm2: 10, // lag: first time the area exceeds the inoculum area by this much
  inoculumMm2: null, // null = area of the first frame
};

export const seriesParams = (series) => ({ ...DEFAULT_PARAMS, ...(series?.params || {}) });

// --------------------------------------------------------------- time points
const UNIT_H = { m: 1 / 60, min: 1 / 60, mins: 1 / 60, minute: 1 / 60, minutes: 1 / 60,
  h: 1, hr: 1, hrs: 1, hour: 1, hours: 1, d: 24, day: 24, days: 24 };
// A number with a time unit, optionally after "t": "_t05h", "-30min", " 2.5 h", "T12hrs", "_1d".
// The token must start the name or follow a separator and must not be followed by a letter or digit.
const TIME_RE = /(^|[\s_\-.,()[\]+])t?(\d+(?:[.,]\d+)?)\s?(minutes|minute|mins|min|m|hours|hour|hrs|hr|h|days|day|d)(?![a-z0-9])/gi;

const stripExt = (name) => String(name || "").replace(/\.[a-z0-9]{2,5}$/i, "");

/** Time point in hours written in a file name ("plate3_t05h.jpg" -> 5, "A-30min.png" -> 0.5); null if none. */
export function parseTimeFromName(name) {
  let last = null;
  for (const m of stripExt(name).matchAll(TIME_RE)) last = m;
  if (!last) return null;
  const v = Number(last[2].replace(",", "."));
  const k = UNIT_H[last[3].toLowerCase()];
  return Number.isFinite(v) && k ? v * k : null;
}

/** The file name without its time token and extension: images of one plate share it ("PA14_r1_t05h" -> "PA14_r1"). */
export function seriesKeyFromName(name) {
  const base = stripExt(name);
  let last = null;
  for (const m of base.matchAll(TIME_RE)) last = m;
  if (!last) return null;
  const start = last.index + last[1].length;
  const key = (base.slice(0, start) + base.slice(start + last[0].length - last[1].length))
    .replace(/[\s_\-.,+]+$/, "").replace(/^[\s_\-.,+]+/, "").replace(/[\s_\-.,+]{2,}/g, (s) => s[0]);
  return key || null;
}

/** Groups images whose names differ only by a time token: [{ key, images }] with at least 2 images each. */
export function groupByFileName(images) {
  const groups = new Map();
  for (const img of images) {
    const key = seriesKeyFromName(img.name);
    if (key == null || parseTimeFromName(img.name) == null) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(img);
  }
  return [...groups].filter(([, list]) => list.length >= 2).map(([key, list]) => ({ key, images: list }));
}

/** Hours since the earliest capture time of the set; Map id -> hours (images without capturedAt are left out). */
export function timesFromCapture(images) {
  const known = images.filter((i) => Number.isFinite(i.capturedAt));
  if (!known.length) return new Map();
  const t0 = Math.min(...known.map((i) => i.capturedAt));
  return new Map(known.map((i) => [i.id, roundH((i.capturedAt - t0) / 3.6e6)]));
}

/** Map id -> hours from the file names. */
export function timesFromNames(images) {
  const out = new Map();
  for (const img of images) { const v = parseTimeFromName(img.name); if (v != null) out.set(img.id, roundH(v)); }
  return out;
}

const roundH = (x) => Math.round(x * 1e4) / 1e4;

/** Frames of a series in time order (frames without time last, by name). */
export function orderFrames(images) {
  return images.slice().sort((a, b) => {
    const ta = Number.isFinite(a.timeH) ? a.timeH : Infinity, tb = Number.isFinite(b.timeH) ? b.timeH : Infinity;
    return ta - tb || a.name.localeCompare(b.name, undefined, { numeric: true });
  });
}

// ------------------------------------------------------------- registration
/**
 * Similarity transform that maps the plate circle of `frame` onto the plate circle of `ref` (both image
 * results): p' = k·p + [tx, ty]. Frames without a detected plate get the identity (registered: false).
 */
export function plateTransform(frame, ref) {
  const p = frame?.result?.plate, q = ref?.result?.plate;
  if (!p || !q || !(p.r > 0) || !(q.r > 0)) return { k: 1, tx: 0, ty: 0, registered: false };
  const k = q.r / p.r;
  return { k, tx: q.cx - k * p.cx, ty: q.cy - k * p.cy, registered: true };
}

export const applyTransform = (pts, { k, tx, ty }) => pts.map(([x, y]) => [k * x + tx, k * y + ty]);

// Viridis-like ramp from early (dark violet) to late (yellow).
const RAMP = [[68, 1, 84], [59, 82, 139], [33, 145, 140], [94, 201, 98], [253, 231, 37]];
/** Colour of time fraction f in [0, 1] as "rgb(r, g, b)". */
export function rampColor(f) {
  const x = Math.min(1, Math.max(0, Number.isFinite(f) ? f : 0)) * (RAMP.length - 1);
  const i = Math.min(RAMP.length - 2, Math.floor(x)), u = x - i;
  const c = RAMP[i].map((v, j) => Math.round(v + (RAMP[i + 1][j] - v) * u));
  return `rgb(${c.join(", ")})`;
}

// ----------------------------------------------------------------- kinetics
/** Ordinary least squares y = a + b·x: { slope, intercept, r2, n } or null with fewer than 2 distinct x. */
export function linearFit(xs, ys) {
  const n = xs.length;
  if (n < 2) return null;
  const mx = xs.reduce((s, v) => s + v, 0) / n, my = ys.reduce((s, v) => s + v, 0) / n;
  let sxx = 0, sxy = 0, syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx, dy = ys[i] - my;
    sxx += dx * dx; sxy += dx * dy; syy += dy * dy;
  }
  if (!(sxx > 0)) return null;
  const slope = sxy / sxx;
  return { slope, intercept: my - slope * mx, r2: syy > 0 ? Math.min(1, (sxy * sxy) / (sxx * syy)) : 1, n };
}

/**
 * Kinetics of one series.
 * images: the frames (any order); settings: { plateDiameterMm, manualPxPerMm }; params: see DEFAULT_PARAMS.
 * Frames without time or without a result (not analysed, no scale) are listed in `skipped`.
 * Returns { frames, skipped, plateAreaMm2, plateRadiusMm, inoculumMm2, fit, maxRateArea, maxRateRadius,
 *           lagH, coverageH, firstCompleteH, finalAreaMm2 }:
 *   frames[i] = { image, t, klass, area, radius, rateArea, rateRadius, inFit } (rates over the interval
 *     from the previous frame, null for the first one); area of a complete frame = plate area.
 *   fit = { t0, t1, n, area: {slope,intercept,r2}, radius: {slope,intercept,r2} } (slopes in mm²/h and mm/h).
 *   lagH: first time the area reaches inoculum + threshold, linearly interpolated between frames.
 *   coverageH: time to complete coverage, interpolated before the first complete frame by extrapolating the
 *     equivalent radius of the last incomplete frame to the plate radius at the latest expansion rate,
 *     clamped to the interval between both frames.
 */
export function computeKinetics(images, settings, params = DEFAULT_PARAMS) {
  const p = { ...DEFAULT_PARAMS, ...params };
  const plateRadiusMm = settings.plateDiameterMm / 2;
  const plateAreaMm2 = Math.PI * plateRadiusMm ** 2;
  const frames = [], skipped = [];
  for (const image of orderFrames(images)) {
    const area = Number.isFinite(image.timeH) ? areaMm2(image, settings) : null;
    if (area == null) { skipped.push(image); continue; }
    frames.push({ image, t: image.timeH, klass: image.result.klass, area, radius: Math.sqrt(area / Math.PI),
      rateArea: null, rateRadius: null, inFit: false });
  }
  const out = { frames, skipped, plateAreaMm2, plateRadiusMm, inoculumMm2: null, fit: null,
    maxRateArea: null, maxRateRadius: null, lagH: null, coverageH: null, firstCompleteH: null, finalAreaMm2: null };
  if (!frames.length) return out;

  // Frame-to-frame rates (assigned to the later frame).
  for (let i = 1; i < frames.length; i++) {
    const a = frames[i - 1], b = frames[i], dt = b.t - a.t;
    if (dt > 0) { b.rateArea = (b.area - a.area) / dt; b.rateRadius = (b.radius - a.radius) / dt; }
  }
  // Maximum rate over intervals that start on an incomplete frame (after that the area is capped).
  for (let i = 1; i < frames.length; i++) {
    const f = frames[i];
    if (f.rateArea == null || frames[i - 1].klass === "complete") continue;
    if (!out.maxRateArea || f.rateArea > out.maxRateArea.value) out.maxRateArea = { value: f.rateArea, t0: frames[i - 1].t, t1: f.t };
    if (!out.maxRateRadius || f.rateRadius > out.maxRateRadius.value) out.maxRateRadius = { value: f.rateRadius, t0: frames[i - 1].t, t1: f.t };
  }

  // Linear fit over the window.
  const firstComplete = frames.findIndex((f) => f.klass === "complete");
  const lastIncomplete = firstComplete < 0 ? frames.length - 1 : firstComplete - 1;
  const t0 = Number.isFinite(p.fitStartH) ? p.fitStartH : frames[0].t;
  const t1 = Number.isFinite(p.fitEndH) ? p.fitEndH : frames[Math.max(0, lastIncomplete)].t;
  const inWin = frames.filter((f) => f.t >= t0 - 1e-9 && f.t <= t1 + 1e-9);
  inWin.forEach((f) => { f.inFit = true; });
  const fa = linearFit(inWin.map((f) => f.t), inWin.map((f) => f.area));
  const fr = linearFit(inWin.map((f) => f.t), inWin.map((f) => f.radius));
  if (fa && fr) out.fit = { t0, t1, n: inWin.length, area: fa, radius: fr };

  // Lag time.
  out.inoculumMm2 = Number.isFinite(p.inoculumMm2) && p.inoculumMm2 >= 0 ? p.inoculumMm2 : frames[0].area;
  const level = out.inoculumMm2 + (Number.isFinite(p.lagThresholdMm2) ? p.lagThresholdMm2 : DEFAULT_PARAMS.lagThresholdMm2);
  for (let i = 0; i < frames.length; i++) {
    if (frames[i].area < level) continue;
    if (i === 0) { out.lagH = frames[0].t; break; }
    const a = frames[i - 1], b = frames[i];
    out.lagH = a.t + ((level - a.area) / (b.area - a.area)) * (b.t - a.t);
    break;
  }

  // Time to complete coverage.
  if (firstComplete >= 0) {
    const c = frames[firstComplete];
    out.firstCompleteH = c.t;
    out.coverageH = c.t;
    if (firstComplete > 0) {
      const a = frames[firstComplete - 1];
      const v = a.rateRadius > 0 ? a.rateRadius : out.fit?.radius.slope > 0 ? out.fit.radius.slope : null;
      if (v) out.coverageH = Math.min(c.t, Math.max(a.t, a.t + (plateRadiusMm - a.radius) / v));
    }
  }
  out.finalAreaMm2 = frames[frames.length - 1].area;
  return out;
}

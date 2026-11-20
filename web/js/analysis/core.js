// Pure-JS image-processing pipeline for MotilityJ-web (no DOM, usable in a worker or a page).
// It mirrors the Python prototype described in README.md step by step; keep the two in sync.
//
//   gray (any size) --area resample--> ~256 px --ring search--> plate (cx, cy, r)
//   --bilinear crop--> 128x128 plate-normalised image --27 features/pixel--> MLP --> P(growth)
//   --threshold + biggest filled component touching the centre--> mask --> crack-following contour
//   --32 plate features--> gradient-boosted trees --> complete / incomplete

export const WORK = 256;   // long side of the working image
export const R = 128;      // side of the plate-normalised crop
const SIGMAS = [1, 2, 4, 8, 16];

// ---------- basic image helpers (Float32Array, row-major) ----------

export function rgbaToGray(data, n) {
  const g = new Float32Array(n);
  for (let i = 0, j = 0; i < n; i++, j += 4) g[i] = 0.299 * data[j] + 0.587 * data[j + 1] + 0.114 * data[j + 2];
  return g;
}

// Area-weighted resampling of one axis (same weights as OpenCV INTER_AREA for downscaling).
function areaWeights(n, m) {
  const s = n / m, w = [];
  for (let i = 0; i < m; i++) {
    const a = i * s, b = a + s, list = [];
    for (let k = Math.floor(a); k < Math.min(Math.ceil(b), n); k++) {
      const ov = Math.min(b, k + 1) - Math.max(a, k);
      if (ov > 1e-9) list.push(k, ov / s);
    }
    w.push(list);
  }
  return w;
}

export function resizeArea(src, W, H, w, h) {
  const wx = areaWeights(W, w), wy = areaWeights(H, h);
  const tmp = new Float32Array(w * H);
  for (let y = 0; y < H; y++) {
    const row = y * W;
    for (let x = 0; x < w; x++) {
      const l = wx[x]; let s = 0;
      for (let k = 0; k < l.length; k += 2) s += src[row + l[k]] * l[k + 1];
      tmp[y * w + x] = s;
    }
  }
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const l = wy[y];
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let k = 0; k < l.length; k += 2) s += tmp[l[k] * w + x] * l[k + 1];
      out[y * w + x] = s;
    }
  }
  return out;
}

function reflect101(p, len) {
  if (len === 1) return 0;
  while (p < 0 || p >= len) p = p < 0 ? -p : 2 * len - 2 - p;
  return p;
}

// Separable Gaussian blur, kernel size and border handling as cv2.GaussianBlur(src, (0,0), sigma) on float32.
export function gaussianBlur(src, W, H, sigma) {
  const ks = (Math.round(sigma * 8 + 1)) | 1, r = ks >> 1;
  const k = new Float32Array(ks);
  let sum = 0;
  for (let i = 0; i < ks; i++) { k[i] = Math.exp(-((i - r) ** 2) / (2 * sigma * sigma)); sum += k[i]; }
  for (let i = 0; i < ks; i++) k[i] /= sum;
  const ix = new Int32Array((W + 2 * r)), iy = new Int32Array((H + 2 * r));
  for (let i = -r; i < W + r; i++) ix[i + r] = reflect101(i, W);
  for (let i = -r; i < H + r; i++) iy[i + r] = reflect101(i, H);
  const tmp = new Float32Array(W * H), out = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    const row = y * W;
    for (let x = 0; x < W; x++) {
      let s = 0;
      for (let j = 0; j < ks; j++) s += k[j] * src[row + ix[x + j]];
      tmp[row + x] = s;
    }
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let s = 0;
      for (let j = 0; j < ks; j++) s += k[j] * tmp[iy[y + j] * W + x];
      out[y * W + x] = s;
    }
  }
  return out;
}

// 3x3 Sobel derivatives (cv2.Sobel ksize=3, BORDER_REFLECT_101).
export function sobel(src, W, H) {
  const gx = new Float32Array(W * H), gy = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    const ym = reflect101(y - 1, H) * W, y0 = y * W, yp = reflect101(y + 1, H) * W;
    for (let x = 0; x < W; x++) {
      const xm = reflect101(x - 1, W), xp = reflect101(x + 1, W);
      const a = src[ym + xm], b = src[ym + x], c = src[ym + xp];
      const d = src[y0 + xm], f = src[y0 + xp];
      const g = src[yp + xm], h = src[yp + x], i = src[yp + xp];
      gx[y0 + x] = (c + 2 * f + i) - (a + 2 * d + g);
      gy[y0 + x] = (g + 2 * h + i) - (a + 2 * b + c);
    }
  }
  return [gx, gy];
}

function percentile(arr, q) { // numpy default (linear) on a copy
  const a = Float32Array.from(arr).sort();
  const pos = (a.length - 1) * q / 100, lo = Math.floor(pos), hi = Math.min(lo + 1, a.length - 1);
  return a[lo] + (a[hi] - a[lo]) * (pos - lo);
}
const median = (arr) => percentile(arr, 50);

function pick(img, mask) {
  let n = 0;
  for (let i = 0; i < mask.length; i++) if (mask[i]) n++;
  const out = new Float32Array(n);
  for (let i = 0, j = 0; i < mask.length; i++) if (mask[i]) out[j++] = img[i];
  return out;
}

// ---------- plate detection ----------

const NA = 128;
const CA = new Float64Array(NA), SA = new Float64Array(NA);
for (let i = 0; i < NA; i++) { const a = (2 * Math.PI * i) / NA; CA[i] = Math.cos(a); SA[i] = Math.sin(a); }

function ringScore(gx, gy, W, H, cx, cy, r) {
  let s = 0;
  for (let i = 0; i < NA; i++) {
    const xi = Math.round(cx + r * CA[i]), yi = Math.round(cy + r * SA[i]);
    if (xi < 0 || xi >= W || yi < 0 || yi >= H) continue;
    const k = yi * W + xi;
    s += Math.abs(gx[k] * CA[i] + gy[k] * SA[i]);
  }
  return s / NA;
}

const range = (a, b, step = 1) => { const o = []; for (let v = a; v < b + 0.01; v += step) o.push(v); return o; };

// Circle with the strongest radial gradient along its rim; images are crops around the dish,
// so the centre is searched within ±5% of the middle and r in [0.38, 0.53] of the short side.
export function findPlate(g, W, H) {
  const s = Math.min(W, H);
  const W2 = Math.floor(W / 2), H2 = Math.floor(H / 2);
  const g2 = resizeArea(g, W, H, W2, H2);
  let [gx, gy] = sobel(g2, W2, H2);
  let best = -1, c0 = null;
  for (const cx of range(W / 4 - 0.05 * s, W / 4 + 0.05 * s))
    for (const cy of range(H / 4 - 0.05 * s, H / 4 + 0.05 * s))
      for (let r = 0.19 * s; r < 0.265 * s; r += 1) {
        const v = ringScore(gx, gy, W2, H2, cx, cy, r);
        if (v > best) { best = v; c0 = [cx * 2, cy * 2, r * 2]; }
      }
  [gx, gy] = sobel(g, W, H);
  best = -1; let c1 = c0;
  for (const cx of range(c0[0] - 2, c0[0] + 2))
    for (const cy of range(c0[1] - 2, c0[1] + 2))
      for (const r of range(c0[2] - 2, c0[2] + 2)) {
        const v = ringScore(gx, gy, W, H, cx, cy, r);
        if (v > best) { best = v; c1 = [cx, cy, r]; }
      }
  return { cx: c1[0], cy: c1[1], r: c1[2] };
}

// Plate-normalised R x R crop (cv2.warpAffine bilinear, BORDER_REPLICATE): plate centre -> (R/2, R/2), diameter -> R.
export function cropPlate(g, W, H, plate) {
  const s = R / (2 * plate.r), out = new Float32Array(R * R);
  for (let v = 0; v < R; v++) {
    for (let u = 0; u < R; u++) {
      let x = (u - R / 2) / s + plate.cx, y = (v - R / 2) / s + plate.cy;
      x = Math.min(Math.max(x, 0), W - 1); y = Math.min(Math.max(y, 0), H - 1);
      const x0 = Math.floor(x), y0 = Math.floor(y), x1 = Math.min(x0 + 1, W - 1), y1 = Math.min(y0 + 1, H - 1);
      const fx = x - x0, fy = y - y0;
      out[v * R + u] = (g[y0 * W + x0] * (1 - fx) + g[y0 * W + x1] * fx) * (1 - fy) + (g[y1 * W + x0] * (1 - fx) + g[y1 * W + x1] * fx) * fy;
    }
  }
  return out;
}

// Normalised radius of each crop pixel (1 = plate rim).
export const DD = new Float32Array(R * R);
for (let y = 0; y < R; y++) for (let x = 0; x < R; x++) DD[y * R + x] = Math.hypot(x - R / 2 + 0.5, y - R / 2 + 0.5) / (R / 2);
const zone = (a, b) => DD.map((d) => (d > a && d < b ? 1 : 0));
const DISC = DD.map((d) => (d < 0.92 ? 1 : 0)), ANN = zone(0.75, 0.9), CEN = DD.map((d) => (d < 0.05 ? 1 : 0));

// ---------- per-pixel features + MLP ----------

export function plateStats(c) {
  const discV = pick(c, DISC);
  const bg = median(pick(c, ANN));
  const sc = Math.max(percentile(discV, 95) - percentile(discV, 5), 10);
  return { bg, sc, cen: median(pick(c, CEN)), discMed: median(discV) };
}

// 27 features per pixel, laid out feature-major: F[f * N + i].
export function pixelFeatures(c, st) {
  const N = R * R, F = [];
  const { bg, sc, cen } = st;
  for (const s of SIGMAS) {
    const b = gaussianBlur(c, R, R, s);
    F.push(b.map((v) => (v - bg) / sc), b.map((v) => Math.abs(v - bg) / sc), b.map((v) => (v - cen) / sc));
  }
  const c2 = c.map((v) => v * v);
  for (const s of [2, 4, 8]) {
    const m1 = gaussianBlur(c, R, R, s), m2 = gaussianBlur(c2, R, R, s);
    F.push(m1.map((v, i) => Math.sqrt(Math.max(m2[i] - v * v, 0)) / sc));
  }
  for (const s of [1, 2, 4]) {
    const [gx, gy] = sobel(gaussianBlur(c, R, R, s), R, R);
    F.push(gx.map((v, i) => Math.hypot(v, gy[i]) / sc));
  }
  F.push(DD);
  const annV = pick(c, ANN);
  let m = 0; for (const v of annV) m += v; m /= annV.length;
  let sd = 0; for (const v of annV) sd += (v - m) ** 2; sd = Math.sqrt(sd / annV.length);
  for (const v of [(cen - bg) / sc, (st.discMed - bg) / sc, bg / 255, sc / 255, sd / sc]) F.push(new Float32Array(N).fill(v));
  return F;
}

// sklearn MLPClassifier forward pass (ReLU hidden layers, logistic output) over all pixels.
export function mlpProb(F, model) {
  const N = R * R, out = new Float32Array(N);
  const layers = model.coefs.map((W, l) => ({ W, b: model.intercepts[l], nin: W.length, nout: W[0].length }));
  // Flatten weights for speed.
  for (const L of layers) { L.w = new Float32Array(L.nin * L.nout); L.W.forEach((row, i) => row.forEach((v, j) => (L.w[i * L.nout + j] = v))); }
  let x = new Float32Array(F.length);
  for (let p = 0; p < N; p++) {
    if (!DISC[p]) continue;
    for (let f = 0; f < F.length; f++) x[f] = F[f][p];
    let a = x;
    for (let l = 0; l < layers.length; l++) {
      const L = layers[l], z = new Float32Array(L.nout);
      for (let j = 0; j < L.nout; j++) z[j] = L.b[j];
      for (let i = 0; i < L.nin; i++) { const ai = a[i]; if (ai === 0) continue; const off = i * L.nout; for (let j = 0; j < L.nout; j++) z[j] += ai * L.w[off + j]; }
      if (l < layers.length - 1) for (let j = 0; j < L.nout; j++) z[j] = z[j] > 0 ? z[j] : 0;
      a = z;
    }
    out[p] = 1 / (1 + Math.exp(-a[0]));
  }
  return out;
}

// ---------- mask post-processing ----------

// 4-connected labelling; returns { lab: Int32Array, n }.
function label(m, W, H) {
  const lab = new Int32Array(W * H), stack = new Int32Array(W * H);
  let n = 0;
  for (let i = 0; i < W * H; i++) {
    if (!m[i] || lab[i]) continue;
    n++; let sp = 0; stack[sp++] = i; lab[i] = n;
    while (sp) {
      const p = stack[--sp], x = p % W, y = (p - x) / W;
      if (x > 0 && m[p - 1] && !lab[p - 1]) { lab[p - 1] = n; stack[sp++] = p - 1; }
      if (x < W - 1 && m[p + 1] && !lab[p + 1]) { lab[p + 1] = n; stack[sp++] = p + 1; }
      if (y > 0 && m[p - W] && !lab[p - W]) { lab[p - W] = n; stack[sp++] = p - W; }
      if (y < H - 1 && m[p + W] && !lab[p + W]) { lab[p + W] = n; stack[sp++] = p + W; }
    }
  }
  return { lab, n };
}

// Fill holes of a binary mask: background not 4-connected to the border becomes foreground.
function fillHoles(m, W, H) {
  const outside = new Uint8Array(W * H), stack = new Int32Array(W * H);
  let sp = 0;
  const push = (p) => { if (!m[p] && !outside[p]) { outside[p] = 1; stack[sp++] = p; } };
  for (let x = 0; x < W; x++) { push(x); push((H - 1) * W + x); }
  for (let y = 0; y < H; y++) { push(y * W); push(y * W + W - 1); }
  while (sp) {
    const p = stack[--sp], x = p % W, y = (p - x) / W;
    if (x > 0) push(p - 1); if (x < W - 1) push(p + 1); if (y > 0) push(p - W); if (y < H - 1) push(p + W);
  }
  const out = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) out[i] = outside[i] ? 0 : 1;
  return out;
}

// Threshold inside the 0.92r disc, then keep the largest hole-filled component that overlaps
// the central disc (r < 0.1); if none does, the component nearest the centre.
export function selectGrowth(prob, thr = 0.5) {
  const N = R * R, m = new Uint8Array(N);
  for (let i = 0; i < N; i++) m[i] = DISC[i] && prob[i] > thr ? 1 : 0;
  const { lab, n } = label(m, R, R);
  if (!n) return m;
  let best = null, bestA = 0;
  for (let k = 1; k <= n; k++) {
    const f = fillHoles(lab.map((v) => (v === k ? 1 : 0)), R, R);
    let a = 0, touches = false;
    for (let i = 0; i < N; i++) if (f[i]) { a++; if (DD[i] < 0.1) touches = true; }
    if (touches && a > bestA) { best = f; bestA = a; }
  }
  if (!best) {
    let bd = Infinity, bk = 1;
    for (let i = 0; i < N; i++) if (lab[i]) {
      const x = i % R, y = (i - x) / R, d = (x - R / 2) ** 2 + (y - R / 2) ** 2;
      if (d < bd) { bd = d; bk = lab[i]; }
    }
    best = fillHoles(lab.map((v) => (v === bk ? 1 : 0)), R, R);
  }
  return best;
}

// Outer boundary of a (single, hole-free) component by crack following; returns the midpoints of the
// pixel edges, i.e. the 0.5 iso-line of the mask, in crop pixel coordinates (pixel i spans [i-0.5, i+0.5]).
export function traceContour(m, W, H) {
  let start = -1;
  for (let i = 0; i < W * H; i++) if (m[i]) { start = i; break; }
  if (start < 0) return [];
  const inside = (x, y) => x >= 0 && y >= 0 && x < W && y < H && m[y * W + x] === 1;
  const sx = start % W, sy = (start - sx) / W;
  let x = sx, y = sy, dx = 1, dy = 0;
  const pts = [];
  for (let guard = 0; guard < 8 * W * H; guard++) {
    pts.push([x + dx / 2 - 0.5, y + dy / 2 - 0.5]);
    x += dx; y += dy;
    let ar, al; // pixel ahead-right / ahead-left of the vertex (x, y)
    if (dx === 1) { ar = inside(x, y); al = inside(x, y - 1); }
    else if (dx === -1) { ar = inside(x - 1, y - 1); al = inside(x - 1, y); }
    else if (dy === 1) { ar = inside(x - 1, y); al = inside(x, y); }
    else { ar = inside(x, y - 1); al = inside(x - 1, y - 1); }
    if (!ar) [dx, dy] = [-dy, dx];        // turn right
    else if (al) [dx, dy] = [dy, -dx];    // turn left
    if (x === sx && y === sy && dx === 1 && dy === 0) break;
  }
  // Drop collinear points.
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[(i - 1 + pts.length) % pts.length], b = pts[i], c = pts[(i + 1) % pts.length];
    if ((b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]) !== 0) out.push(b);
  }
  return out;
}

export function polygonArea(pts) {
  let s = 0;
  for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; s += a[0] * b[1] - b[0] * a[1]; }
  return Math.abs(s) / 2;
}

// ---------- complete / incomplete ----------

const BINS = [0, 0.2, 0.4, 0.6, 0.75, 0.9];

export function plateFeatures(c, st, prob, mask) {
  const { bg, sc } = st;
  const [gx, gy] = sobel(c, R, R);
  const mean = (arr, z) => { let s = 0, n = 0; for (let i = 0; i < arr.length; i++) if (z[i]) { s += arr[i]; n++; } return n ? s / n : 0; };
  const pGt = prob.map((v) => (v > 0.5 ? 1 : 0));
  const f = [mean(mask, DISC), mean(pGt, DISC), mean(prob, DISC), sc / 255, bg / 255];
  const gm = gx.map((v, i) => Math.hypot(v, gy[i]) / sc);
  for (let b = 0; b < BINS.length - 1; b++) {
    const z = DD.map((d) => (d >= BINS[b] && d < BINS[b + 1] ? 1 : 0));
    const vals = pick(c, z);
    let mu = 0; for (const v of vals) mu += v; mu /= vals.length;
    let sd = 0; for (const v of vals) sd += (v - mu) ** 2; sd = Math.sqrt(sd / vals.length);
    f.push(mean(prob, z), mean(mask, z), (median(vals) - bg) / sc, sd / sc, mean(gm, z));
  }
  const S = 16, cs = new Float64Array(S), cn = new Float64Array(S);
  for (let y = 0; y < R; y++) for (let x = 0; x < R; x++) {
    const i = y * R + x;
    if (!(DD[i] > 0.8 && DD[i] < 0.9)) continue;
    const th = Math.atan2(y - R / 2 + 0.5, x - R / 2 + 0.5);
    const k = Math.floor(((th + Math.PI) / (2 * Math.PI)) * S) % S;
    cs[k] += mask[i]; cn[k]++;
  }
  let covered = 0, minCov = Infinity;
  for (let k = 0; k < S; k++) { const v = cs[k] / Math.max(cn[k], 1); if (v > 0.5) covered++; minCov = Math.min(minCov, v); }
  f.push(covered / S, minCov);
  return f;
}

// sklearn HistGradientBoostingClassifier exported as flat trees: go left when x[f] <= t.
export function classify(f, model) {
  let z = model.base;
  for (const t of model.trees) {
    let i = 0;
    while (!t.leaf[i]) i = f[t.f[i]] <= t.t[i] ? t.l[i] : t.r[i];
    z += t.v[i];
  }
  return 1 / (1 + Math.exp(-z)); // P(complete)
}

// ---------- full pipeline ----------

// gray: Float32Array (W*H). Returns everything in input-image pixels.
export function analyzeGray(gray, W, H, models, onProgress = () => {}) {
  const sc = WORK / Math.max(W, H);
  const w = Math.round(W * sc), h = Math.round(H * sc);
  const g = resizeArea(gray, W, H, w, h);
  onProgress(0.1, "plate");
  const pw = findPlate(g, w, h);
  onProgress(0.3, "features");
  const c = cropPlate(g, w, h, pw);
  const st = plateStats(c);
  const F = pixelFeatures(c, st);
  onProgress(0.6, "segmentation");
  const prob = mlpProb(F, models.seg);
  const mask = selectGrowth(prob, models.seg.threshold ?? 0.5);
  onProgress(0.85, "classification");
  const pComplete = classify(plateFeatures(c, st, prob, mask), models.cls);
  // crop coords -> working coords -> input coords (pixel-centre convention: in = (work + 0.5) / sc - 0.5)
  const k = (2 * pw.r) / R, sx = W / w, sy = H / h;
  const toInput = ([u, v]) => [((u - R / 2) * k + pw.cx + 0.5) * sx - 0.5, ((v - R / 2) * k + pw.cy + 0.5) * sy - 0.5];
  const plate = { cx: (pw.cx + 0.5) * sx - 0.5, cy: (pw.cy + 0.5) * sy - 0.5, r: pw.r * (sx + sy) / 2 };
  const klass = pComplete >= 0.5 ? "complete" : "incomplete";
  const contourAlways = traceContour(mask, R, R).map(toInput);
  return {
    klass,
    confidence: klass === "complete" ? pComplete : 1 - pComplete,
    plate,
    contour: klass === "complete" ? [] : contourAlways,
    areaPx: klass === "complete" ? Math.PI * plate.r * plate.r : polygonArea(contourAlways),
    growthContour: contourAlways, // segmentation even when classified complete (lets the UI offer it on override)
  };
}

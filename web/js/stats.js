// Descriptive and inferential statistics (pure, no DOM, no libraries): mean, SD, SEM, 95 % CI (t distribution),
// Welch's t-test, one-way ANOVA, Holm's step-down correction and significance stars.
// The t and F distributions are computed from the regularized incomplete beta function (continued fraction of
// Numerical Recipes, Lentz's method) and log-gamma (Lanczos). Checked against scipy in stats.test.html
// (expected values from tools/stats_fixtures.py).

const finite = (xs) => xs.filter((x) => typeof x === "number" && Number.isFinite(x));

export function mean(xs) {
  const v = finite(xs);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

/** Sample variance (n − 1); null for fewer than 2 values. */
export function variance(xs) {
  const v = finite(xs);
  if (v.length < 2) return null;
  const m = mean(v);
  return v.reduce((a, b) => a + (b - m) ** 2, 0) / (v.length - 1);
}

export const sd = (xs) => { const v = variance(xs); return v == null ? null : Math.sqrt(v); };
export const sem = (xs) => { const s = sd(xs); return s == null ? null : s / Math.sqrt(finite(xs).length); };

/** { n, mean, sd, sem, ciLow, ciHigh } with a 95 % (or `level`) confidence interval of the mean from the t distribution. */
export function describe(xs, level = 0.95) {
  const v = finite(xs);
  const n = v.length, m = mean(v), s = sd(v), e = sem(v);
  let ciLow = null, ciHigh = null;
  if (n >= 2) {
    const half = tQuantile(1 - (1 - level) / 2, n - 1) * e;
    ciLow = m - half; ciHigh = m + half;
  }
  return { n, mean: m, sd: s, sem: e, ciLow, ciHigh };
}

// ------------------------------------------------------------ special functions
const LANCZOS = [676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
  12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];

/** ln Γ(x) for x > 0 (Lanczos, g = 7). */
export function lgamma(x) {
  if (x < 0.5) return Math.log(Math.PI / Math.abs(Math.sin(Math.PI * x))) - lgamma(1 - x);
  x -= 1;
  let a = 0.99999999999980993;
  const t = x + 7.5;
  for (let i = 0; i < 8; i++) a += LANCZOS[i] / (x + i + 1);
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}

function betacf(a, b, x) {
  const FPMIN = 1e-300, EPS = 1e-15;
  const qab = a + b, qap = a + 1, qam = a - 1;
  let c = 1, d = 1 - (qab * x) / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= 1000; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d; h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return h;
}

/** Regularized incomplete beta function I_x(a, b). */
export function betaInc(x, a, b) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const lbt = lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x);
  return x < (a + 1) / (a + b + 2)
    ? Math.exp(lbt) * betacf(a, b, x) / a
    : 1 - Math.exp(lbt) * betacf(b, a, 1 - x) / b;
}

// ------------------------------------------------------------ distributions
/** Cumulative distribution function of Student's t with df degrees of freedom (df may be fractional). */
export function tCdf(t, df) {
  if (!Number.isFinite(t)) return t > 0 ? 1 : 0;
  const tail = 0.5 * betaInc(df / (df + t * t), df / 2, 0.5); // P(T > |t|)
  return t > 0 ? 1 - tail : tail;
}

/** Two-sided p-value P(|T| ≥ |t|), computed from the tail directly so that small p keep their precision. */
export function tTwoSided(t, df) {
  if (!Number.isFinite(t)) return 0;
  return betaInc(df / (df + t * t), df / 2, 0.5);
}

/** Quantile of Student's t: the t with tCdf(t, df) = p (bisection on the CDF). */
export function tQuantile(p, df) {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  if (p === 0.5) return 0;
  if (p < 0.5) return -tQuantile(1 - p, df);
  let lo = 0, hi = 1;
  while (tCdf(hi, df) < p) hi *= 2;
  for (let i = 0; i < 200 && hi - lo > 1e-12 * Math.max(1, hi); i++) {
    const mid = (lo + hi) / 2;
    if (tCdf(mid, df) < p) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

/** Cumulative distribution function of F with (d1, d2) degrees of freedom. */
export function fCdf(f, d1, d2) {
  if (f <= 0) return 0;
  return betaInc((d1 * f) / (d1 * f + d2), d1 / 2, d2 / 2);
}

/** Upper tail P(F ≥ f), from the complementary beta so that small p keep their precision. */
export function fSf(f, d1, d2) {
  if (f <= 0) return 1;
  if (!Number.isFinite(f)) return 0;
  return betaInc(d2 / (d2 + d1 * f), d2 / 2, d1 / 2);
}

// ------------------------------------------------------------ tests
/** Welch's unequal-variance t-test of a vs b (two-sided): { t, df, p, diff }, or null if it cannot be computed
 *  (fewer than 2 values in a group, or no variance in either group). */
export function welch(a, b) {
  const x = finite(a), y = finite(b);
  if (x.length < 2 || y.length < 2) return null;
  const va = variance(x) / x.length, vb = variance(y) / y.length;
  const se2 = va + vb;
  if (!(se2 > 0)) return null;
  const diff = mean(x) - mean(y);
  const t = diff / Math.sqrt(se2);
  const df = (se2 * se2) / ((va * va) / (x.length - 1) + (vb * vb) / (y.length - 1));
  return { t, df, p: tTwoSided(t, df), diff };
}

/** One-way ANOVA of groups (arrays of values): { F, df1, df2, p }, or null if it cannot be computed. */
export function anova(groups) {
  const gs = groups.map(finite).filter((g) => g.length > 0);
  const k = gs.length, N = gs.reduce((s, g) => s + g.length, 0);
  if (k < 2 || N - k < 1) return null;
  const grand = gs.flat().reduce((a, b) => a + b, 0) / N;
  let ssb = 0, ssw = 0;
  for (const g of gs) {
    const m = mean(g);
    ssb += g.length * (m - grand) ** 2;
    for (const v of g) ssw += (v - m) ** 2;
  }
  const df1 = k - 1, df2 = N - k;
  if (!(ssw > 0)) return null;
  const F = (ssb / df1) / (ssw / df2);
  return { F, df1, df2, p: fSf(F, df1, df2) };
}

/** Holm's step-down adjustment of a family of p-values (nulls are skipped and stay null). */
export function holm(ps) {
  const idx = ps.map((p, i) => [p, i]).filter(([p]) => p != null && Number.isFinite(p)).sort((a, b) => a[0] - b[0]);
  const m = idx.length;
  const out = ps.map(() => null);
  let running = 0;
  idx.forEach(([p, i], rank) => {
    running = Math.max(running, Math.min(1, (m - rank) * p));
    out[i] = running;
  });
  return out;
}

/** GraphPad-style stars: **** p < 0.0001, *** < 0.001, ** < 0.01, * < 0.05, ns otherwise. */
export function stars(p) {
  if (p == null || !Number.isFinite(p)) return "";
  return p < 1e-4 ? "****" : p < 1e-3 ? "***" : p < 0.01 ? "**" : p < 0.05 ? "*" : "ns";
}

/** % inhibition of a treated mean vs a control mean, and its SD propagated to first order (delta method):
 *  I = (1 − mT/mC)·100, SD(I) = 100·(mT/mC)·√((sT/mT)² + (sC/mC)²), written as 100·√((sT/mC)² + (mT·sC/mC²)²)
 *  so that it also holds for mT = 0. sd is null when an SD is missing. */
export function inhibition(mT, sT, mC, sC) {
  if (!(mC > 0) || mT == null || !Number.isFinite(mT)) return { pct: null, sd: null };
  const pct = (1 - mT / mC) * 100;
  if (sT == null || sC == null) return { pct, sd: null };
  return { pct, sd: 100 * Math.sqrt((sT / mC) ** 2 + ((mT * sC) / (mC * mC)) ** 2) };
}

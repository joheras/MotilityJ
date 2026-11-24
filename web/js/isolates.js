// Per-isolate motility profile (pure, no DOM): groups the images of one or more experiments by isolate and
// assay type and aggregates each isolate × assay cell, as clinical isolate surveys do (each isolate tested for
// swimming, swarming and twitching and reported as a combined profile, e.g. Murray et al. 2010,
// https://pmc.ncbi.nlm.nih.gov/articles/PMC2855384).
//
// entries: [{ img, exp, eff, m }] (eff = effective metadata, m = measurements; see columns.rowContext)
// Isolate key: the strain ("strain") or the strain and the condition ("strainCondition"). Images without a strain
// or an assay type are not grouped; they are returned as `unassigned` so that the page can ask for them.
//
// Per cell:
// - n = analysed images; nPending = images without a result yet (not in any statistic).
// - nBioReps = distinct biological replicates (experiment + bioRep, since replicate "1" of two experiments are
//   different cultures); null when no image of the cell has a bioRep.
// - diam / area = mean ± SD (sample SD, n − 1; null for n < 2) of the equivalent diameter (mm) and area (mm²) of the
//   analysed images that have a scale. A complete plate counts with the plate diameter (the zone reached the rim).
// - fracComplete = complete / analysed.
// - representative = the analysed image whose diameter (or area, without a scale) is closest to the cell mean.
// - phenotype = majority vote of the per-image phenotypes (classifyPhenotype of js/phenotype.js, when present):
//   the most frequent `level` wins; a tie gives `mixed: true` with the tied labels joined by "/". `ratio` is the
//   mean of the per-image ratios. null when no image has a phenotype.

export const PROFILE_ASSAYS = ["swim", "swarm", "twitch"];
export const ALL_ASSAYS = [...PROFILE_ASSAYS, "other"];
export const KEY_MODES = ["strain", "strainCondition"];

const isBlank = (v) => v == null || String(v).trim() === "";
const norm = (v) => String(v).trim();

export function mean(xs) {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
}

/** Sample standard deviation (n − 1); null for fewer than two values. */
export function sd(xs) {
  if (xs.length < 2) return null;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1));
}

const stat = (xs) => ({ mean: mean(xs), sd: sd(xs), n: xs.length });

/** Isolate of an image from its effective metadata -> { key, strain, condition } or null without a strain. */
export function isolateOf(eff, mode = "strain") {
  if (isBlank(eff?.strain)) return null;
  const strain = norm(eff.strain);
  const condition = mode === "strainCondition" && !isBlank(eff.condition) ? norm(eff.condition) : null;
  return { key: condition == null ? strain.toLowerCase() : `${strain.toLowerCase()}\u0000${condition.toLowerCase()}`, strain, condition };
}

export const isolateName = (iso) => (iso.condition ? `${iso.strain} · ${iso.condition}` : iso.strain);

// ----------------------------------------------------------------- phenotype
const NEG = /^(neg|negative|non[- ]?motile|none|absent|no|0|-|−)$/i;
const POS = /^(pos|positive|motile|yes|\+|wt|wild[- ]?type)$/i;

/** "+" or "−" of a phenotype level (anything not recognised as negative is a kind of positive); null without one. */
export function phenotypeSign(p) {
  if (!p) return null;
  if (p.sign === "+" || p.sign === "−" || p.sign === "-") return p.sign === "-" ? "−" : p.sign;
  return NEG.test(String(p.level ?? p.label ?? "").trim()) ? "−" : "+";
}

/** Whether the level is a plain +/− (then the profile shows only the sign, otherwise the sign and the label). */
const plainLevel = (p) => NEG.test(String(p.level ?? "").trim()) || POS.test(String(p.level ?? "").trim());

/** Majority phenotype of a list of per-image phenotypes (nulls ignored). */
export function aggregatePhenotype(list) {
  const ps = list.filter(Boolean);
  if (!ps.length) return null;
  const counts = new Map();
  for (const p of ps) {
    const level = String(p.level ?? p.label ?? "");
    const c = counts.get(level) || { level, label: p.label ?? level, n: 0, rule: p.rule?.name ?? p.rule ?? null, sign: p.sign };
    c.n++;
    counts.set(level, c);
  }
  const sorted = [...counts.values()].sort((a, b) => b.n - a.n);
  const top = sorted.filter((c) => c.n === sorted[0].n);
  const ratios = ps.map((p) => p.ratio).filter(Number.isFinite);
  const mixed = top.length > 1;
  return {
    level: mixed ? top.map((c) => c.level).join("/") : top[0].level,
    label: mixed ? top.map((c) => c.label).join("/") : top[0].label,
    sign: mixed ? (new Set(top.map((c) => phenotypeSign(c))).size === 1 ? phenotypeSign(top[0]) : null) : phenotypeSign(top[0]),
    plain: !mixed && plainLevel(top[0]),
    mixed,
    agree: top[0].n, n: ps.length,
    ratio: ratios.length ? mean(ratios) : null,
    rule: mixed ? null : top[0].rule,
  };
}

/** Profile token of one assay: "swim+", "swarm+ (hyper)", "twitch−", "swim?" (no phenotype), "swim n/a" (not tested). */
export function profileToken(assay, cell, labels = {}) {
  const name = labels[assay] ?? assay;
  if (!cell || !cell.n) return `${name} n/a`;
  const p = cell.phenotype;
  if (!p) return `${name}?`;
  if (p.sign == null) return `${name} (${p.label})`;
  return p.plain ? `${name}${p.sign}` : `${name}${p.sign} (${p.label})`;
}

// ------------------------------------------------------------------ grouping
function makeCell(assay, list) {
  const analysed = list.filter((e) => e.img.result);
  const diams = analysed.map((e) => e.m?.eqDiameterMm).filter(Number.isFinite);
  const areas = analysed.map((e) => e.m?.areaMm2).filter(Number.isFinite);
  const reps = new Set(list.filter((e) => !isBlank(e.eff.bioRep)).map((e) => `${e.exp?.id ?? ""}|${norm(e.eff.bioRep).toLowerCase()}`));
  const diam = stat(diams), area = stat(areas);
  const by = diams.length ? (e) => e.m?.eqDiameterMm : areas.length ? (e) => e.m?.areaMm2 : null;
  const target = diams.length ? diam.mean : area.mean;
  let representative = analysed[0] || list[0] || null;
  if (by) {
    let best = Infinity;
    for (const e of analysed) {
      const v = by(e);
      if (Number.isFinite(v) && Math.abs(v - target) < best) { best = Math.abs(v - target); representative = e; }
    }
  }
  return {
    assay, entries: list, n: analysed.length, nPending: list.length - analysed.length,
    nBioReps: reps.size ? reps.size : null,
    diam, area,
    fracComplete: analysed.length ? analysed.filter((e) => e.img.result.klass === "complete").length / analysed.length : null,
    representative,
    phenotype: aggregatePhenotype(analysed.map((e) => e.phenotype)),
  };
}

/**
 * Groups entries by isolate and assay type.
 * entries: [{ img, exp, eff, m, phenotype? }]; opts: { keyMode, labels } (labels: assay -> display name for profiles)
 * -> { isolates: [{ key, strain, condition, name, cells: { swim, swarm, twitch, other }, n, experiments: [names],
 *      profile, missing: [assays] }], assays: [assays present], unassigned: [{ img, exp, missing: ["strain"|"assayType"] }] }
 */
export function groupIsolates(entries, { keyMode = "strain", labels = {} } = {}) {
  const groups = new Map();
  const unassigned = [];
  for (const e of entries) {
    const iso = isolateOf(e.eff, keyMode);
    const assay = ALL_ASSAYS.includes(e.eff?.assayType) ? e.eff.assayType : null;
    if (!iso || !assay) {
      unassigned.push({ img: e.img, exp: e.exp, missing: [!iso && "strain", !assay && "assayType"].filter(Boolean) });
      continue;
    }
    let g = groups.get(iso.key);
    if (!g) groups.set(iso.key, (g = { ...iso, byAssay: Object.fromEntries(ALL_ASSAYS.map((a) => [a, []])) }));
    g.byAssay[assay].push(e);
  }
  const present = ALL_ASSAYS.filter((a) => [...groups.values()].some((g) => g.byAssay[a].length));
  const expected = PROFILE_ASSAYS.filter((a) => present.includes(a));
  const isolates = [...groups.values()].map((g) => {
    const cells = Object.fromEntries(ALL_ASSAYS.map((a) => [a, g.byAssay[a].length ? makeCell(a, g.byAssay[a]) : null]));
    const all = ALL_ASSAYS.flatMap((a) => g.byAssay[a]);
    return {
      key: g.key, strain: g.strain, condition: g.condition, name: isolateName(g), cells,
      n: all.filter((e) => e.img.result).length, nImages: all.length,
      experiments: [...new Set(all.map((e) => e.exp?.name).filter(Boolean))],
      // The profile and the missing assays use the assays tested in this scope: an experiment with only swim
      // plates does not make every isolate "missing" swarm and twitch.
      profile: (expected.length ? expected : PROFILE_ASSAYS).map((a) => profileToken(a, cells[a], labels)).join(" / "),
      missing: expected.filter((a) => !cells[a]),
    };
  }).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }));
  return { isolates, assays: present, expected, unassigned };
}

// -------------------------------------------------------------------- export
const r = (v, d) => (v == null || !Number.isFinite(v) ? "" : Math.round(v * 10 ** d) / 10 ** d);

/** Wide table (header first): one row per isolate, a block of columns per assay type. */
export function matrixRows(result, { assays = null } = {}) {
  const cols = assays || [...PROFILE_ASSAYS, ...(result.assays.includes("other") ? ["other"] : [])];
  const header = ["isolate", "strain", "condition", "experiments", "profile", "missing_assays",
    ...cols.flatMap((a) => ["n_images", "n_pending", "n_bio_reps", "eq_diameter_mm_mean", "eq_diameter_mm_sd", "area_mm2_mean", "area_mm2_sd",
      "fraction_complete", "phenotype", "phenotype_level", "phenotype_ratio", "phenotype_agreement", "representative_file"].map((c) => `${a}_${c}`))];
  const rows = result.isolates.map((iso) => [
    iso.name, iso.strain, iso.condition ?? "", iso.experiments.join("; "), iso.profile, iso.missing.join("; "),
    ...cols.flatMap((a) => {
      const c = iso.cells[a];
      if (!c) return Array(13).fill("");
      const p = c.phenotype;
      return [c.n, c.nPending, c.nBioReps ?? "", r(c.diam.mean, 3), r(c.diam.sd, 3), r(c.area.mean, 3), r(c.area.sd, 3),
        r(c.fracComplete, 3), p?.label ?? "", p?.level ?? "", r(p?.ratio, 3), p ? `${p.agree}/${p.n}` : "", c.representative?.img.name ?? ""];
    }),
  ]);
  return [header, ...rows];
}

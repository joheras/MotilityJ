// Motility phenotype classification (pure, no DOM): configurable rule sets that turn a measurement of the growth
// zone into a category ("Negative", "Low", "High"…), either with absolute cut-offs or relative to a reference strain.
// Thresholds are species- and assay-specific: the built-in presets are examples from the literature and must be
// validated for each organism and protocol.
//
// Rule set (settings.phenotypeRuleSets holds the custom ones; PRESETS are built in and read-only):
//   { id, name, source?, url?, assayType: "swim" | "swarm" | "twitch" | "any",
//     mode: "absolute" | "relative" | "anyZone", measure: "eqDiameterMm" | "areaMm2" | "feretMaxMm",
//     categories: [{ min, label, positive }],      // absolute / relative: ordered by min; min of the first is 0
//     minZoneMm,                                   // anyZone: inoculum footprint (equivalent diameter, mm)
//     reference: { field, value, match: [keys] } } // relative: reference images and the metadata that must match
// The experiment chooses its rule sets: exp.phenotypeRules = [rule set ids], in order of priority.
//
// Semantics
// - Category: the last one whose `min` ≤ value (value = the measure for absolute, value / reference mean for
//   relative). Lower bounds are inclusive, so bins written as 0–0.09 / 0.1–0.3 / 0.31–0.69 / > 0.7 are stored as
//   mins 0 / 0.10 / 0.31 / 0.70.
// - anyZone ("positive if any measurable zone"): positive when the equivalent diameter is larger than minZoneMm,
//   i.e. there is growth beyond the inoculation point. The default, 3 mm, is about the footprint of a stab or of a
//   1–2 µL drop; set it to the size of a non-motile control on your plates.
// - Relative: the reference images are the analysed images of the SAME experiment whose metadata field
//   (default strain) equals the reference value (case-insensitive), with the same effective assay type as the image
//   and the same values of the `match` fields (default incubation time). Ratio = image measure / mean reference
//   measure. Warnings: "refMissing" (no reference image: no category) and "refFew" (n < 2: ratio kept, uncertain).
// - Complete plates (growth reaches the rim) are treated as maximal: their measure is the plate's (diameter =
//   plate diameter, area = plate area, see measure.js) and the ratio is computed from it. The true zone may be
//   larger, so `capped` is true and the ratio is a lower bound.
// - The rule set of an image is the first of the experiment's rule sets whose assay type is the image's effective
//   assay type, or "any". Images without an assay type only match "any" rule sets ("noAssayType" otherwise).
//
// API for other views (e.g. per-isolate swim/swarm/twitch profiles):
//   classifyPhenotype(image, exp, settings, images = [image]) -> Phenotype | null
//   classifyImages(images, exp, settings, only = null) -> Map(image.id -> Phenotype | null)  (references computed
//     once; `only`: classify just that image id)
//   Phenotype = { label, level, levels, positive, value, measure, ratio, capped, isReference,
//                 rule: { id, name, mode, assayType }, reference: { mean, n, field, value } | null, warnings: [codes] }
//   label/level are null when the image cannot be classified (see warnings: notAnalysed, noMeasure, noAssayType,
//   noRule, refMissing). level is 0..levels-1 in the order of the categories. null = the experiment has no rule set.
import { effectiveMeta, isEmpty, measureSettings } from "./metadata.js";
import { measure } from "./measure.js";

export const PHENOTYPE_ASSAYS = ["swim", "swarm", "twitch", "any"];
export const PHENOTYPE_MODES = ["absolute", "relative", "anyZone"];
export const PHENOTYPE_MEASURES = ["eqDiameterMm", "areaMm2", "feretMaxMm"];
export const REFERENCE_FIELDS = ["strain", "condition"];
export const REFERENCE_MATCH = ["incubationTimeH", "condition", "agarPct"];
export const DEFAULT_MIN_ZONE_MM = 3;

export const PRESETS = [
  {
    id: "preset-pa-swarm-murray2010", builtin: true,
    name: "P. aeruginosa swarming vs PAO1 (Murray 2010)",
    source: "Murray TS et al. 2010, J Med Microbiol: swarming positive when the zone diameter is > 10% of PAO1",
    url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC2855384",
    assayType: "swarm", mode: "relative", measure: "eqDiameterMm",
    reference: { field: "strain", value: "PAO1", match: ["incubationTimeH"] },
    categories: [
      { min: 0, label: "Negative (< 0.10)", positive: false },
      { min: 0.10, label: "Low (0.10–0.30)", positive: true },
      { min: 0.31, label: "Intermediate (0.31–0.69)", positive: true },
      { min: 0.70, label: "High (≥ 0.70)", positive: true },
    ],
  },
  {
    id: "preset-pa-swim-anyzone", builtin: true,
    name: "P. aeruginosa swimming: any zone",
    source: "Murray TS et al. 2010, J Med Microbiol: swimming positive for any measurable zone",
    url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC2855384",
    assayType: "swim", mode: "anyZone", measure: "eqDiameterMm", minZoneMm: DEFAULT_MIN_ZONE_MM,
  },
  {
    id: "preset-ab-twitch-abs", builtin: true,
    name: "A. baumannii twitching (NM < 5 mm, IM 5–20 mm, HM > 20 mm)",
    source: "Absolute twitching cut-offs used for A. baumannii clinical isolates: non-motile < 5 mm, intermediate 5–20 mm, highly motile > 20 mm",
    url: "",
    assayType: "twitch", mode: "absolute", measure: "eqDiameterMm",
    categories: [
      { min: 0, label: "Non-motile (< 5 mm)", positive: false },
      { min: 5, label: "Intermediately motile (5–20 mm)", positive: true },
      { min: 20, label: "Highly motile (> 20 mm)", positive: true },
    ],
  },
];

const num = (v, d = null) => {
  const n = typeof v === "string" ? Number(v.trim().replace(",", ".")) : Number(v);
  return v == null || v === "" || !Number.isFinite(n) ? d : n;
};

/** A cleaned copy of a rule set (from settings, a backup or the editor). Categories are sorted by min. */
export function normalizeRuleSet(rs) {
  const mode = PHENOTYPE_MODES.includes(rs?.mode) ? rs.mode : "absolute";
  const out = {
    id: String(rs?.id || ""), name: String(rs?.name || "").trim().slice(0, 200),
    source: String(rs?.source || "").trim().slice(0, 500), url: String(rs?.url || "").trim().slice(0, 500),
    assayType: PHENOTYPE_ASSAYS.includes(rs?.assayType) ? rs.assayType : "any",
    mode,
    measure: PHENOTYPE_MEASURES.includes(rs?.measure) ? rs.measure : "eqDiameterMm",
  };
  if (rs?.builtin) out.builtin = true;
  if (mode === "anyZone") {
    out.measure = "eqDiameterMm";
    out.minZoneMm = Math.max(0, num(rs?.minZoneMm, DEFAULT_MIN_ZONE_MM));
    return out;
  }
  out.categories = (Array.isArray(rs?.categories) ? rs.categories : [])
    .map((c) => ({ min: Math.max(0, num(c?.min, 0)), label: String(c?.label || "").trim().slice(0, 100), positive: !!c?.positive }))
    .sort((a, b) => a.min - b.min);
  if (out.categories.length) out.categories[0].min = 0;
  if (mode === "relative") {
    const ref = rs?.reference || {};
    out.reference = {
      field: REFERENCE_FIELDS.includes(ref.field) ? ref.field : "strain",
      value: String(ref.value || "").trim().slice(0, 200),
      match: (Array.isArray(ref.match) ? ref.match : ["incubationTimeH"]).filter((k) => REFERENCE_MATCH.includes(k)),
    };
  }
  return out;
}

/** Problems of a (normalized) rule set: [] when it can be saved. Codes: name, categories, label, duplicateMin, refValue. */
export function validateRuleSet(rs) {
  const errors = [];
  if (!rs.name) errors.push("name");
  if (rs.mode === "anyZone") return errors;
  if (!rs.categories?.length) errors.push("categories");
  if (rs.categories?.some((c) => !c.label)) errors.push("label");
  if (rs.categories?.some((c, i) => i > 0 && c.min === rs.categories[i - 1].min)) errors.push("duplicateMin");
  if (rs.mode === "relative" && !rs.reference?.value) errors.push("refValue");
  return errors;
}

/** The categories of a rule set (anyZone: "No zone" / "Motile"). */
export function categoriesOf(rs) {
  if (rs.mode !== "anyZone") return rs.categories || [];
  const d = rs.minZoneMm ?? DEFAULT_MIN_ZONE_MM;
  return [{ min: 0, label: `No zone (≤ ${d} mm)`, positive: false }, { min: d, label: `Motile (> ${d} mm)`, positive: true }];
}

/** Built-in presets followed by the custom rule sets of the settings. */
export function allRuleSets(settings) {
  const custom = Array.isArray(settings?.phenotypeRuleSets) ? settings.phenotypeRuleSets : [];
  return [...PRESETS, ...custom.map(normalizeRuleSet).filter((r) => r.id && !r.builtin)];
}

export const findRuleSet = (id, settings) => allRuleSets(settings).find((r) => r.id === id) || null;

/** The rule sets the experiment applies, in priority order (unknown ids are skipped). */
export function activeRuleSets(exp, settings) {
  const ids = Array.isArray(exp?.phenotypeRules) ? exp.phenotypeRules : [];
  return ids.map((id) => findRuleSet(id, settings)).filter(Boolean);
}

/** Custom rule sets of a backup added to the current ones (ids already present are kept as they are). */
export function mergeRuleSets(current, incoming) {
  const out = Array.isArray(current) ? [...current] : [];
  for (const rs of Array.isArray(incoming) ? incoming : []) {
    if (rs?.id && !rs.builtin && !out.some((r) => r.id === rs.id) && !PRESETS.some((p) => p.id === rs.id)) out.push(normalizeRuleSet(rs));
  }
  return out;
}

export const newRuleSetId = () => `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

/** Index of the category of `value` (last with min ≤ value). */
export function categoryIndex(categories, value) {
  let k = -1;
  for (let i = 0; i < categories.length; i++) if (value >= categories[i].min) k = i;
  return k;
}

const sameText = (a, b) => !isEmpty(a) && !isEmpty(b) && String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
const sameValue = (a, b) => (isEmpty(a) && isEmpty(b)) || (typeof a === "number" || typeof b === "number" ? Number(a) === Number(b) : sameText(a, b));

export const isReferenceImage = (eff, rs) => rs.mode === "relative" && sameText(eff[rs.reference.field], rs.reference.value);

function ruleFor(eff, rules) {
  const assay = eff.assayType;
  return rules.find((r) => r.assayType === "any" || (!isEmpty(assay) && r.assayType === assay)) || null;
}

/**
 * Phenotypes of the images of one experiment: Map(image.id -> Phenotype | null). `images` should be all the
 * images of the experiment (the reference images are taken from them).
 */
export function classifyImages(images, exp, settings, only = null) {
  const out = new Map();
  const rules = activeRuleSets(exp, settings);
  if (!rules.length) {
    for (const img of images) out.set(img.id, null);
    return out;
  }
  // Measures are computed lazily: only for the classified images and the reference candidates.
  const rows = images.map((img) => {
    let m;
    return { img, eff: effectiveMeta(img, exp, settings), get m() { return m === undefined ? (m = measure(img, measureSettings(img, exp, settings))) : m; } };
  });
  const refCache = new Map();
  const reference = (row, rs) => {
    const key = JSON.stringify([rs.id, row.eff.assayType ?? null, ...rs.reference.match.map((k) => row.eff[k] ?? null)]);
    if (!refCache.has(key)) {
      const vals = rows.filter((r) => isReferenceImage(r.eff, rs) && sameValue(r.eff.assayType, row.eff.assayType)
        && rs.reference.match.every((k) => sameValue(r.eff[k], row.eff[k])))
        .map((r) => r.m?.[rs.measure]).filter((v) => Number.isFinite(v));
      refCache.set(key, { mean: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null, n: vals.length,
        field: rs.reference.field, value: rs.reference.value });
    }
    return refCache.get(key);
  };
  for (const row of rows) if (!only || only === row.img.id) out.set(row.img.id, classifyRow(row, rules, reference));
  return out;
}

function classifyRow(row, rules, reference) {
  const { img, eff } = row;
  const rs = ruleFor(eff, rules);
  const base = { label: null, level: null, levels: 0, positive: null, value: null, measure: null, ratio: null, capped: false,
    isReference: false, rule: null, reference: null, warnings: [] };
  if (!rs) {
    base.warnings.push(isEmpty(eff.assayType) ? "noAssayType" : "noRule");
    return base;
  }
  const cats = categoriesOf(rs);
  Object.assign(base, { rule: { id: rs.id, name: rs.name, mode: rs.mode, assayType: rs.assayType }, measure: rs.measure, levels: cats.length,
    isReference: isReferenceImage(eff, rs) });
  if (!img.result) { base.warnings.push("notAnalysed"); return base; }
  const v = row.m?.[rs.measure];
  if (!Number.isFinite(v)) { base.warnings.push("noMeasure"); return base; }
  base.value = v;
  base.capped = img.result.klass === "complete";
  let x = v;
  if (rs.mode === "relative") {
    const ref = reference({ eff }, rs);
    base.reference = ref;
    if (!ref.n || !(ref.mean > 0)) { base.warnings.push("refMissing"); return base; }
    if (ref.n < 2) base.warnings.push("refFew");
    x = base.ratio = v / ref.mean;
  }
  // anyZone: strictly larger than the inoculum footprint; the others: min inclusive.
  const k = rs.mode === "anyZone" ? (v > rs.minZoneMm ? 1 : 0) : categoryIndex(cats, x);
  if (k < 0) return base;
  return { ...base, label: cats[k].label, level: k, positive: cats[k].positive };
}

/** Phenotype of one image. `images`: the experiment's images, needed by relative rule sets (reference strain). */
export function classifyPhenotype(image, exp, settings, images = [image]) {
  const list = images.some((i) => i.id === image.id) ? images.map((i) => (i.id === image.id ? image : i)) : [...images, image];
  return classifyImages(list, exp, settings, image.id).get(image.id) ?? null;
}

/** Warnings of an experiment, one per distinct (rule set, reference group) problem:
 *  [{ code: "refMissing" | "refFew", rule, reference: { field, value, n }, assayType, match: { key: value } , images: n }] */
export function experimentWarnings(images, exp, settings, phenotypes = classifyImages(images, exp, settings)) {
  const groups = new Map();
  for (const img of images) {
    const p = phenotypes.get(img.id);
    if (!p?.rule) continue;
    for (const code of p.warnings.filter((w) => w === "refMissing" || w === "refFew")) {
      const rs = findRuleSet(p.rule.id, settings);
      const eff = effectiveMeta(img, exp, settings);
      const match = Object.fromEntries(rs.reference.match.map((k) => [k, eff[k] ?? null]));
      const key = JSON.stringify([code, rs.id, eff.assayType, match]);
      if (!groups.has(key)) groups.set(key, { code, rule: p.rule, reference: { field: rs.reference.field, value: rs.reference.value, n: p.reference?.n ?? 0 },
        assayType: eff.assayType, match, images: 0 });
      groups.get(key).images++;
    }
  }
  return [...groups.values()];
}

// Comparison of treated samples against controls (pure, no DOM): groups the images of an experiment into
// conditions, averages technical replicates within each biological replicate, and computes per condition
// n, mean ± SD, 95 % CI, % inhibition vs the control (± SD propagated by the delta method), Welch's t-test vs
// the control with Holm's correction within each family, and a one-way ANOVA per family.
//
// image.meta.role = "sample" (or empty) | "untreated" | "vehicle"   (a per-image metadata field, metadata.js)
// exp.compare = { measure, pairing, groupBy, reference }            (defaults in COMPARE_DEFAULTS)
//   measure:   "eqDiameterMm" (default: most papers report zone diameters) | "areaMm2"
//   pairing:   "group"  -> samples are compared with the controls that share the values of `groupBy`
//              "global" -> every sample is compared with all the controls of the experiment
//   groupBy:   metadata fields that define a group (e.g. strain + incubation time)
//   reference: "auto" (vehicle control if the group has one, else untreated) | "vehicle" | "untreated"
//
// Statistical unit: the biological replicate. Plates (technical replicates) with the same bioRep, group and
// condition are averaged first; an image without a bioRep counts as its own biological replicate. A complete
// plate has the plate size as its value (the zone reached the rim), which is a lower bound of the real motility.
import { measure } from "./measure.js";
import { effectiveMeta, isEmpty, measureSettings } from "./metadata.js";
import { anova, describe, holm, inhibition, stars, welch } from "./stats.js";

export const ROLES = ["sample", "untreated", "vehicle"];
export const CONTROL_ROLES = ["untreated", "vehicle"];
export const COMPARE_MEASURES = ["eqDiameterMm", "areaMm2"];
export const GROUP_FIELDS = ["strain", "incubationTimeH", "assayType", "agarPct", "medium", "incubationTempC"];
export const PAIRINGS = ["group", "global"];
export const REFERENCES = ["auto", "vehicle", "untreated"];
export const COMPARE_DEFAULTS = { measure: "eqDiameterMm", pairing: "group", groupBy: ["strain", "incubationTimeH"], reference: "auto" };

/** The comparison settings of an experiment, with defaults for missing or invalid values (old data, backups). */
export function compareSettings(exp) {
  const c = exp?.compare || {};
  return {
    measure: COMPARE_MEASURES.includes(c.measure) ? c.measure : COMPARE_DEFAULTS.measure,
    pairing: PAIRINGS.includes(c.pairing) ? c.pairing : COMPARE_DEFAULTS.pairing,
    groupBy: Array.isArray(c.groupBy) ? GROUP_FIELDS.filter((f) => c.groupBy.includes(f)) : [...COMPARE_DEFAULTS.groupBy],
    reference: REFERENCES.includes(c.reference) ? c.reference : COMPARE_DEFAULTS.reference,
  };
}

export const roleOf = (eff) => (CONTROL_ROLES.includes(eff?.role) ? eff.role : "sample");
export const isControl = (img) => CONTROL_ROLES.includes(img?.meta?.role);

const keyOf = (vals) => JSON.stringify(vals);
const natural = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

/** Biological replicates of a list of plates: [{ bioRep, value, plates }], technical replicates averaged. */
function bioUnits(plates) {
  const units = new Map();
  for (const p of plates) {
    const k = isEmpty(p.bioRep) ? `\u0000${p.imgId}` : `b:${p.bioRep}`;
    if (!units.has(k)) units.set(k, { bioRep: isEmpty(p.bioRep) ? null : p.bioRep, plates: [] });
    units.get(k).plates.push(p);
  }
  return [...units.values()].map((u) => ({ ...u, value: u.plates.reduce((s, p) => s + p.value, 0) / u.plates.length }));
}

function makeRow(entries, extra) {
  const plates = entries.filter((e) => e.value != null);
  const units = bioUnits(plates);
  const values = units.map((u) => u.value);
  const d = describe(values);
  return {
    ...extra,
    plates, units, values,
    n: d.n, nPlates: plates.length, nComplete: plates.filter((p) => p.complete).length,
    nUnmeasured: entries.length - plates.length,
    techAveraged: units.some((u) => u.plates.length > 1),
    bioMissing: plates.some((p) => isEmpty(p.bioRep)) && plates.some((p) => !isEmpty(p.bioRep)),
    mean: d.mean, sd: d.sd, sem: d.sem, ciLow: d.ciLow, ciHigh: d.ciHigh,
    inhibitionPct: null, inhibitionSd: null, t: null, df: null, p: null, pAdj: null, stars: "",
  };
}

/**
 * -> { settings, families: [{ key, groupVals, control, rows, anova }], rows, perImage: Map(imageId -> {...}),
 *      warnings: [{ code, ... }], nPending, nControls }
 * A family is the set of conditions compared with one control (a group, or the whole experiment when pairing is
 * global). family.rows excludes the control row; rows (flat) lists every row with its control first.
 */
export function buildComparison(images, exp, settings) {
  const cs = compareSettings(exp);
  const entries = [];
  let nPending = 0;
  for (const img of images) {
    if (!img.result) { nPending++; continue; }
    const eff = effectiveMeta(img, exp, settings);
    const m = measure(img, measureSettings(img, exp, settings));
    const v = m?.[cs.measure];
    const groupVals = cs.groupBy.map((f) => (isEmpty(eff[f]) ? null : eff[f]));
    entries.push({
      img, eff, role: roleOf(eff), condition: isEmpty(eff.condition) ? null : String(eff.condition), groupVals,
      value: v != null && Number.isFinite(v) ? v : null, complete: img.result.klass === "complete",
      bioRep: isEmpty(eff.bioRep) ? null : String(eff.bioRep), imgId: img.id,
    });
  }
  const nControls = entries.filter((e) => e.role !== "sample").length;
  const warnings = [];

  // Families: by group, or one for the whole experiment.
  const famMap = new Map();
  for (const e of entries) {
    const fk = cs.pairing === "global" ? "*" : keyOf(e.groupVals);
    if (!famMap.has(fk)) famMap.set(fk, { key: fk, groupVals: cs.pairing === "global" ? null : e.groupVals, entries: [] });
    famMap.get(fk).entries.push(e);
  }

  const perImage = new Map();
  const families = [];
  for (const fam of famMap.values()) {
    const has = (role) => fam.entries.some((e) => e.role === role);
    const ref = cs.reference === "auto" ? (has("vehicle") ? "vehicle" : has("untreated") ? "untreated" : null)
      : has(cs.reference) ? cs.reference : null;
    const ctlEntries = ref ? fam.entries.filter((e) => e.role === ref) : [];
    const ctlConds = [...new Set(ctlEntries.map((e) => e.condition))];
    const control = ctlEntries.length
      ? makeRow(ctlEntries, { key: `${fam.key}|control`, groupVals: fam.groupVals, condition: ctlConds.filter(Boolean).join(" + ") || null, role: ref, isControl: true })
      : null;
    if (control && ctlConds.length > 1) warnings.push({ code: "pooledControls", groupVals: fam.groupVals, conditions: ctlConds });

    // Rows: one per (group, role, condition) of the non-reference images.
    const rowMap = new Map();
    for (const e of fam.entries) {
      if (e.role === ref) continue;
      const rk = keyOf([cs.pairing === "global" ? e.groupVals : null, e.role, e.condition]);
      if (!rowMap.has(rk)) rowMap.set(rk, { groupVals: e.groupVals, role: e.role, condition: e.condition, list: [] });
      rowMap.get(rk).list.push(e);
    }
    const rows = [...rowMap.entries()].map(([rk, r]) => makeRow(r.list, { key: `${fam.key}|${rk}`, groupVals: r.groupVals, condition: r.condition, role: r.role, isControl: false }));
    rows.sort((a, b) => (a.role === "sample") - (b.role === "sample")
      || natural.compare(keyOf(a.groupVals), keyOf(b.groupVals)) || natural.compare(a.condition ?? "", b.condition ?? ""));

    if (control && control.n > 0) {
      for (const r of rows) {
        const inh = inhibition(r.mean, r.sd, control.mean, control.sd);
        r.inhibitionPct = inh.pct; r.inhibitionSd = inh.sd;
        const w = welch(r.values, control.values);
        if (w) Object.assign(r, { t: w.t, df: w.df, p: w.p });
      }
      holm(rows.map((r) => r.p)).forEach((p, i) => { rows[i].pAdj = p; rows[i].stars = stars(p); });
      control.inhibitionPct = 0;
      for (const e of fam.entries) {
        if (e.value != null) perImage.set(e.imgId, { inhibitionPct: (1 - e.value / control.mean) * 100, controlMean: control.mean, measure: cs.measure });
      }
    } else if (rows.some((r) => r.role === "sample" && r.nPlates)) {
      warnings.push({ code: "noControl", groupVals: fam.groupVals });
    }
    const all = [control, ...rows].filter((r) => r && r.n > 0);
    const av = control && all.length >= 2 ? anova(all.map((r) => r.values)) : null;
    families.push({ key: fam.key, groupVals: fam.groupVals, control, rows, anova: av, reference: ref });
  }
  families.sort((a, b) => natural.compare(keyOf(a.groupVals), keyOf(b.groupVals)));

  const flat = families.flatMap((f) => [f.control, ...f.rows].filter(Boolean));
  for (const r of flat) {
    if (r.nPlates && r.n < 3) warnings.push({ code: "lowN", row: r });
    if (r.bioMissing) warnings.push({ code: "bioMissing", row: r });
  }
  const nComplete = flat.reduce((s, r) => s + r.nComplete, 0);
  if (nComplete) warnings.push({ code: "complete", n: nComplete });
  if (nPending) warnings.push({ code: "pending", n: nPending });

  return { settings: cs, families, rows: flat, perImage, warnings, nPending, nControls };
}

// Machine-friendly column names of the comparison export (CSV and the "Comparison" sheet).
const round = (v, d) => (v == null || !Number.isFinite(v) ? "" : Math.round(v * 10 ** d) / 10 ** d);
const sig = (p) => (p == null || !Number.isFinite(p) ? "" : Number(p.toPrecision(4)));
const MEASURE_COL = { eqDiameterMm: "equivalent_diameter_mm", areaMm2: "area_mm2" };

/** Tidy comparison table (header first): one row per condition. groupCols: [{ key, col }] of the group fields. */
export function comparisonRows(cmp, groupCols) {
  const header = [
    ...groupCols.map((g) => g.col), "condition", "role", "is_reference_control", "measure",
    "n_biological_replicates", "n_plates", "n_complete_plates", "mean", "sd", "sem", "ci95_low", "ci95_high",
    "inhibition_pct", "inhibition_sd", "welch_t", "welch_df", "p_value", "p_holm", "significance",
    "anova_f", "anova_df1", "anova_df2", "anova_p", "control_mean", "control_n", "pairing", "replicate_values",
  ];
  const out = [header];
  const d = cmp.settings.measure === "areaMm2" ? 2 : 3;
  for (const f of cmp.families) {
    for (const r of [f.control, ...f.rows].filter(Boolean)) {
      out.push([
        ...groupCols.map((g) => { const i = cmp.settings.groupBy.indexOf(g.key); return i >= 0 && r.groupVals?.[i] != null ? r.groupVals[i] : ""; }),
        r.condition ?? "", r.role, r.isControl ? "yes" : "no", MEASURE_COL[cmp.settings.measure],
        r.n, r.nPlates, r.nComplete, round(r.mean, d), round(r.sd, d), round(r.sem, d), round(r.ciLow, d), round(r.ciHigh, d),
        round(r.inhibitionPct, 2), round(r.inhibitionSd, 2), round(r.t, 4), round(r.df, 3), sig(r.p), sig(r.pAdj), r.stars,
        round(f.anova?.F, 4), f.anova?.df1 ?? "", f.anova?.df2 ?? "", sig(f.anova?.p),
        round(f.control?.mean, d), f.control?.n ?? "", cmp.settings.pairing, r.values.map((v) => round(v, d)).join("; "),
      ]);
    }
  }
  return out;
}

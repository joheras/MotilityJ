// Columns of the results table and of the exports: metadata, measurements and notes of each image.
// The results table shows a configurable subset (settings.resultColumns); the tidy export has every column.
import { buildComparison } from "./compare.js";
import { t } from "./i18n.js";
import { measure } from "./measure.js";
import { EXPERIMENT_FIELDS, IMAGE_FIELDS, effectiveMeta, fieldDef, measureSettings } from "./metadata.js";

/** Context of one image row: effective metadata, measurements and, given the experiment's comparison
 *  (compare.js buildComparison), the % inhibition vs its control. */
export function rowContext(img, exp, settings, cmp = null) {
  const st = measureSettings(img, exp, settings);
  return { img, exp, eff: effectiveMeta(img, exp, settings), m: measure(img, st), settings: st, cmp: cmp?.perImage.get(img.id) ?? null };
}

// Columns with a long name get a short table header (short_<key> in i18n.js); the full name is its tooltip.
const SHORT = new Set(["bioRep", "techRep", "inhibitionPct", "incubationTimeH", "eqDiameterMm", "feretMaxMm", "feretMinMm", "coveragePct", "centroidOffsetMm"]);
const header = (key, label) => () => (SHORT.has(key) ? t(`short_${key}`) : label());
const meta = (key) => {
  const unit = fieldDef(key).unit;
  const label = () => (unit ? `${t(`meta_${key}`)} (${unit})` : t(`meta_${key}`));
  return { id: key, kind: "meta", key, label, header: header(key, label), value: (c) => c.eff[key] };
};
const mes = (key, digits) => {
  const label = () => t(`m_${key}`);
  return { id: key, kind: "measure", num: true, digits, label, header: header(key, label), value: (c) => c.m?.[key] ?? null };
};

/** Optional columns of the results table, in display order. */
export const TABLE_COLUMNS = [
  meta("strain"), meta("condition"), meta("bioRep"), meta("techRep"), meta("role"), meta("incubationTimeH"), meta("assayType"), meta("agarPct"),
  mes("areaMm2", 2), mes("eqDiameterMm", 2), mes("feretMaxMm", 2), mes("feretMinMm", 2), mes("perimeterMm", 2),
  mes("circularity", 3), mes("coveragePct", 1), mes("centroidOffsetMm", 2),
  { ...mes("inhibitionPct", 1), value: (c) => c.cmp?.inhibitionPct ?? null },
  { id: "notes", kind: "notes", label: () => t("colNotes"), header: () => t("colNotes"), value: (c) => c.img.notes || "" },
];

export const DEFAULT_COLUMNS = ["strain", "condition", "bioRep", "role", "areaMm2", "eqDiameterMm", "circularity", "coveragePct", "notes"];

export function visibleColumns(settings) {
  const ids = Array.isArray(settings.resultColumns) ? settings.resultColumns : DEFAULT_COLUMNS;
  return TABLE_COLUMNS.filter((c) => ids.includes(c.id));
}

const round = (v, d) => (v == null || !Number.isFinite(v) ? "" : Math.round(v * 10 ** d) / 10 ** d);

/** Rows (header first) as in the results table: file, class and the visible columns. */
export function tableRows(images, exp, settings) {
  const cols = visibleColumns(settings);
  const header = [t("colFile"), t("colClass"), ...cols.map((c) => c.label())];
  const cmp = cols.some((c) => c.id === "inhibitionPct") ? buildComparison(images, exp, settings) : null;
  const rows = images.map((img) => {
    const c = rowContext(img, exp, settings, cmp);
    return [img.name, img.result ? img.result.klass : "", ...cols.map((col) => {
      const v = col.value(c);
      return col.num ? round(v, col.digits) : v == null ? "" : v;
    })];
  });
  return [header, ...rows];
}

// Tidy data: one row per image, one column per variable, machine-friendly names with units.
const TIDY = [
  ["experiment", (c) => c.exp?.name ?? ""],
  ["file", (c) => c.img.name],
  ["class", (c) => c.img.result?.klass ?? ""],
  ["confidence", (c) => round(c.img.result?.confidence ?? null, 4)],
  ["edited_by_hand", (c) => (c.img.result ? (c.img.result.edited ? "yes" : "no") : "")],
  ...EXPERIMENT_FIELDS.map((f) => [f.col, (c) => c.eff[f.key] ?? ""]),
  ...IMAGE_FIELDS.filter((f) => !EXPERIMENT_FIELDS.some((e) => e.key === f.key)).map((f) => [f.col, (c) => c.eff[f.key] ?? ""]),
  ["area_mm2", (c) => round(c.m?.areaMm2, 3)],
  ["equivalent_diameter_mm", (c) => round(c.m?.eqDiameterMm, 3)],
  ["feret_max_mm", (c) => round(c.m?.feretMaxMm, 3)],
  ["feret_min_mm", (c) => round(c.m?.feretMinMm, 3)],
  ["perimeter_mm", (c) => round(c.m?.perimeterMm, 3)],
  ["circularity", (c) => round(c.m?.circularity, 4)],
  ["plate_coverage_pct", (c) => round(c.m?.coveragePct, 2)],
  ["centroid_offset_mm", (c) => round(c.m?.centroidOffsetMm, 3)],
  ["inhibition_pct", (c) => round(c.cmp?.inhibitionPct, 2)],
  ["inhibition_measure", (c) => (c.cmp ? { eqDiameterMm: "equivalent_diameter_mm", areaMm2: "area_mm2" }[c.cmp.measure] : "")],
  ["inhibition_control_mean", (c) => round(c.cmp?.controlMean, 3)],
  ["mm_per_px", (c) => round(c.m?.mmPerPx, 6)],
  ["scale_source", (c) => (c.m?.mmPerPx == null ? "" : c.settings.manualPxPerMm > 0 ? "manual" : "plate")],
  ["notes", (c) => c.img.notes || ""],
];

/** Tidy rows (header first) of the images of one or more experiments: [{ exp, images }]. */
export function tidyRows(groups, settings) {
  const rows = [TIDY.map(([name]) => name)];
  for (const { exp, images } of groups) {
    const cmp = buildComparison(images, exp, settings);
    for (const img of images) {
      const c = rowContext(img, exp, settings, cmp);
      rows.push(TIDY.map(([, f]) => f(c)));
    }
  }
  return rows;
}

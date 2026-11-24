// Assay metadata (pure, no DOM): experiment defaults (exp.meta), per-image values and overrides (image.meta),
// effective values, and checks. Motility assays are not standardised: results depend on the assay type, agar %,
// medium, plate volume, drying time, temperature and incubation time, so these are kept with every image.
//
// exp.meta   = { assayType, agarPct, medium, plateVolumeMl, dryingMin, incubationTempC, incubationTimeH, plateDiameterMm }
// image.meta = { strain, condition, bioRep, techRep, role, ...any experiment field as an override }
//   role: "sample" (or empty) | "untreated" | "vehicle" control, for the comparison vs control (compare.js)
// Empty values are null. An image value overrides the experiment value; plateDiameterMm falls back to Settings.

export const ASSAY_TYPES = ["swim", "swarm", "twitch", "other"];
export const IMAGE_ROLES = ["sample", "untreated", "vehicle"];

/** type: "select" | "number" | "text"; unit for labels and export column names; optionKey: i18n prefix of select options. */
export const EXPERIMENT_FIELDS = [
  { key: "assayType", type: "select", options: ASSAY_TYPES, optionKey: "assay", col: "assay_type" },
  { key: "agarPct", type: "number", unit: "%", min: 0, max: 10, step: "any", col: "agar_pct" },
  { key: "medium", type: "text", col: "medium" },
  { key: "plateVolumeMl", type: "number", unit: "mL", min: 0, step: "any", col: "plate_volume_ml" },
  { key: "dryingMin", type: "number", unit: "min", min: 0, step: "any", col: "drying_time_min" },
  { key: "incubationTempC", type: "number", unit: "°C", step: "any", col: "incubation_temp_c" },
  { key: "incubationTimeH", type: "number", unit: "h", min: 0, step: "any", col: "incubation_time_h" },
  { key: "plateDiameterMm", type: "number", unit: "mm", min: 1, step: "any", col: "plate_diameter_mm" },
];

export const IMAGE_FIELDS = [
  { key: "strain", type: "text", col: "strain" },
  { key: "condition", type: "text", col: "condition" },
  { key: "bioRep", type: "text", col: "biological_replicate" },
  { key: "techRep", type: "text", col: "technical_replicate" },
  { key: "incubationTimeH", type: "number", unit: "h", min: 0, step: "any", col: "incubation_time_h" },
  { key: "role", type: "select", options: IMAGE_ROLES, optionKey: "role", col: "role" },
];

const ALL_FIELDS = [...EXPERIMENT_FIELDS, ...IMAGE_FIELDS];
export const fieldDef = (key) => ALL_FIELDS.find((f) => f.key === key);

export const isEmpty = (v) => v == null || v === "" || (typeof v === "number" && !Number.isFinite(v));

/** Parses a form value to the field's type: number, trimmed string or null. */
export function parseValue(def, raw) {
  if (raw == null) return null;
  if (def.type === "number") {
    const s = String(raw).trim().replace(",", ".");
    if (s === "") return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }
  const s = String(raw).trim();
  if (def.type === "select") return def.options.includes(s) ? s : null;
  return s === "" ? null : s.slice(0, 200);
}

function clean(meta, fields) {
  const out = {};
  for (const def of fields) out[def.key] = parseValue(def, meta?.[def.key]);
  return out;
}

/** Fills missing metadata (data from before metadata existed, or from old backups). Mutates and returns exp. */
export function normalizeExperiment(exp) {
  if (exp) exp.meta = clean(exp.meta, EXPERIMENT_FIELDS);
  return exp;
}

/** Image meta keeps the image fields plus any non-empty experiment-field override. Mutates and returns image. */
export function normalizeImage(img) {
  if (!img) return img;
  const src = img.meta || {};
  const meta = clean(src, IMAGE_FIELDS);
  for (const def of EXPERIMENT_FIELDS) {
    if (def.key in meta) continue;
    const v = parseValue(def, src[def.key]);
    if (!isEmpty(v)) meta[def.key] = v;
  }
  img.meta = meta;
  if (img.notes == null) img.notes = "";
  return img;
}

/** Effective metadata of an image: experiment defaults overridden by the image's non-empty values. */
export function effectiveMeta(img, exp, settings) {
  const out = { ...clean(exp?.meta, EXPERIMENT_FIELDS) };
  for (const [k, v] of Object.entries(img?.meta || {})) if (!isEmpty(v)) out[k] = v;
  for (const def of IMAGE_FIELDS) if (!(def.key in out)) out[def.key] = null;
  if (isEmpty(out.plateDiameterMm) && settings) out.plateDiameterMm = settings.plateDiameterMm;
  return out;
}

/** Settings to measure an image with: the global settings with the effective plate diameter. */
export function measureSettings(img, exp, settings) {
  const d = effectiveMeta(img, exp, settings).plateDiameterMm;
  return d > 0 ? { ...settings, plateDiameterMm: d } : settings;
}

/** Fields whose effective value differs between the images of an experiment (assay type, agar %, plate Ø).
 *  -> [{ key, values: [distinct values] }] */
export function conflicts(images, exp, settings, keys = ["assayType", "agarPct", "plateDiameterMm"]) {
  const out = [];
  for (const key of keys) {
    const values = [...new Set(images.map((img) => effectiveMeta(img, exp, settings)[key]).filter((v) => !isEmpty(v)))];
    const unset = images.some((img) => isEmpty(effectiveMeta(img, exp, settings)[key]));
    if (values.length > 1) out.push({ key, values, unset });
  }
  return out;
}

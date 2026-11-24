// UI for the assay metadata: experiment conditions form, per-image fields, bulk edit, column chooser
// and the warning when the images of an experiment were grown in different conditions.
import { TABLE_COLUMNS, visibleColumns } from "./columns.js";
import { h } from "./dom.js";
import { t } from "./i18n.js";
import { EXPERIMENT_FIELDS, IMAGE_FIELDS, conflicts, fieldDef, isEmpty, parseValue } from "./metadata.js";
import { modal } from "./ui.js";

export const fieldLabel = (def) => t(`meta_${def.key}`);

const optionLabel = (def, o) => t(`${def.optionKey || "assay"}_${o}`);

/** Display text of a metadata value (select options translated). */
export function formatMeta(key, v) {
  if (isEmpty(v)) return "";
  const def = fieldDef(key);
  if (def?.type === "select") return optionLabel(def, v);
  return typeof v === "number" ? v.toLocaleString(undefined, { maximumFractionDigits: 4 }) : String(v);
}

/** An input or select for a field. placeholder: shown when empty (e.g. the inherited value). */
export function metaInput(def, value, { placeholder = "", onChange = null, className = "" } = {}) {
  let el;
  if (def.type === "select") {
    el = h("select", { class: className },
      h("option", { value: "" }, placeholder ? `${t("inherit")}: ${placeholder}` : "—"),
      def.options.map((o) => h("option", { value: o, selected: value === o }, optionLabel(def, o))));
  } else {
    el = h("input", { class: className, type: "text", inputmode: def.type === "number" ? "decimal" : null,
      value: isEmpty(value) ? "" : String(value), placeholder, maxlength: 200, autocomplete: "off" });
  }
  el.dataset.key = def.key;
  el.readValue = () => parseValue(def, el.value);
  if (onChange) el.addEventListener("change", () => onChange(el.readValue(), el));
  return el;
}

const labelWithUnit = (def) => (def.unit ? `${fieldLabel(def)} (${def.unit})` : fieldLabel(def));

/** Card with the experiment's assay conditions. onSave(meta) is awaited. */
export function assayCard(exp, settings, onSave, { open = false } = {}) {
  const inputs = EXPERIMENT_FIELDS.map((def) => metaInput(def, exp.meta?.[def.key],
    { placeholder: def.key === "plateDiameterMm" ? `${settings.plateDiameterMm} (${t("fromSettings")})` : "" }));
  const summary = EXPERIMENT_FIELDS.filter((d) => !isEmpty(exp.meta?.[d.key]))
    .map((d) => `${fieldLabel(d)}: ${formatMeta(d.key, exp.meta[d.key])}${d.unit && d.unit !== "%" ? ` ${d.unit}` : d.unit || ""}`).join(" · ");
  const form = h("form", { class: "meta-form", onsubmit: async (e) => {
    e.preventDefault();
    const meta = { ...exp.meta };
    for (const el of inputs) meta[el.dataset.key] = el.readValue();
    if (!isEmpty(meta.plateDiameterMm) && !(meta.plateDiameterMm > 0)) meta.plateDiameterMm = null;
    await onSave(meta);
  } },
  h("p", { class: "muted small" }, t("assayLead")),
  h("div", { class: "meta-grid" }, inputs.map((el) => h("label", null, labelWithUnit(fieldDef(el.dataset.key)), el))),
  h("div", { class: "actions" }, h("button", { class: "primary", type: "submit" }, t("save"))));
  return h("details", { class: "card assay-card", open },
    h("summary", null, h("h2", null, t("assayConditions")), h("span", { class: "muted small assay-summary" }, summary || t("assayNotSet"))),
    form);
}

/** Per-image metadata inputs. onChange(key, value) on every change. Experiment fields are shown as overrides. */
export function imageMetaFields(img, exp, settings, onChange) {
  const inherited = (def) => {
    const v = def.key === "plateDiameterMm" && isEmpty(exp.meta?.plateDiameterMm) ? settings.plateDiameterMm : exp.meta?.[def.key];
    return formatMeta(def.key, v);
  };
  const field = (def) => h("label", null, labelWithUnit(def),
    metaInput(def, img.meta?.[def.key], { placeholder: inherited(def), onChange: (v) => onChange(def.key, v) }));
  const overrides = EXPERIMENT_FIELDS.filter((d) => !IMAGE_FIELDS.some((f) => f.key === d.key));
  const nOverrides = overrides.filter((d) => !isEmpty(img.meta?.[d.key])).length;
  return h("div", { class: "image-meta" },
    h("div", { class: "meta-grid compact" }, IMAGE_FIELDS.map(field)),
    h("details", { class: "overrides", open: nOverrides > 0 },
      h("summary", { class: "small" }, t("overrideConditions"), nOverrides ? ` (${nOverrides})` : ""),
      h("p", { class: "help" }, t("overrideHelp")),
      h("div", { class: "meta-grid compact" }, overrides.map(field))));
}

/** Bulk edit of the metadata of several images. Resolves to { key: value } of the fields to set, or null. */
export function bulkEditDialog(images, exp) {
  const fields = [...IMAGE_FIELDS, ...EXPERIMENT_FIELDS.filter((d) => !IMAGE_FIELDS.some((f) => f.key === d.key))];
  const rows = fields.map((def) => {
    const values = [...new Set(images.map((i) => i.meta?.[def.key]).map((v) => (isEmpty(v) ? "" : v)))];
    const same = values.length === 1;
    const apply = h("input", { type: "checkbox", "aria-label": t("bulkApply") });
    const input = metaInput(def, same ? values[0] : null, { placeholder: same ? "" : t("multipleValues") });
    const mark = () => { apply.checked = true; };
    input.addEventListener("input", mark);
    input.addEventListener("change", mark);
    return { def, apply, input, el: h("div", { class: "bulk-row" }, apply, h("label", { class: "grow" }, labelWithUnit(def), input)) };
  });
  return modal((close) => h("form", { class: "bulk-form", onsubmit: (e) => {
    e.preventDefault();
    const out = {};
    for (const r of rows) if (r.apply.checked) out[r.def.key] = r.input.readValue();
    close(Object.keys(out).length ? out : null);
  } },
  h("h2", null, t("bulkEditTitle", { n: images.length })),
  h("p", { class: "muted small" }, t("bulkEditHelp")),
  h("div", { class: "bulk-rows" }, rows.map((r) => r.el)),
  h("div", { class: "actions dialog-actions" },
    h("button", { type: "button", onclick: () => close(null) }, t("cancel")),
    h("button", { type: "submit", class: "primary" }, t("bulkApplyButton")))));
}

/** Chooser of the optional columns of the results table. Resolves to the list of column ids, or null. */
export function columnsDialog(settings) {
  const shown = new Set(visibleColumns(settings).map((c) => c.id));
  const boxes = TABLE_COLUMNS.map((c) => {
    const box = h("input", { type: "checkbox", checked: shown.has(c.id), value: c.id });
    return { c, box };
  });
  const group = (kind, title) => h("fieldset", { class: "col-group" }, h("legend", null, title),
    boxes.filter((b) => b.c.kind === kind || (kind === "meta" && b.c.kind === "notes"))
      .map(({ c, box }) => h("label", { class: "check" }, box, c.label())));
  return modal((close) => h("form", { onsubmit: (e) => { e.preventDefault(); close(boxes.filter((b) => b.box.checked).map((b) => b.c.id)); } },
    h("h2", null, t("columnsTitle")),
    h("div", { class: "col-groups" }, group("meta", t("metadata")), group("measure", t("measurements"))),
    h("div", { class: "actions dialog-actions" },
      h("button", { type: "button", onclick: () => close("reset") }, t("columnsReset")),
      h("button", { type: "button", onclick: () => close(null) }, t("cancel")),
      h("button", { type: "submit", class: "primary" }, t("ok")))));
}

/** Warning when images of the experiment have different assay type, agar % or plate diameter; null otherwise. */
export function conflictWarning(images, exp, settings) {
  const list = conflicts(images, exp, settings);
  if (!list.length) return null;
  return h("div", { class: "warn meta-warning", role: "note" },
    h("b", null, "⚠ ", t("conflictTitle")), " ", t("conflictLead"),
    h("ul", null, list.map(({ key, values, unset }) => h("li", null, h("b", null, fieldLabel(fieldDef(key))), ": ",
      values.map((v) => formatMeta(key, v)).join(" · "), unset ? ` ${t("conflictUnset")}` : ""))));
}

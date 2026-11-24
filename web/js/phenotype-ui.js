// Phenotype UI: badges, the experiment's rule-set card, the review-page line and the rule-set editor of Settings.
import * as db from "./db.js";
import { fmtNumber, h } from "./dom.js";
import { t } from "./i18n.js";
import { fieldDef } from "./metadata.js";
import { fieldLabel, formatMeta } from "./metadata-ui.js";
import {
  PHENOTYPE_ASSAYS, PHENOTYPE_MEASURES, PHENOTYPE_MODES, REFERENCE_FIELDS, REFERENCE_MATCH, DEFAULT_MIN_ZONE_MM,
  activeRuleSets, allRuleSets, categoriesOf, experimentWarnings, newRuleSetId, normalizeRuleSet, validateRuleSet,
} from "./phenotype.js";
import { confirmDialog, modal, showError, toast } from "./ui.js";

const UNIT = { eqDiameterMm: "mm", feretMaxMm: "mm", areaMm2: "mm²" };

/** Colour class of a category: grey for negative, three blues for the positive ones (light -> dark). */
function levelClass(cats, level) {
  if (!cats[level]?.positive) return "ph-neg";
  const pos = cats.map((c, i) => (c.positive ? i : -1)).filter((i) => i >= 0);
  const j = pos.indexOf(level), n = pos.length;
  const f = n < 2 ? 1 : j / (n - 1);
  return f < 0.34 ? "ph-lo" : f < 0.67 ? "ph-mid" : "ph-hi";
}

const warningText = (p) => p.warnings.map((w) => t(`ph_w_${w}`)).join(" · ");

/** Badge of a phenotype (null -> nothing). Unclassified images show a muted dash with the reason as tooltip. */
export function phenotypeBadge(p, settings) {
  if (!p) return null;
  if (p.label == null) {
    if (p.warnings.includes("notAnalysed")) return null;
    return h("span", { class: "badge cat-na", title: warningText(p) }, "—");
  }
  const rs = allRuleSets(settings).find((r) => r.id === p.rule.id);
  const cls = rs ? levelClass(categoriesOf(rs), p.level) : "ph-neg";
  const tip = [p.rule.name, p.isReference ? t("phReferenceHint") : "", p.capped ? t("phCapped") : "", warningText(p)].filter(Boolean).join("\n");
  return h("span", { class: ["badge", "ph-badge", cls], title: tip },
    p.label, p.isReference ? h("span", { class: "ph-ref" }, " ★") : null, p.warnings.includes("refFew") ? " ⚠" : null);
}

/** Ratio as text: "≥ 1.23" for complete plates (lower bound), "" when there is none. */
export const ratioText = (p) => (p?.ratio == null ? "" : `${p.capped ? "≥ " : ""}${fmtNumber(p.ratio, 2)}`);

function contextText(w) {
  const parts = w.assayType ? [t("phCtxAssay", { assay: formatMeta("assayType", w.assayType) })] : [];
  for (const [k, v] of Object.entries(w.match)) parts.push(`${fieldLabel(fieldDef(k))} ${v == null ? "—" : formatMeta(k, v)}${k === "incubationTimeH" && v != null ? " h" : ""}`);
  return parts.join(", ");
}

/** Warning box for the reference problems of an experiment, or null. */
export function phenotypeWarning(images, exp, settings, phenotypes) {
  const list = experimentWarnings(images, exp, settings, phenotypes);
  if (!list.length) return null;
  return h("div", { class: "warn meta-warning", role: "note" },
    h("b", null, "⚠ ", t("phWarnTitle")),
    h("ul", null, list.map((w) => h("li", null, t(w.code === "refMissing" ? "phWarnMissing" : "phWarnFew", {
      rule: w.rule.name, field: fieldLabel(fieldDef(w.reference.field)), value: w.reference.value, context: contextText(w), images: w.images })))));
}

/** One-line description of a rule set (mode, measure, categories). */
function ruleSummary(rs) {
  const cats = categoriesOf(rs);
  const unit = rs.mode === "relative" ? t("phUnitRatio") : UNIT[rs.measure];
  const ref = rs.mode === "relative" ? ` · ${fieldLabel(fieldDef(rs.reference.field))} = ${rs.reference.value}` : "";
  return `${t(`phAssay_${rs.assayType}`)} · ${t(`phMode_${rs.mode}`)}${ref} · ${t(`phMeasure_${rs.measure}`)} · `
    + cats.map((c, i) => `${rs.mode === "anyZone" || i === 0 ? "" : `≥ ${c.min}: `}${c.label}${c.positive ? "+" : ""}`).join(" | ") + (rs.mode === "anyZone" ? "" : ` (${unit})`);
}

const sourceLine = (rs) => (rs.source || rs.url ? h("p", { class: "small muted ph-source" }, `${t("phSource")}: `, rs.source || "",
  rs.url ? [" ", h("a", { href: rs.url, target: "_blank", rel: "noreferrer" }, rs.url.replace(/^https?:\/\//, ""))] : null) : null);

/**
 * Card of the experiment page: which rule sets apply, counts per category and reference warnings.
 * onSave(ids) is awaited.
 */
export function phenotypeCard(exp, images, settings, phenotypes, onSave, { open = false } = {}) {
  const rules = allRuleSets(settings);
  const active = activeRuleSets(exp, settings);
  const chosen = new Set(active.map((r) => r.id));
  const missing = (exp.phenotypeRules || []).some((id) => !rules.some((r) => r.id === id));
  const boxes = rules.map((rs) => {
    const box = h("input", { type: "checkbox", checked: chosen.has(rs.id), value: rs.id });
    return h("label", { class: "check ph-choice" }, box,
      h("span", null, h("b", null, rs.name), rs.builtin ? h("span", { class: "tag" }, t("phBuiltin")) : null,
        h("br"), h("span", { class: "small muted" }, ruleSummary(rs)), sourceLine(rs)));
  });
  const form = h("form", { class: "meta-form", onsubmit: async (e) => {
    e.preventDefault();
    const ids = boxes.map((b) => b.querySelector("input")).filter((b) => b.checked).map((b) => b.value);
    await onSave(ids);
  } },
  h("p", { class: "muted small" }, t("phNoneLead")),
  h("p", { class: "warn small" }, t("phCaution")),
  missing ? h("p", { class: "small error" }, t("phUnknownRule")) : null,
  h("fieldset", { class: "col-group ph-choices" }, h("legend", null, t("phChoose")), boxes),
  h("div", { class: "actions" }, h("a", { href: "#/settings", class: "small" }, t("phEditRules")), h("button", { class: "primary", type: "submit" }, t("save"))));

  const counts = active.map((rs) => {
    const cats = categoriesOf(rs);
    const ps = images.map((i) => phenotypes.get(i.id)).filter((p) => p?.rule?.id === rs.id);
    if (!ps.length) return null;
    const n = cats.map((_, k) => ps.filter((p) => p.level === k).length);
    const none = ps.filter((p) => p.level == null).length;
    return h("div", { class: "ph-counts" }, h("b", { class: "small" }, rs.name),
      h("div", { class: "thumb-badges ph-count-row" },
        cats.map((c, k) => (n[k] ? h("span", { class: ["badge", "ph-badge", levelClass(cats, k)] }, `${c.label}: ${n[k]}`) : null)),
        none ? h("span", { class: "badge cat-na" }, `${t("phUnclassified")}: ${none}`) : null));
  }).filter(Boolean);

  const summary = active.length ? active.map((r) => r.name).join(" · ") : t("phNone");
  return h("details", { class: "card assay-card ph-card", open: open || null },
    h("summary", null, h("h2", null, t("phTitle")), h("span", { class: "muted small assay-summary" }, summary)),
    counts.length ? h("div", { class: "ph-count-list" }, counts) : null,
    form);
}

/** Phenotype block of the review page. */
export function reviewPhenotype(p, settings) {
  if (!p) return null;
  const unit = UNIT[p.measure] || "";
  return h("div", { class: "ph-review" },
    h("div", { class: "muted small" }, t("phTitle")),
    h("div", { class: "ph-review-main" }, phenotypeBadge(p, settings) || h("span", { class: "muted" }, "—"),
      p.ratio != null ? h("span", { class: "num" }, ` ${t("phRatioShort")} ${ratioText(p)}`) : null),
    h("div", { class: "small muted" }, t("phRuleLine", { name: p.rule?.name ?? "—" })),
    p.reference?.n ? h("div", { class: "small muted" }, t("phRefLine", { value: p.reference.value, mean: `${fmtNumber(p.reference.mean, 2)} ${unit}`, n: p.reference.n })) : null,
    p.capped ? h("div", { class: "small muted" }, t("phCapped")) : null,
    p.warnings.length ? h("div", { class: "small warn-text" }, "⚠ ", warningText(p)) : null);
}

// ------------------------------------------------------------------ settings
function select(options, value, label) {
  return h("select", null, options.map((o) => h("option", { value: o, selected: o === value }, label(o))));
}

/** Editor dialog of a rule set. Resolves to the normalized rule set or null. */
export function ruleSetDialog(initial) {
  const rs = normalizeRuleSet(initial);
  const name = h("input", { value: rs.name, maxlength: 200, autofocus: true });
  const assay = select(PHENOTYPE_ASSAYS, rs.assayType, (o) => t(`phAssay_${o}`));
  const measureSel = select(PHENOTYPE_MEASURES, rs.measure, (o) => t(`phMeasure_${o}`));
  const source = h("input", { value: rs.source, maxlength: 500 });
  const url = h("input", { type: "url", value: rs.url, maxlength: 500, placeholder: "https://" });
  const modeRadios = PHENOTYPE_MODES.map((m) => h("label", { class: "check" },
    h("input", { type: "radio", name: "ph-mode", value: m, checked: rs.mode === m, onchange: () => sync() }),
    h("span", null, h("b", null, t(`phMode_${m}`)), h("br"), h("span", { class: "small muted" }, t(`phMode_${m}_help`)))));
  const ref = rs.reference || { field: "strain", value: "", match: ["incubationTimeH"] };
  const refField = select(REFERENCE_FIELDS, ref.field, (k) => fieldLabel(fieldDef(k)));
  const refValue = h("input", { value: ref.value, placeholder: t("phRefValuePlaceholder"), maxlength: 200 });
  const matchBoxes = REFERENCE_MATCH.map((k) => h("input", { type: "checkbox", value: k, checked: ref.match.includes(k) }));
  const minZone = h("input", { type: "number", min: 0, step: "any", value: String(rs.minZoneMm ?? DEFAULT_MIN_ZONE_MM) });

  let cats = (rs.categories?.length ? rs.categories : [{ min: 0, label: "", positive: false }]).map((c) => ({ ...c }));
  const catBody = h("tbody");
  const unitEl = h("span", { class: "small muted" });
  function drawCats() {
    catBody.replaceChildren(...cats.map((c, i) => h("tr", null,
      h("td", null, h("input", { type: "number", min: 0, step: "any", value: String(c.min), disabled: i === 0, "aria-label": t("phFrom"),
        oninput: (e) => { c.min = e.target.value; } })),
      h("td", null, h("input", { value: c.label, maxlength: 100, "aria-label": t("phLabel"), oninput: (e) => { c.label = e.target.value; } })),
      h("td", { class: "ph-pos" }, h("input", { type: "checkbox", checked: c.positive, "aria-label": t("phPositive"), onchange: (e) => { c.positive = e.target.checked; } })),
      h("td", null, cats.length > 1 ? h("button", { type: "button", class: "small ghost danger", title: t("remove"), "aria-label": t("remove"),
        onclick: () => { cats.splice(i, 1); drawCats(); } }, "✕") : null))));
  }
  const relBox = h("fieldset", { class: "col-group" }, h("legend", null, t("phMode_relative")),
    h("div", { class: "meta-grid compact" }, h("label", null, t("phRefField"), refField), h("label", null, t("phRefValue"), refValue)),
    h("p", { class: "small" }, t("phRefMatch")),
    h("div", { class: "ph-match" }, matchBoxes.map((b) => h("label", { class: "check" }, b, fieldLabel(fieldDef(b.value))))));
  const zoneBox = h("fieldset", { class: "col-group" }, h("legend", null, t("phMode_anyZone")),
    h("label", null, t("phMinZone"), minZone), h("p", { class: "help" }, t("phMinZoneHelp")));
  const measureLabel = h("label", null, t("phMeasure"), measureSel);
  const catBox = h("fieldset", { class: "col-group" }, h("legend", null, t("phCategories"), " ", unitEl),
    h("p", { class: "help" }, t("phCategoriesHelp")),
    h("div", { class: "table-wrap" }, h("table", { class: "results ph-cat-table" },
      h("thead", null, h("tr", null, h("th", null, t("phFrom")), h("th", null, t("phLabel")), h("th", null, t("phPositive")), h("th"))), catBody)),
    h("button", { type: "button", class: "small", onclick: () => {
      const last = cats[cats.length - 1];
      cats.push({ min: (Number(last?.min) || 0) + 1, label: "", positive: true });
      drawCats();
    } }, "+ ", t("phAddCategory")));
  const mode = () => modeRadios.map((l) => l.querySelector("input")).find((r) => r.checked)?.value || "absolute";
  function sync() {
    const m = mode();
    relBox.hidden = m !== "relative";
    zoneBox.hidden = m !== "anyZone";
    catBox.hidden = m === "anyZone";
    measureLabel.hidden = m === "anyZone";
    unitEl.textContent = `(${m === "relative" ? t("phUnitRatio") : UNIT[measureSel.value]})`;
  }
  measureSel.addEventListener("change", sync);
  drawCats();
  sync();

  return modal((close) => h("form", { class: "ph-editor", onsubmit: (e) => {
    e.preventDefault();
    const out = normalizeRuleSet({
      id: rs.id, name: name.value, source: source.value, url: url.value, assayType: assay.value, mode: mode(), measure: measureSel.value,
      minZoneMm: minZone.value, categories: cats,
      reference: { field: refField.value, value: refValue.value, match: matchBoxes.filter((b) => b.checked).map((b) => b.value) },
    });
    const errors = validateRuleSet(out);
    if (errors.length) { toast(errors.map((c) => t(`phErr_${c}`)).join(" "), "error"); return; }
    close(out);
  } },
  h("h2", null, t("phEditTitle")),
  h("p", { class: "warn small" }, t("phCaution")),
  h("div", { class: "meta-grid" }, h("label", null, t("phName"), name), h("label", null, t("phAssayType"), assay), measureLabel),
  h("fieldset", { class: "col-group" }, h("legend", null, t("phMode")), h("div", { class: "ph-modes" }, modeRadios)),
  relBox, zoneBox, catBox,
  h("div", { class: "meta-grid" }, h("label", null, t("phSourceField"), source), h("label", null, t("phUrl"), url)),
  h("div", { class: "actions dialog-actions" },
    h("button", { type: "button", onclick: () => close(null) }, t("cancel")),
    h("button", { type: "submit", class: "primary" }, t("save")))));
}

/** Settings card: built-in presets (read-only, can be duplicated) and custom rule sets (edit, duplicate, delete). */
export function phenotypeSettingsSection(ctx) {
  const card = h("section", { class: "card ph-settings" });
  const custom = () => (Array.isArray(ctx.settings.phenotypeRuleSets) ? ctx.settings.phenotypeRuleSets : []);
  async function save(list) {
    ctx.settings = { ...ctx.settings, phenotypeRuleSets: list };
    try { await db.saveSettings(ctx.settings); toast(t("settingsSaved"), "ok"); } catch (e) { showError(e); }
    draw();
  }
  async function edit(rs, { copy = false } = {}) {
    const init = copy ? { ...rs, builtin: false, id: newRuleSetId(), name: t("phCopyOf", { name: rs.name }) } : rs;
    const out = await ruleSetDialog(init);
    if (!out) return;
    const list = custom().filter((r) => r.id !== out.id);
    const at = custom().findIndex((r) => r.id === out.id);
    list.splice(at < 0 ? list.length : at, 0, out);
    await save(list);
  }
  function draw() {
    const items = allRuleSets(ctx.settings).map((rs) => h("li", { class: "ph-rule" },
      h("div", { class: "grow" }, h("b", null, rs.name), rs.builtin ? h("span", { class: "tag" }, t("phBuiltin")) : null,
        h("br"), h("span", { class: "small muted" }, ruleSummary(rs)), sourceLine(rs)),
      h("div", { class: "btn-row" },
        rs.builtin ? null : h("button", { class: "small", onclick: () => edit(rs) }, t("phEdit")),
        h("button", { class: "small", onclick: () => edit(rs, { copy: true }) }, t("phDuplicate")),
        rs.builtin ? null : h("button", { class: "small ghost danger", onclick: async () => {
          if (!(await confirmDialog(t("phDeleteConfirm", { name: rs.name }), { ok: t("delete"), danger: true }))) return;
          await save(custom().filter((r) => r.id !== rs.id));
          toast(t("phDeleted"));
        } }, t("delete")))));
    card.replaceChildren(
      h("h2", null, t("phRules")),
      h("p", { class: "muted" }, t("phRulesLead")),
      h("p", { class: "warn small" }, t("phCaution"), " ", h("a", { href: "#/help/phenotype" }, t("help"))),
      h("ul", { class: "ph-rule-list" }, items),
      h("div", { class: "actions" }, h("button", { class: "primary", onclick: () => edit({ id: newRuleSetId(), name: "", assayType: "any", mode: "absolute",
        categories: [{ min: 0, label: "Negative", positive: false }, { min: 5, label: "Positive", positive: true }] }) }, "+ ", t("phNew"))));
  }
  draw();
  return card;
}

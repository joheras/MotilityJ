// "Comparison vs control" card of the experiment page: settings (measure, pairing, group fields, reference
// control), warnings, one table and one dot plot per family (conditions compared with one control).
import * as db from "./db.js";
import { fmtNumber, h, s } from "./dom.js";
import { COMPARE_MEASURES, GROUP_FIELDS, PAIRINGS, REFERENCES, buildComparison, compareSettings } from "./compare.js";
import { comparisonTable, csvBlob, download, safeFileName } from "./export.js";
import { t } from "./i18n.js";
import { effectiveMeta, fieldDef } from "./metadata.js";
import { fieldLabel, formatMeta } from "./metadata-ui.js";
import { showError } from "./ui.js";

const unitOf = (measure) => (measure === "areaMm2" ? "mm²" : "mm");
const fmtP = (p) => (p == null || !Number.isFinite(p) ? "—" : p < 1e-4 ? "< 0.0001" : fmtNumber(p, p < 0.001 ? 4 : 3));

/** "Strain: PAO1 · Incubation time: 24 h" (unset fields left out), or "" when no group field is set. */
function groupLabel(groupBy, vals) {
  if (!vals) return "";
  return groupBy.map((f, i) => {
    if (vals[i] == null) return null;
    const def = fieldDef(f);
    return `${fieldLabel(def)}: ${formatMeta(f, vals[i])}${def.unit && def.unit !== "%" ? ` ${def.unit}` : def.unit || ""}`;
  }).filter(Boolean).join(" · ");
}

export const rowLabel = (r) => r.condition ?? (r.role === "sample" ? t("noCondition") : t(`role_${r.role}`));

/** Effective plate diameter of the experiment (most frequent among the images). */
function plateDiameter(images, exp, settings) {
  const counts = new Map();
  for (const img of images) {
    const d = effectiveMeta(img, exp, settings).plateDiameterMm;
    if (d > 0) counts.set(d, (counts.get(d) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? settings.plateDiameterMm;
}

function niceTicks(max, n = 5) {
  const raw = max / n, mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((k) => k * mag).find((k) => k >= raw);
  return Array.from({ length: Math.floor(max / step) + 1 }, (_, i) => i * step);
}

/** Bar (mean) + error bar (SD) + one dot per biological replicate; complete plates as hollow squares at the plate size. */
function plot(family, cs, plateSize, title) {
  const rows = [family.control, ...family.rows].filter((r) => r && r.nPlates);
  if (!rows.length) return null;
  const m = { l: 56, r: 16, t: 24, b: 48 };
  const bw = 84, W = m.l + m.r + bw * rows.length, H = 280;
  const top = Math.max(plateSize, ...rows.flatMap((r) => [...r.values, ...r.plates.map((p) => p.value), (r.mean ?? 0) + (r.sd ?? 0)])) * 1.12;
  const Y = (v) => H - m.b - (v / top) * (H - m.t - m.b);
  const g = [];
  for (const v of niceTicks(top)) {
    g.push(s("line", { x1: m.l, x2: W - m.r, y1: Y(v), y2: Y(v), class: "grid" }));
    g.push(s("text", { x: m.l - 6, y: Y(v) + 4, class: "tick", "text-anchor": "end" }, fmtNumber(v, v % 1 ? 1 : 0)));
  }
  g.push(s("line", { x1: m.l, x2: W - m.r, y1: Y(plateSize), y2: Y(plateSize), class: "ceiling" },
    s("title", null, t("plateSizeLine", { v: fmtNumber(plateSize, 1), u: unitOf(cs.measure) }))));
  g.push(s("text", { x: W - m.r, y: Y(plateSize) - 4, class: "tick", "text-anchor": "end" }, t("plateSize")));
  rows.forEach((r, i) => {
    const cx = m.l + bw * (i + 0.5);
    const tip = `${rowLabel(r)}${r.role !== "sample" ? ` (${t(`role_${r.role}`)})` : ""}: ${fmtNumber(r.mean, 2)}${r.sd != null ? ` ± ${fmtNumber(r.sd, 2)}` : ""} ${unitOf(cs.measure)} (n = ${r.n})`;
    if (r.mean != null) g.push(s("rect", { x: cx - bw * 0.3, y: Y(r.mean), width: bw * 0.6, height: Math.max(0, Y(0) - Y(r.mean)), class: r.role !== "sample" ? "cmp-bar control" : "cmp-bar" }, s("title", null, tip)));
    if (r.sd != null) {
      const y1 = Y(r.mean + r.sd), y2 = Y(Math.max(0, r.mean - r.sd));
      g.push(s("path", { d: `M${cx},${y1}V${y2}M${cx - 9},${y1}H${cx + 9}M${cx - 9},${y2}H${cx + 9}`, class: "cmp-err" }));
    }
    // Technical replicates (individual plates) as small faint dots behind their biological replicate.
    if (r.techAveraged) r.plates.forEach((p, j) => g.push(s("circle", { cx: cx + ((j % 5) - 2) * 4, cy: Y(p.value), r: 2.2, class: "cmp-plate" }, s("title", null, `${p.img.name}: ${fmtNumber(p.value, 2)}`))));
    r.units.forEach((u, j) => {
      const x = cx + (r.units.length > 1 ? (j / (r.units.length - 1) - 0.5) * bw * 0.42 : 0);
      const complete = u.plates.some((p) => p.complete);
      const tipU = `${u.bioRep != null ? `${t("short_bioRep")} ${u.bioRep}` : u.plates[0].img.name}: ${fmtNumber(u.value, 2)} ${unitOf(cs.measure)}${complete ? ` (${t("complete")})` : ""}`;
      g.push(complete
        ? s("rect", { x: x - 4.5, y: Y(u.value) - 4.5, width: 9, height: 9, class: "cmp-dot complete" }, s("title", null, tipU))
        : s("circle", { cx: x, cy: Y(u.value), r: 4.5, class: "cmp-dot" }, s("title", null, tipU)));
    });
    if (r.stars) g.push(s("text", { x: cx, y: Y((r.mean ?? 0) + (r.sd ?? 0)) - 8, class: "cmp-stars", "text-anchor": "middle" }, r.stars));
    const label = rowLabel(r);
    g.push(s("text", { x: cx, y: H - m.b + 16, class: "tick", "text-anchor": "middle" }, label.length > 13 ? `${label.slice(0, 12)}…` : label, s("title", null, label)));
    g.push(s("text", { x: cx, y: H - m.b + 31, class: "tick", "text-anchor": "middle" }, `n = ${r.n}`));
  });
  g.push(s("line", { x1: m.l, x2: m.l, y1: m.t, y2: H - m.b, class: "axis" }), s("line", { x1: m.l, x2: W - m.r, y1: H - m.b, y2: H - m.b, class: "axis" }));
  g.push(s("text", { x: 14, y: (m.t + H - m.b) / 2, class: "axis-label", "text-anchor": "middle", transform: `rotate(-90 14 ${(m.t + H - m.b) / 2})` }, t(`cmp_${cs.measure}`)));
  return h("figure", { class: "chart cmp-chart" }, title ? h("figcaption", null, title) : null,
    s("svg", { viewBox: `0 0 ${W} ${H}`, style: `max-width: ${Math.max(W, 320) * 1.25}px`, role: "img", "aria-label": `${t("comparison")} ${title || ""}` }, g));
}

function table(family, cs, showGroup) {
  const u = unitOf(cs.measure);
  const tr = (r) => h("tr", { class: r.isControl ? "cmp-control" : null },
    showGroup ? h("td", null, r.isControl ? t("allImages") : groupLabel(cs.groupBy, r.groupVals)) : null,
    h("td", null, h("b", null, rowLabel(r)), r.isControl ? h("span", { class: "tag cmp-tag" }, t("reference")) : null),
    h("td", null, t(`role_${r.role}`)),
    h("td", { class: "num", title: t("nTitle") }, r.n < 3 && r.nPlates ? h("span", { class: "cmp-low", title: t("lowNHint") }, "⚠ ") : null, r.n,
      r.nPlates !== r.n ? h("small", { class: "muted" }, ` (${r.nPlates})`) : null,
      r.nComplete ? h("small", { class: "cmp-complete", title: t("completeHint") }, ` ▣${r.nComplete}`) : null),
    h("td", { class: "num" }, r.mean == null ? "—" : `${fmtNumber(r.mean, 2)}${r.sd != null ? ` ± ${fmtNumber(r.sd, 2)}` : ""}`),
    h("td", { class: "num muted" }, r.ciLow == null ? "—" : `${fmtNumber(r.ciLow, 2)} – ${fmtNumber(r.ciHigh, 2)}`),
    h("td", { class: "num" }, r.isControl ? "0" : r.inhibitionPct == null ? "—" : `${fmtNumber(r.inhibitionPct, 1)}${r.inhibitionSd != null ? ` ± ${fmtNumber(r.inhibitionSd, 1)}` : ""}`),
    h("td", { class: "num", title: r.p != null ? `${t("pRaw")}: ${fmtP(r.p)} · t = ${fmtNumber(r.t, 3)}, df = ${fmtNumber(r.df, 2)}` : null }, r.isControl ? "" : fmtP(r.pAdj)),
    h("td", { class: ["cmp-sig", r.stars && r.stars !== "ns" ? "sig" : null] }, r.stars));
  return h("div", { class: "table-wrap" }, h("table", { class: "results cmp-table" },
    h("thead", null, h("tr", null, showGroup ? h("th", null, t("group")) : null, h("th", null, t("meta_condition")), h("th", null, t("meta_role")),
      h("th", { class: "num", title: t("nTitle") }, t("nBio")), h("th", { class: "num" }, `${t("meanSd")} (${u})`), h("th", { class: "num" }, t("ci95")),
      h("th", { class: "num", title: t("inhibitionHint") }, t("inhibitionSd")), h("th", { class: "num", title: t("pHolmHint") }, t("pHolm")), h("th"))),
    h("tbody", null, [family.control, ...family.rows].filter(Boolean).map(tr))));
}

function warningList(cmp) {
  const cs = cmp.settings, items = [];
  const named = (r) => (r.role === "sample" || !r.condition ? rowLabel(r) : `${rowLabel(r)}, ${t(`role_${r.role}`).toLowerCase()}`);
  const low = cmp.warnings.filter((w) => w.code === "lowN").map((w) => `${named(w.row)} (n = ${w.row.n})`);
  for (const w of cmp.warnings) {
    if (w.code === "noControl") items.push(t("warnNoControl", { g: groupLabel(cs.groupBy, w.groupVals) || t("allImages") }));
    if (w.code === "pooledControls") items.push(t("warnPooled", { g: groupLabel(cs.groupBy, w.groupVals) || t("allImages"), c: w.conditions.map((c) => c ?? "—").join(", ") }));
    if (w.code === "complete") items.push(t("warnComplete", { n: w.n }));
    if (w.code === "bioMissing") items.push(t("warnBioMissing", { c: named(w.row) }));
    if (w.code === "pending") items.push(t("warnPending", { n: w.n }));
  }
  if (low.length) items.unshift(t("warnLowN", { list: low.join(", ") }));
  return items.length ? h("div", { class: "warn cmp-warn", role: "note" }, h("ul", null, items.map((x) => h("li", null, x)))) : null;
}

function settingsForm(exp, cs, save) {
  const sel = (key, options, label) => h("label", null, label,
    h("select", { onchange: (e) => save({ ...cs, [key]: e.target.value }) },
      options.map((o) => h("option", { value: o, selected: cs[key] === o }, t(`cmp_${key}_${o}`)))));
  const groupBoxes = GROUP_FIELDS.map((f) => h("label", { class: "check" },
    h("input", { type: "checkbox", checked: cs.groupBy.includes(f),
      onchange: (e) => save({ ...cs, groupBy: e.target.checked ? [...cs.groupBy, f] : cs.groupBy.filter((x) => x !== f) }) }),
    fieldLabel(fieldDef(f))));
  return h("div", { class: "cmp-settings" },
    h("div", { class: "cmp-selects" },
      h("label", null, t("cmpMeasure"), h("select", { onchange: (e) => save({ ...cs, measure: e.target.value }) },
        COMPARE_MEASURES.map((o) => h("option", { value: o, selected: cs.measure === o }, t(`cmp_${o}`))))),
      sel("pairing", PAIRINGS, t("cmpPairing")),
      sel("reference", REFERENCES, t("cmpReference"))),
    h("fieldset", { class: "cmp-groupby" }, h("legend", null, cs.pairing === "group" ? t("cmpGroupBy") : t("cmpGroupRows")), groupBoxes));
}

/** The card. Re-renders itself when its settings change (saved in exp.compare). */
export function comparisonCard(exp, images, settings) {
  const cs = compareSettings(exp);
  const cmp = buildComparison(images, exp, settings);
  let card;
  const save = async (next) => {
    exp.compare = next;
    exp.updated = Date.now();
    try { await db.putExperiment(exp); } catch (e) { showError(e); }
    const fresh = comparisonCard(exp, images, settings);
    fresh.open = true;
    card.replaceWith(fresh);
  };
  const d = plateDiameter(images, exp, settings);
  const plateSize = cs.measure === "areaMm2" ? Math.PI * (d / 2) ** 2 : d;
  const showGroup = cs.pairing === "global" && cs.groupBy.length > 0;
  const families = cmp.nControls ? cmp.families.filter((f) => f.control || f.rows.some((r) => r.nPlates)).map((f) => {
    const title = cs.pairing === "global" ? t("allImages") : groupLabel(cs.groupBy, f.groupVals) || t("allImages");
    return h("div", { class: "cmp-family" },
      h("h3", null, title),
      h("p", { class: "muted small" }, f.anova
        ? t("anovaLine", { F: fmtNumber(f.anova.F, 2), d1: f.anova.df1, d2: f.anova.df2, p: fmtP(f.anova.p) })
        : f.control ? t("anovaNa") : ""),
      table(f, cs, showGroup),
      plot(f, cs, plateSize, null));
  }) : [];

  const csv = () => {
    const rows = comparisonTable(images, exp, settings);
    if (rows) download(csvBlob(rows), `${safeFileName(exp.name)}-comparison.csv`);
  };
  card = h("details", { class: "card compare-card", open: cmp.nControls > 0 },
    h("summary", null, h("h2", null, t("comparison")),
      h("span", { class: "muted small" }, cmp.nControls ? t("cmpSummary", { n: cmp.nControls, m: t(`cmp_${cs.measure}`) }) : t("cmpNoControls"))),
    h("p", { class: "muted small" }, t("cmpLead"), " ", h("a", { href: "#/help/compare" }, t("cmpHowComputed"))),
    settingsForm(exp, cs, save),
    cmp.nControls ? warningList(cmp) : h("p", { class: "cmp-empty" }, t("cmpHowToMark")),
    families,
    cmp.nControls ? h("p", { class: "muted small" }, t("cmpReplicatesNote")) : null,
    cmp.nControls ? h("div", { class: "actions" }, h("button", { class: "small", onclick: csv }, "⤓ ", t("exportComparisonCsv"))) : null);
  return card;
}

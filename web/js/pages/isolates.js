// Isolate profiles (#/e/:id/isolates for one experiment, #/isolates for all): a matrix with one row per isolate and
// one column per assay type (mean diameter ± SD, n, phenotype, representative thumbnail), the combined profile,
// filters, sorting, warnings about missing assays and metadata, and the wide-format export.
import * as db from "../db.js";
import { fmtNumber, h } from "../dom.js";
import { rowContext, tidyRows } from "../columns.js";
import { csvBlob, download, safeFileName } from "../export.js";
import { t } from "../i18n.js";
import { ALL_ASSAYS, KEY_MODES, PROFILE_ASSAYS, groupIsolates, matrixRows } from "../isolates.js";
import { phenotypeClassifier } from "../phenotype-adapter.js";
import { overlayThumb } from "../thumbs.js";
import { menu, modal, showError } from "../ui.js";
import { xlsxWorkbookBlob } from "../xlsx.js";
import { bulkEditShortcut } from "../bulk-edit-link.js";
import { classBadge } from "./experiment.js";

// ------------------------------------------------------------------ page
const assayLabel = (a) => t(`assay_${a}`);
const profileLabels = () => Object.fromEntries(ALL_ASSAYS.map((a) => [a, assayLabel(a).toLowerCase()]));

function phenotypeBadge(p) {
  if (!p) return null;
  const cls = p.mixed ? "cat-i" : p.sign === "−" ? "cat-na" : "cat-s";
  const title = [p.mixed ? t("isoPhenotypeMixed") : null, t("isoPhenotypeAgree", { agree: p.agree, n: p.n }),
    p.ratio != null ? `ratio ${fmtNumber(p.ratio, 2)}` : null, p.rule || null].filter(Boolean).join(" · ");
  return h("span", { class: ["badge", cls], title }, p.mixed ? "± " : "", p.label, p.ratio != null ? h("small", null, ` ×${fmtNumber(p.ratio, 2)}`) : null);
}

const pm = (s, d = 2) => (s.mean == null ? "—" : s.sd == null ? fmtNumber(s.mean, d) : `${fmtNumber(s.mean, d)} ± ${fmtNumber(s.sd, d)}`);

export async function render(view, { expId }, ctx) {
  let groups; // [{ exp, images }]
  if (expId) {
    const exp = await db.getExperiment(expId);
    if (!exp) {
      view.replaceChildren(h("div", { class: "card empty" }, h("h2", null, t("notFound")), h("a", { href: "#/" }, t("backToExperiments"))));
      return;
    }
    groups = [{ exp, images: await db.listImages(exp.id) }];
  } else {
    groups = await Promise.all((await db.listExperiments()).map(async (exp) => ({ exp, images: await db.listImages(exp.id) })));
  }
  const settings = ctx.settings;
  const classify = await phenotypeClassifier();
  const entries = [];
  for (const { exp, images } of groups) {
    for (const img of images) {
      const c = rowContext(img, exp, settings);
      entries.push({ img, exp, eff: c.eff, m: c.m, phenotype: classify && img.result ? await classify(img, exp, settings) : null });
    }
  }

  const urls = new Map();
  const urlOf = (img) => {
    if (!urls.has(img.id)) urls.set(img.id, URL.createObjectURL(img.thumb || img.blob));
    return urls.get(img.id);
  };
  const state = { keyMode: KEY_MODES.includes(settings.isolateKey) ? settings.isolateKey : "strain", search: "", profile: "", sort: "name", dir: 1 };
  const title = expId ? t("isoTitle") : t("isoAllTitle");
  const fileBase = safeFileName(expId ? `${groups[0].exp.name} - isolates` : `MotilityJ isolates ${new Date().toISOString().slice(0, 10)}`);

  function openCell(iso, cell) {
    const list = [...cell.entries].sort((a, b) => (a.exp.name + a.img.name).localeCompare(b.exp.name + b.img.name, undefined, { numeric: true }));
    modal((close) => h("div", { class: "iso-dialog" },
      h("h2", null, t("isoCellTitle", { isolate: iso.name, assay: assayLabel(cell.assay) })),
      h("p", { class: "muted" }, `${pm(cell.diam)} mm · ${t("isoCellN", { n: cell.n })}`,
        cell.nBioReps ? ` · ${t("isoCellReps", { n: cell.nBioReps })}` : "", cell.nPending ? ` · ${t("isoCellPending", { n: cell.nPending })}` : "",
        cell.area.mean != null ? ` · ${pm(cell.area, 1)} mm²` : "", " ", phenotypeBadge(cell.phenotype)),
      h("div", { class: "plates" }, list.map((e) => h("a", { class: "plate-thumb", href: `#/e/${e.exp.id}/i/${e.img.id}`, title: e.img.name, onclick: () => close(null) },
        overlayThumb(e.img, urlOf(e.img)),
        h("span", { class: "thumb-name" }, e.img.name),
        h("span", { class: "thumb-badges" }, classBadge(e.img.result),
          e === cell.representative ? h("span", { class: "badge cat-s", title: t("isoRepresentativeHint") }, "★") : null),
        h("span", { class: "small" }, e.m?.eqDiameterMm != null ? `Ø ${fmtNumber(e.m.eqDiameterMm, 1)} mm` : "",
          e.eff.bioRep ? ` · ${t("short_bioRep")} ${e.eff.bioRep}` : "", expId ? "" : ` · ${e.exp.name}`)))),
      h("div", { class: "actions dialog-actions" }, h("button", { onclick: () => close(null) }, t("ok")))));
  }

  function warnings(result) {
    const out = [];
    if (result.isolates.some((i) => i.missing.length)) {
      const list = result.isolates.filter((i) => i.missing.length);
      out.push(h("div", { class: "warn meta-warning", role: "note" },
        h("b", null, "⚠ ", t("isoMissingTitle")), " ", t("isoMissingLead"),
        h("ul", null, list.slice(0, 12).map((i) => h("li", null, h("b", null, i.name), ": ", i.missing.map(assayLabel).join(", "))),
          list.length > 12 ? h("li", null, "…") : null)));
    }
    if (result.unassigned.length) {
      const byExp = new Map();
      for (const u of result.unassigned) {
        if (!byExp.has(u.exp.id)) byExp.set(u.exp.id, { exp: u.exp, items: [] });
        byExp.get(u.exp.id).items.push(u);
      }
      out.push(h("div", { class: "warn meta-warning", role: "note" },
        h("b", null, "⚠ ", t("isoUnassignedTitle")), " ", t("isoUnassignedLead"),
        h("ul", null, [...byExp.values()].map(({ exp, items }) => {
          const noStrain = items.filter((u) => u.missing.includes("strain")).length;
          const noAssay = items.filter((u) => u.missing.includes("assayType")).length;
          return h("li", null, t("isoUnassignedLine", { exp: exp.name, n: items.length }),
            h("span", { class: "muted" }, " (", [noStrain ? `${noStrain} ${t("isoMissingStrain")}` : null, noAssay ? `${noAssay} ${t("isoMissingAssay")}` : null].filter(Boolean).join(", "), ") "),
            h("button", { class: "small", onclick: () => bulkEditShortcut(exp.id, items.map((u) => u.img.id)) }, "✎ ", t("isoEditMeta")));
        }))));
    }
    const pending = entries.filter((e) => !e.img.result).length;
    if (pending) out.push(h("p", { class: "muted small" }, t("isoPendingNote", { n: pending })));
    return out;
  }

  function draw() {
    const result = groupIsolates(entries, { keyMode: state.keyMode, labels: profileLabels() });
    const cols = [...PROFILE_ASSAYS, ...(result.assays.includes("other") ? ["other"] : [])];
    const profiles = [...new Set(result.isolates.map((i) => i.profile))].sort();
    if (state.profile && !["__missing", "__full"].includes(state.profile) && !profiles.includes(state.profile)) state.profile = "";
    const shown = result.isolates.filter((i) => (!state.profile || (state.profile === "__missing" ? i.missing.length > 0 : state.profile === "__full" ? !i.missing.length : i.profile === state.profile)));
    const key = state.sort === "name" ? (i) => i.name : state.sort === "profile" ? (i) => i.profile : state.sort === "n" ? (i) => i.n
      : (i) => i.cells[state.sort]?.diam.mean ?? null;
    shown.sort((a, b) => {
      const x = key(a), y = key(b);
      if (x == null || y == null) return x == null && y == null ? 0 : x == null ? 1 : -1; // empty cells last
      return (typeof x === "string" ? x.localeCompare(y, undefined, { numeric: true, sensitivity: "base" }) : x - y) * state.dir;
    });

    const exportMenu = menu(h("span", null, "⤓ ", t("export")), [
      { label: t("isoExportMatrixXlsx"), disabled: !result.isolates.length, onClick: exportXlsx },
      { label: t("isoExportMatrixCsv"), disabled: !result.isolates.length, onClick: () => download(csvBlob(matrixRows(result)), `${fileBase}.csv`) },
      { label: t("isoExportTidyCsv"), disabled: !entries.length, onClick: () => download(csvBlob(tidyRows(groups, settings)), `${fileBase} - tidy.csv`) },
    ]);
    async function exportXlsx() {
      try {
        const matrix = matrixRows(result);
        const tidy = tidyRows(groups, settings);
        download(xlsxWorkbookBlob([
          { name: t("isoSheetMatrix"), rows: matrix, widths: matrix[0].map((c, i) => (i < 6 ? 22 : Math.max(10, Math.min(28, c.length + 2)))) },
          { name: t("sheetTidy"), rows: tidy, widths: tidy[0].map((c) => Math.max(12, Math.min(30, c.length + 2))) },
        ]), `${fileBase}.xlsx`);
      } catch (e) { showError(e); }
    }

    const keySelect = h("select", { "aria-label": t("isoKey"), onchange: async () => {
      state.keyMode = keySelect.value;
      ctx.settings = { ...ctx.settings, isolateKey: state.keyMode };
      try { await db.saveSettings(ctx.settings); } catch (e) { showError(e); }
      draw();
    } }, KEY_MODES.map((k) => h("option", { value: k, selected: k === state.keyMode }, t(k === "strain" ? "isoKeyStrain" : "isoKeyStrainCondition"))));

    const exp = expId ? groups[0].exp : null;
    const head = h("div", { class: "page-head" },
      h("div", null, h("h1", null, title), h("p", { class: "muted" }, expId ? t("isoLead") : t("isoAllLead"))),
      h("div", { class: "actions head-actions" }, h("label", { class: "inline-label" }, t("isoKey"), " ", keySelect), exportMenu));

    const search = h("input", { type: "search", class: "iso-search", placeholder: t("isoSearch"), value: state.search, "aria-label": t("isoSearch"),
      oninput: () => { state.search = search.value; drawTable(); } });
    const profileSelect = h("select", { "aria-label": t("isoProfileFilter"), onchange: () => { state.profile = profileSelect.value; draw(); } },
      h("option", { value: "" }, t("isoAnyProfile")),
      result.expected.length > 1 ? [h("option", { value: "__missing", selected: state.profile === "__missing" }, t("isoMissingFilter")),
        h("option", { value: "__full", selected: state.profile === "__full" }, t("isoFullFilter"))] : null,
      profiles.map((p) => h("option", { value: p, selected: p === state.profile }, p)));

    const th = (id, label, cls = null) => h("th", { class: cls, "aria-sort": state.sort === id ? (state.dir > 0 ? "ascending" : "descending") : null },
      h("button", { class: "sort-button", onclick: () => { if (state.sort === id) state.dir = -state.dir; else { state.sort = id; state.dir = 1; } draw(); } },
        label, state.sort === id ? (state.dir > 0 ? " ▲" : " ▼") : ""));

    const cellTd = (iso, a) => {
      const c = iso.cells[a];
      if (!c) return h("td", { class: "iso-cell empty-cell" }, h("span", { class: "muted" }, "n/a"));
      const rep = c.representative;
      return h("td", { class: "iso-cell" }, h("button", { class: "iso-cell-button", title: t("isoCellTitle", { isolate: iso.name, assay: assayLabel(a) }), onclick: () => openCell(iso, c) },
        rep ? overlayThumb(rep.img, urlOf(rep.img), { className: "thumb-frame iso-thumb" }) : null,
        h("span", { class: "iso-cell-text" },
          h("b", { class: "num" }, c.diam.mean == null ? (c.n ? "—" : t("pending")) : h("span", null, pm(c.diam, 1), h("small", null, " mm"))),
          h("span", { class: "small muted" }, t("isoCellN", { n: c.n }), c.nBioReps ? ` · ${t("isoCellReps", { n: c.nBioReps })}` : "",
            c.fracComplete ? ` · ${t("isoCellComplete", { pct: Math.round(c.fracComplete * 100) })}` : "", c.nPending ? ` · ${t("isoCellPending", { n: c.nPending })}` : ""),
          phenotypeBadge(c.phenotype))));
    };

    const tableSlot = h("div");
    function drawTable() {
      const qq = state.search.trim().toLowerCase();
      const rows = shown.filter((i) => !qq || i.name.toLowerCase().includes(qq));
      tableSlot.replaceChildren(
        h("p", { class: "muted small" }, t("isoShown", { n: rows.length, total: result.isolates.length })),
        rows.length ? h("div", { class: "iso-wrap" }, h("table", { class: "results iso-matrix" },
          h("thead", null, h("tr", null, th("name", t("isoCol")), cols.map((a) => th(a, assayLabel(a))), th("profile", t("isoProfile")), th("n", t("isoN"), "num"))),
          h("tbody", null, rows.map((iso) => h("tr", null,
            h("th", { scope: "row", class: "iso-name" }, iso.name, !expId && iso.experiments.length ? h("div", { class: "small muted" }, iso.experiments.join(", ")) : null),
            cols.map((a) => cellTd(iso, a)),
            h("td", { class: "iso-profile" }, h("code", null, iso.profile)),
            h("td", { class: "num" }, iso.n))))))
          : h("p", { class: "muted" }, t("isoNoMatch")));
    }
    drawTable();

    const crumbs = h("div", { class: "crumbs" }, h("a", { href: "#/" }, t("experiments")), " › ",
      exp ? [h("a", { href: `#/e/${exp.id}` }, exp.name), " › "] : null, title);
    const body = result.isolates.length
      ? h("section", { class: "card" },
        h("div", { class: "table-tools iso-tools" }, search, h("label", { class: "inline-label" }, t("isoProfileFilter"), " ", profileSelect)),
        tableSlot,
        h("p", { class: "muted small" }, t("isoLegend")),
        classify ? null : h("p", { class: "muted small" }, t("isoNoPhenotype")))
      : h("div", { class: "card empty" }, h("h2", null, t("isoNone")), h("p", { class: "muted" }, t("isoNoneLead")),
        exp ? h("a", { class: "button", href: `#/e/${exp.id}` }, t("isoBackToExperiment")) : null);
    view.replaceChildren(crumbs, head, ...warnings(result), body);
  }

  draw();
  return () => { urls.forEach((u) => URL.revokeObjectURL(u)); urls.clear(); };
}

// Experiment page: add images (dropzone, file picker, camera), assay conditions, thumbnails, results table
// (configurable columns, inline and bulk metadata editing), analyse all, export.
import { analyseImages } from "../analyze.js";
import * as db from "../db.js";
import { fmtNumber, h } from "../dom.js";
import { driveEnabled, saveExperimentToDrive } from "../drive-ui.js";
import { rowContext, visibleColumns } from "../columns.js";
import { buildComparison } from "../compare.js";
import { comparisonCard } from "../compare-ui.js";
import { BACKUP_EXT, backupBlob, comparisonTable, csvBlob, download, excelBlob, safeFileName, tidyTable } from "../export.js";
import { t } from "../i18n.js";
import { ACCEPT, importFile, isImageFile } from "../images.js";
import { fieldDef, isEmpty } from "../metadata.js";
import { assayCard, bulkEditDialog, columnsDialog, conflictWarning, formatMeta, metaInput } from "../metadata-ui.js";
import { requestPersistence } from "../pwa.js";
import { checkPhoto } from "../quality.js";
import { qualityBadge, storedQuality } from "../quality-ui.js";
import { seriesCard } from "../series-ui.js";
import { needsReview, overlayThumb } from "../thumbs.js";
import { busy, confirmDialog, fileButton, idle, menu, showError, toast } from "../ui.js";
import { deleteExperimentAsk, renameExperiment } from "./experiments.js";

export const classBadge = (result) => result
  ? h("span", { class: ["badge", result.klass === "complete" ? "cat-s" : "cat-i"] }, t(result.klass), result.edited ? h("span", { title: t("editedByHand") }, " ✎") : null)
  : h("span", { class: "badge cat-na" }, t("pending"));

const reviewBadge = (result) => needsReview(result)
  ? h("span", { class: "badge cat-r", title: t("needsReviewHint") }, "⚠ ", t("needsReview")) : null;

const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
const sd = (xs) => { const m = mean(xs); return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / Math.max(1, xs.length - 1)); };

export async function render(view, { expId }, ctx) {
  const exp = await db.getExperiment(expId);
  if (!exp) {
    view.replaceChildren(h("div", { class: "card empty" }, h("h2", null, t("notFound")), h("a", { href: "#/" }, t("backToExperiments"))));
    return;
  }
  let images = [];
  const urls = [];
  const selected = new Set();

  async function addFiles(files) {
    const list = files.filter(isImageFile);
    const skipped = files.length - list.length;
    const errors = [];
    let warned = 0;
    requestPersistence();
    try {
      for (let i = 0; i < list.length; i++) {
        busy(t("importingN", { i: i + 1, n: list.length }), i / list.length);
        try {
          const fields = await importFile(list[i]);
          // Photo quality check on the stored copy (non-blocking: the image is added anyway).
          const quality = storedQuality(await checkPhoto(fields.blob, { origWidth: fields.origWidth }).catch(() => null), fields.width);
          if (quality?.items.length) warned++;
          await db.putImage({ id: db.newId(), experimentId: exp.id, name: list[i].name || `photo-${Date.now()}.jpg`, added: Date.now() + i, notes: "", meta: {}, result: null, ...fields, quality });
        } catch (e) {
          errors.push(e.message === "unsupported" ? t("unsupportedFile", { name: list[i].name }) : `${list[i].name}: ${e.message}`);
        }
      }
    } finally { idle(); }
    await db.touchExperiment(exp.id);
    const added = list.length - errors.length;
    if (added) toast(t("imagesAdded", { n: added }), "ok");
    if (warned) toast(t("qualityImported", { n: warned }));
    if (skipped) toast(t("skippedFiles", { n: skipped }), "error");
    errors.forEach((e) => toast(e, "error"));
    await draw();
  }

  async function analyseAll() {
    const pending = images.filter((i) => !i.result);
    let todo = pending;
    if (!pending.length) {
      if (!images.length) return;
      const ok = await confirmDialog(t("reanalyseAllConfirm", { n: images.length }), { ok: t("reanalyse") });
      if (!ok) return;
      todo = images;
    }
    const { n, errors, cancelled } = await analyseImages(todo);
    if (n) toast(t("analysedN", { n }), "ok");
    if (cancelled) toast(t("cancelled"));
    errors.forEach((e) => toast(e, "error"));
    await draw();
  }

  async function saveAssay(meta) {
    exp.meta = meta;
    exp.updated = Date.now();
    try { await db.putExperiment(exp); toast(t("assaySaved"), "ok"); } catch (e) { showError(e); }
    await draw({ assayOpen: true });
  }

  async function bulkEdit() {
    const list = images.filter((i) => selected.has(i.id));
    if (!list.length) return;
    const changes = await bulkEditDialog(list, exp);
    if (!changes) return;
    for (const img of list) {
      img.meta = { ...img.meta, ...changes };
      await db.putImage(img);
    }
    await db.touchExperiment(exp.id);
    toast(t("bulkEdited", { n: list.length }), "ok");
    await draw();
  }

  async function chooseColumns() {
    const ids = await columnsDialog(ctx.settings);
    if (!ids) return;
    ctx.settings = { ...ctx.settings, resultColumns: ids === "reset" ? null : ids };
    try { await db.saveSettings(ctx.settings); } catch (e) { showError(e); }
    await draw();
  }

  const camera = () => fileButton(h("span", null, "📷 ", t("takePhoto")), { accept: "image/*", capture: "environment", className: "button primary camera-button", onFiles: addFiles });
  const chooser = (cls = "button") => fileButton(t("chooseFiles"), { accept: ACCEPT, multiple: true, className: cls, onFiles: addFiles });

  async function draw({ assayOpen = false } = {}) {
    images = await db.listImages(exp.id);
    for (const id of [...selected]) if (!images.some((i) => i.id === id)) selected.delete(id);
    urls.splice(0).forEach(URL.revokeObjectURL);
    const settings = ctx.settings;
    const pending = images.filter((i) => !i.result).length;
    const done = images.length - pending;
    const nComplete = images.filter((i) => i.result?.klass === "complete").length;

    const cmp = buildComparison(images, exp, settings);
    const analyseLabel = pending ? t("analyseN", { n: pending }) : t("analyseAll");
    const none = !images.length;
    const exportMenu = menu(h("span", null, "⤓ ", t("export")), [
      { label: t("exportExcelItem"), disabled: none, onClick: () => download(excelBlob(images, exp, settings), `${safeFileName(exp.name)}.xlsx`) },
      { label: t("exportCsvItem"), disabled: none, onClick: () => download(csvBlob(tidyTable(images, exp, settings)), `${safeFileName(exp.name)}.csv`) },
      { label: t("exportComparisonItem"), disabled: !cmp.nControls, onClick: () => download(csvBlob(comparisonTable(images, exp, settings)), `${safeFileName(exp.name)}-comparison.csv`) },
      { label: t("backupItem"), onClick: backup },
      driveEnabled() ? { label: t("driveSave"), onClick: () => saveExperimentToDrive(exp) } : null,
    ], { title: t("exportHint") });
    const moreMenu = menu("⋯", [
      { label: t("rename"), onClick: async () => { if (await renameExperiment(exp)) await draw(); } },
      { label: t("deleteExperiment"), danger: true, onClick: async () => { if (await deleteExperimentAsk(exp, images.length)) location.hash = "#/"; } },
    ], { title: t("moreActions"), className: "menu-more" });
    const head = h("div", { class: "page-head" },
      h("div", null,
        h("h1", null, exp.name),
        h("p", { class: "muted" }, t("nImages", { n: images.length }), images.length ? ` · ${t("nAnalysed", { n: done, total: images.length })}` : "")),
      h("div", { class: "actions head-actions" },
        h("button", { class: pending ? "primary" : "", onclick: analyseAll, disabled: none }, "▶ ", analyseLabel),
        exportMenu, moreMenu));

    // Summary tiles: what the experiment found, and what still needs attention.
    const areas = images.filter((i) => i.result?.klass === "incomplete").map((i) => rowContext(i, exp, settings).m?.areaMm2).filter(Number.isFinite);
    const nReview = images.filter((i) => needsReview(i.result)).length;
    const tile = (value, label, cls = "") => h("div", { class: ["stat-tile", cls] }, h("b", null, value), h("span", null, label));
    const stats = images.length ? h("div", { class: "stat-tiles" },
      tile(nComplete, t("complete"), "s"),
      tile(done - nComplete, t("incomplete"), "i"),
      areas.length ? tile(h("span", null, fmtNumber(mean(areas), 1), areas.length > 1 ? h("small", null, ` ± ${fmtNumber(sd(areas), 1)}`) : null),
        t("meanIncompleteArea")) : null,
      nReview ? tile(nReview, t("needsReview"), "r") : null,
      pending ? tile(pending, t("pending"), "na") : null) : null;

    const dropzone = h("label", { class: "dropzone small-dropzone" },
      h("input", { type: "file", accept: ACCEPT, multiple: true, onchange: (e) => { const f = [...e.target.files]; e.target.value = ""; if (f.length) addFiles(f); } }),
      h("span", null, h("b", null, t("dropHere")), h("br"), h("span", { class: "small" }, t("dropFormats"))));
    for (const ev of ["dragenter", "dragover"]) dropzone.addEventListener(ev, (e) => { e.preventDefault(); dropzone.classList.add("dragging"); });
    for (const ev of ["dragleave", "drop"]) dropzone.addEventListener(ev, () => dropzone.classList.remove("dragging"));
    dropzone.addEventListener("drop", (e) => { e.preventDefault(); const f = [...(e.dataTransfer?.files || [])]; if (f.length) addFiles(f); });

    const addCard = h("section", { class: "card add-card" },
      h("h2", null, t("addImages")),
      dropzone,
      h("div", { class: "photo-buttons" }, camera(), chooser(),
        driveEnabled() ? h("a", { class: "button", href: `#/inbox/${exp.id}` }, "☁ ", t("driveInbox")) : null));

    const thumbs = images.map((img) => {
      const url = URL.createObjectURL(img.thumb || img.blob);
      urls.push(url);
      return h("a", { class: "plate-thumb", href: `#/e/${exp.id}/i/${img.id}`, title: img.name },
        overlayThumb(img, url),
        h("span", { class: "thumb-name" }, img.name),
        h("span", { class: "thumb-badges" }, classBadge(img.result), reviewBadge(img.result), qualityBadge(img.quality)));
    });

    const cols = visibleColumns(settings);
    const warningSlot = h("div", { class: "warning-slot" }, conflictWarning(images, exp, settings));
    // The comparison card follows metadata edits in the table (role, condition, replicates) without a full redraw.
    const compareSlot = h("div", { class: "compare-slot" }, images.length ? comparisonCard(exp, images, settings) : null);
    const refreshWarning = () => {
      warningSlot.replaceChildren(conflictWarning(images, exp, settings) || "");
      const open = compareSlot.querySelector("details")?.open;
      const card = comparisonCard(exp, images, settings);
      if (open) card.open = true;
      compareSlot.replaceChildren(card);
    };
    const selectAll = h("input", { type: "checkbox", "aria-label": t("selectAll"), checked: images.length > 0 && selected.size === images.length,
      onchange: () => { images.forEach((i) => (selectAll.checked ? selected.add(i.id) : selected.delete(i.id))); draw(); } });
    selectAll.indeterminate = selected.size > 0 && selected.size < images.length;

    const cell = (img, c, col) => {
      if (col.kind === "notes") {
        const notes = h("input", { class: "notes-input", value: img.notes || "", placeholder: t("addNote"), "aria-label": t("colNotes"),
          onchange: async () => { img.notes = notes.value; await db.putImage(img); } });
        return h("td", { class: "notes-cell" }, notes);
      }
      if (col.kind === "meta") {
        const def = fieldDef(col.key);
        const own = img.meta?.[col.key];
        const inherited = isEmpty(own) ? formatMeta(col.key, c.eff[col.key]) : formatMeta(col.key, exp.meta?.[col.key]);
        const input = metaInput(def, own, { className: "notes-input meta-input", placeholder: inherited,
          onChange: async (v) => { img.meta = { ...img.meta, [col.key]: v }; await db.putImage(img); refreshWarning(); } });
        input.setAttribute("aria-label", `${col.label()} · ${img.name}`);
        return h("td", { class: "meta-cell" }, input);
      }
      const v = col.value(c);
      return h("td", { class: "num" }, v == null ? (img.result ? "—" : "") : fmtNumber(v, col.digits));
    };

    const rows = images.map((img) => {
      const c = rowContext(img, exp, settings, cmp);
      const box = h("input", { type: "checkbox", checked: selected.has(img.id), "aria-label": t("selectImage", { name: img.name }),
        onchange: () => { box.checked ? selected.add(img.id) : selected.delete(img.id); draw(); } });
      return h("tr", { class: selected.has(img.id) ? "selected" : null },
        h("td", { class: "sel-cell" }, box),
        h("td", { class: "file-cell" }, h("a", { href: `#/e/${exp.id}/i/${img.id}` }, img.name)),
        h("td", null, h("span", { class: "thumb-badges" }, classBadge(img.result), reviewBadge(img.result), qualityBadge(img.quality))),
        cols.map((col) => cell(img, c, col)),
        h("td", { class: "row-actions" }, h("button", { class: "small ghost danger", title: t("removeImage"), "aria-label": t("removeImage"),
          onclick: async () => {
            if (await confirmDialog(t("removeImageConfirm", { name: img.name }), { ok: t("remove"), danger: true })) { await db.deleteImage(img.id); await draw(); }
          } }, "✕")));
    });

    // Phones: a compact list (thumbnail with outline, class, area) instead of the wide table.
    const phoneList = h("ul", { class: "result-list" }, images.map((img, i) => {
      const m = rowContext(img, exp, settings).m;
      return h("li", null, h("a", { href: `#/e/${exp.id}/i/${img.id}` },
        overlayThumb(img, urls[i], { className: "thumb-frame small" }),
        h("span", { class: "rl-main" }, h("span", { class: "rl-name" }, img.name),
          h("span", { class: "thumb-badges" }, classBadge(img.result), reviewBadge(img.result), qualityBadge(img.quality))),
        h("span", { class: "rl-area num" }, m?.areaMm2 != null ? h("span", null, fmtNumber(m.areaMm2, 1), h("small", null, " mm²")) : "")));
    }));

    const tableTools = h("div", { class: "table-tools" },
      h("button", { class: "small", onclick: bulkEdit, disabled: !selected.size, title: t("bulkEditHint") }, "✎ ", selected.size ? t("bulkEditN", { n: selected.size }) : t("bulkEdit")),
      h("button", { class: "small", onclick: chooseColumns }, "▦ ", t("columns")));

    const diam = exp.meta?.plateDiameterMm > 0 ? exp.meta.plateDiameterMm : settings.plateDiameterMm;
    const results = h("section", { class: "card" },
      h("div", { class: "section-head" },
        h("h2", null, t("results")),
        images.length ? h("span", { class: "muted small" }, t("summary", { c: nComplete, i: done - nComplete, p: pending })) : null),
      warningSlot,
      images.length ? tableTools : null,
      images.length
        ? h("div", { class: "table-wrap" }, h("table", { class: "results" },
          h("thead", null, h("tr", null, h("th", { class: "sel-cell" }, selectAll), h("th", null, t("colFile")), h("th", null, t("colClass")),
            cols.map((col) => h("th", { class: col.num ? "num" : null, title: col.label() }, col.header())), h("th"))),
          h("tbody", null, rows)))
        : h("p", { class: "muted" }, t("noImagesYet")),
      images.length ? phoneList : null,
      images.length ? h("p", { class: "muted small" }, t("areaNote", { d: diam }),
        settings.manualPxPerMm > 0 ? ` ${t("manualScaleActive", { s: settings.manualPxPerMm })}` : "", " ", h("a", { href: "#/settings" }, t("settings"))) : null);

    const series = await seriesCard(exp, images, settings, draw, urls);
    const gallery = images.length ? h("section", { class: "card" }, h("h2", null, t("images")), h("div", { class: "plates" }, thumbs)) : null;

    // Phones: main actions in a bar at the bottom of the screen.
    const bottom = h("div", { class: "nav bottom-bar" }, camera(), chooser("button bottom-choose"),
      h("button", { class: pending ? "primary" : "", onclick: analyseAll, disabled: !images.length }, "▶ ", analyseLabel));

    view.replaceChildren(...[
      h("div", { class: "crumbs" }, h("a", { href: "#/" }, t("experiments")), " › ", exp.name),
      head, stats, assayCard(exp, settings, saveAssay, { open: assayOpen }), addCard, results, compareSlot, series, gallery, bottom].filter(Boolean));
  }

  async function backup() {
    try {
      busy(t("preparingBackup"));
      download(await backupBlob([exp]), `${safeFileName(exp.name)}${BACKUP_EXT}`);
    } catch (e) { showError(e); } finally { idle(); }
  }

  view.classList.add("with-bottom-bar");
  await draw();
  return () => urls.forEach(URL.revokeObjectURL);
}

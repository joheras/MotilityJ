// Experiment page: add images (dropzone, file picker, camera), thumbnails, results table, analyse all, export.
import { analyseImages } from "../analyze.js";
import * as db from "../db.js";
import { fmtNumber, h } from "../dom.js";
import { driveEnabled, importFromInbox, saveExperimentToDrive } from "../drive-ui.js";
import { BACKUP_EXT, backupBlob, csvBlob, download, excelBlob, resultRows, safeFileName } from "../export.js";
import { areaMm2 } from "../geometry.js";
import { t } from "../i18n.js";
import { ACCEPT, importFile, isImageFile } from "../images.js";
import { requestPersistence } from "../pwa.js";
import { seriesCard } from "../series-ui.js";
import { busy, confirmDialog, fileButton, idle, showError, toast } from "../ui.js";
import { deleteExperimentAsk, renameExperiment } from "./experiments.js";

export const classBadge = (result) => result
  ? h("span", { class: ["badge", result.klass === "complete" ? "cat-s" : "cat-i"] }, t(result.klass), result.edited ? h("span", { title: t("editedByHand") }, " ✎") : null)
  : h("span", { class: "badge cat-na" }, t("pending"));

export async function render(view, { expId }, ctx) {
  const exp = await db.getExperiment(expId);
  if (!exp) {
    view.replaceChildren(h("div", { class: "card empty" }, h("h2", null, t("notFound")), h("a", { href: "#/" }, t("backToExperiments"))));
    return;
  }
  let images = [];
  const urls = [];

  async function addFiles(files) {
    const list = files.filter(isImageFile);
    const skipped = files.length - list.length;
    const errors = [];
    requestPersistence();
    try {
      for (let i = 0; i < list.length; i++) {
        busy(t("importingN", { i: i + 1, n: list.length }), i / list.length);
        try {
          const fields = await importFile(list[i]);
          await db.putImage({ id: db.newId(), experimentId: exp.id, name: list[i].name || `photo-${Date.now()}.jpg`, added: Date.now() + i, notes: "", result: null, ...fields });
        } catch (e) {
          errors.push(e.message === "unsupported" ? t("unsupportedFile", { name: list[i].name }) : `${list[i].name}: ${e.message}`);
        }
      }
    } finally { idle(); }
    await db.touchExperiment(exp.id);
    const added = list.length - errors.length;
    if (added) toast(t("imagesAdded", { n: added }), "ok");
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

  function exportRows() { return resultRows(images, ctx.settings); }

  const camera = () => fileButton(h("span", null, "📷 ", t("takePhoto")), { accept: "image/*", capture: "environment", className: "button primary camera-button", onFiles: addFiles });
  const chooser = (cls = "button") => fileButton(t("chooseFiles"), { accept: ACCEPT, multiple: true, className: cls, onFiles: addFiles });

  async function draw() {
    images = await db.listImages(exp.id);
    urls.splice(0).forEach(URL.revokeObjectURL);
    const settings = ctx.settings;
    const pending = images.filter((i) => !i.result).length;
    const done = images.length - pending;
    const nComplete = images.filter((i) => i.result?.klass === "complete").length;

    const analyseLabel = pending ? t("analyseN", { n: pending }) : t("analyseAll");
    const head = h("div", { class: "page-head" },
      h("div", null,
        h("h1", null, exp.name),
        h("p", { class: "muted" }, t("nImages", { n: images.length }), images.length ? ` · ${t("nAnalysed", { n: done, total: images.length })}` : "")),
      h("div", { class: "actions" },
        h("button", { class: pending ? "primary" : "", onclick: analyseAll, disabled: !images.length }, "▶ ", analyseLabel),
        h("button", { onclick: () => download(excelBlob(exportRows(), exp.name), `${safeFileName(exp.name)}.xlsx`), disabled: !images.length }, t("exportExcel")),
        h("button", { onclick: () => download(csvBlob(exportRows()), `${safeFileName(exp.name)}.csv`), disabled: !images.length }, t("exportCsv")),
        h("button", { onclick: backup, title: t("backupHint") }, t("backup")),
        driveEnabled() ? h("button", { onclick: () => saveExperimentToDrive(exp) }, t("driveSave")) : null,
        h("button", { onclick: async () => { if (await renameExperiment(exp)) await draw(); } }, t("rename")),
        h("button", { class: "danger", onclick: async () => { if (await deleteExperimentAsk(exp, images.length)) location.hash = "#/"; } }, t("delete"))));

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
        driveEnabled() ? h("button", { onclick: async () => { if (await importFromInbox(exp.id)) await draw(); } }, t("driveInbox")) : null));

    const thumbs = images.map((img) => {
      const url = URL.createObjectURL(img.thumb || img.blob);
      urls.push(url);
      return h("a", { class: "plate-thumb", href: `#/e/${exp.id}/i/${img.id}`, title: img.name },
        h("img", { src: url, alt: img.name, loading: "lazy" }),
        h("span", { class: "thumb-name" }, img.name),
        classBadge(img.result));
    });

    const rows = images.map((img) => {
      const area = areaMm2(img, settings);
      const notes = h("input", { class: "notes-input", value: img.notes || "", placeholder: t("addNote"), "aria-label": t("colNotes"),
        onchange: async () => { img.notes = notes.value; await db.putImage(img); } });
      return h("tr", null,
        h("td", { class: "file-cell" }, h("a", { href: `#/e/${exp.id}/i/${img.id}` }, img.name)),
        h("td", null, classBadge(img.result)),
        h("td", { class: "num" }, area == null ? (img.result ? "—" : "") : fmtNumber(area)),
        h("td", { class: "notes-cell" }, notes),
        h("td", { class: "row-actions" }, h("button", { class: "small ghost danger", title: t("removeImage"), "aria-label": t("removeImage"),
          onclick: async () => {
            if (await confirmDialog(t("removeImageConfirm", { name: img.name }), { ok: t("remove"), danger: true })) { await db.deleteImage(img.id); await draw(); }
          } }, "✕")));
    });

    const results = h("section", { class: "card" },
      h("div", { class: "section-head" },
        h("h2", null, t("results")),
        images.length ? h("span", { class: "muted small" }, t("summary", { c: nComplete, i: done - nComplete, p: pending })) : null),
      images.length
        ? h("div", { class: "table-wrap" }, h("table", { class: "results" },
          h("thead", null, h("tr", null, h("th", null, t("colFile")), h("th", null, t("colClass")), h("th", { class: "num" }, t("colArea")), h("th", null, t("colNotes")), h("th"))),
          h("tbody", null, rows)))
        : h("p", { class: "muted" }, t("noImagesYet")),
      images.length ? h("p", { class: "muted small" }, t("areaNote", { d: settings.plateDiameterMm }),
        settings.manualPxPerMm > 0 ? ` ${t("manualScaleActive", { s: settings.manualPxPerMm })}` : "", " ", h("a", { href: "#/settings" }, t("settings"))) : null);

    const series = await seriesCard(exp, images, settings, draw, urls);
    const gallery = images.length ? h("section", { class: "card" }, h("h2", null, t("images")), h("div", { class: "plates" }, thumbs)) : null;

    // Phones: main actions in a bar at the bottom of the screen.
    const bottom = h("div", { class: "nav bottom-bar" }, camera(), chooser("button bottom-choose"),
      h("button", { class: pending ? "primary" : "", onclick: analyseAll, disabled: !images.length }, "▶ ", analyseLabel));

    view.replaceChildren(
      h("div", { class: "crumbs" }, h("a", { href: "#/" }, t("experiments")), " › ", exp.name),
      head, addCard, results, series, gallery, bottom);
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

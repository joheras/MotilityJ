// Experiments page: grid of experiment cards; create, rename, delete; back up all and restore.
import * as db from "../db.js";
import { fmtDate, h } from "../dom.js";
import { driveEnabled, restoreFromDrive } from "../drive-ui.js";
import { BACKUP_EXT, backupBlob, download, readJsonFile, restoreBackup } from "../export.js";
import { t } from "../i18n.js";
import { needsReview, overlayThumb } from "../thumbs.js";
import { busy, confirmDialog, fileButton, idle, promptDialog, showError, toast } from "../ui.js";

export async function newExperiment() {
  const name = await promptDialog(t("newExperiment"), t("defaultExperimentName", { date: new Date().toLocaleDateString() }), { ok: t("create"), label: t("name") });
  if (!name) return;
  const exp = await db.createExperiment(name);
  location.hash = `#/e/${exp.id}`;
}

export async function renameExperiment(exp) {
  const name = await promptDialog(t("renameExperiment"), exp.name, { ok: t("rename"), label: t("name") });
  if (!name || name === exp.name) return false;
  exp.name = name;
  exp.updated = Date.now();
  await db.putExperiment(exp);
  return true;
}

export async function deleteExperimentAsk(exp, count) {
  const ok = await confirmDialog(t("deleteExperimentConfirm", { name: exp.name, n: count }), { ok: t("delete"), danger: true, title: t("deleteExperiment") });
  if (ok) await db.deleteExperiment(exp.id);
  return ok;
}

export async function render(view) {
  const urls = [];
  const draw = async () => {
    const experiments = await db.listExperiments();
    const withImages = await Promise.all(experiments.map(async (e) => ({ exp: e, images: await db.listImages(e.id) })));
    urls.splice(0).forEach(URL.revokeObjectURL);

    const restoreFile = fileButton(t("restore"), {
      accept: `${BACKUP_EXT},.json,application/json`,
      onFiles: async ([file]) => {
        try {
          busy(t("restoring"));
          const n = await restoreBackup(await readJsonFile(file));
          toast(t("restored", { n }), "ok");
          await draw();
        } catch (e) { showError(e); } finally { idle(); }
      },
    });

    const head = h("div", { class: "page-head" },
      h("div", null, h("h1", null, t("experiments")), h("p", { class: "muted" }, t("experimentsLead"))),
      h("div", { class: "actions" },
        h("button", { class: "primary", onclick: newExperiment }, "+ ", t("newExperiment")),
        experiments.length ? h("button", { onclick: () => backupAll(experiments), title: t("backupAllHint") }, t("backupAll")) : null,
        restoreFile,
        driveEnabled() ? h("button", { onclick: async () => { const n = await restoreFromDrive(); if (n) { toast(t("restored", { n }), "ok"); await draw(); } } }, t("driveRestore")) : null));

    const body = experiments.length
      ? h("div", { class: "cards" }, withImages.map(({ exp, images }) => card(exp, images)))
      : h("div", { class: "card empty" },
        h("h2", null, t("noExperiments")),
        h("p", { class: "muted" }, t("noExperimentsLead")),
        h("div", { class: "actions empty-actions" },
          h("button", { class: "primary", onclick: newExperiment }, "+ ", t("newExperiment")),
          h("a", { class: "button", href: "#/help" }, t("howItWorks"))));

    view.replaceChildren(head, body);
  };

  function card(exp, images) {
    const analysed = images.filter((i) => i.result).length;
    const nComplete = images.filter((i) => i.result?.klass === "complete").length;
    const nReview = images.filter((i) => needsReview(i.result)).length;
    const thumbs = images.slice(0, 5).map((img) => {
      const url = URL.createObjectURL(img.thumb || img.blob);
      urls.push(url);
      return overlayThumb(img, url, { className: "thumb-frame tiny" });
    });
    const stop = (fn) => async (e) => { e.preventDefault(); e.stopPropagation(); try { if (await fn()) await draw(); } catch (err) { showError(err); } };
    return h("a", { class: "card exp-card", href: `#/e/${exp.id}` },
      h("div", { class: "section-head" },
        h("h2", { class: "clamp" }, exp.name),
        h("div", { class: "card-actions" },
          h("button", { class: "small ghost", title: t("rename"), "aria-label": t("rename"), onclick: stop(() => renameExperiment(exp)) }, "✎"),
          h("button", { class: "small ghost danger", title: t("delete"), "aria-label": t("delete"), onclick: stop(() => deleteExperimentAsk(exp, images.length)) }, "🗑"))),
      h("div", { class: "card-thumbs" }, thumbs.length ? thumbs : h("div", { class: "img-placeholder" })),
      h("div", { class: "meta muted" },
        h("span", null, t("nImages", { n: images.length })),
        images.length && analysed < images.length ? h("span", { class: "badge cat-na" }, t("nAnalysed", { n: analysed, total: images.length })) : null,
        nComplete ? h("span", { class: "badge cat-s" }, nComplete, " ", t("complete")) : null,
        analysed - nComplete ? h("span", { class: "badge cat-i" }, analysed - nComplete, " ", t("incomplete")) : null,
        nReview ? h("span", { class: "badge cat-r", title: t("needsReviewHint") }, "⚠ ", nReview) : null,
        h("span", null, fmtDate(exp.updated))));
  }

  async function backupAll(experiments) {
    try {
      busy(t("preparingBackup"));
      download(await backupBlob(experiments), `MotilityJ-${new Date().toISOString().slice(0, 10)}${BACKUP_EXT}`);
    } catch (e) { showError(e); } finally { idle(); }
  }

  await draw();
  return () => urls.forEach(URL.revokeObjectURL);
}

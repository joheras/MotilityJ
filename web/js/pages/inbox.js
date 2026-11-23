// Inbox page (computer): the photos sent from phones with Capture to MotilityJ/Inbox in Google Drive, with their
// plate data and quality check (from the JSON sidecar). Select several, choose or create the experiment and
// Import & analyse: the data goes into image.meta / notes, and the imported files are moved to Inbox/Processed.
// #/inbox/<experimentId> preselects an experiment (the experiment page's "From Drive inbox…").
import { analyseImages } from "../analyze.js";
import * as db from "../db.js";
import * as drive from "../drive.js";
import { h } from "../dom.js";
import { driveEnabled } from "../drive-ui.js";
import { t } from "../i18n.js";
import { importFile, isImageFile } from "../images.js";
import { IMAGE_FIELDS, parseValue } from "../metadata.js";
import { formatMeta } from "../metadata-ui.js";
import { checkPhoto } from "../quality.js";
import { qualityList, qualityPill, storedQuality } from "../quality-ui.js";
import { busy, confirmDialog, idle, promptDialog, showError, toast } from "../ui.js";

const ANALYSE_KEY = "motilityj.inbox.analyse";
const NEW = "__new";

const loadBool = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };

/** image.meta from a capture sidecar (only the fields MotilityJ knows, parsed to their types). */
export function metaFromSidecar(sc) {
  return Object.fromEntries(IMAGE_FIELDS.map((def) => [def.key, parseValue(def, sc?.[def.key])]));
}

function describe(sc) {
  const m = metaFromSidecar(sc);
  return IMAGE_FIELDS.filter((d) => m[d.key] != null && d.key !== "strain")
    .map((d) => `${t(`meta_${d.key}`)} ${formatMeta(d.key, m[d.key])}${d.unit ? ` ${d.unit}` : ""}`).join(" · ");
}

export async function render(view, { expId }) {
  if (!driveEnabled()) {
    view.replaceChildren(h("div", { class: "page-head" }, h("h1", null, t("inboxTitle"))), h("p", { class: "card muted" }, t("inboxNoDrive")));
    return;
  }
  let experiments = await db.listExperiments();
  let target = expId && experiments.some((e) => e.id === expId) ? expId : "";
  let list = null; // Drive inbox items, null until read
  const selected = new Set();
  let analyse = loadBool(ANALYSE_KEY, true);
  let alive = true;
  const cleanups = [];

  const targetSelect = h("select", { "aria-label": t("inboxTarget") });
  function fillTargets() {
    targetSelect.replaceChildren(h("option", { value: "" }, "—"),
      ...experiments.map((e) => h("option", { value: e.id, selected: e.id === target }, e.name)),
      h("option", { value: NEW }, t("captureNewExperiment")));
    targetSelect.value = target;
  }
  targetSelect.addEventListener("change", () => { target = targetSelect.value === NEW ? NEW : targetSelect.value; draw(); });
  fillTargets();

  /** The chosen experiment, created first when "New experiment…" is selected. */
  async function targetExperiment() {
    if (target && target !== NEW) return db.getExperiment(target);
    const suggested = [...new Set(list.filter((i) => selected.has(i.id)).map((i) => i.sidecar?.experiment?.name).filter(Boolean))];
    const name = await promptDialog(t("newExperiment"), suggested.length === 1 ? suggested[0] : t("defaultExperimentName", { date: new Date().toLocaleDateString() }), { label: t("captureNewName") });
    if (!name) return null;
    const exp = await db.createExperiment(name);
    experiments = await db.listExperiments();
    target = exp.id;
    fillTargets();
    return exp;
  }

  /** Preselects the experiment the phone chose (same id, or same name on another device) when they all agree. */
  function guessTarget() {
    if (target) return;
    const chosen = list.filter((i) => selected.has(i.id)).map((i) => i.sidecar?.experiment).filter(Boolean);
    if (!chosen.length) return;
    const match = (x) => experiments.find((e) => e.id === x.id) || experiments.find((e) => e.name === x.name);
    const ids = [...new Set(chosen.map((x) => match(x)?.id).filter(Boolean))];
    if (ids.length === 1) { target = ids[0]; fillTargets(); }
  }

  async function read() {
    try {
      if (!drive.isConnected()) return draw();
      busy(t("inboxReading"));
      list = await drive.listInbox();
      for (const id of [...selected]) if (!list.some((i) => i.id === id)) selected.delete(id);
    } catch (e) { showError(e); } finally { idle(); }
    if (alive) draw();
  }

  async function importSelected() {
    const chosen = list.filter((i) => selected.has(i.id));
    if (!chosen.length) return;
    const exp = await targetExperiment();
    if (!exp) return;
    const added = [], errors = [];
    try {
      for (let i = 0; i < chosen.length; i++) {
        const item = chosen[i], sc = item.sidecar || {};
        busy(t("inboxDownloading", { i: i + 1, n: chosen.length }), i / chosen.length);
        try {
          const blob = await drive.downloadFile(item.id);
          const name = sc.original_name || item.name;
          const capturedAt = Date.parse(sc.captured_at) || Date.parse(item.createdTime) || Date.now();
          const file = new File([blob], name, { type: blob.type || "image/jpeg", lastModified: capturedAt });
          if (!isImageFile(file)) throw new Error(t("unsupportedFile", { name }));
          const fields = await importFile(file);
          // The phone's quality check refers to the photo it took; recheck when it is missing (older sidecars).
          const quality = sc.quality ? scaleQuality(sc.quality, fields.width) : storedQuality(await checkPhoto(fields.blob, { origWidth: fields.origWidth }), fields.width);
          const img = { id: db.newId(), experimentId: exp.id, name, added: Date.now() + i, notes: sc.notes || "", meta: metaFromSidecar(sc), result: null,
            ...fields, capturedAt, quality, source: { drive: item.id, device: sc.device || "", sentAt: sc.captured_at || "" } };
          await db.putImage(img);
          added.push(img);
          await drive.markProcessed(item);
          selected.delete(item.id);
        } catch (e) {
          console.error(e);
          errors.push(`${item.name}: ${e.message || e}`);
        }
      }
    } finally { idle(); }
    if (added.length) {
      await db.touchExperiment(exp.id);
      toast(t("inboxImported", { n: added.length, name: exp.name }), "ok");
    }
    errors.forEach((e) => toast(e, "error"));
    list = list.filter((i) => !added.some((a) => a.source.drive === i.id));
    if (added.length && analyse) {
      const { n, errors: errs } = await analyseImages(added);
      if (n) toast(t("analysedN", { n }), "ok");
      errs.forEach((e) => toast(e, "error"));
    }
    if (added.length) location.hash = `#/e/${exp.id}`;
    else draw();
  }

  async function skipSelected() {
    const chosen = list.filter((i) => selected.has(i.id));
    if (!chosen.length || !(await confirmDialog(t("inboxSkipConfirm", { n: chosen.length }), { ok: t("inboxSkip") }))) return;
    try {
      for (const item of chosen) { busy(t("inboxSkip")); await drive.markProcessed(item); selected.delete(item.id); }
    } catch (e) { showError(e); } finally { idle(); }
    list = list.filter((i) => !chosen.includes(i) || selected.has(i.id));
    draw();
  }

  const body = h("div", { class: "inbox-body" });

  function draw() {
    if (!alive) return;
    const status = drive.getStatus();
    const connected = drive.isConnected();
    const n = selected.size;
    const analyseBox = h("input", { type: "checkbox", checked: analyse, onchange: () => { analyse = analyseBox.checked; try { localStorage.setItem(ANALYSE_KEY, JSON.stringify(analyse)); } catch { /* ignore */ } draw(); } });
    const selectAll = h("input", { type: "checkbox", "aria-label": t("selectAll"), checked: !!list?.length && n === list.length,
      onchange: () => { list.forEach((i) => (selectAll.checked ? selected.add(i.id) : selected.delete(i.id))); guessTarget(); draw(); } });
    selectAll.indeterminate = n > 0 && n < (list?.length || 0);

    const toolbar = h("div", { class: "card inbox-toolbar" },
      h("label", null, t("inboxTarget"), targetSelect),
      h("label", { class: "check small" }, analyseBox, t("inboxAnalyse")),
      h("div", { class: "actions" },
        h("button", { class: "primary", disabled: !n, onclick: importSelected }, "⤓ ", analyse ? t("inboxImport", { n }) : t("inboxImportOnly", { n })),
        h("button", { class: "ghost", disabled: !n, onclick: skipSelected }, t("inboxSkip"))));

    let content;
    if (!connected) {
      content = h("div", { class: "card" }, h("p", null, status === "expired" ? t("captureExpiredDrive") : t("inboxConnect")),
        h("button", { class: "primary", onclick: async () => { try { await drive.connect(); } catch (e) { showError(e); } } },
          status === "expired" ? t("captureReconnect") : t("captureConnect")));
    } else if (list === null) {
      content = h("p", { class: "muted" }, t("inboxReading"));
    } else if (!list.length) {
      content = h("p", { class: "card muted" }, t("inboxEmpty"));
    } else {
      content = h("section", { class: "card" },
        h("div", { class: "section-head" },
          h("label", { class: "check" }, selectAll, t("inboxCount", { n: list.length }), n ? h("span", { class: "muted small" }, ` · ${t("inboxSelected", { n })}`) : null),
          h("button", { class: "small", onclick: read }, "↻ ", t("inboxRefresh"))),
        h("ul", { class: "inbox-list" }, list.map((item) => {
          const sc = item.sidecar || {};
          const box = h("input", { type: "checkbox", checked: selected.has(item.id), "aria-label": item.name,
            onchange: () => { box.checked ? selected.add(item.id) : selected.delete(item.id); guessTarget(); draw(); } });
          const details = h("details", { class: "inbox-quality" }, h("summary", { class: "small" }, t("qualityTitle")), qualityList(sc.quality, { helpLink: false }));
          return h("li", { class: selected.has(item.id) ? "selected" : null },
            box,
            sc.thumbnail ? h("img", { src: sc.thumbnail, alt: "" }) : h("span", { class: "img-placeholder" }),
            h("div", { class: "grow" },
              h("b", null, sc.strain || sc.original_name || item.name), " ", qualityPill(sc.quality),
              h("div", { class: "muted small" }, describe(sc)),
              h("div", { class: "muted small" }, [sc.experiment?.name && `→ ${sc.experiment.name}`,
                t("inboxFrom", { date: new Date(sc.captured_at || item.createdTime).toLocaleString(), device: sc.device || "?" })].filter(Boolean).join(" · ")),
              sc.notes ? h("div", { class: "small" }, sc.notes) : null,
              sc.quality?.items?.length ? details : null));
        })));
    }
    body.replaceChildren(toolbar, content);
  }

  view.replaceChildren(
    h("div", { class: "crumbs" }, h("a", { href: "#/" }, t("experiments")), " › ", t("inbox")),
    h("div", { class: "page-head" }, h("div", null, h("h1", null, t("inboxTitle")), h("p", { class: "muted" }, t("inboxLead")))),
    body);
  cleanups.push(drive.onStatusChange((st) => { if (st === "connected" && list === null) read(); else draw(); }));
  return () => { alive = false; cleanups.forEach((fn) => fn()); };
}

/** A sidecar's quality report with its plate scaled to the stored image (the phone uploads at most 3000 px). */
function scaleQuality(q, width) {
  if (!q?.plate || !q.metrics?.width) return q || null;
  const k = width / q.metrics.width;
  return { ...q, plate: { cx: q.plate.cx * k, cy: q.plate.cy * k, r: q.plate.r * k } };
}

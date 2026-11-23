// Capture page (phones first, like AntibiogramJ-web's Capture): the plate data once for a batch, Take photo /
// Choose photos, a quality check of each photo with the plate circle drawn on it (Keep / Retake / Crop to plate),
// then either add the photos to an experiment on this device (optionally analysed at once) or send them with
// their data to the Google Drive inbox (MotilityJ/Inbox) to import them on a computer (pages/inbox.js).
// Sending works offline: js/drive.js keeps the photos in its IndexedDB queue until there is a connection.
import { analyseImages } from "../analyze.js";
import * as db from "../db.js";
import * as drive from "../drive.js";
import { h } from "../dom.js";
import { driveEnabled } from "../drive-ui.js";
import { readCaptureTime } from "../exif.js";
import { t } from "../i18n.js";
import { importFile, isImageFile } from "../images.js";
import { IMAGE_FIELDS, parseValue } from "../metadata.js";
import { fieldLabel, metaInput } from "../metadata-ui.js";
import { checkPhoto, cropToPlate } from "../quality.js";
import { photoPreview, qualityList, qualityPill, storedQuality } from "../quality-ui.js";
import { busy, confirmDialog, fileButton, idle, modal, promptDialog, showError, toast } from "../ui.js";

const FORM_KEY = "motilityj.capture.form";
const ANALYSE_KEY = "motilityj.capture.analyse";
const SENT_KEY = "motilityj.capture.sent"; // sessionStorage: captures queued from this page that left the queue
const NEW = "__new";

const load = (key, fallback, store = localStorage) => { try { return JSON.parse(store.getItem(key)) ?? fallback; } catch { return fallback; } };
const save = (key, value, store = localStorage) => { try { store.setItem(key, JSON.stringify(value)); } catch { /* storage blocked */ } };

const pad = (n) => String(n).padStart(2, "0");
const timeStamp = (ms) => { const d = new Date(ms); return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`; };
const safe = (x) => String(x).trim().replace(/[^\p{L}\p{N}.+-]+/gu, "-").replace(/^-+|-+$/g, "").slice(0, 40);

export async function render(view) {
  const form = { target: "", strain: "", condition: "", bioRep: "", techRep: "", incubationTimeH: "", notes: "", ...load(FORM_KEY, {}) };
  let analyseNow = load(ANALYSE_KEY, true);
  let experiments = await db.listExperiments();
  if (form.target && form.target !== "" && !experiments.some((e) => e.id === form.target)) form.target = "";
  const items = []; // { id, blob, name, capturedAt, url, report, checking, fromCamera }
  const useDrive = driveEnabled();
  const cleanups = [];
  let alive = true;

  const persist = () => save(FORM_KEY, form);
  const meta = () => Object.fromEntries(IMAGE_FIELDS.map((def) => [def.key, parseValue(def, form[def.key])]));

  // ------------------------------------------------------------ plate data form
  const targetSelect = h("select", { class: "capture-input", "aria-label": t("captureTarget") });
  function fillTargets() {
    targetSelect.replaceChildren(
      h("option", { value: "" }, "—"),
      ...experiments.map((e) => h("option", { value: e.id, selected: e.id === form.target }, e.name)),
      h("option", { value: NEW }, t("captureNewExperiment")));
    targetSelect.value = form.target || "";
  }
  targetSelect.addEventListener("change", async () => {
    if (targetSelect.value === NEW) {
      const name = await promptDialog(t("newExperiment"), t("defaultExperimentName", { date: new Date().toLocaleDateString() }), { label: t("captureNewName") });
      if (name) {
        const exp = await db.createExperiment(name);
        experiments = await db.listExperiments();
        form.target = exp.id;
      }
      fillTargets();
    } else form.target = targetSelect.value;
    persist();
    drawActions();
  });
  fillTargets();

  const fieldInputs = IMAGE_FIELDS.map((def) => {
    const input = metaInput(def, form[def.key], { className: "capture-input" });
    input.addEventListener("input", () => { form[def.key] = input.value; persist(); });
    return h("label", null, def.unit ? `${fieldLabel(def)} (${def.unit})` : fieldLabel(def), input);
  });
  const notes = h("textarea", { class: "capture-input", maxlength: 1000, rows: 2 }, form.notes);
  notes.value = form.notes;
  notes.addEventListener("input", () => { form.notes = notes.value; persist(); });

  const dataCard = h("section", { class: "card" },
    h("h2", null, t("captureData")),
    h("div", { class: "capture-form" },
      h("label", { class: "wide" }, t("captureTarget"), targetSelect),
      fieldInputs,
      h("label", { class: "wide" }, t("captureNotes"), notes)),
    h("p", { class: "muted small" }, t("captureDataLead")));

  // ------------------------------------------------------------ photos
  const grid = h("div", { class: "capture-grid" });
  const actions = h("div", { class: "capture-actions" });
  const lastNote = h("div");

  async function check(item) {
    item.checking = true;
    drawGrid();
    try { item.report = await checkPhoto(item.blob); } catch (e) { console.error(e); item.report = null; }
    item.checking = false;
    drawGrid();
    drawActions();
  }

  async function addFiles(files, fromCamera) {
    for (const f of files.filter(isImageFile)) {
      if (!alive) return;
      const capturedAt = (await readCaptureTime(f).catch(() => null)) ?? (f.lastModified || Date.now());
      const item = { id: db.newId(), blob: f, name: f.name || "photo.jpg", capturedAt, url: URL.createObjectURL(f), report: null, checking: true, fromCamera };
      items.push(item);
      drawActions();
      await check(item);
      // A photo just taken is shown at once (Keep / Retake / Crop); photos chosen in a batch only get their badge.
      if (fromCamera && alive) await review(item);
    }
  }

  function replaceBlob(item, blob) {
    URL.revokeObjectURL(item.url);
    item.blob = blob;
    item.url = URL.createObjectURL(blob);
  }

  function removeItem(item) {
    const i = items.indexOf(item);
    if (i >= 0) items.splice(i, 1);
    URL.revokeObjectURL(item.url);
    drawGrid();
    drawActions();
  }

  /** Check dialog: the photo with the plate circle and the warnings; Keep, Retake, Crop to plate or Remove. */
  async function review(item) {
    for (;;) {
      const choice = await modal((close) => {
        const retake = fileButton(h("span", null, "📷 ", t("captureRetake")), { accept: "image/*", capture: "environment", className: "button",
          onFiles: (files) => close({ retake: files[0] }) });
        return h("div", { class: "capture-review" },
          h("h2", null, t("captureReviewTitle")),
          photoPreview(item.url, item.report),
          item.report ? qualityList(item.report) : h("p", { class: "warn" }, t("q_plate_not_found")),
          h("div", { class: "actions dialog-actions capture-review-actions" },
            h("button", { class: "ghost danger", onclick: () => close("remove") }, t("captureRemove")),
            item.fromCamera ? retake : null,
            item.report?.canCrop ? h("button", { onclick: () => close("crop") }, "⌗ ", t("captureCrop")) : null,
            h("button", { class: "primary", autofocus: true, onclick: () => close("keep") }, t("captureKeep"))));
      });
      if (choice === "remove") { removeItem(item); return; }
      if (choice?.retake) {
        replaceBlob(item, choice.retake);
        item.capturedAt = (await readCaptureTime(choice.retake).catch(() => null)) ?? (choice.retake.lastModified || Date.now());
        await check(item);
        continue;
      }
      if (choice === "crop") {
        try {
          busy(t("qualityChecking"));
          replaceBlob(item, await cropToPlate(item.blob, item.report.plate));
          item.name = item.name.replace(/(\.\w+)?$/, "-crop.jpg");
          idle();
          toast(t("captureCropped"), "ok");
          await check(item);
        } catch (e) { idle(); showError(e); return; }
        continue;
      }
      return; // keep (or Esc)
    }
  }

  function drawGrid() {
    grid.replaceChildren(...(items.length ? items.map((item, i) => h("figure", { class: "capture-thumb" },
      h("button", { class: "thumb-open", "aria-label": `${t("captureReviewTitle")} ${i + 1}`, onclick: () => review(item) },
        h("img", { src: item.url, alt: `${i + 1}` })),
      h("span", { class: "thumb-quality" }, qualityPill(item.report, item.checking)),
      h("button", { class: "small thumb-remove", title: t("captureRemove"), "aria-label": `${t("captureRemove")} ${i + 1}`, onclick: () => removeItem(item) }, "✕")))
      : [h("p", { class: "muted" }, t("captureNoPhotos"))]));
  }

  function nameFor(item, i) {
    if (!item.fromCamera) return item.name;
    const parts = [form.strain, form.condition, form.bioRep && `b${form.bioRep}`, form.techRep && `t${form.techRep}`].filter(Boolean).map(safe).filter(Boolean);
    return `${parts.length ? parts.join("_") : "plate"}_${timeStamp(item.capturedAt)}${i ? `-${i}` : ""}.jpg`;
  }

  // ------------------------------------------------------------ destinations
  async function addLocal() {
    const exp = form.target && (await db.getExperiment(form.target));
    if (!exp) { toast(t("captureNeedTarget"), "error"); targetSelect.focus(); return; }
    const batch = items.slice();
    const added = [], addedItems = [];
    try {
      for (let i = 0; i < batch.length; i++) {
        busy(t("importingN", { i: i + 1, n: batch.length }), i / batch.length);
        const item = batch[i];
        const name = nameFor(item, i);
        const fields = await importFile(new File([item.blob], name, { type: item.blob.type || "image/jpeg", lastModified: item.capturedAt }));
        const img = { id: db.newId(), experimentId: exp.id, name, added: Date.now() + i, notes: form.notes || "", meta: meta(), result: null,
          ...fields, capturedAt: item.capturedAt, quality: storedQuality(item.report, fields.width) };
        await db.putImage(img);
        added.push(img);
        addedItems.push(item);
      }
    } catch (e) { showError(e); } finally { idle(); }
    if (!added.length) return;
    await db.touchExperiment(exp.id);
    addedItems.forEach(removeItem);
    toast(t("captureAdded", { n: added.length, name: exp.name }), "ok");
    if (analyseNow) {
      const { n, errors } = await analyseImages(added);
      if (n) toast(t("analysedN", { n }), "ok");
      errors.forEach((e) => toast(e, "error"));
    }
    lastNote.replaceChildren(h("p", { class: "ok" }, t("captureAdded", { n: added.length, name: exp.name }), " ",
      h("a", { href: `#/e/${exp.id}` }, t("openExperiment"))));
  }

  async function sendDrive() {
    const exp = form.target ? experiments.find((e) => e.id === form.target) : null;
    const batch = items.slice();
    let n = 0;
    try {
      for (let i = 0; i < batch.length; i++) {
        busy(t("importingN", { i: i + 1, n: batch.length }), i / batch.length);
        const item = batch[i];
        const m = meta();
        const clientId = db.newId();
        await drive.uploadCapture(item.blob, {
          client_id: clientId, app: "MotilityJ-web",
          strain: m.strain || "", name: [m.condition, m.bioRep && `b${m.bioRep}`, m.techRep && `t${m.techRep}`].filter(Boolean).join(" "),
          ...m, notes: form.notes || "", original_name: nameFor(item, i),
          experiment: exp ? { id: exp.id, name: exp.name } : null,
          captured_at: new Date(item.capturedAt).toISOString(),
          quality: storedQuality(item.report),
        });
        pending.add(clientId);
        removeItem(item);
        n++;
      }
    } catch (e) { showError(e); } finally { idle(); }
    if (n) toast(t("captureQueued", { n }), "ok");
    refreshQueue();
  }

  function drawActions() {
    if (!items.length) { actions.replaceChildren(); return; }
    const n = items.length;
    const analyseBox = h("input", { type: "checkbox", checked: analyseNow, onchange: () => { analyseNow = analyseBox.checked; save(ANALYSE_KEY, analyseNow); } });
    const exp = experiments.find((e) => e.id === form.target);
    actions.replaceChildren(...[
      h("div", { class: "capture-dest" },
        h("button", { class: "primary capture-send", onclick: addLocal, disabled: items.some((i) => i.checking) }, "＋ ", t("captureAddLocal", { n })),
        h("label", { class: "check small" }, analyseBox, t("captureAnalyseNow")),
        exp ? null : h("p", { class: "muted small" }, t("captureNeedTarget"))),
      useDrive ? h("div", { class: "capture-dest" },
        h("button", { class: "capture-send", onclick: sendDrive, disabled: items.some((i) => i.checking) }, "☁ ", t("captureSendDrive", { n })),
        h("p", { class: "muted small" }, t("captureDriveLead"))) : null].filter(Boolean));
  }

  const photosCard = h("section", { class: "card" },
    h("h2", null, t("capturePhotos")),
    h("div", { class: "capture-buttons" },
      fileButton(h("span", null, "📷 ", t("takePhoto")), { accept: "image/*", capture: "environment", className: "button primary capture-btn", onFiles: (f) => addFiles(f, true) }),
      fileButton(h("span", null, "🖼 ", t("captureChoose")), { accept: "image/*", multiple: true, className: "button capture-btn", onFiles: (f) => addFiles(f, false) })),
    h("p", { class: "muted small" }, t("capturePhotosLead"), " ", h("a", { href: "#/help/photos" }, t("captureTips"))),
    grid, actions, lastNote);
  drawGrid();

  // ------------------------------------------------------------ Drive status and queue
  const pending = new Set(load(SENT_KEY, [], sessionStorage)); // client ids queued from this page in this session
  const done = new Map(); // client id -> sidecar of captures that left the queue (uploaded)
  const driveBox = h("div");
  const queueCard = h("section", { class: "card", hidden: true });
  let lastQueue = [];

  function drawDriveBox(status) {
    if (!useDrive) return;
    const waiting = lastQueue.length;
    const offline = typeof navigator !== "undefined" && navigator.onLine === false;
    driveBox.replaceChildren(...[ // replaceChildren() would print null as text
      offline ? h("p", { class: "warn" }, t("captureOffline")) : null,
      status !== "connected" ? h("div", { class: "card capture-connect" },
        h("p", null, status === "expired" ? t("captureExpiredDrive") : t("captureConnectDrive"),
          waiting ? ` ${t("captureQueue")}: ${waiting}.` : ""),
        h("button", { class: "primary", onclick: async () => { try { await drive.connect(); } catch (e) { showError(e); } } },
          status === "expired" ? t("captureReconnect") : t("captureConnect"))) : null].filter(Boolean));
  }

  async function refreshQueue() {
    if (!useDrive) return;
    let list = [];
    try { list = await drive.queuedCaptures(); } catch (e) { console.error(e); }
    if (!alive) return;
    const inQueue = new Set(list.map((q) => q.sidecar?.client_id));
    for (const id of pending) {
      if (!inQueue.has(id)) { pending.delete(id); done.set(id, lastQueue.find((q) => q.sidecar?.client_id === id)?.sidecar || { client_id: id }); }
    }
    save(SENT_KEY, [...pending], sessionStorage);
    lastQueue = list;
    const row = (sc, status, q) => h("li", null,
      sc?.thumbnail ? h("img", { src: sc.thumbnail, alt: "" }) : h("span", { class: "img-placeholder" }),
      h("div", { class: "grow" },
        h("b", null, [sc?.strain, sc?.condition].filter(Boolean).join(" · ") || sc?.original_name || t("inboxNoData")),
        h("div", { class: "muted small" }, [sc?.experiment?.name, sc?.captured_at && new Date(sc.captured_at).toLocaleString()].filter(Boolean).join(" · ")),
        h("div", { class: `small status-${status}` }, status === "done" ? t("captureQueueDone")
          : status === "uploading" ? t("captureQueueUploading")
            : status === "error" ? t("captureQueueFailed", { error: q.error || "" })
              : q?.error ? `${t("captureQueueWaiting")}: ${q.error}` : t("captureQueueWaiting"))),
      q && status !== "uploading" ? h("button", { class: "small ghost danger", onclick: async () => {
        if (await confirmDialog(t("captureQueueDeleteConfirm"), { ok: t("captureQueueDelete"), danger: true })) {
          await drive.removeQueuedCapture(q.id);
          pending.delete(q.sidecar?.client_id);
        }
      } }, t("captureQueueDelete")) : null);
    const connected = drive.isConnected();
    queueCard.hidden = !list.length && !done.size;
    queueCard.replaceChildren(
      h("div", { class: "section-head" }, h("h2", null, list.length ? t("captureQueue") : t("captureSent")),
        list.length && connected ? h("button", { class: "small", onclick: () => drive.processQueue().catch(showError) }, t("captureSendNow")) : null),
      h("ul", { class: "capture-queue" },
        list.map((q) => row(q.sidecar, q.status, q)),
        [...done.values()].reverse().map((sc) => row(sc, "done", null))));
    drawDriveBox(drive.getStatus());
  }

  if (useDrive) {
    cleanups.push(drive.onStatusChange((st) => { drawDriveBox(st); refreshQueue(); }));
    cleanups.push(drive.onQueueChange(refreshQueue));
    const net = () => { drawDriveBox(drive.getStatus()); if (navigator.onLine) drive.processQueue().catch(() => {}); };
    window.addEventListener("online", net);
    window.addEventListener("offline", net);
    cleanups.push(() => { window.removeEventListener("online", net); window.removeEventListener("offline", net); });
    refreshQueue();
  }

  view.classList.add("capture-page");
  view.replaceChildren(
    h("div", { class: "page-head" }, h("div", null, h("h1", null, t("captureTitle")),
      h("p", { class: "muted" }, useDrive ? t("captureLead") : t("captureLeadNoDrive")))),
    driveBox, dataCard, photosCard, queueCard);

  return () => {
    alive = false;
    cleanups.forEach((fn) => { try { fn(); } catch { /* ignore */ } });
    items.forEach((i) => URL.revokeObjectURL(i.url));
  };
}

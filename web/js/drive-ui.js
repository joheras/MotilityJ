// Optional Google Drive UI. Everything here is hidden unless drive.isConfigured() (js/config.js has a client ID).
// Calls only the functions of the contract in js/drive.js.
import * as drive from "./drive.js";
import * as db from "./db.js";
import { h } from "./dom.js";
import { makeBackup, restoreBackup } from "./export.js";
import { t } from "./i18n.js";
import { importFile, isImageFile } from "./images.js";
import { busy, chooseDialog, idle, showError, toast } from "./ui.js";

export function driveEnabled() {
  try { return typeof drive.isConfigured === "function" && drive.isConfigured(); } catch { return false; }
}

const call = (name, ...args) => {
  if (typeof drive[name] !== "function") throw new Error(t("driveUnavailable"));
  return drive[name](...args);
};

export function driveStatusPanel() {
  if (!driveEnabled()) return null;
  const text = h("span", { class: "grow" });
  const button = h("button", { class: "small", onclick: connect });
  const panel = h("div", { class: "drive-banner card" }, h("span", { class: "tag" }, "Google Drive"), text, button);
  const show = (status) => {
    text.textContent = t(`drive_${status}`) || status;
    button.textContent = status === "connected" ? t("driveConnected") : t("driveConnect");
    button.disabled = status === "connected";
    panel.dataset.status = status;
  };
  async function connect() {
    try { await call("connect"); } catch (e) { showError(e); }
  }
  let connected = false;
  try { connected = drive.isConnected?.(); } catch { /* ignore */ }
  show(connected ? "connected" : "disconnected");
  try { drive.onStatusChange?.(show); } catch { /* ignore */ }
  return panel;
}

async function ensureConnected() {
  if (!drive.isConnected?.()) await call("connect");
}

export async function saveExperimentToDrive(exp) {
  try {
    await ensureConnected();
    busy(t("driveSaving"));
    await call("backupExperiment", await makeBackup([exp]));
    toast(t("driveSaved", { name: exp.name }), "ok");
  } catch (e) { showError(e); } finally { idle(); }
}

/** Lets the user pick a backup in Drive and restores it. Returns the number of experiments added. */
export async function restoreFromDrive() {
  try {
    await ensureConnected();
    busy(t("loading"));
    const list = await call("listBackups");
    idle();
    const id = await chooseDialog(t("driveRestoreTitle"),
      list.map((b) => ({ value: b.id, label: b.name, detail: b.modifiedTime ? new Date(b.modifiedTime).toLocaleString() : "" })),
      { empty: t("driveNoBackups") });
    if (!id) return 0;
    busy(t("restoring"));
    return await restoreBackup(await call("downloadBackup", id));
  } catch (e) { showError(e); return 0; } finally { idle(); }
}

/** Imports one photo from MotilityJ/Inbox in Drive into the experiment. Returns true when an image was added. */
export async function importFromInbox(experimentId) {
  try {
    await ensureConnected();
    busy(t("loading"));
    const list = await call("listInbox");
    idle();
    const id = await chooseDialog(t("driveInboxTitle"), list.map((f) => ({ value: f.id, label: f.name })), { empty: t("driveInboxEmpty") });
    if (!id) return false;
    const item = list.find((f) => f.id === id);
    busy(t("importingN", { i: 1, n: 1 }));
    const blob = await call("downloadFile", id);
    const file = new File([blob], item.name, { type: blob.type });
    if (!isImageFile(file)) throw new Error(t("unsupportedFile", { name: item.name }));
    await db.putImage({ id: db.newId(), experimentId, name: item.name, added: Date.now(), notes: item.sidecar?.notes || "", result: null, ...(await importFile(file)) });
    await db.touchExperiment(experimentId);
    return true;
  } catch (e) { showError(e); return false; } finally { idle(); }
}

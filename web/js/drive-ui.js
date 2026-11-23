// Optional Google Drive UI. Everything here is hidden unless drive.isConfigured() (js/config.js has a client ID).
// Calls only the functions of the contract in js/drive.js. The Drive inbox and phone captures are in
// pages/inbox.js and pages/capture.js.
import * as drive from "./drive.js";
import { h } from "./dom.js";
import { makeBackup, restoreBackup } from "./export.js";
import { t } from "./i18n.js";
import { busy, chooseDialog, idle, showError, toast } from "./ui.js";

export function driveEnabled() {
  try { return typeof drive.isConfigured === "function" && drive.isConfigured(); } catch { return false; }
}

const call = (name, ...args) => {
  if (typeof drive[name] !== "function") throw new Error(t("driveUnavailable"));
  return drive[name](...args);
};

/** Compact Drive status for the top bar: a pill with a coloured dot; click to connect. */
export function driveStatusButton() {
  if (!driveEnabled()) return null;
  const label = h("span", { class: "drive-label" }, "Drive");
  const button = h("button", { class: "small drive-pill", onclick: connect }, h("span", { class: "dot", "aria-hidden": "true" }), label);
  const show = (status) => {
    const text = t(`drive_${status}`) || status;
    button.title = text;
    button.setAttribute("aria-label", `Google Drive: ${text}`);
    button.dataset.status = status;
  };
  async function connect() {
    if (button.dataset.status === "connected") { toast(t("drive_connected"), "ok"); return; }
    try { await call("connect"); } catch (e) { showError(e); }
  }
  let connected = false;
  try { connected = drive.isConnected?.(); } catch { /* ignore */ }
  show(connected ? "connected" : "disconnected");
  try { drive.onStatusChange?.(show); } catch { /* ignore */ }
  return button;
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

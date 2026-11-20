// Settings: plate diameter, optional manual scale, storage.
import * as db from "../db.js";
import { h } from "../dom.js";
import { t } from "../i18n.js";
import { isPersisted, requestPersistence } from "../pwa.js";
import { confirmDialog, showError, toast } from "../ui.js";

export async function render(view, _params, ctx) {
  const st = ctx.settings;
  const diameter = h("input", { type: "number", min: 1, max: 1000, step: "any", required: true, value: String(st.plateDiameterMm) });
  const manual = h("input", { type: "number", min: 0, step: "any", placeholder: t("manualScalePlaceholder"), value: st.manualPxPerMm > 0 ? String(st.manualPxPerMm) : "" });

  const form = h("form", { class: "card settings-card", onsubmit: async (e) => {
    e.preventDefault();
    const d = Number(diameter.value), m = manual.value.trim() === "" ? null : Number(manual.value);
    if (!(d > 0)) return toast(t("invalidDiameter"), "error");
    if (m != null && !(m > 0)) return toast(t("invalidScale"), "error");
    ctx.settings = { ...st, plateDiameterMm: d, manualPxPerMm: m };
    try { await db.saveSettings(ctx.settings); toast(t("settingsSaved"), "ok"); } catch (err) { showError(err); }
  } },
  h("h2", null, t("measurement")),
  h("div", { class: "form-grid" },
    h("label", null, t("plateDiameter"), diameter, h("span", { class: "small" }, t("plateDiameterHelp"))),
    h("label", null, t("manualScale"), manual, h("span", { class: "small" }, t("manualScaleHelp")))),
  h("div", { class: "actions" }, h("button", { class: "primary", type: "submit" }, t("save"))));

  const persisted = await isPersisted();
  let usage = "";
  try {
    const est = await navigator.storage?.estimate?.();
    if (est?.usage != null) usage = t("storageUsage", { mb: (est.usage / 1048576).toFixed(1) });
  } catch { /* ignore */ }
  const persistLine = h("p", null, t("storageState"), " ",
    persisted === null ? t("unknown") : persisted ? h("b", null, t("persistent")) : h("span", null, t("bestEffort"), " ",
      h("button", { class: "link", onclick: async () => { toast((await requestPersistence()) ? t("persistGranted") : t("persistDenied")); render(view, _params, ctx); } }, t("askKeep"))),
    usage ? ` ${usage}` : "");

  const storage = h("section", { class: "card" },
    h("h2", null, t("storage")),
    h("p", { class: "muted" }, t("storageLead")),
    persistLine,
    h("div", { class: "actions" },
      h("button", { class: "danger", onclick: async () => {
        if (await confirmDialog(t("deleteAllConfirm"), { ok: t("deleteAll"), danger: true })) {
          await db.clearAll();
          toast(t("deletedAll"), "ok");
        }
      } }, t("deleteAll"))));

  view.replaceChildren(h("div", { class: "page-head" }, h("h1", null, t("settings"))), h("div", { class: "settings-page" }, form, storage));
}

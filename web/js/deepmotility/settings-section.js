// Settings card: which analyzer "Analyse" uses (built-in or Deep-Motility), and the downloaded models.
import * as db from "../db.js";
import { h } from "../dom.js";
import { t } from "../i18n.js";
import { showError, toast } from "../ui.js";
import { dmSupported, isModelCached, removeModel } from "./index.js";
import { downloadMb, ensureModel } from "./review-tool.js";

export async function analyzerSection(ctx) {
  const card = h("section", { class: "card" });
  const supported = dmSupported();

  async function save(analyzer) {
    ctx.settings = { ...ctx.settings, analyzer };
    try { await db.saveSettings(ctx.settings); toast(t("settingsSaved"), "ok"); } catch (e) { showError(e); }
  }

  async function draw() {
    const cached = supported && (await isModelCached());
    const current = ctx.settings.analyzer === "deepmotility" && cached ? "deepmotility" : "builtin";
    const option = (value, label, help, disabled = false) => h("label", { class: "radio-row", style: { display: "flex", flexDirection: "row", gap: "8px", alignItems: "flex-start" } },
      h("input", { type: "radio", name: "analyzer", value, checked: current === value, disabled, style: { width: "auto", marginTop: "4px" },
        onchange: async () => {
          if (value === "deepmotility" && !cached) {
            try { if (!(await ensureModel())) return draw(); } catch (e) { showError(e); return draw(); }
          }
          await save(value);
          draw();
        } }),
      h("span", null, h("b", null, label), h("br"), h("span", { class: "small muted" }, help)));
    card.replaceChildren(
      h("h2", null, t("dmAnalyzer")),
      h("p", { class: "muted" }, t("dmAnalyzerLead")),
      h("div", { style: { display: "flex", flexDirection: "column", gap: "10px" } },
        option("builtin", t("dmAnalyzerBuiltin"), t("dmAnalyzerBuiltinHelp")),
        option("deepmotility", t("dmAnalyzerDeep"), t("dmAnalyzerDeepHelp", { mb: downloadMb(), s: "0.5" }), !supported)),
      !supported ? h("p", { class: "small muted" }, t("dmUnsupported"))
        : h("p", null, t("dmModelState"), " ", cached ? h("b", null, t("dmModelReady")) : t("dmModelMissing"), " ",
          cached
            ? h("button", { class: "link", onclick: async () => {
              try { await removeModel(); if (ctx.settings.analyzer === "deepmotility") await save("builtin"); toast(t("dmRemoved")); } catch (e) { showError(e); }
              draw();
            } }, t("dmRemove"))
            : h("button", { class: "link", onclick: async () => { try { await ensureModel(); } catch (e) { showError(e); } draw(); } }, t("dmDownload"))));
  }
  await draw();
  return card;
}

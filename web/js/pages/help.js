// Help: workflow, photographing plates, capture and Drive inbox, review and editing, AI outline, Deep-Motility, area, measurements, assay metadata, time series,
// phones/install/offline, data and privacy.
import { h } from "../dom.js";
import { t } from "../i18n.js";
import { canInstall, isPersisted, isStandalone, promptInstall } from "../pwa.js";

const SECTIONS = ["workflow", "photos", "capture", "review", "sam", "deepmotility", "area", "measures", "metadata", "series", "formats", "install", "privacy"];

export async function render(view, { section }) {
  const install = h("div");
  if (isStandalone()) install.append(h("p", { class: "ok" }, t("usingInstalled")));
  else if (canInstall()) install.append(h("p", null, h("button", { class: "primary", onclick: promptInstall }, t("installApp"))));
  const persisted = await isPersisted();

  const body = SECTIONS.map((id) => h("section", { id: `help-${id}`, class: "card" },
    h("h2", null, t(`help_${id}_title`)),
    h("div", { html: t(`help_${id}_html`) }),
    id === "install" ? [install, h("p", { class: "small muted" }, t("storageState"), " ", persisted === null ? t("unknown") : persisted ? t("persistent") : t("bestEffort"), ".")] : null));

  const toc = h("nav", { class: "help-toc", "aria-label": t("help") },
    SECTIONS.map((id) => h("a", { href: `#/help/${id}` }, t(`help_${id}_title`))));

  view.replaceChildren(
    h("div", { class: "page-head" }, h("div", null, h("h1", null, t("help")), h("p", { class: "muted lead" }, t("helpLead")))),
    h("div", { class: "help-page" }, toc, h("div", { class: "help-body" }, body)));
  if (section) requestAnimationFrame(() => document.getElementById(`help-${section}`)?.scrollIntoView({ block: "start" }));
}

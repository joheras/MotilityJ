// MotilityJ web: app shell (top bar with Drive status, update banner), hash router and boot.
import * as db from "./db.js";
import { h } from "./dom.js";
import { driveEnabled, driveStatusButton } from "./drive-ui.js";
import { t } from "./i18n.js";
import { applyUpdate, canInstall, onPwaChange, promptInstall, registerServiceWorker, updateAvailable } from "./pwa.js";
import { showError } from "./ui.js";
import * as capturePage from "./pages/capture.js";
import * as experimentPage from "./pages/experiment.js";
import * as experimentsPage from "./pages/experiments.js";
import * as helpPage from "./pages/help.js";
import * as inboxPage from "./pages/inbox.js";
import * as reviewPage from "./pages/review.js";
import * as seriesPage from "./pages/series.js";
import * as settingsPage from "./pages/settings.js";

const ROUTES = [
  [/^\/?$/, experimentsPage, () => ({})],
  [/^\/e\/([^/]+)\/?$/, experimentPage, (m) => ({ expId: m[1] })],
  [/^\/e\/([^/]+)\/i\/([^/]+)\/?$/, reviewPage, (m) => ({ expId: m[1], imageId: m[2] })],
  [/^\/e\/([^/]+)\/s\/([^/]+)\/?$/, seriesPage, (m) => ({ expId: m[1], seriesId: m[2] })],
  [/^\/capture\/?$/, capturePage, () => ({})],
  [/^\/inbox(?:\/([^/]+))?\/?$/, inboxPage, (m) => ({ expId: m[1] })],
  [/^\/settings\/?$/, settingsPage, () => ({})],
  [/^\/help(?:\/([\w-]+))?\/?$/, helpPage, (m) => ({ section: m[1] })],
];

const ctx = { settings: null };
let cleanup = null;
let token = 0;

function topbar() {
  const install = h("button", { class: "small", onclick: promptInstall, title: t("installHint") }, t("install"));
  const links = [["#/", t("experiments"), "nav-experiments"], ["#/capture", h("span", null, "📷 ", t("capture")), "nav-capture"],
    driveEnabled() ? ["#/inbox", t("inbox"), "nav-inbox"] : null, ["#/settings", t("settings"), ""], ["#/help", t("help"), ""]]
    .filter(Boolean)
    .map(([href, label, cls]) => h("a", { href, class: ["topbar-link", cls] }, label));
  const bar = h("header", { class: "topbar" },
    h("a", { href: "#/", class: "brand" }, h("span", { class: "logo", "aria-hidden": "true" }, "◉"), " MotilityJ"),
    h("nav", { class: "topbar-user" }, install, ...links, driveStatusButton(),
      h("span", { class: "tag topbar-offline", title: t("dataLocalHint") }, t("dataLocal"))));
  const banner = h("div", { class: "update-banner", role: "status" }, t("updateAvailable"),
    h("button", { class: "small primary", onclick: applyUpdate }, t("reload")));
  const sync = () => {
    install.hidden = !canInstall();
    banner.hidden = !updateAvailable();
  };
  onPwaChange(sync);
  sync();
  return { bar, banner, links };
}

async function route(view, links) {
  const path = location.hash.replace(/^#/, "") || "/";
  const my = ++token;
  try { cleanup?.(); } catch (e) { console.error(e); }
  cleanup = null;
  let page = null, params = {};
  for (const [re, mod, args] of ROUTES) {
    const m = path.match(re);
    if (m) { page = mod; params = args(m.map((x) => (x == null ? x : decodeURIComponent(x)))); break; }
  }
  if (!page) { location.replace("#/"); return; }
  for (const a of links) {
    const target = a.getAttribute("href").slice(1);
    a.classList.toggle("active", target === "/" ? (path === "/" || path.startsWith("/e/")) : path.startsWith(target));
  }
  const el = h("div", { class: "page" });
  view.replaceChildren(el);
  window.scrollTo(0, 0);
  try {
    const c = await page.render(el, params, ctx);
    if (my !== token) { if (typeof c === "function") c(); return; }
    cleanup = typeof c === "function" ? c : null;
  } catch (e) {
    showError(e);
    el.replaceChildren(h("p", { class: "error" }, e.message || String(e)));
  }
}

async function boot() {
  registerServiceWorker();
  const { bar, banner, links } = topbar();
  const main = h("main");
  const view = h("div", { class: "view" });
  main.append(view);
  const footer = h("footer", { class: "footer muted small" }, "MotilityJ · ", h("a", { href: "#/help" }, t("help")), " · ",
    h("a", { href: "#/help/privacy" }, t("privacy")), " · ", h("a", { href: "https://github.com/joheras/MotilityJ", target: "_blank", rel: "noreferrer" }, t("sourceCode")));
  document.getElementById("app").replaceChildren(bar, banner, main, footer);
  try {
    ctx.settings = await db.getSettings();
  } catch (e) {
    view.replaceChildren(h("div", { class: "center" }, h("p", { class: "error" }, t("storageUnavailable"), " ", e.message || "")));
    return;
  }
  window.addEventListener("hashchange", () => route(view, links));
  await route(view, links);
}

boot();

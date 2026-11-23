// UI pieces for the photo quality check (js/quality.js): badges, the list of warnings with tips, the photo with
// the detected plate circle, and the compact report stored on an image (image.quality) or in a Drive sidecar.
import { h, s } from "./dom.js";
import { t } from "./i18n.js";
import { qualityItems } from "./quality.js";

/**
 * Compact report for storage: plate scaled to an image `width` px wide (the stored copy is often downscaled);
 * the full-resolution measures that only matter while checking are dropped.
 */
export function storedQuality(report, width = null) {
  if (!report) return null;
  const m = report.metrics || {};
  const k = width && m.width ? width / m.width : 1;
  const plate = report.plate ? { cx: report.plate.cx * k, cy: report.plate.cy * k, r: report.plate.r * k } : null;
  const { plate: _p, analysisPlate: _a, ms: _ms, ...metrics } = m;
  return { version: report.version, score: report.score, level: report.level, canCrop: !!report.canCrop,
    items: report.items.map(({ level, code, params }) => ({ level, code, params })), metrics, plate, checkedAt: report.checkedAt };
}

/** "⚠ Photo" badge for images whose photo has warnings; null for good photos or images never checked. */
export function qualityBadge(q) {
  if (!q?.items?.length) return null;
  return h("span", { class: ["badge", q.level === "bad" ? "cat-r" : "cat-i", "quality-badge"],
    title: `${t("qualityBadgeHint")}\n${qualityItems(q).map((i) => `• ${i.message}`).join("\n")}` }, "⚠ ", t("qualityBadge"));
}

/** Score pill: green (good), amber (warnings) or red (serious warnings); "…" while checking. */
export function qualityPill(q, checking = false) {
  if (checking) return h("span", { class: "badge cat-na quality-pill" }, "…");
  if (!q) return null;
  const cls = q.level === "ok" ? "cat-s" : q.level === "warn" ? "cat-i" : "cat-r";
  const text = q.level === "ok" ? `✓ ${q.score}` : `⚠ ${q.score}`;
  return h("span", { class: ["badge", cls, "quality-pill"], title: q.items.length ? qualityItems(q).map((i) => i.message).join(" ") : t("qualityOk") }, text);
}

/** The warnings with their tips (non-blocking), or a short "good photo" note. */
export function qualityList(q, { showOk = true, helpLink = true } = {}) {
  if (!q) return null;
  const items = qualityItems(q);
  if (!items.length) return showOk ? h("p", { class: "ok quality-ok" }, "✓ ", t("qualityOk")) : null;
  return h("div", { class: ["warn", "quality-list", q.level === "bad" ? "quality-bad" : ""], role: "status" },
    h("b", null, t("qualityTitle"), " · ", t("qualityScore", { score: q.score })),
    h("ul", null, items.map((i) => h("li", null, h("span", { class: `q-level q-${i.level}` }, i.level === "bad" ? "●" : "○"), " ",
      i.message, " ", h("span", { class: "small q-tip" }, i.tip)))),
    h("span", { class: "small" }, t("qualityLead"), helpLink ? [" ", h("a", { href: "#/help/photos" }, t("qualityHowTo"))] : null));
}

/** The photo (object URL) with the detected plate circle drawn on top. width/height: the photo's pixel size. */
export function photoPreview(url, q, { width = null, height = null, className = "photo-preview" } = {}) {
  const W = width || q?.metrics?.width || 1, H = height || q?.metrics?.height || 1;
  const p = q?.plate;
  const svg = p ? s("svg", { class: "preview-overlay", viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: "xMidYMid meet", "aria-hidden": "true" },
    s("circle", { class: "pv-plate", cx: p.cx, cy: p.cy, r: p.r, style: `stroke-width:${Math.max(W, H) / 150}px` })) : null;
  return h("div", { class: className, style: { aspectRatio: `${W} / ${H}` } }, h("img", { src: url, alt: "" }), svg);
}

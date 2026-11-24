// Figure builder dialog: options, live preview and SVG / PNG download of a publication figure of plate photos
// (layout and SVG in figure.js). Opened from the Export menu of the experiment page and from the series page.
import { rowContext } from "./columns.js";
import * as db from "./db.js";
import { h } from "./dom.js";
import { download, safeFileName } from "./export.js";
import { DEFAULTS, buildGrid, figureShapes, layoutFigure, pngSize, rowKeyOf, toSvg } from "./figure.js";
import { t } from "./i18n.js";
import { MEASURES } from "./measure.js";
import { busy, idle, modal, showError } from "./ui.js";

const STORE = "motilityj.figure"; // last options (per browser, convenience only)
const MAX_PX = 16000; // longest side of the PNG
const PREVIEW_PX = 360; // side of the preview crops

function loadOpts() {
  try { return JSON.parse(localStorage.getItem(STORE) || "{}") || {}; } catch { return {}; }
}
function saveOpts(o) {
  try { const { manualIds, ...keep } = o; localStorage.setItem(STORE, JSON.stringify(keep)); } catch { /* private window */ }
}

/** Figure items: analysed images with effective metadata, measurements and scale. */
function makeItems(images, exp, settings, seriesNames) {
  return images.filter((img) => img.result).map((img) => {
    const c = rowContext(img, exp, settings);
    return { id: img.id, name: img.name, img, width: img.width, height: img.height, result: img.result, plate: img.result.plate,
      meta: c.eff, m: c.m, mmPerPx: c.m?.mmPerPx ?? null, timeH: img.timeH, seriesName: seriesNames.get(img.seriesId) || null, value: null };
  });
}

// ------------------------------------------------------------- rendering
const bitmaps = new Map(); // image id -> ImageBitmap (for the lifetime of the dialog)
async function bitmapOf(it) {
  if (!bitmaps.has(it.id)) bitmaps.set(it.id, await createImageBitmap(it.img.blob));
  return bitmaps.get(it.id);
}

/** Canvas of `px`×`px` with the crop square of a panel (outside the photo: background colour). */
async function cropCanvas(it, geom, px, bg) {
  const bmp = await bitmapOf(it);
  const cv = Object.assign(document.createElement("canvas"), { width: px, height: px });
  const ctx = cv.getContext("2d");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, px, px);
  const k = px / geom.crop.size;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bmp, -geom.crop.x * k, -geom.crop.y * k, bmp.width * k * (it.width / bmp.width), bmp.height * k * (it.height / bmp.height));
  return cv;
}

const toBlob = (cv, type, q) => new Promise((res, rej) => cv.toBlob((b) => (b ? res(b) : rej(new Error("canvas"))), type, q));
const blobToDataUrl = (blob) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error); r.readAsDataURL(blob); });

/** Paints the primitives (figure mm) on a 2D context already scaled to mm; crops: panel index -> canvas. */
function paint(ctx, shapes, crops) {
  for (const sh of shapes) {
    ctx.save();
    switch (sh.type) {
      case "rect": ctx.fillStyle = sh.fill; ctx.fillRect(sh.x, sh.y, sh.w, sh.h); break;
      case "image":
        ctx.beginPath();
        if (sh.clip) ctx.arc(sh.clip.cx, sh.clip.cy, sh.clip.r, 0, 2 * Math.PI); else ctx.rect(sh.x, sh.y, sh.w, sh.h);
        ctx.clip();
        if (crops[sh.key]) ctx.drawImage(crops[sh.key], sh.x, sh.y, sh.w, sh.h);
        break;
      case "poly":
        ctx.beginPath();
        sh.points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        if (sh.closed) ctx.closePath();
        ctx.strokeStyle = sh.stroke; ctx.lineWidth = sh.width; ctx.lineJoin = "round"; ctx.stroke();
        break;
      case "circle":
        ctx.beginPath(); ctx.arc(sh.cx, sh.cy, sh.r, 0, 2 * Math.PI);
        ctx.strokeStyle = sh.stroke; ctx.lineWidth = sh.width; ctx.stroke();
        break;
      case "line":
        ctx.beginPath(); ctx.moveTo(sh.x1, sh.y1); ctx.lineTo(sh.x2, sh.y2);
        ctx.strokeStyle = sh.stroke; ctx.lineWidth = sh.width; ctx.stroke();
        break;
      case "text": {
        ctx.font = `${sh.weight === "bold" ? "bold " : ""}${sh.size}px Arial, Helvetica, sans-serif`;
        ctx.textAlign = sh.anchor === "middle" ? "center" : sh.anchor === "end" ? "right" : "left";
        ctx.textBaseline = "alphabetic";
        ctx.translate(sh.x, sh.y);
        let dy = 0;
        if (sh.rotate) { ctx.rotate((sh.rotate * Math.PI) / 180); dy = sh.size * 0.35; }
        if (sh.halo) { ctx.strokeStyle = sh.halo; ctx.lineWidth = sh.size * 0.18; ctx.lineJoin = "round"; ctx.strokeText(sh.text, 0, dy); }
        ctx.fillStyle = sh.fill;
        ctx.fillText(sh.text, 0, dy);
        break;
      }
    }
    ctx.restore();
  }
}

/** Everything needed to draw the figure with the current options. */
function compose(items, o) {
  for (const it of items) it.value = it.m?.[o.repMeasure] ?? null;
  const transpose = o.transpose === "yes" ? true : o.transpose === "no" ? false : "auto";
  const grid = buildGrid(items, { ...o, transpose, repLabel: t("figRepN") });
  const layout = layoutFigure(grid, o);
  const shapes = figureShapes(layout, { ...o, tableHeader: [t("figGroup"), "n", t("figMeanSd", { m: t(`m_${o.tableMeasure}`) })] });
  return { grid, layout, shapes };
}

const panelPx = (layout, dpi) => Math.max(16, Math.min(4000, Math.ceil((layout.panel / 25.4) * dpi)));
const bgOf = (o) => (o.background === "black" ? "#000000" : "#ffffff");

async function svgBlob(fig, o) {
  const px = Math.min(2000, panelPx(fig.layout, o.dpi));
  const hrefs = {};
  for (const [i, p] of fig.layout.panels.entries()) {
    hrefs[i] = await blobToDataUrl(await toBlob(await cropCanvas(p.item, p.geom, px, bgOf(o)), "image/jpeg", 0.92));
  }
  return new Blob([toSvg(fig.layout, fig.shapes, hrefs)], { type: "image/svg+xml" });
}

async function pngCanvas(fig, o) {
  const size = pngSize(fig.layout, o.dpi);
  if (size.width > MAX_PX || size.height > MAX_PX) throw new Error(t("figTooLarge", { w: size.width, h: size.height }));
  const px = panelPx(fig.layout, o.dpi);
  const crops = {};
  for (const [i, p] of fig.layout.panels.entries()) crops[i] = await cropCanvas(p.item, p.geom, px, bgOf(o));
  const cv = Object.assign(document.createElement("canvas"), { width: size.width, height: size.height });
  const ctx = cv.getContext("2d");
  ctx.scale(size.width / fig.layout.widthMm, size.height / fig.layout.heightMm);
  paint(ctx, fig.shapes, crops);
  return cv;
}

/** PNG with its resolution (pHYs chunk) so that it opens at the chosen DPI. */
async function pngBlob(fig, o) {
  const raw = new Uint8Array(await (await toBlob(await pngCanvas(fig, o), "image/png")).arrayBuffer());
  return new Blob([withDpi(raw, o.dpi)], { type: "image/png" });
}

const CRC = (() => { const tb = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; tb[n] = c >>> 0; } return tb; })();
const crc32 = (bytes) => { let c = 0xffffffff; for (const b of bytes) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function withDpi(png, dpi) {
  const ppm = Math.round(dpi / 0.0254);
  const chunk = new Uint8Array(21);
  const dv = new DataView(chunk.buffer);
  dv.setUint32(0, 9);
  chunk.set([0x70, 0x48, 0x59, 0x73], 4); // "pHYs"
  dv.setUint32(8, ppm); dv.setUint32(12, ppm); chunk[16] = 1;
  dv.setUint32(17, crc32(chunk.subarray(4, 17)));
  const at = 33; // after the signature (8) and IHDR (25)
  const out = new Uint8Array(png.length + 21);
  out.set(png.subarray(0, at)); out.set(chunk, at); out.set(png.subarray(at), at + 21);
  return out;
}

// ----------------------------------------------------------------- dialog
/**
 * Opens the figure builder. images: the images to choose from (of the experiment, or of one series).
 * series: when given, rows = series and columns = time points by default.
 */
export async function figureDialog(exp, images, settings, { series = null } = {}) {
  const seriesList = await db.listSeries(exp.id);
  const items = makeItems(images, exp, settings, new Map(seriesList.map((s) => [s.id, s.name])));
  if (!items.length) { showError(new Error(t("figNoAnalysed"))); return; }
  const o = { ...DEFAULTS, ...loadOpts(), manualIds: null };
  if (![ "auto", "yes", "no"].includes(o.transpose)) o.transpose = "auto";
  if (series) Object.assign(o, { rowsBy: "series", colsBy: "time", select: "representative", transpose: "no" });
  let unit = o.unit === "in" ? "in" : "mm";
  const previewUrls = [];
  const previewCrops = new Map(); // key -> object URL

  const opt = (value, label) => h("option", { value }, label);
  const field = (label, input, hint = null) => h("label", { class: "fig-field" }, h("span", null, label), input, hint && h("small", { class: "muted" }, hint));
  const select = (key, options) => {
    const el = h("select", { onchange: () => { o[key] = el.value; update(); } }, options.map(([v, l]) => opt(v, l)));
    el.value = o[key];
    return el;
  };
  const check = (key, label) => {
    const el = h("input", { type: "checkbox", checked: !!o[key], onchange: () => { o[key] = el.checked; update(); } });
    return h("label", { class: "check" }, el, " ", label);
  };
  const number = (key, { min, max, step = "any", scale = 1 } = {}) => {
    const el = h("input", { type: "number", min, max, step, value: Math.round(o[key] * scale * 1000) / 1000, class: "fig-num",
      oninput: () => { const v = Number(el.value.replace?.(",", ".") ?? el.value); if (Number.isFinite(v) && v >= (min ?? -Infinity)) { o[key] = v / scale; update(); } } });
    return el;
  };
  const color = (key) => h("input", { type: "color", value: o[key], class: "fig-color", oninput: (e) => { o[key] = e.target.value; update(); } });
  const measureOpts = MEASURES.map((k) => [k, t(`m_${k}`)]);

  // Manual selection: every analysed image, grouped by row, the current representatives ticked.
  const manualBox = h("div", { class: "fig-manual" });
  function fillManual() {
    const cur = compose(items, { ...o, select: o.select === "manual" ? "manual" : "representative" });
    const ticked = new Set(o.manualIds || cur.grid.cells.flat().filter(Boolean).map((it) => it.id));
    o.manualIds = [...ticked];
    const groups = new Map();
    for (const it of items) { const k = rowKeyOf(it, o.rowsBy); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(it); }
    manualBox.replaceChildren(...[...groups].map(([k, list]) => h("div", null, h("b", { class: "small" }, k),
      list.map((it) => {
        const box = h("input", { type: "checkbox", checked: ticked.has(it.id), onchange: () => {
          const s = new Set(o.manualIds); box.checked ? s.add(it.id) : s.delete(it.id); o.manualIds = [...s]; update();
        } });
        return h("label", { class: "check small" }, box, " ", it.name);
      }))));
  }

  const widthInput = h("input", { type: "number", min: 10, step: "any", class: "fig-num", value: unit === "in" ? Math.round((o.widthMm / 25.4) * 100) / 100 : o.widthMm,
    oninput: () => { const v = Number(widthInput.value); if (v > 0) { o.widthMm = unit === "in" ? v * 25.4 : v; update(); } } });
  const unitSel = h("select", { onchange: () => { unit = unitSel.value; o.unit = unit; widthInput.value = unit === "in" ? Math.round((o.widthMm / 25.4) * 100) / 100 : Math.round(o.widthMm * 10) / 10; update(); } },
    opt("mm", "mm"), opt("in", "in"));
  unitSel.value = unit;
  const sizeInfo = h("p", { class: "muted small" });
  const preview = h("div", { class: "fig-preview", "aria-live": "polite" });
  const timeHint = h("small", { class: "muted" });

  const controls = h("div", { class: "fig-controls" },
    h("fieldset", null, h("legend", null, t("figContent")),
      field(t("figRowsBy"), select("rowsBy", [["condition", t("meta_condition")], ["strain", t("meta_strain")], ["strainCondition", t("figStrainCondition")], ["series", t("figSeries")]])),
      field(t("figColsBy"), select("colsBy", [["replicate", t("figReplicates")], ["time", t("figTimePoints")]]), timeHint),
      field(t("figImages"), select("select", [["representative", t("figRepresentative")], ["all", t("figAll")], ["manual", t("figManual")]])),
      manualBox,
      field(t("figRepBy"), select("repMeasure", measureOpts)),
      field(t("figMaxCols"), number("maxCols", { min: 1, max: 26, step: 1 })),
      field(t("figTranspose"), select("transpose", [["auto", t("figTransposeAuto")], ["no", t("figTransposeNo")], ["yes", t("figTransposeYes")]]))),
    h("fieldset", null, h("legend", null, t("figPanels")),
      field(t("figNormalize"), select("normalize", [["plate", t("figSamePlate")], ["mm", t("figSameMm")]])),
      field(t("figCropMargin"), number("cropMargin", { min: 0, max: 1, step: 1, scale: 100 })),
      check("maskPlate", t("figMaskPlate")),
      h("div", { class: "fig-row" }, check("outline", t("figOutline")), color("outlineColor"), number("outlineWidthPt", { min: 0.1, max: 5, step: 0.25 }), h("span", { class: "small muted" }, "pt")),
      h("div", { class: "fig-row" }, check("plateCircle", t("figPlateCircle")), color("plateColor")),
      h("div", { class: "fig-row" }, check("scaleBar", t("figScaleBar")), number("scaleBarMm", { min: 0.1, step: "any" }), h("span", { class: "small muted" }, "mm")),
      check("scaleBarAll", t("figScaleBarAll"))),
    h("fieldset", null, h("legend", null, t("figText")),
      check("labels", t("figLabels")), check("rowHeaders", t("figRowHeaders")), check("colHeaders", t("figColHeaders")),
      field(t("figCaption"), select("caption", [["", t("figNone")], ...measureOpts])),
      field(t("figFontPt"), number("fontPt", { min: 4, max: 24, step: 0.5 })),
      field(t("figBackground"), select("background", [["white", t("figWhite")], ["black", t("figBlack")]]))),
    h("fieldset", null, h("legend", null, t("figTable")),
      check("table", t("figTableShow")),
      field(t("figTableMeasure"), select("tableMeasure", measureOpts)),
      h("small", { class: "muted" }, t("figTableHint"))),
    h("fieldset", null, h("legend", null, t("figOutput")),
      h("div", { class: "fig-row" }, field(t("figWidth"), widthInput), unitSel, field(t("figDpi"), number("dpi", { min: 50, max: 1200, step: 1 }))),
      sizeInfo));

  let fig = null, timer = null, seq = 0;
  function update() {
    clearTimeout(timer);
    timer = setTimeout(redraw, 120);
  }
  async function redraw() {
    const my = ++seq;
    saveOpts(o);
    manualBox.hidden = o.select !== "manual";
    if (o.select === "manual" && !manualBox.childElementCount) fillManual();
    const timed = items.filter((it) => Number.isFinite(it.timeH) || Number.isFinite(it.meta?.incubationTimeH)).length;
    timeHint.textContent = o.colsBy === "time" ? t("figTimeHint", { n: timed, total: items.length }) : "";
    try {
      fig = compose(items, o);
      const ps = pngSize(fig.layout, o.dpi);
      sizeInfo.textContent = t("figSizeInfo", { w: Math.round(fig.layout.widthMm), h: Math.round(fig.layout.heightMm), pw: ps.width, ph: ps.height, n: fig.layout.panels.length });
      const hrefs = {};
      for (const [i, p] of fig.layout.panels.entries()) {
        const g = p.geom.crop;
        const key = `${p.item.id}|${g.x.toFixed(1)}|${g.y.toFixed(1)}|${g.size.toFixed(1)}|${o.background}`;
        if (!previewCrops.has(key)) {
          const url = URL.createObjectURL(await toBlob(await cropCanvas(p.item, p.geom, PREVIEW_PX, bgOf(o)), "image/jpeg", 0.85));
          previewUrls.push(url);
          previewCrops.set(key, url);
        }
        hrefs[i] = previewCrops.get(key);
      }
      if (my !== seq) return;
      preview.innerHTML = fig.layout.panels.length ? toSvg(fig.layout, fig.shapes, hrefs).replace(/^<\?xml[^>]*>\s*/, "") : `<p class="muted">${t("figEmpty")}</p>`;
      const svg = preview.querySelector("svg");
      if (svg) { svg.removeAttribute("width"); svg.removeAttribute("height"); svg.setAttribute("role", "img"); svg.setAttribute("aria-label", t("figPreview")); }
    } catch (e) { showError(e); }
  }

  const base = safeFileName(series ? `${exp.name}-${series.name}-figure` : `${exp.name}-figure`);
  async function exportAs(kind) {
    if (!fig?.layout.panels.length) return;
    try {
      busy(t("figRendering"));
      download(kind === "svg" ? await svgBlob(fig, o) : await pngBlob(fig, o), `${base}.${kind}`);
    } catch (e) { showError(e); } finally { idle(); }
  }

  const done = modal((close) => h("div", { class: "figure-dialog" },
    h("h2", null, t("figTitle")),
    h("div", { class: "fig-layout" }, controls, h("div", { class: "fig-preview-wrap" }, preview)),
    h("div", { class: "actions dialog-actions" },
      h("button", { type: "button", onclick: () => close(null) }, t("figClose")),
      h("button", { type: "button", onclick: () => exportAs("svg") }, "⤓ SVG"),
      h("button", { type: "button", class: "primary", onclick: () => exportAs("png") }, "⤓ PNG"))));
  await redraw();
  await done;
  clearTimeout(timer);
  previewUrls.forEach(URL.revokeObjectURL);
  for (const b of bitmaps.values()) b.close?.();
  bitmaps.clear();
}

// For checks from the console / tests: the last composed figure is not kept; expose the helpers instead.
export const _internal = { compose, makeItems, svgBlob, pngBlob, pngCanvas, withDpi };

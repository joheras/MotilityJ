// Publication figure (pure, no DOM): panels of plate photos in a grid (rows = condition, strain or series;
// columns = replicate or time point), each cropped to the plate circle and scaled to a common plate size or a
// common mm/px, with panel labels, headers, captions, outlines and scale bars; optional n / mean ± SD table.
// Everything is laid out in millimetres of the printed figure, turned into a list of drawing primitives
// (figureShapes) and serialised to SVG here (toSvg) or painted on a canvas by figure-ui.js.
//
// Image coordinates are stored-image pixels (image.result.plate / contour); mmPerPx comes from geometry.js.
// TODO: when js/compare.js (control comparison + statistics) is merged, the table can take its rows
// (n, mean ± SD, test vs control) instead of rowStats() below.

export const PT_MM = 25.4 / 72; // 1 pt in mm
export const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export const DEFAULTS = {
  rowsBy: "condition", // condition | strain | strainCondition | series
  colsBy: "replicate", // replicate | time
  select: "representative", // representative | all | manual
  manualIds: null, // image ids for select = "manual"
  repLabel: "{n}", // column header of replicate columns ({n} = 1, 2…)
  repMeasure: "eqDiameterMm", // the representative image is the one closest to the group mean of this
  maxCols: 6,
  transpose: "auto", // true | false | "auto": swap rows and columns when there is a single column (one representative per row)
  widthMm: 180,
  marginMm: 2,
  gapMm: 1.5,
  fontPt: 8,
  labels: true, // panel letters A, B, C…
  rowHeaders: true,
  colHeaders: true,
  caption: "eqDiameterMm", // "" | any measure key of measure.js
  outline: true,
  outlineColor: "#ff00ff",
  outlineWidthPt: 0.75,
  plateCircle: false,
  plateColor: "#00e5ff",
  scaleBar: true,
  scaleBarMm: 10,
  scaleBarAll: false, // false: only the first panel (or every panel when the bars would differ)
  cropMargin: 0.05, // around the plate circle, fraction of its radius
  maskPlate: false, // hide the photo outside the plate circle (+ margin)
  normalize: "plate", // plate: same plate size in every panel | mm: same mm per figure mm in every panel
  background: "white", // white | black
  table: false,
  tableMeasure: "eqDiameterMm",
  dpi: 300,
};

// ------------------------------------------------------------------ helpers
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
const sd = (xs) => {
  if (xs.length < 2) return null;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1));
};
const natural = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });
const isNum = Number.isFinite;

/** n, mean and SD (sample, n − 1) of the finite values. */
export function summary(values) {
  const xs = values.filter(isNum);
  return { n: xs.length, mean: xs.length ? mean(xs) : null, sd: sd(xs) };
}

/** Time point of an item in hours: series time, else the incubation time of its metadata. */
export const timeOf = (it) => (isNum(it.timeH) ? it.timeH : isNum(it.meta?.incubationTimeH) ? it.meta.incubationTimeH : null);

const fmtTime = (h) => (h == null ? "?" : `${Math.round(h * 100) / 100} h`);

/** Row key of an item. item = { id, name, meta (effective), seriesName, timeH, value (measure), m } */
export function rowKeyOf(it, rowsBy) {
  const strain = it.meta?.strain ?? "", cond = it.meta?.condition ?? "";
  if (rowsBy === "strain") return strain || "—";
  if (rowsBy === "strainCondition") return [strain, cond].filter(Boolean).join(" · ") || "—";
  if (rowsBy === "series") return it.seriesName || "—";
  return cond || "—";
}

/** Index of the item closest to the mean of `value` (first one when none has a value). */
export function representativeIndex(items) {
  const vals = items.map((it) => it.value);
  const xs = vals.filter(isNum);
  if (!xs.length) return items.length ? 0 : -1;
  const m = mean(xs);
  let best = -1;
  vals.forEach((v, i) => { if (isNum(v) && (best < 0 || Math.abs(v - m) < Math.abs(vals[best] - m))) best = i; });
  return best;
}

const byRep = (a, b) => natural.compare(String(a.meta?.bioRep ?? ""), String(b.meta?.bioRep ?? ""))
  || natural.compare(String(a.meta?.techRep ?? ""), String(b.meta?.techRep ?? "")) || natural.compare(a.name, b.name);

/**
 * Grid of the figure from the analysed items of an experiment.
 * -> { rows: [label], cols: [label], cells: [[item | null]], groups: [[all items of the row]] }
 * The groups (every image of a row, not only the shown ones) feed the n / mean ± SD table.
 */
export function buildGrid(items, opts) {
  const o = { ...DEFAULTS, ...opts };
  const groups = new Map();
  for (const it of items) {
    const k = rowKeyOf(it, o.rowsBy);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(it);
  }
  const rowKeys = [...groups.keys()].sort((a, b) => (a === "—") - (b === "—") || natural.compare(a, b));
  const manual = o.select === "manual" ? new Set(o.manualIds || []) : null;
  const pick = (list) => {
    if (manual) return list.filter((it) => manual.has(it.id));
    if (o.select === "all") return list;
    const i = representativeIndex(list);
    return i < 0 ? [] : [list[i]];
  };

  let rows = [], cols = [], cells = [];
  const rowGroups = rowKeys.map((k) => groups.get(k));
  if (o.colsBy === "time") {
    // One image per (row, time point); the representative of that cell unless picked by hand.
    const times = [...new Set(items.map(timeOf).filter(isNum).map((x) => Math.round(x * 100) / 100))].sort((a, b) => a - b);
    const shown = times.slice(0, Math.max(1, o.maxCols));
    rows = rowKeys;
    cols = shown.map(fmtTime);
    cells = rowGroups.map((list) => shown.map((tp) => {
      const inCell = list.filter((it) => { const x = timeOf(it); return isNum(x) && Math.round(x * 100) / 100 === tp; });
      return pick(inCell)[0] || null;
    }));
  } else {
    const picked = rowGroups.map((list) => pick([...list].sort(byRep)).slice(0, Math.max(1, o.maxCols)));
    const nCols = Math.max(0, ...picked.map((p) => p.length));
    rows = rowKeys;
    cols = o.select === "representative" ? [""] : Array.from({ length: nCols }, (_, i) => (o.repLabel || "{n}").replace("{n}", i + 1));
    cells = picked.map((p) => cols.map((_, i) => p[i] || null));
  }
  // Drop empty rows (e.g. manual selection without any image of that group).
  const keep = cells.map((r) => r.some(Boolean));
  const grid = { rows: rows.filter((_, i) => keep[i]), cols, cells: cells.filter((_, i) => keep[i]), groups: rowGroups.filter((_, i) => keep[i]) };
  if (o.transpose === true || (o.transpose === "auto" && grid.cols.length === 1 && grid.rows.length > 1)) {
    return { rows: grid.cols, cols: grid.rows, cells: grid.cols.map((_, c) => grid.rows.map((_, r) => grid.cells[r][c])), groups: grid.groups, transposed: true };
  }
  return grid;
}

/** Table rows: label, n and mean ± SD of `value` over every image of each group. */
export function rowStats(grid) {
  const labels = grid.transposed ? grid.cols : grid.rows;
  return grid.groups.map((list, i) => ({ label: labels[i], ...summary(list.map((it) => it.value)) }));
}

// -------------------------------------------------------------------- panels
/** Plate (or, without plate, the centred square of the image) of an item: { cx, cy, r } in image pixels. */
export function plateOf(it) {
  const p = it.plate;
  if (p && p.r > 0) return p;
  const W = it.width || 1, H = it.height || 1;
  return { cx: W / 2, cy: H / 2, r: Math.min(W, H) / 2, fallback: true };
}

/** Real width (mm) of the cropped square of an item: plate diameter + margin, or null without scale. */
export const cropSpanMm = (it, margin) => (isNum(it.mmPerPx) && it.mmPerPx > 0 ? 2 * plateOf(it).r * (1 + margin) * it.mmPerPx : null);

/** Common real width (mm) of every panel in "same mm/px" mode: the widest crop. */
export function commonSpanMm(items, margin) {
  const spans = items.map((it) => cropSpanMm(it, margin)).filter(isNum);
  return spans.length ? Math.max(...spans) : null;
}

/**
 * Crop square (image pixels), figure scale (figure mm per image pixel) and scale-bar length (figure mm)
 * of one panel of side `sizeMm`. normalize "plate": the plate (+ margin) fills the panel;
 * "mm": the panel shows `spanMm` real millimetres (falls back to "plate" for an image without scale).
 */
export function panelGeometry(it, sizeMm, { normalize = "plate", cropMargin = 0.05, scaleBarMm = 10 } = {}, spanMm = null) {
  const p = plateOf(it);
  let half = p.r * (1 + cropMargin);
  if (normalize === "mm" && isNum(spanMm) && isNum(it.mmPerPx) && it.mmPerPx > 0) half = spanMm / 2 / it.mmPerPx;
  const crop = { x: p.cx - half, y: p.cy - half, size: 2 * half };
  const scale = sizeMm / crop.size;
  const barMm = isNum(it.mmPerPx) && it.mmPerPx > 0 ? (scaleBarMm / it.mmPerPx) * scale : null;
  return { crop, scale, barMm, plate: p };
}

/** Maps image pixels to figure mm inside a panel at (px, py). */
export const toFigure = (g, px, py) => ([x, y]) => [px + (x - g.crop.x) * g.scale, py + (y - g.crop.y) * g.scale];

/** Rough width of a text in mm (Arial-like average glyph width), enough for layout. */
export const textWidthMm = (text, fsMm) => String(text).length * fsMm * 0.55;

/**
 * Positions of everything in figure mm. grid from buildGrid(); -> {
 *   widthMm, heightMm, fsMm, panel (side mm), panels: [{ x, y, size, row, col, item, label, geom }],
 *   rowHeaders: [{ x, y, text }] (rotated −90° about x, y), colHeaders: [{ x, y, text }], table: {...} | null }
 */
export function layoutFigure(grid, opts) {
  const o = { ...DEFAULTS, ...opts };
  const fs = o.fontPt * PT_MM;
  const R = grid.rows.length, C = grid.cols.length;
  const named = (labels) => labels.length > 1 || (labels.length === 1 && !!labels[0] && labels[0] !== "—");
  const showRowH = o.rowHeaders && named(grid.rows);
  const showColH = o.colHeaders && named(grid.cols);
  const rowHeaderW = showRowH ? fs * 1.6 : 0;
  const colHeaderH = showColH ? fs * 1.6 : 0;
  const captionH = o.caption ? fs * 1.5 : 0;
  const inner = o.widthMm - 2 * o.marginMm - rowHeaderW;
  const size = C ? Math.max(1, (inner - (C - 1) * o.gapMm) / C) : 0;
  const x0 = o.marginMm + rowHeaderW, y0 = o.marginMm + colHeaderH;
  const cellH = size + captionH;

  const shown = grid.cells.flat().filter(Boolean);
  const span = o.normalize === "mm" ? commonSpanMm(shown, o.cropMargin) : null;
  const panels = [];
  let n = 0;
  grid.cells.forEach((row, r) => row.forEach((item, c) => {
    if (!item) return;
    const x = x0 + c * (size + o.gapMm), y = y0 + r * (cellH + o.gapMm);
    const label = o.labels ? (n < 26 ? LETTERS[n] : LETTERS[Math.floor(n / 26) - 1] + LETTERS[n % 26]) : null;
    n++;
    panels.push({ x, y, size, row: r, col: c, item, label, geom: panelGeometry(item, size, o, span) });
  }));

  const rowHeaders = showRowH ? grid.rows.map((text, r) => ({ x: o.marginMm + fs * 1.05, y: y0 + r * (cellH + o.gapMm) + size / 2, text })) : [];
  const colHeaders = showColH ? grid.cols.map((text, c) => ({ x: x0 + c * (size + o.gapMm) + size / 2, y: o.marginMm + fs * 1.1, text })) : [];
  let height = y0 + R * cellH + Math.max(0, R - 1) * o.gapMm;

  let table = null;
  if (o.table && grid.groups?.length) {
    const stats = rowStats(grid);
    const lh = fs * 1.5;
    const top = height + fs * 1.2;
    const w = o.widthMm - 2 * o.marginMm;
    const labelW = Math.min(w * 0.5, Math.max(textWidthMm("Group", fs), ...stats.map((s) => textWidthMm(s.label, fs))) + fs);
    const xs = [o.marginMm, o.marginMm + labelW, o.marginMm + labelW + fs * 4]; // label | n | mean ± SD (left aligned)
    table = { x: o.marginMm, y: top, width: w, lineH: lh, colX: xs, rows: stats };
    height = top + lh * (stats.length + 1) + fs * 0.4;
  }
  return { widthMm: o.widthMm, heightMm: height + o.marginMm, fsMm: fs, panel: size, span, panels, rowHeaders, colHeaders, table };
}

/** Scale bars: on the first panel only, unless asked for every panel or the bar lengths differ by > 1 %. */
export function scaleBarPanels(layout, opts) {
  const o = { ...DEFAULTS, ...opts };
  if (!o.scaleBar) return [];
  const withBar = layout.panels.filter((p) => isNum(p.geom.barMm));
  if (!withBar.length) return [];
  const lens = withBar.map((p) => p.geom.barMm);
  const differ = Math.max(...lens) - Math.min(...lens) > 0.01 * Math.max(...lens);
  return o.scaleBarAll || differ ? withBar : [withBar[0]];
}

// ---------------------------------------------------------------- primitives
const fmt = (x, d) => (isNum(x) ? x.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d, useGrouping: false }) : "");
const CAPTION_UNITS = { areaMm2: [" mm²", 1], eqDiameterMm: [" mm", 1], feretMaxMm: [" mm", 1], feretMinMm: [" mm", 1], perimeterMm: [" mm", 1],
  circularity: ["", 2], coveragePct: [" %", 1], centroidOffsetMm: [" mm", 1] };
export const formatMeasure = (key, v) => {
  const [unit, d] = CAPTION_UNITS[key] || ["", 2];
  return isNum(v) ? `${fmt(v, d)}${unit}` : "—";
};

/**
 * Drawing primitives in figure mm, back to front:
 *   { type: "rect", x, y, w, h, fill }
 *   { type: "image", key (panel index), x, y, w, h, clip: { cx, cy, r } | null }
 *   { type: "poly", points: [[x, y]...], stroke, width, closed }   { type: "circle", cx, cy, r, stroke, width }
 *   { type: "line", x1, y1, x2, y2, stroke, width }
 *   { type: "text", x, y (baseline), text, size, weight, anchor: start|middle|end, fill, halo?, rotate? }
 */
export function figureShapes(layout, opts) {
  const o = { ...DEFAULTS, ...opts };
  const dark = o.background === "black";
  const ink = dark ? "#ffffff" : "#000000";
  const fs = layout.fsMm;
  const lw = o.outlineWidthPt * PT_MM;
  const out = [{ type: "rect", x: 0, y: 0, w: layout.widthMm, h: layout.heightMm, fill: dark ? "#000000" : "#ffffff" }];
  const bars = new Set(scaleBarPanels(layout, o));

  layout.panels.forEach((p, i) => {
    const g = p.geom;
    const map = toFigure(g, p.x, p.y);
    const [pcx, pcy] = map([g.plate.cx, g.plate.cy]);
    const clipR = g.plate.r * (1 + o.cropMargin) * g.scale;
    out.push({ type: "image", key: i, x: p.x, y: p.y, w: p.size, h: p.size, clip: o.maskPlate && !g.plate.fallback ? { cx: pcx, cy: pcy, r: clipR } : null });
    const res = p.item.result;
    if (o.plateCircle && !g.plate.fallback) out.push({ type: "circle", cx: pcx, cy: pcy, r: g.plate.r * g.scale, stroke: o.plateColor, width: lw });
    if (o.outline && res) {
      if (res.klass === "complete" && res.plate) out.push({ type: "circle", cx: pcx, cy: pcy, r: res.plate.r * g.scale, stroke: o.outlineColor, width: lw });
      else if (res.contour?.length > 2) out.push({ type: "poly", points: res.contour.map(map), stroke: o.outlineColor, width: lw, closed: true });
    }
    if (p.label) out.push({ type: "text", x: p.x + fs * 0.35, y: p.y + fs * 1.15, text: p.label, size: fs * 1.15, weight: "bold", anchor: "start", fill: "#ffffff", halo: "#000000" });
    if (bars.has(p)) {
      const len = g.barMm, pad = fs * 0.5;
      const x2 = p.x + p.size - pad, x1 = x2 - len, y = p.y + p.size - pad;
      out.push({ type: "line", x1, y1: y, x2, y2: y, stroke: "#000000", width: Math.max(0.6, fs * 0.22) + 0.35 });
      out.push({ type: "line", x1, y1: y, x2, y2: y, stroke: "#ffffff", width: Math.max(0.6, fs * 0.22) });
      out.push({ type: "text", x: (x1 + x2) / 2, y: y - fs * 0.45, text: `${fmt(o.scaleBarMm, o.scaleBarMm % 1 ? 1 : 0)} mm`, size: fs * 0.9, weight: "normal", anchor: "middle", fill: "#ffffff", halo: "#000000" });
    }
    if (o.caption) {
      out.push({ type: "text", x: p.x + p.size / 2, y: p.y + p.size + fs * 1.1, text: formatMeasure(o.caption, p.item.m?.[o.caption]), size: fs, weight: "normal", anchor: "middle", fill: ink });
    }
  });
  for (const r of layout.rowHeaders) out.push({ type: "text", x: r.x, y: r.y, text: r.text, size: fs, weight: "bold", anchor: "middle", fill: ink, rotate: -90 });
  for (const c of layout.colHeaders) out.push({ type: "text", x: c.x, y: c.y, text: c.text, size: fs, weight: "bold", anchor: "middle", fill: ink });

  const tb = layout.table;
  if (tb) {
    const head = opts.tableHeader || ["Group", "n", `${o.tableMeasure} (mean ± SD)`];
    const line = (y, w) => out.push({ type: "line", x1: tb.x, y1: y, x2: tb.x + tb.width, y2: y, stroke: ink, width: w });
    line(tb.y, 0.25);
    head.forEach((txt, j) => out.push({ type: "text", x: tb.colX[j], y: tb.y + tb.lineH * 0.72, text: txt, size: fs, weight: "bold", anchor: "start", fill: ink }));
    line(tb.y + tb.lineH, 0.15);
    const d = (CAPTION_UNITS[o.tableMeasure] || ["", 2])[1]; // the unit is in the header
    tb.rows.forEach((r, i) => {
      const y = tb.y + tb.lineH * (i + 1.72);
      const ms = r.mean == null ? "—" : `${fmt(r.mean, d)}${r.sd == null ? "" : ` ± ${fmt(r.sd, d)}`}`;
      [r.label, String(r.n), ms].forEach((txt, j) => out.push({ type: "text", x: tb.colX[j], y, text: txt, size: fs, weight: "normal", anchor: "start", fill: ink }));
    });
    line(tb.y + tb.lineH * (tb.rows.length + 1), 0.25);
  }
  return out;
}

// ----------------------------------------------------------------------- SVG
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const n3 = (x) => String(Math.round(x * 1000) / 1000);
const FONT = "Arial, Helvetica, sans-serif";

/**
 * SVG document (mm units: width/height in mm, viewBox in mm) with vector text and outlines.
 * hrefs: panel index -> image URL (data: URL for a standalone file).
 */
export function toSvg(layout, shapes, hrefs) {
  const W = layout.widthMm, H = layout.heightMm;
  const defs = [], body = [];
  shapes.forEach((sh, i) => {
    switch (sh.type) {
      case "rect": body.push(`<rect x="${n3(sh.x)}" y="${n3(sh.y)}" width="${n3(sh.w)}" height="${n3(sh.h)}" fill="${sh.fill}"/>`); break;
      case "image": {
        const id = `c${i}`;
        defs.push(sh.clip
          ? `<clipPath id="${id}"><circle cx="${n3(sh.clip.cx)}" cy="${n3(sh.clip.cy)}" r="${n3(sh.clip.r)}"/></clipPath>`
          : `<clipPath id="${id}"><rect x="${n3(sh.x)}" y="${n3(sh.y)}" width="${n3(sh.w)}" height="${n3(sh.h)}"/></clipPath>`);
        body.push(`<image x="${n3(sh.x)}" y="${n3(sh.y)}" width="${n3(sh.w)}" height="${n3(sh.h)}" preserveAspectRatio="none" clip-path="url(#${id})" href="${esc(hrefs?.[sh.key] ?? "")}" xlink:href="${esc(hrefs?.[sh.key] ?? "")}"/>`);
        break;
      }
      case "poly": body.push(`<${sh.closed ? "polygon" : "polyline"} points="${sh.points.map((p) => `${n3(p[0])},${n3(p[1])}`).join(" ")}" fill="none" stroke="${sh.stroke}" stroke-width="${n3(sh.width)}" stroke-linejoin="round"/>`); break;
      case "circle": body.push(`<circle cx="${n3(sh.cx)}" cy="${n3(sh.cy)}" r="${n3(sh.r)}" fill="none" stroke="${sh.stroke}" stroke-width="${n3(sh.width)}"/>`); break;
      case "line": body.push(`<line x1="${n3(sh.x1)}" y1="${n3(sh.y1)}" x2="${n3(sh.x2)}" y2="${n3(sh.y2)}" stroke="${sh.stroke}" stroke-width="${n3(sh.width)}"/>`); break;
      case "text": {
        const tr = sh.rotate ? ` transform="rotate(${sh.rotate} ${n3(sh.x)} ${n3(sh.y)})"` : "";
        const dy = sh.rotate ? n3(sh.size * 0.35) : "0"; // rotated headers are centred on their axis
        const attrs = `x="${n3(sh.x)}" y="${n3(sh.y)}" dy="${dy}" font-family="${FONT}" font-size="${n3(sh.size)}" font-weight="${sh.weight}" text-anchor="${sh.anchor}"${tr}`;
        if (sh.halo) body.push(`<text ${attrs} fill="none" stroke="${sh.halo}" stroke-width="${n3(sh.size * 0.18)}" stroke-linejoin="round">${esc(sh.text)}</text>`);
        body.push(`<text ${attrs} fill="${sh.fill}">${esc(sh.text)}</text>`);
        break;
      }
    }
  });
  return `<?xml version="1.0" encoding="UTF-8"?>\n`
    + `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" width="${n3(W)}mm" height="${n3(H)}mm" viewBox="0 0 ${n3(W)} ${n3(H)}">\n`
    + `<defs>${defs.join("")}</defs>\n${body.join("\n")}\n</svg>\n`;
}

/** Pixel size of the PNG: width in mm at `dpi`. */
export const pngSize = (layout, dpi) => ({
  width: Math.round((layout.widthMm / 25.4) * dpi),
  height: Math.round((layout.heightMm / 25.4) * dpi),
  pxPerMm: Math.round((layout.widthMm / 25.4) * dpi) / layout.widthMm,
});

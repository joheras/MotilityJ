// Unit tests of figure.js (layout, crops, scale bars, grid, SVG). Run them on js/figure.test.html,
// with node (node web/js/figure.test.js), or from the console: (await import("./js/figure.test.js")).runTests()
import { buildGrid, figureShapes, layoutFigure, panelGeometry, pngSize, representativeIndex, rowStats, scaleBarPanels, toSvg } from "./figure.js";

// An analysed image of W×H px with a plate of radius r px centred at (cx, cy) on a 90 mm dish.
const item = (id, { cond = "A", strain = "S", rep = null, value = null, timeH = null, r = 400, cx = 500, cy = 500, W = 1000, H = 1000, mmPerPx } = {}) => ({
  id, name: `${id}.jpg`, width: W, height: H, timeH, meta: { condition: cond, strain, bioRep: rep },
  plate: { cx, cy, r }, mmPerPx: mmPerPx ?? 90 / (2 * r), value, m: { eqDiameterMm: value },
  result: { klass: "incomplete", plate: { cx, cy, r }, contour: [[cx - 50, cy - 50], [cx + 50, cy - 50], [cx + 50, cy + 50], [cx - 50, cy + 50]] },
});

export function runTests() {
  const results = [];
  const close = (name, got, want, tol = 1e-6) => results.push({ name, ok: got != null && Math.abs(got - want) <= tol, got, want });
  const eq = (name, got, want) => results.push({ name, ok: JSON.stringify(got) === JSON.stringify(want), got: JSON.stringify(got), want: JSON.stringify(want) });

  // Representative: closest to the mean (10, 20, 33 -> mean 21 -> 20).
  eq("representative closest to mean", representativeIndex([{ value: 10 }, { value: 20 }, { value: 33 }]), 1);
  eq("representative without values", representativeIndex([{ value: null }, { value: null }]), 0);

  // Crop and scale, "plate" mode: r = 400 px, margin 5 % -> crop 840 px; panel 42 mm -> 0.05 mm/px.
  const a = item("a");
  const g = panelGeometry(a, 42, { normalize: "plate", cropMargin: 0.05, scaleBarMm: 10 });
  close("crop x", g.crop.x, 80);
  close("crop size", g.crop.size, 840);
  close("figure mm per px", g.scale, 0.05);
  // 10 mm on the plate = 10 / (90/800) = 88.89 px -> 4.444 mm on the figure; also = 10 · 42 / (90 · 1.05).
  close("scale bar (plate mode)", g.barMm, (10 * 42) / (90 * 1.05));

  // "mm" mode: the panels show the same real width (largest plate + margin), the smaller plate looks smaller.
  const big = item("big", { r: 400 }), small = item("small", { r: 400, mmPerPx: 60 / 800 }); // a 60 mm dish
  const span = 2 * 400 * 1.05 * (90 / 800);
  const gs = panelGeometry(small, 42, { normalize: "mm", cropMargin: 0.05, scaleBarMm: 10 }, span);
  close("mm mode crop size", gs.crop.size, span / (60 / 800));
  close("mm mode bar = 10 mm · panel / span", gs.barMm, (10 * 42) / span);
  close("mm mode same bar for both", panelGeometry(big, 42, { normalize: "mm", cropMargin: 0.05, scaleBarMm: 10 }, span).barMm, gs.barMm, 1e-9);

  // Manual scale: 20 px/mm of the stored image -> 10 mm = 200 px.
  const man = item("m", { mmPerPx: 1 / 20 });
  close("manual scale bar", panelGeometry(man, 42, { cropMargin: 0.05 }).barMm, 200 * (42 / 840));

  // Grid: 2 conditions × 3 replicates.
  const items = [item("a1", { cond: "WT", rep: "1", value: 10 }), item("a2", { cond: "WT", rep: "2", value: 20 }), item("a3", { cond: "WT", rep: "3", value: 33 }),
    item("b1", { cond: "ΔfliC", rep: "1", value: 5 }), item("b2", { cond: "ΔfliC", rep: "2", value: 7 })];
  const rep = buildGrid(items, { rowsBy: "condition", select: "representative", transpose: false });
  eq("representative grid rows", rep.rows, ["WT", "ΔfliC"]);
  eq("representative grid picks", rep.cells.map((r) => r.map((c) => c?.id)), [["a2"], ["b1"]]);
  const all = buildGrid(items, { rowsBy: "condition", select: "all", repLabel: "R{n}" });
  eq("all grid", all.cells.map((r) => r.map((c) => c?.id ?? null)), [["a1", "a2", "a3"], ["b1", "b2", null]]);
  eq("replicate headers", all.cols, ["R1", "R2", "R3"]);
  const tr = buildGrid(items, { rowsBy: "condition", select: "representative" });
  eq("auto transposed", tr.cells.map((r) => r.map((c) => c?.id)), [["a2", "b1"]]);
  eq("auto transposed headers", [tr.rows, tr.cols], [[""], ["WT", "ΔfliC"]]);
  eq("forced transpose", buildGrid(items, { select: "all", transpose: true }).cells.length, 3);
  const stats = rowStats(all);
  close("table mean", stats[0].mean, 21);
  close("table SD", stats[0].sd, Math.sqrt(((10 - 21) ** 2 + (20 - 21) ** 2 + (33 - 21) ** 2) / 2));
  eq("table n", stats.map((s) => s.n), [3, 2]);
  const man2 = buildGrid(items, { select: "manual", manualIds: ["a3", "b2"], transpose: false });
  eq("manual picks", man2.cells.map((r) => r.map((c) => c?.id)), [["a3"], ["b2"]]);

  // Time columns.
  const ts = [item("t0", { cond: "WT", timeH: 0 }), item("t5", { cond: "WT", timeH: 5 }), item("u5", { cond: "M", timeH: 5 })];
  const tg = buildGrid(ts, { colsBy: "time" });
  eq("time columns", tg.cols, ["0 h", "5 h"]);
  eq("time cells", tg.cells.map((r) => r.map((c) => c?.id ?? null)), [[null, "u5"], ["t0", "t5"]]);

  // Layout: 180 mm wide, 3 columns, row headers 1.6·fs, gap 1.5, margin 2.
  const opts = { widthMm: 180, marginMm: 2, gapMm: 1.5, fontPt: 8, caption: "eqDiameterMm", cropMargin: 0.05 };
  const L = layoutFigure(all, opts);
  const fs = 8 * 25.4 / 72;
  const size = (180 - 4 - fs * 1.6 - 2 * 1.5) / 3;
  close("panel size", L.panel, size);
  eq("panel count", L.panels.length, 5);
  eq("labels", L.panels.map((p) => p.label), ["A", "B", "C", "D", "E"]);
  close("second row y", L.panels[3].y - L.panels[0].y, size + fs * 1.5 + 1.5);
  close("bar length in layout", L.panels[0].geom.barMm, (10 * size) / (90 * 1.05));
  eq("one scale bar when all equal", scaleBarPanels(L, opts).length, 1);
  eq("bar on every panel when asked", scaleBarPanels(L, { ...opts, scaleBarAll: true }).length, 5);
  const mixed = layoutFigure(buildGrid([item("x", { cond: "A" }), item("y", { cond: "B", mmPerPx: 1 / 20 })], {}), opts);
  eq("auto transposed layout: no row header", mixed.rowHeaders.length, 0);
  eq("auto transposed layout: column headers", mixed.colHeaders.map((c) => c.text), ["A", "B"]);
  eq("bars differ -> every panel", scaleBarPanels(mixed, opts).length, 2);

  // PNG size: 180 mm at 300 dpi = 2126 px.
  eq("png width", pngSize(L, 300).width, Math.round((180 / 25.4) * 300));

  // SVG: well-formed enough and in mm.
  const svg = toSvg(L, figureShapes(L, opts), {});
  eq("svg width in mm", /width="180mm"/.test(svg), true);
  eq("svg has 5 images", (svg.match(/<image /g) || []).length, 5);
  eq("svg outlines", (svg.match(/<polygon /g) || []).length, 5);
  eq("svg escapes text", toSvg(L, [{ type: "text", x: 0, y: 0, text: "a<b&c", size: 1, weight: "normal", anchor: "start", fill: "#000" }], {}).includes("a&lt;b&amp;c"), true);

  const failed = results.filter((r) => !r.ok).length;
  return { passed: results.length - failed, failed, results };
}

// node web/js/figure.test.js
if (typeof process !== "undefined" && process.argv?.[1]?.endsWith("figure.test.js")) {
  const { passed, failed, results } = runTests();
  for (const r of results) if (!r.ok) console.log("FAIL", r.name, "got", r.got, "want", r.want);
  console.log(`${passed} passed, ${failed} failed`);
}

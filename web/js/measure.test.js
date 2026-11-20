// Unit tests of measure.js against shapes with known measurements. Run them on js/measure.test.html,
// or from the console of the app: (await import("./js/measure.test.js")).runTests()
import { centroid, circularity, convexHull, equivalentDiameter, feret, measure, perimeter } from "./measure.js";
import { polygonArea } from "./geometry.js";

const circle = (cx, cy, r, n = 720) => Array.from({ length: n }, (_, i) => [cx + r * Math.cos((2 * Math.PI * i) / n), cy + r * Math.sin((2 * Math.PI * i) / n)]);
const ellipse = (cx, cy, a, b, n = 2000, rot = 0) => Array.from({ length: n }, (_, i) => {
  const t = (2 * Math.PI * i) / n, x = a * Math.cos(t), y = b * Math.sin(t);
  return [cx + x * Math.cos(rot) - y * Math.sin(rot), cy + x * Math.sin(rot) + y * Math.cos(rot)];
});
// Ramanujan's approximation of the perimeter of an ellipse.
const ellipsePerimeter = (a, b) => Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b)));

export function runTests() {
  const results = [];
  const close = (name, got, want, tol) => {
    const ok = got != null && Math.abs(got - want) <= tol;
    results.push({ name, ok, got, want });
  };

  // Circle r = 100
  const c = circle(300, 200, 100);
  close("circle area", polygonArea(c), Math.PI * 1e4, 1e4 * 0.001);
  close("circle perimeter", perimeter(c), 2 * Math.PI * 100, 0.1);
  close("circle circularity", circularity(polygonArea(c), perimeter(c)), 1, 1e-3);
  close("circle Feret max", feret(c).max, 200, 0.01);
  close("circle Feret min", feret(c).min, 200, 0.01);
  close("circle centroid x", centroid(c)[0], 300, 1e-6);
  close("circle centroid y", centroid(c)[1], 200, 1e-6);
  close("circle equivalent diameter", equivalentDiameter(polygonArea(c)), 200, 0.1);

  // Square of side 10, rotated 30°
  const rot = (p, a) => [p[0] * Math.cos(a) - p[1] * Math.sin(a), p[0] * Math.sin(a) + p[1] * Math.cos(a)];
  const sq = [[0, 0], [10, 0], [10, 10], [0, 10]].map((p) => rot(p, Math.PI / 6));
  close("square area", polygonArea(sq), 100, 1e-9);
  close("square perimeter", perimeter(sq), 40, 1e-9);
  close("square circularity", circularity(100, 40), Math.PI / 4, 1e-12);
  close("square Feret max (diagonal)", feret(sq).max, 10 * Math.SQRT2, 1e-9);
  close("square Feret min (side)", feret(sq).min, 10, 1e-9);
  const cs = centroid(sq), want = rot([5, 5], Math.PI / 6);
  close("square centroid", Math.hypot(cs[0] - want[0], cs[1] - want[1]), 0, 1e-9);
  close("hull of square + inner point", convexHull([...sq, rot([5, 5], Math.PI / 6)]).length, 4, 0);
  close("clockwise square area", polygonArea([...sq].reverse()), 100, 1e-9);

  // Ellipse a = 120, b = 50, rotated 40°
  const e = ellipse(0, 0, 120, 50, 2000, (40 * Math.PI) / 180);
  close("ellipse area", polygonArea(e), Math.PI * 120 * 50, Math.PI * 6000 * 1e-4);
  close("ellipse perimeter", perimeter(e), ellipsePerimeter(120, 50), 0.05);
  close("ellipse Feret max", feret(e).max, 240, 0.01);
  close("ellipse Feret min", feret(e).min, 100, 0.01);
  close("ellipse circularity", circularity(polygonArea(e), perimeter(e)), (4 * Math.PI * Math.PI * 6000) / ellipsePerimeter(120, 50) ** 2, 1e-3);

  // L shape: hull ≠ polygon (concave)
  const L = [[0, 0], [20, 0], [20, 10], [10, 10], [10, 20], [0, 20]];
  close("L area", polygonArea(L), 300, 1e-9);
  close("L perimeter", perimeter(L), 80, 1e-9);
  close("L Feret max", feret(L).max, Math.hypot(20, 20), 1e-9);
  close("L centroid x", centroid(L)[0], 25 / 3, 1e-9);

  // measure(): incomplete plate, circle of r = 100 px in a plate of r = 400 px, 90 mm -> 90/800 mm/px
  const settings = { plateDiameterMm: 90, manualPxPerMm: null };
  const k = 90 / 800;
  const g = circle(560, 500, 100);
  const img = { scale: 1, result: { klass: "incomplete", plate: { cx: 500, cy: 500, r: 400 }, contour: g, areaPx: polygonArea(g) } };
  const m = measure(img, settings);
  close("measure area mm²", m.areaMm2, Math.PI * (100 * k) ** 2, 0.05);
  close("measure equivalent diameter mm", m.eqDiameterMm, 200 * k, 0.01);
  close("measure Feret max mm", m.feretMaxMm, 200 * k, 0.01);
  close("measure Feret min mm", m.feretMinMm, 200 * k, 0.01);
  close("measure perimeter mm", m.perimeterMm, 2 * Math.PI * 100 * k, 0.01);
  close("measure circularity", m.circularity, 1, 1e-3);
  close("measure coverage %", m.coveragePct, (100 * 1e4) / (400 * 400), 0.01);
  close("measure centroid offset mm", m.centroidOffsetMm, 60 * k, 1e-6);

  // measure(): complete plate -> plate circle
  const mc = measure({ scale: 1, result: { klass: "complete", plate: { cx: 500, cy: 500, r: 400 }, contour: [], areaPx: Math.PI * 16e4 } }, settings);
  close("complete area", mc.areaMm2, Math.PI * 45 * 45, 1e-9);
  close("complete equivalent diameter", mc.eqDiameterMm, 90, 1e-9);
  close("complete perimeter", mc.perimeterMm, Math.PI * 90, 1e-9);
  close("complete coverage", mc.coveragePct, 100, 0);
  close("complete circularity", mc.circularity, 1, 0);

  // No scale: shape-only values are still given
  const ns = measure({ scale: 1, result: { klass: "incomplete", plate: null, contour: sq, areaPx: 100 } }, settings);
  results.push({ name: "no scale -> null mm values", ok: ns.areaMm2 == null && ns.perimeterMm == null && ns.feretMaxMm == null, got: ns.areaMm2, want: null });
  close("no scale -> circularity still computed", ns.circularity, Math.PI / 4, 1e-9);
  results.push({ name: "no result -> null", ok: measure({ result: null }, settings) === null, got: null, want: null });

  const failed = results.filter((r) => !r.ok);
  console.table(results);
  console.log(failed.length ? `measure.js: ${failed.length} of ${results.length} tests FAILED` : `measure.js: all ${results.length} tests passed`);
  return { passed: results.length - failed.length, failed: failed.length, results };
}

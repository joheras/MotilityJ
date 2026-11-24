// Unit tests of phenotype.js on synthetic experiments. Run them on js/phenotype.test.html,
// or from the console of the app: (await import("./js/phenotype.test.js")).runTests()
import { polygonArea } from "./geometry.js";
import { PRESETS, categoryIndex, classifyImages, classifyPhenotype, experimentWarnings, mergeRuleSets, normalizeRuleSet, validateRuleSet } from "./phenotype.js";

const circle = (cx, cy, r, n = 360) => Array.from({ length: n }, (_, i) => [cx + r * Math.cos((2 * Math.PI * i) / n), cy + r * Math.sin((2 * Math.PI * i) / n)]);
// (Polygons are inscribed, so a zone measures slightly less than D: test values avoid the exact cut-offs.)
// Plate r = 450 px, 90 mm -> 0.1 mm/px: a zone of diameter D mm is a circle of radius 5·D px.
const plate = { cx: 500, cy: 500, r: 450 };
let seq = 0;
function zone(d, meta = {}, klass = "incomplete") {
  const g = d > 0 ? circle(500, 500, 5 * d) : [];
  return { id: `img${++seq}`, name: `img${seq}.jpg`, scale: 1, meta,
    result: { klass, plate, contour: g, areaPx: g.length ? polygonArea(g) : 0 } };
}

export function runTests() {
  const results = [];
  const check = (name, got, want, tol = 0) => {
    const ok = typeof want === "number" ? got != null && Math.abs(got - want) <= tol : got === want;
    results.push({ name, ok, got: Array.isArray(got) ? got.join(",") : String(got), want: String(want) });
  };
  const settings = { plateDiameterMm: 90, manualPxPerMm: null, phenotypeRuleSets: [] };

  // categoryIndex: lower bounds inclusive
  const cats = PRESETS[0].categories;
  check("bin 0.05 -> 0", categoryIndex(cats, 0.05), 0);
  check("bin 0.10 -> 1", categoryIndex(cats, 0.10), 1);
  check("bin 0.305 -> 1", categoryIndex(cats, 0.305), 1);
  check("bin 0.5 -> 2", categoryIndex(cats, 0.5), 2);
  check("bin 0.70 -> 3", categoryIndex(cats, 0.70), 3);
  check("bin 1.4 -> 3", categoryIndex(cats, 1.4), 3);

  // Relative (Murray 2010 swarming): PAO1 24 h = 40 and 44 mm (mean 42)
  const exp = { id: "e", name: "e", meta: { assayType: "swarm", incubationTimeH: 24 }, phenotypeRules: ["preset-pa-swarm-murray2010"] };
  const ref1 = zone(40, { strain: "PAO1" }), ref2 = zone(44, { strain: "pao1 " });
  const neg = zone(2.1, { strain: "CF-1" }), low = zone(8.4, { strain: "CF-2" }), mid = zone(21, { strain: "CF-3" }), high = zone(37.8, { strain: "CF-4" });
  const full = zone(0, { strain: "CF-5" }, "complete");
  const other = zone(20, { strain: "CF-6", incubationTimeH: 48 }); // no PAO1 at 48 h
  const images = [ref1, ref2, neg, low, mid, high, full, other];
  const ph = classifyImages(images, exp, settings);
  check("reference mean (mm)", ph.get(low.id).reference.mean, 42, 0.05);
  check("reference n", ph.get(low.id).reference.n, 2);
  check("ratio 8.4/42", ph.get(low.id).ratio, 0.2, 0.002);
  check("negative < 0.10", ph.get(neg.id).label, "Negative (< 0.10)");
  check("negative is not positive", ph.get(neg.id).positive, false);
  check("low", ph.get(low.id).level, 1);
  check("low positive", ph.get(low.id).positive, true);
  check("sign", ph.get(low.id).sign + ph.get(neg.id).sign, "+−");
  check("intermediate", ph.get(mid.id).level, 2);
  check("high", ph.get(high.id).level, 3);
  check("reference image flagged", ph.get(ref2.id).isReference, true);
  check("complete plate: ratio from plate diameter", ph.get(full.id).ratio, 90 / 42, 0.01);
  check("complete plate: capped", ph.get(full.id).capped, true);
  check("complete plate: highest category", ph.get(full.id).level, 3);
  check("other time: no reference", ph.get(other.id).warnings.join(), "refMissing");
  check("other time: no label", ph.get(other.id).label, null);
  const w = experimentWarnings(images, exp, settings, ph);
  check("experiment warnings: one refMissing group", w.length === 1 && w[0].code === "refMissing" && w[0].match.incubationTimeH === 48, true);

  // Same time not required -> 48 h image uses the 24 h PAO1
  const anyTime = normalizeRuleSet({ ...PRESETS[0], id: "c1", builtin: false, reference: { field: "strain", value: "PAO1", match: [] } });
  const p48 = classifyPhenotype(other, { ...exp, phenotypeRules: ["c1"] }, { ...settings, phenotypeRuleSets: [anyTime] }, images);
  check("no time match: ratio 20/42", p48.ratio, 20 / 42, 0.003);

  // A single reference image -> refFew warning, ratio kept
  const one = classifyImages([ref1, low], exp, settings);
  check("n = 1 reference: warning", one.get(low.id).warnings.join(), "refFew");
  check("n = 1 reference: ratio", one.get(low.id).ratio, 8.4 / 40, 0.002);

  // Assay type must match: twitch image in a swarm-only experiment
  const tw = zone(10, { strain: "X", assayType: "twitch" });
  check("assay without rule", classifyImages([tw], exp, settings).get(tw.id).warnings.join(), "noRule");
  const unset = { ...exp, meta: {} };
  check("no assay type", classifyImages([zone(10)], unset, settings).values().next().value.warnings.join(), "noAssayType");
  check("no rule sets -> null", classifyPhenotype(tw, { ...exp, phenotypeRules: [] }, settings), null);

  // Absolute (A. baumannii twitching) and anyZone (swimming)
  const absExp = { id: "a", meta: { assayType: "twitch" }, phenotypeRules: ["preset-ab-twitch-abs", "preset-pa-swim-anyzone"] };
  const abs = (d) => classifyPhenotype(zone(d), absExp, settings)?.level;
  check("twitch 4.9 mm -> NM", abs(4.9), 0);
  check("twitch 5.1 mm -> IM", abs(5.1), 1);
  check("twitch 19.9 mm -> IM", abs(19.9), 1);
  check("twitch 20.1 mm -> HM", abs(20.1), 2);
  const swim = (d, klass) => classifyPhenotype(zone(d, { assayType: "swim" }, klass), absExp, settings);
  check("swim 2 mm -> no zone", swim(2).positive, false);
  check("swim 3 mm (= min) -> no zone", swim(3).positive, false);
  check("swim 3.5 mm -> motile", swim(3.5).positive, true);
  check("swim no growth -> no zone", swim(0).positive, false);
  check("swim complete -> motile", swim(0, "complete").positive, true);
  check("first matching rule set", swim(10).rule.id, "preset-pa-swim-anyzone");

  // Area measure, no scale, not analysed
  const areaRule = normalizeRuleSet({ id: "c2", name: "area", assayType: "any", mode: "absolute", measure: "areaMm2",
    categories: [{ min: 100, label: "big" }, { min: 0, label: "small" }] });
  const st2 = { ...settings, phenotypeRuleSets: [areaRule] };
  const areaExp = { id: "b", meta: {}, phenotypeRules: ["c2"] };
  check("categories sorted", areaRule.categories.map((c) => c.label).join(), "small,big");
  check("area 10 mm Ø (78.5 mm²) -> small", classifyPhenotype(zone(10), areaExp, st2).label, "small");
  check("area 12 mm Ø (113 mm²) -> big", classifyPhenotype(zone(12), areaExp, st2).label, "big");
  check("not analysed", classifyPhenotype({ id: "n", meta: {}, result: null }, areaExp, st2).warnings.join(), "notAnalysed");
  const noScale = zone(10); noScale.result.plate = null;
  check("no scale", classifyPhenotype(noScale, areaExp, st2).warnings.join(), "noMeasure");

  // Validation and backups
  check("valid preset", validateRuleSet(normalizeRuleSet(PRESETS[0])).length, 0);
  check("missing reference value", validateRuleSet(normalizeRuleSet({ name: "x", mode: "relative", categories: [{ min: 0, label: "a" }] })).join(), "refValue");
  check("duplicate bounds", validateRuleSet(normalizeRuleSet({ name: "x", categories: [{ min: 0, label: "a" }, { min: 0, label: "b" }] })).join(), "duplicateMin");
  check("merge keeps existing, adds new", mergeRuleSets([{ id: "c1", name: "mine" }], [{ id: "c1", name: "theirs" }, { id: "c9", name: "new" }, PRESETS[0]])
    .map((r) => r.name).join(), "mine,new");

  const failed = results.filter((r) => !r.ok);
  console.table(results);
  console.log(failed.length ? `phenotype.js: ${failed.length} of ${results.length} tests FAILED` : `phenotype.js: all ${results.length} tests passed`);
  return { passed: results.length - failed.length, failed: failed.length, results };
}

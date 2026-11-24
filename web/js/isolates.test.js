// Unit tests of isolates.js (grouping, statistics, phenotype majority, profile, wide export). Run them on
// js/isolates.test.html, or from the console of the app: (await import("./js/isolates.test.js")).runTests()
import { aggregatePhenotype, groupIsolates, isolateOf, matrixRows, phenotypeSign, sd } from "./isolates.js";

let nextId = 0;
const expA = { id: "A", name: "Exp A" }, expB = { id: "B", name: "Exp B" };
// An entry as built by the page: { img, exp, eff, m, phenotype }.
function entry({ exp = expA, strain, condition = null, assay, bioRep = null, d = null, klass = "incomplete", pending = false, phenotype = null }) {
  const img = { id: `i${++nextId}`, name: `img${nextId}.jpg`, result: pending ? null : { klass } };
  const area = d == null ? null : Math.PI * (d / 2) ** 2;
  return { img, exp, eff: { strain, condition, assayType: assay, bioRep }, m: pending ? null : { eqDiameterMm: d, areaMm2: area }, phenotype };
}

export function runTests() {
  const results = [];
  const eq = (name, got, want) => results.push({ name, ok: JSON.stringify(got) === JSON.stringify(want), got: JSON.stringify(got), want: JSON.stringify(want) });
  const close = (name, got, want, tol = 1e-9) => results.push({ name, ok: got != null && Math.abs(got - want) <= tol, got, want });

  eq("isolate key ignores case and spaces", isolateOf({ strain: " PAO1 " }).key, isolateOf({ strain: "pao1" }).key);
  eq("no strain -> null", isolateOf({ strain: "  " }), null);
  eq("strain + condition", isolateOf({ strain: "PA14", condition: "LB" }, "strainCondition").condition, "LB");
  eq("strain mode ignores the condition", isolateOf({ strain: "PA14", condition: "LB" }, "strain").condition, null);
  close("sample SD", sd([2, 4, 4, 4, 5, 5, 7, 9]), Math.sqrt(32 / 7));
  eq("SD of one value", sd([3]), null);

  const pos = { level: "positive", label: "+" }, neg = { level: "negative", label: "−" }, hyper = { level: "hyper", label: "hyper", ratio: 1.5 };
  eq("sign of negative", phenotypeSign(neg), "−");
  eq("sign of hyper", phenotypeSign(hyper), "+");
  const maj = aggregatePhenotype([pos, pos, neg, null]);
  eq("majority level", [maj.level, maj.agree, maj.n, maj.mixed], ["positive", 2, 3, false]);
  const tie = aggregatePhenotype([pos, neg]);
  eq("tie is mixed", [tie.mixed, tie.sign], [true, null]);
  close("mean ratio", aggregatePhenotype([hyper, { ...hyper, ratio: 2.5 }]).ratio, 2);
  eq("no phenotypes -> null", aggregatePhenotype([null, null]), null);

  const entries = [
    entry({ strain: "PAO1", assay: "swim", bioRep: "1", d: 40, phenotype: pos }),
    entry({ strain: "PAO1", assay: "swim", bioRep: "2", d: 50, phenotype: pos }),
    entry({ strain: "PAO1", assay: "swim", bioRep: "2", d: 60, phenotype: pos }),
    entry({ strain: "pao1", assay: "swim", pending: true }),
    entry({ strain: "PAO1", assay: "swarm", bioRep: "1", d: 90, klass: "complete", phenotype: hyper }),
    entry({ exp: expB, strain: "PAO1", assay: "swarm", bioRep: "1", d: 70, phenotype: hyper }),
    entry({ strain: "PAO1", assay: "twitch", d: 10, phenotype: neg }),
    entry({ strain: "ISO-2", assay: "swim", d: 20 }),
    entry({ strain: "ISO-2", assay: "twitch", d: 15 }),
    entry({ strain: null, assay: "swim", d: 30 }),
    entry({ strain: "ISO-3", assay: null, d: 30 }),
  ];
  const r = groupIsolates(entries);
  eq("isolates", r.isolates.map((i) => i.name), ["ISO-2", "PAO1"]);
  eq("unassigned", r.unassigned.map((u) => u.missing), [["strain"], ["assayType"]]);
  const pao1 = r.isolates[1];
  const swim = pao1.cells.swim;
  eq("swim n and pending", [swim.n, swim.nPending], [3, 1]);
  close("swim mean diameter", swim.diam.mean, 50);
  close("swim SD diameter", swim.diam.sd, 10);
  eq("bio reps", swim.nBioReps, 2);
  eq("representative is closest to the mean", swim.representative.m.eqDiameterMm, 50);
  eq("bio reps of different experiments differ", pao1.cells.swarm.nBioReps, 2);
  close("fraction complete", pao1.cells.swarm.fracComplete, 0.5);
  eq("no bioRep -> null", pao1.cells.twitch.nBioReps, null);
  eq("experiments", pao1.experiments, ["Exp A", "Exp B"]);
  eq("profile", pao1.profile, "swim+ / swarm+ (hyper) / twitch−");
  eq("profile without phenotype and missing assay", r.isolates[0].profile, "swim? / swarm n/a / twitch?");
  eq("missing assays", r.isolates[0].missing, ["swarm"]);

  const onlySwim = groupIsolates(entries.filter((e) => e.eff.assayType === "swim"));
  eq("only the assays tested count as missing", onlySwim.isolates.map((i) => i.missing.length), [0, 0]);
  eq("profile of a swim-only scope", onlySwim.isolates[1].profile, "swim+");

  const byCond = groupIsolates([entry({ strain: "X", condition: "LB", assay: "swim", d: 1 }), entry({ strain: "X", condition: "M9", assay: "swim", d: 2 })], { keyMode: "strainCondition" });
  eq("strain + condition grouping", byCond.isolates.map((i) => i.name), ["X · LB", "X · M9"]);

  const rows = matrixRows(r);
  eq("wide export: one row per isolate", rows.length, 3);
  const col = (name) => rows[0].indexOf(name);
  eq("wide export: swim mean", rows[2][col("swim_eq_diameter_mm_mean")], 50);
  eq("wide export: phenotype agreement", rows[2][col("swim_phenotype_agreement")], "3/3");
  eq("wide export: missing cell empty", rows[1][col("swarm_n_images")], "");
  return { passed: results.filter((x) => x.ok).length, failed: results.filter((x) => !x.ok).length, results };
}

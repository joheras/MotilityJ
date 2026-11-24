// Adapter to the optional phenotype rules (js/phenotype.js: classifyPhenotype(image, exp, settings, images) ->
// { label, level, ratio?, rule } or null). Pages that only read phenotypes go through here, so that they keep
// working ("no phenotype") when the module is absent or fails.

let loaded = null;

/** -> classify(image, exp, settings, images) (images: all of the experiment, where relative rules find their reference) returning a phenotype or null; never throws. */
export async function phenotypeClassifier() {
  loaded ??= import("./phenotype.js").then((mod) => (typeof mod.classifyPhenotype === "function" ? mod.classifyPhenotype : null)).catch(() => null);
  const fn = await loaded;
  if (!fn) return null;
  return async (image, exp, settings, images) => {
    try {
      const p = await fn(image, exp, settings, images);
      return p && (p.level != null || p.label != null) ? p : null;
    } catch (e) {
      console.warn("Phenotype rules failed:", e);
      return null;
    }
  };
}

// English strings of the motility phenotype rules; merged into i18n.js's table (keys start with "ph" or "help_phenotype").
export const strings = {
  phTitle: "Motility phenotype",
  phColumn: "Phenotype",
  phRatioColumn: "Ratio to reference",
  phRatioShort: "Ratio",
  phNone: "No rule set",
  phNoneLead: "Choose the rule sets that classify the images of this experiment. Each image uses the first chosen rule set of its assay type (or of “any” assay).",
  phChoose: "Rule sets of this experiment",
  phEditRules: "Create or edit rule sets in Settings",
  phSaved: "Phenotype rules saved.",
  phUnknownRule: "A rule set of this experiment no longer exists.",
  phCounts: "{n} image(s)",
  phUnclassified: "Not classified",
  phReference: "reference",
  phReferenceHint: "Reference strain image",
  phCapped: "Complete plate: the zone reaches the rim, so it is treated as maximal (measured on the plate); the true value may be larger.",
  phRuleLine: "Rule: {name}",
  phRefLine: "Reference {value}: mean {mean} (n = {n})",
  phValueLine: "{measure}: {value}",
  phCaution: "Thresholds are species- and assay-specific. The presets are examples from the literature: validate them for your organism and protocol.",

  // warnings (per image) and per experiment
  ph_w_notAnalysed: "not analysed",
  ph_w_noMeasure: "no scale: the measure needs the plate or a manual scale",
  ph_w_noAssayType: "no assay type: set it in Assay conditions",
  ph_w_noRule: "no chosen rule set for this assay type",
  ph_w_refMissing: "no reference image",
  ph_w_refFew: "only one reference image (n < 2): the ratio is uncertain",
  phWarnTitle: "Phenotype reference:",
  phWarnMissing: "{rule}: no analysed image of {field} = {value} ({context}); {images} image(s) cannot be classified.",
  phWarnFew: "{rule}: only one analysed image of {field} = {value} ({context}); {images} ratio(s) rely on n = 1.",
  phCtxAssay: "assay {assay}",

  // rule set fields
  phAssay_swim: "Swimming", phAssay_swarm: "Swarming", phAssay_twitch: "Twitching", phAssay_any: "Any assay",
  phMode_absolute: "Absolute cut-offs", phMode_relative: "Relative to a reference strain", phMode_anyZone: "Positive if any measurable zone",
  phMode_absolute_help: "Categories on the measure itself (mm or mm²).",
  phMode_relative_help: "Categories on the ratio image / mean of the reference strain images of the same experiment, same assay type (and the chosen fields).",
  phMode_anyZone_help: "Motile when the zone is larger than the inoculum footprint (equivalent diameter > minimum zone).",
  phMeasure_eqDiameterMm: "Equivalent diameter (mm)", phMeasure_areaMm2: "Area (mm²)", phMeasure_feretMaxMm: "Maximum Feret diameter (mm)",
  phUnitRatio: "× reference",

  // settings
  phRules: "Phenotype rules",
  phRulesLead: "Rule sets turn the measured zone into a motility category. Choose which ones an experiment uses on its page.",
  phBuiltin: "built-in",
  phNew: "New rule set",
  phDuplicate: "Duplicate",
  phEdit: "Edit",
  phCopyOf: "{name} (copy)",
  phDeleteConfirm: "Delete the rule set “{name}”? Experiments that use it will no longer show its phenotype.",
  phDeleted: "Rule set deleted.",
  phSource: "Source",
  phEditTitle: "Rule set",
  phName: "Name",
  phAssayType: "Assay type",
  phMode: "Classification",
  phMeasure: "Measure",
  phSourceField: "Source or note",
  phUrl: "Link (optional)",
  phRefField: "Reference identified by",
  phRefValue: "Reference value",
  phRefValuePlaceholder: "e.g. PAO1",
  phRefMatch: "Reference images must also have the same",
  phMinZone: "Minimum zone (mm)",
  phMinZoneHelp: "Inoculum footprint: zones with an equivalent diameter up to this value count as no measurable zone. Measure a non-motile control on your plates; 3 mm is about the size of a stab or a 1–2 µL drop.",
  phCategories: "Categories",
  phCategoriesHelp: "Each category starts at its lower bound (inclusive) and ends where the next one starts. Mark the categories that count as motile (positive).",
  phFrom: "From",
  phLabel: "Label",
  phPositive: "Positive",
  phAddCategory: "Add category",
  phErr_name: "Give the rule set a name.",
  phErr_categories: "Add at least one category.",
  phErr_label: "Every category needs a label.",
  phErr_duplicateMin: "Two categories start at the same value.",
  phErr_refValue: "Enter the reference value (e.g. the reference strain name).",

  // help
  help_phenotype_title: "Motility phenotype",
  help_phenotype_html: `<p>MotilityJ can classify each plate into a motility phenotype with <b>rule sets</b>. Choose the rule sets of an experiment in its <b>Motility phenotype</b> card; the results table then shows a coloured <b>Phenotype</b> badge (and the <b>ratio to the reference</b> for relative rules), the review page shows it next to the measurements, and the CSV and Excel exports include the phenotype, the rule set, the ratio and the reference used.</p>
  <p class="warn"><b>Thresholds are species- and assay-specific.</b> The presets are examples from the literature; validate them for your organism, medium and protocol before reporting phenotypes.</p>
  <ul>
    <li><b>Absolute cut-offs</b>: categories on the equivalent diameter (mm), the maximum Feret diameter (mm) or the area (mm²). Example preset: <i>A. baumannii</i> twitching, non-motile &lt; 5 mm, intermediate 5–20 mm, highly motile &gt; 20 mm.</li>
    <li><b>Relative to a reference strain</b>: categories on the ratio between the image and the mean of the reference images (e.g. strain = PAO1). The reference images are taken from the <b>same experiment</b>, with the same assay type and, if chosen, the same incubation time, condition or agar %. Without a reference image the image is not classified; with only one, a warning says the ratio is uncertain. Example preset: <i>P. aeruginosa</i> swarming vs PAO1 (Murray et al. 2010): positive when the zone is &gt; 10% of PAO1, bins 0–0.09, 0.10–0.30, 0.31–0.69 and ≥ 0.70.</li>
    <li><b>Positive if any measurable zone</b>: motile when the equivalent diameter is larger than a minimum zone (the inoculum footprint; 3 mm by default). Example preset: <i>P. aeruginosa</i> swimming (Murray et al. 2010).</li>
  </ul>
  <p>Each category starts at its lower bound (inclusive). An image uses the first chosen rule set whose assay type is the image's assay type (or a rule set for any assay), so set the assay type in <b>Assay conditions</b>.</p>
  <p><b>Complete plates</b> (growth reaching the rim) are treated as maximal: they are measured on the plate (diameter = plate diameter), so their ratio is a lower bound, shown with “≥”.</p>
  <p>Custom rule sets are created in <a href="#/settings">Settings</a>, stored in this browser and included in backups (restoring a backup adds the rule sets it uses).</p>`,
};

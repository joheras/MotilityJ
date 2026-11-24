// English strings of the per-isolate profile (js/isolates.js, js/pages/isolates.js); merged into i18n.js's table
// (keys start with "iso" or "help_isolates").
export const strings = {
  isoTitle: "Isolate profiles", isoAllTitle: "All isolates", isoOpen: "Isolate profiles",
  isoOpenHint: "One row per isolate with its swim, swarm and twitch results",
  isoAllHint: "Isolate profiles across all experiments",
  isoLead: "One row per isolate (strain) with the mean equivalent diameter ± SD of each assay type. Click a cell to see its images.",
  isoAllLead: "Isolates of every experiment together: images of the same strain in different experiments are pooled.",
  isoKey: "Isolate", isoKeyStrain: "Strain", isoKeyStrainCondition: "Strain + condition",
  isoSearch: "Search strain…", isoProfileFilter: "Profile", isoAnyProfile: "All profiles",
  isoMissingFilter: "Missing an assay", isoFullFilter: "All assays tested",
  isoCol: "Isolate", isoProfile: "Profile", isoN: "n",
  isoCellN: "n = {n}", isoCellReps: "{n} bio. rep.", isoCellPending: "{n} pending", isoCellComplete: "{pct}% complete",
  isoNoPhenotype: "Phenotype rules are not available: the profile shows “?” for each assay tested.",
  isoNoPhenotypeShort: "no phenotype",
  isoPhenotypeAgree: "{agree} of {n} images", isoPhenotypeMixed: "Replicates disagree",
  isoNone: "No isolates yet", isoNoneLead: "Give your images a strain and an assay type (Results table, ✎ Bulk edit, or the assay conditions) to see their profile here.",
  isoNoMatch: "No isolate matches the filters.",
  isoShown: "{n} of {total} isolates",
  isoMissingTitle: "Isolates missing an assay",
  isoMissingLead: "These isolates were not tested with every assay type used here:",
  isoUnassignedTitle: "Images without a strain or an assay type",
  isoUnassignedLead: "They are not in the matrix. Fill in the metadata:",
  isoUnassignedLine: "{exp}: {n} image(s)",
  isoMissingStrain: "no strain", isoMissingAssay: "no assay type",
  isoEditMeta: "Edit their metadata",
  isoPendingNote: "{n} image(s) are not analysed yet and are not in the statistics.",
  isoCellTitle: "{isolate} · {assay}",
  isoRepresentative: "representative", isoRepresentativeHint: "Image closest to the mean diameter",
  isoExportMatrixXlsx: "Isolate matrix + tidy data (.xlsx)", isoExportMatrixCsv: "Isolate matrix, one row per isolate (.csv)",
  isoExportTidyCsv: "Tidy table, one row per image (.csv)",
  isoSheetMatrix: "Isolates",
  isoBackToExperiment: "Back to the experiment",
  isoLegend: "Cells: mean equivalent diameter ± SD (mm), n analysed images and biological replicates, phenotype. A complete plate counts with the plate diameter.",
  help_isolates_title: "Isolate profiles",
  help_isolates_html: `<p>Clinical isolate surveys test every isolate with several assays (swimming, swarming and twitching) and report a combined <b>motility profile</b>, for example grouping isolates by twitch and swim positivity and swarming relative to a reference strain such as PAO1 (Murray et al. 2010, <a href="https://pmc.ncbi.nlm.nih.gov/articles/PMC2855384/" target="_blank" rel="noreferrer">237 <i>P. aeruginosa</i> isolates</a>).</p>
  <p><b>Isolate profiles</b> (button on an experiment, or <b>All isolates</b> on the experiments page to pool every experiment) shows one row per isolate and one column per assay type:</p>
  <ul>
    <li>An isolate is a <b>strain</b>, or a strain and a <b>condition</b> (choose it at the top). The strain is compared ignoring case and surrounding spaces. The assay type is the image's, or else the experiment's.</li>
    <li>Each cell shows the mean <b>equivalent diameter ± SD</b> (sample SD, n − 1) of the analysed images, the number of images (n), of biological replicates (different experiments count as different replicates) and the share of complete plates; a complete plate counts with the plate diameter. Its thumbnail is the image closest to the mean. Click a cell to see all its images.</li>
    <li>The <b>phenotype</b> of a cell is the most frequent phenotype of its images (from the phenotype rules, when available); when replicates disagree equally the cell shows both and is marked as mixed, and the ratio is the mean of the images' ratios. Without phenotype rules the profile shows “?” for each assay tested.</li>
    <li>The <b>profile</b> joins the assays tested in the page, e.g. <code>swim+ / swarm− / twitch+</code>; “n/a” means that isolate was not tested with that assay. Filter by profile, search by strain and sort by any column.</li>
    <li>Isolates missing an assay and images without a strain or an assay type are listed at the top, with a shortcut to edit their metadata.</li>
    <li><b>Export</b> gives the matrix in wide format (one row per isolate, a block of columns per assay) as CSV, or an Excel workbook with the matrix and the tidy table (one row per image).</li>
  </ul>`,
};

// All user-visible strings. To add a language, add an object with the same keys (missing keys fall back to English)
// and select it in LANG (e.g. from navigator.language).
// Placeholders: {name} is replaced by params.name.

const en = {
  // shell
  experiments: "Experiments", settings: "Settings", help: "Help", privacy: "Privacy", sourceCode: "Source code",
  install: "Install", installHint: "Install MotilityJ as an app on this device", installApp: "Install MotilityJ",
  dataLocal: "Data stays in this browser",
  dataLocalHint: "Images and results are stored in this browser; they are only sent to your own Google Drive if you connect it.",
  updateAvailable: "A new version of MotilityJ is available.", reload: "Reload",
  storageUnavailable: "This browser does not let MotilityJ store data (private window or blocked site data?).",
  loading: "Loading…", ok: "OK", cancel: "Cancel", create: "Create", rename: "Rename", delete: "Delete", remove: "Remove",
  save: "Save", back: "Back", name: "Name", untitled: "Untitled", unknown: "unknown", notFound: "Not found",
  backToExperiments: "Back to the experiments", cancelled: "Cancelled.",

  // experiments page
  experimentsLead: "Each experiment is a set of Petri-dish images analysed together and exported as one table.",
  newExperiment: "New experiment", renameExperiment: "Rename experiment", deleteExperiment: "Delete experiment",
  defaultExperimentName: "Experiment {date}",
  deleteExperimentConfirm: "Delete “{name}” and its {n} image(s)? This cannot be undone; make a backup first if you may need it.",
  noExperiments: "No experiments yet",
  noExperimentsLead: "Create an experiment, add photos of your motility plates and MotilityJ classifies each one as complete or incomplete and measures the growth area.",
  howItWorks: "How it works",
  nImages: "{n} image(s)", nAnalysed: "{n}/{total} analysed",
  backupAll: "Back up all", backupAllHint: "Save every experiment, with its images, to one .motilityj.json file",
  backup: "Back up", backupHint: "Save this experiment, with its images, to a .motilityj.json file",
  restore: "Restore", restoring: "Restoring…", preparingBackup: "Preparing the backup…",
  restored: "{n} experiment(s) restored.", restoreInvalid: "This is not a MotilityJ backup (.motilityj.json).",

  // experiment page
  addImages: "Add images", dropHere: "Drop images here or click to choose",
  dropFormats: "JPEG, PNG, WebP or TIFF. Large images are reduced to 2000 pixels.",
  takePhoto: "Take photo", chooseFiles: "Choose files",
  importingN: "Importing image {i} of {n}…", imagesAdded: "{n} image(s) added.",
  skippedFiles: "{n} file(s) skipped: not images.", unsupportedFile: "{name}: this image format cannot be read in this browser.",
  analyseAll: "Analyse all", analyseN: "Analyse {n} new", analyse: "Analyse", reanalyse: "Re-analyse",
  analysing: "Analysing…", analysingN: "Analysing image {i} of {n}", analysedN: "{n} image(s) analysed.",
  reanalyseAllConfirm: "All {n} images are already analysed. Analyse them again? Manual corrections will be replaced.",
  exportExcel: "Excel", exportCsv: "CSV",
  results: "Results", images: "Images", noImagesYet: "No images yet: add them above.",
  summary: "{c} complete · {i} incomplete · {p} pending",
  colFile: "File", colClass: "Class", colArea: "Area (mm²)", colAreaPlain: "Area (mm2)", colNotes: "Notes",
  complete: "complete", incomplete: "incomplete", pending: "pending", editedByHand: "Edited by hand",
  areaNote: "Areas use a plate diameter of {d} mm.", manualScaleActive: "Manual scale: {s} px/mm.",
  addNote: "Add a note", removeImage: "Remove image", removeImageConfirm: "Remove “{name}” from this experiment?",

  // metadata and measurements (columns.js, metadata-ui.js)
  meta_assayType: "Assay type", meta_agarPct: "Agar", meta_medium: "Medium", meta_plateVolumeMl: "Plate volume",
  meta_dryingMin: "Drying time", meta_incubationTempC: "Incubation temperature", meta_incubationTimeH: "Incubation time",
  meta_plateDiameterMm: "Plate diameter", meta_strain: "Strain", meta_condition: "Condition",
  meta_bioRep: "Biological replicate", meta_techRep: "Technical replicate",
  assay_swim: "Swim", assay_swarm: "Swarm", assay_twitch: "Twitch", assay_other: "Other",
  m_areaMm2: "Area (mm²)", m_eqDiameterMm: "Equivalent diameter (mm)", m_feretMaxMm: "Max Feret (mm)", m_feretMinMm: "Min Feret (mm)",
  m_perimeterMm: "Perimeter (mm)", m_circularity: "Circularity", m_coveragePct: "Plate covered (%)", m_centroidOffsetMm: "Centroid offset (mm)",
  short_bioRep: "Bio. rep.", short_techRep: "Tech. rep.", short_incubationTimeH: "Time (h)", short_eqDiameterMm: "Eq. Ø (mm)",
  short_feretMaxMm: "Feret max (mm)", short_feretMinMm: "Feret min (mm)", short_coveragePct: "Covered (%)", short_centroidOffsetMm: "Offset (mm)",
  metadata: "Metadata", measurements: "Measurements", imageMetadata: "Strain, condition, replicates",
  assayConditions: "Assay conditions", assayNotSet: "Not set: record them so results can be compared.",
  assayLead: "Defaults for every image of this experiment; an image can override them. They are exported with each image, because motility results depend on them.",
  assaySaved: "Assay conditions saved.", inherit: "default", fromSettings: "Settings",
  overrideConditions: "Different assay conditions for this image",
  overrideHelp: "Leave empty to use the experiment's value (shown in grey).",
  columns: "Columns", columnsTitle: "Columns of the results table", columnsReset: "Default columns",
  selectAll: "Select all images", selectImage: "Select {name}",
  bulkEdit: "Edit metadata", bulkEditN: "Edit metadata of {n}", bulkEditHint: "Select images with the boxes on the left, then set their metadata at once",
  bulkEditTitle: "Metadata of {n} image(s)", bulkApply: "Apply this field", bulkApplyButton: "Apply",
  bulkEditHelp: "Only the ticked fields are changed; a field is ticked when you edit it. A ticked empty field clears the value.",
  multipleValues: "(several values)", bulkEdited: "Metadata of {n} image(s) updated.",
  conflictTitle: "Conditions differ between images.",
  conflictLead: "Motility depends strongly on the assay; compare these images with care:",
  conflictUnset: "(and some images without a value)",
  exportExcelHint: "Excel workbook: the results as shown and a tidy sheet with all metadata and measurements",
  exportCsvHint: "Tidy CSV: one row per image with all metadata and measurements",
  sheetResults: "Results", sheetTidy: "Tidy data",

  // review page
  zoomIn: "Zoom in", zoomOut: "Zoom out", zoomFit: "Fit image",
  legendPlate: "Plate", legendGrowth: "Growth",
  growthArea: "Growth area", notAnalysed: "Not analysed yet",
  notAnalysedHint: "This image has not been analysed yet: press Analyse, or draw the growth by hand.",
  automatic: "Automatic", confidence: "confidence",
  noScale: "No scale: adjust the plate circle or set a manual scale in Settings.",
  scalePlate: "{k} mm/px (plate Ø {d} mm)", scaleManual: "{k} mm/px (manual scale)",
  edit: "Edit", undo: "Undo", previous: "Previous", next: "Next",
  saving: "Saving…", saved: "Saved",
  notesPlaceholder: "Notes for this image",
  reanalyseConfirm: "Analyse this image again? Your manual corrections will be replaced (you can undo).",
  mode_view: "Move", mode_vertices: "Vertices", mode_draw: "Redraw", mode_plate: "Plate",
  mode_view_help: "Drag to move around, pinch or use the mouse wheel to zoom, double-click to zoom in or out.",
  mode_vertices_help: "Drag a vertex to move it; drag the outline between two vertices to add one; double-click a vertex to delete it.",
  mode_draw_help: "Draw the outline of the growth with one finger or the mouse; it replaces the current outline when you lift it.",
  mode_plate_help: "Drag the edge of the plate circle to resize it, or its inside to move it. Its diameter sets the scale.",

  // settings
  measurement: "Measurement", plateDiameter: "Plate diameter (mm)",
  plateDiameterHelp: "Inner diameter of your Petri dishes; 90 mm by default. Used for the scale and for complete plates.",
  manualScale: "Manual scale (pixels per mm)", manualScalePlaceholder: "automatic (from the plate)",
  manualScaleHelp: "Leave empty to compute the scale from the detected plate. Set it if all photos are taken from a fixed distance; it refers to the original image size.",
  invalidDiameter: "The plate diameter must be a positive number.", invalidScale: "The scale must be a positive number or empty.",
  settingsSaved: "Settings saved.",
  storage: "Storage", storageLead: "Experiments, images and results are stored only in this browser (IndexedDB). Back them up regularly.",
  storageState: "Storage of this browser:", persistent: "persistent",
  bestEffort: "best effort (may be cleared when the device is low on space)", askKeep: "ask to keep it",
  persistGranted: "The browser will keep the data.", persistDenied: "The browser did not grant persistent storage.",
  storageUsage: "In use: {mb} MB.",
  deleteAll: "Delete all data", deleteAllConfirm: "Delete every experiment and image stored in this browser? This cannot be undone.",
  deletedAll: "All data deleted.",

  // Drive (only shown when configured)
  driveConnect: "Connect", driveConnected: "Connected", driveUnavailable: "Google Drive is not available in this version.",
  drive_disabled: "Google Drive is disabled.", drive_disconnected: "Not connected. Connect to back up experiments and receive photos from phones.",
  drive_connected: "Connected to your Google Drive.", drive_expired: "The Google session expired: connect again.",
  drive_error: "Google Drive error: try to connect again.",
  driveSave: "Save to Drive", driveSaving: "Saving to Google Drive…", driveSaved: "“{name}” saved to Google Drive.",
  driveRestore: "Restore from Drive", driveRestoreTitle: "Backups in Google Drive", driveNoBackups: "There are no backups in MotilityJ/Backups.",
  driveInbox: "From Drive inbox", driveInboxTitle: "Photos in MotilityJ/Inbox", driveInboxEmpty: "The inbox is empty.",

  // help
  helpLead: "MotilityJ classifies bacterial motility in photos of Petri dishes and measures the area of the growth.",
  usingInstalled: "You are using the installed app.",
  help_workflow_title: "Workflow",
  help_workflow_html: `<ol>
    <li><b>Create an experiment</b> on the <a href="#/">Experiments</a> page.</li>
    <li><b>Add images</b>: drop them on the box, <b>Choose files</b> (several at once) or, on a phone or tablet, <b>Take photo</b> to use the camera.</li>
    <li><b>Analyse all</b>: each image is classified as <span class="badge cat-s">complete</span> (the growth covers the whole plate) or <span class="badge cat-i">incomplete</span>, and the growth is outlined.</li>
    <li><b>Review</b>: open an image to check the result, change the class or correct the outline and the plate circle. Corrections are saved automatically.</li>
    <li>Record the <b>assay conditions</b> of the experiment and the <b>strain, condition and replicates</b> of each image (see <a href="#/help/metadata">Assay metadata</a>).</li>
    <li><b>Export</b> to <b>Excel</b> (the table as shown plus a tidy sheet) or <b>CSV</b> (tidy: one row per image with all metadata and measurements).</li>
  </ol>
  <p>Photograph the plates from above, centred, on a dark uniform background, without reflections; the whole rim of the dish must be visible.</p>`,
  help_review_title: "Reviewing and correcting",
  help_review_html: `<p>The review page shows the image with the <b>plate circle</b> (cyan) and the <b>growth outline</b> (magenta). Zoom with the mouse wheel, the <b>+</b>/<b>−</b> buttons or by pinching with two fingers; drag to move around.</p>
  <ul>
    <li><b>Class</b>: switch between complete and incomplete. A complete plate counts the whole plate area.</li>
    <li><b>Vertices</b>: drag the points of the outline; drag the line between two points to add one; double-click a point to delete it.</li>
    <li><b>Redraw</b>: draw the outline again by hand in one stroke.</li>
    <li><b>Plate</b>: move the circle or drag its edge to fit the inner rim of the dish; the scale follows it.</li>
    <li><b>Undo</b> (<kbd>Ctrl</kbd>+<kbd>Z</kbd>) reverts the last change; <b>Re-analyse</b> runs the automatic analysis again. <kbd>Alt</kbd>+<kbd>←</kbd>/<kbd>→</kbd> go to the previous/next image.</li>
  </ul>`,
  help_area_title: "How the area is computed",
  help_area_html: `<p>The scale comes from the plate: <code>mm per pixel = plate diameter / (2 × plate radius in pixels)</code>, with the plate diameter of <a href="#/settings">Settings</a> (90 mm by default). If all your photos are taken from the same distance you can set a fixed scale in pixels per mm instead.</p>
  <ul>
    <li><b>Complete</b>: area = π × (diameter / 2)², e.g. 6361.73 mm² for a 90 mm plate.</li>
    <li><b>Incomplete</b>: area = area of the outline in pixels × (mm per pixel)². It is recomputed as soon as you edit the outline or the plate circle.</li>
  </ul>
  <p>The plate diameter of an experiment's <b>assay conditions</b>, or of an image, replaces the one of Settings for those images.</p>`,
  help_measures_title: "Measurements",
  help_measures_html: `<p>Besides the area, MotilityJ measures the shape of the growth outline (after your corrections). Choose which ones the results table shows with <b>Columns</b>; the exports always include all of them.</p>
  <ul>
    <li><b>Equivalent diameter</b> = 2√(area/π): the diameter of a circle with the same area. Swim assays are usually reported as a zone diameter; this makes irregular zones comparable to it.</li>
    <li><b>Max Feret</b> and <b>Min Feret</b>: the largest and the smallest distance between two parallel lines touching the outline (caliper diameters). Their ratio shows how elongated the zone is.</li>
    <li><b>Perimeter</b> of the outline, and <b>circularity</b> = 4π·area/perimeter²: 1 for a circle, lower for elongated or branched (e.g. dendritic swarm) edges. The perimeter depends on how detailed the outline is, so compare circularity between images analysed the same way.</li>
    <li><b>Plate covered</b>: area of the growth / area of the plate circle, in %.</li>
    <li><b>Centroid offset</b>: distance from the centre of the plate to the centroid of the growth; large values point to an off-centre inoculation or a tilted plate.</li>
  </ul>
  <p>For a <b>complete</b> plate all of them refer to the plate circle: the diameters are the plate diameter, circularity is 1, the plate is 100 % covered and the offset is 0.</p>`,
  help_metadata_title: "Assay metadata",
  help_metadata_html: `<p>There is no standard motility assay: the zone depends on the <b>assay type</b> (swim, usually ≤ 0.3 % agar; swarm, about 0.4–0.8 %; twitch, about 1 % at the plate bottom), the <b>agar %</b>, the medium, the plate volume, how long the plates dried, the temperature and the incubation time, as well as the strain and the replicate. Record them so that your results can be compared and reported.</p>
  <ul>
    <li><b>Assay conditions</b> (experiment page): the defaults of every image of the experiment, including the plate diameter.</li>
    <li><b>Per image</b>: strain, condition, biological and technical replicate and incubation time, in the results table or on the review page. An image can also override any assay condition (e.g. a different agar %).</li>
    <li><b>Bulk edit</b>: tick several images in the results table and press <b>Edit metadata</b>; only the fields you change are applied.</li>
    <li>If the images of an experiment have a different assay type, agar % or plate diameter, a warning is shown above the table.</li>
  </ul>
  <p>Metadata is stored with the experiment, included in backups and exported in the tidy CSV and Excel sheet (columns such as <code>strain</code>, <code>agar_pct</code>, <code>equivalent_diameter_mm</code>), ready for R or Python.</p>`,
  help_formats_title: "Image formats",
  help_formats_html: `<p>JPEG, PNG, WebP and the other formats of your browser are read directly. <b>TIFF</b> files are read by MotilityJ itself: 8 or 16 bits, grey, RGB or palette, in strips or tiles, uncompressed or compressed with LZW, PackBits, Deflate (ZIP) or JPEG. Not supported: BigTIFF, separate colour planes, floating-point samples and old-style JPEG; convert those to PNG first. Only the first page of a multi-page TIFF is used. iPhone HEIC photos taken from the app are converted to JPEG by the phone.</p>
  <p>Images are stored reduced to at most 2000 pixels on the longest side, which is enough for the analysis and keeps the browser storage small. The manual scale (pixels per mm) refers to the original image.</p>`,
  help_install_title: "Phones, tablets and offline use",
  help_install_html: `<p>MotilityJ works on phones and tablets: <b>Take photo</b> opens the rear camera. You can also <b>install</b> it as an app: it then opens from the home screen in its own window and works without an internet connection.</p>
  <div class="install-steps">
    <div><h3>iPhone and iPad (Safari)</h3><ol><li>Open this page in <b>Safari</b>.</li><li>Tap the <b>Share</b> button (square with an arrow).</li><li>Choose <b>Add to Home Screen</b> and confirm.</li></ol></div>
    <div><h3>Android (Chrome) and computers (Chrome, Edge)</h3><ol><li>Open the browser menu (⋮), or use the <b>Install</b> button at the top.</li><li>Choose <b>Install app</b> or <b>Add to Home screen</b>.</li></ol></div>
  </div>
  <p class="warn"><b>On iPhone and iPad, install the app to keep your data.</b> Safari deletes the data of web sites that have not been used for 7 days; the data of an app added to the Home Screen is not deleted that way. The installed app has its own storage, separate from Safari's: use Back up and Restore to move experiments between them.</p>
  <p>When a new version is published, a <b>Reload</b> banner appears at the top.</p>`,
  help_privacy_title: "Your data and privacy",
  help_privacy_html: `<p>MotilityJ runs entirely in your browser: images are analysed on your device and there is no MotilityJ server that receives them. Experiments, images and results are stored in this browser's storage (IndexedDB), only for this browser profile on this device, and nothing is sent anywhere unless you connect your own Google Drive (when available).</p>
  <ul>
    <li><b>Back up</b> saves an experiment (or all of them) with its images to a <code>.motilityj.json</code> file. Do it regularly.</li>
    <li><b>Restore</b> adds the experiments of a backup file; use it to move your data to another device or browser.</li>
    <li>Clearing the browsing data or site data, using a private window, or uninstalling the browser deletes the data. Some browsers may also evict storage when the disk is almost full; see <a href="#/settings">Settings</a> to ask the browser to keep it.</li>
  </ul>`,
};

const LANGS = { en };
const LANG = "en";

export function t(key, params) {
  let s = LANGS[LANG]?.[key] ?? en[key];
  if (s == null) { console.warn("Missing string:", key); return key; }
  if (params) s = s.replace(/\{(\w+)\}/g, (m, k) => (params[k] ?? m));
  return s;
}

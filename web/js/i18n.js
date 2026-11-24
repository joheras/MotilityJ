// All user-visible strings. To add a language, add an object with the same keys (missing keys fall back to English)
// and select it in LANG (e.g. from navigator.language).
// Placeholders: {name} is replaced by params.name.

import { strings as dmStrings } from "./deepmotility/strings.js";
import { strings as phStrings } from "./phenotype-strings.js";

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
  export: "Export", exportHint: "Download the results or a backup of this experiment",
  exportExcelItem: "Excel workbook (.xlsx)", exportCsvItem: "Table for R / Python (.csv)", backupItem: "Backup with images (.motilityj.json)",
  moreActions: "More actions", meanIncompleteArea: "mean area, incomplete (mm²)",
  needsReview: "review", needsReviewHint: "Low-confidence automatic result: open the image to check the outline",
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

  // comparison vs control (compare.js, compare-ui.js)
  meta_role: "Role", role_sample: "Sample", role_untreated: "Untreated control", role_vehicle: "Vehicle control",
  m_inhibitionPct: "Inhibition vs control (%)", short_inhibitionPct: "Inhib. (%)",
  sheetComparison: "Comparison", exportComparisonItem: "Comparison vs control (.csv)", exportComparisonCsv: "Comparison (.csv)",
  comparison: "Comparison vs control",
  cmpLead: "Each condition is compared with the control images of its group: n biological replicates, mean ± SD, % inhibition and Welch's t-test (Holm-corrected).",
  cmpHowComputed: "How it is computed",
  cmpHowToMark: "No control marked yet. Set the Role of your untreated or vehicle (e.g. DMSO) control plates to “Untreated control” or “Vehicle control”: in the Role column of the results table, on the review page, or for several images at once with Edit metadata. Give each treatment a Condition and each plate its biological replicate.",
  cmpSummary: "{n} control image(s) · {m}", cmpNoControls: "no controls marked",
  cmpMeasure: "Measure", cmp_eqDiameterMm: "Equivalent diameter (mm)", cmp_areaMm2: "Area (mm²)",
  cmpPairing: "Compare samples with", cmp_pairing_group: "the controls of their group", cmp_pairing_global: "all the controls of the experiment",
  cmpReference: "Reference control", cmp_reference_auto: "Vehicle if present, else untreated", cmp_reference_vehicle: "Vehicle control", cmp_reference_untreated: "Untreated control",
  cmpGroupBy: "A group (with its own control) has the same", cmpGroupRows: "Split the conditions by",
  allImages: "All images", group: "Group", noCondition: "(no condition)", reference: "reference",
  nBio: "n", nTitle: "Biological replicates (plates in brackets; ▣ = complete plates)", meanSd: "Mean ± SD", ci95: "95% CI",
  inhibitionSd: "Inhibition (%) ± SD", inhibitionHint: "(1 − mean / mean of the control) × 100; SD propagated from both SDs",
  pHolm: "p (Holm)", pHolmHint: "Welch's t-test vs the control, Holm-corrected within the group; hover for the raw p", pRaw: "raw p",
  lowNHint: "Fewer than 3 biological replicates", completeHint: "Complete plates: the value is the plate size, a lower bound",
  anovaLine: "One-way ANOVA: F({d1}, {d2}) = {F}, p = {p}", anovaNa: "One-way ANOVA: not enough replicates.",
  plateSize: "plate", plateSizeLine: "Plate size: {v} {u} (complete plates)",
  warnLowN: "Fewer than 3 biological replicates: {list}. Tests with so few replicates have little power; add replicates before drawing conclusions.",
  warnNoControl: "No control for {g}: its % inhibition and p-values cannot be computed. Mark a control in this group, or compare with all the controls of the experiment.",
  warnPooled: "{g}: control images of different conditions ({c}) were pooled into one control.",
  warnComplete: "{n} plate(s) are complete: their value is the plate size, a lower bound of the real motility, so differences to the control may be underestimated.",
  warnBioMissing: "{c}: some images have no biological replicate; each of them counts as a separate biological replicate.",
  warnPending: "{n} image(s) not analysed yet are left out.",
  cmpReplicatesNote: "n = biological replicates. Plates with the same biological replicate (technical replicates) are averaged first; the dots are the biological replicates, faint dots the individual plates, squares complete plates; bars are means and error bars ± SD. Stars: * p < 0.05, ** < 0.01, *** < 0.001, **** < 0.0001 (Holm-adjusted).",

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
  mode_sam: "AI outline (Segment Anything)",
  mode_sam_help: "Drag a box around the growth, or tap on it. Tap again to add points: Include (+) adds a region, Exclude (−, or Alt/Shift+click) removes one. Each prompt replaces the outline; Undo goes back.",
  samInclude: "Include", samExclude: "Exclude", samPointKind: "Kind of point", samClear: "Clear prompts",
  samDownload: "Download",
  samDownloadConfirm: "The AI outline tool uses the Segment Anything model (SlimSAM), which is downloaded once (about {mb} MB) and then kept in this browser for offline use. Download it now?",
  samDownloading: "Downloading the Segment Anything model ({mb} MB)…",
  samLoading: "Loading the Segment Anything model…",
  samPreparing: "Preparing the image for Segment Anything (once per image; up to half a minute on a phone)…",
  samReady: "Ready ({backend}; image prepared in {s} s). Drag a box or tap the growth.",
  samDecoded: "Outline updated in {ms} ms (model confidence {score}%).",
  samEmpty: "Segment Anything found nothing there: try a box or another point.",
  samUnsupported: "This browser cannot run the AI outline tool (needs Web Workers, WebAssembly and the Cache API).",

  // time series (series-ui.js, pages/series.js, series-export.js)
  timeSeries: "Time series",
  timeSeriesLead: "Group the photos of one plate taken over time to follow its expansion: overlay of the outlines, area and radius vs time, expansion rate, lag and time to coverage.",
  noSeries: "No series yet. Select the photos of one plate with Group as series, or detect series from file names such as plate1_t05h.jpg.",
  groupAsSeries: "Group as series", detectSeries: "Detect from file names",
  seriesDetected: "{n} series created from the file names.", noSeriesDetected: "No file names with a time point (e.g. _t05h, -30min) shared by two or more images.",
  seriesName: "Series name", defaultSeriesName: "Plate {n}", nFrames: "{n} frame(s)",
  selectFrames: "Images of the plate (at least 2)", selectAtLeast2: "Select at least two images.",
  inSeries: "in {name}", timeSource: "Time of each image",
  timeFromName: "From the file names (_t05h, -30min, 2d…)", timeFromCapture: "From the capture time (photo EXIF, else file date), relative to the first",
  timeInterval: "Every … hours, in file-name order", timeKeep: "Keep the current times (set them later)",
  intervalH: "Interval (h)", seriesCreated: "Series “{name}” created with {n} images.",
  kineticsExcel: "Kinetics Excel", kineticsCsv: "Kinetics CSV", kineticsSheet: "Kinetics",
  deleteSeries: "Ungroup", deleteSeriesConfirm: "Ungroup the series “{name}”? The images stay in the experiment.",
  renameSeries: "Rename series", openSeries: "Open",
  seriesOverlay: "Overlay", seriesOverlayHint: "Outlines of every time point registered on the plate circle of the last photo, from early (violet) to late (yellow).",
  frameN: "Frame {i} of {n}", play: "Play", pause: "Pause", showAllContours: "All outlines", showFrameImage: "Photo of the frame",
  notRegistered: "The plate circle of this frame was not detected: it is shown without registration.",
  kinetics: "Kinetics", areaVsTime: "Area (mm²) vs time (h)", radiusVsTime: "Equivalent radius √(A/π) (mm) vs time (h)",
  timeH: "Time (h)", eqRadius: "Eq. radius (mm)", rateAreaShort: "mm²/h", rateRadiusShort: "mm/h",
  rateAreaCol: "Rate (mm²/h)", rateRadiusCol: "Rate (mm/h)",
  fitWindow: "Linear fit window (h)", fitFrom: "from", fitTo: "to", auto: "auto",
  lagThreshold: "Lag threshold (mm² above the inoculum)", inoculumArea: "Inoculum area (mm²)", inoculumAuto: "first frame",
  statFitArea: "Expansion rate (area)", statFitRadius: "Expansion rate (radius)", statMax: "Maximum rate (frame to frame)",
  statLag: "Lag time", statCoverage: "Time to complete coverage", statFinal: "Final area", r2: "R²",
  statNone: "—", notCovered: "not reached", hUnit: "{v} h", between: "between {a} and {b} h",
  statsHelp: "Rates are least-squares slopes over the fit window (by default all incomplete frames). Complete frames count as the whole plate. Lag: first time the area exceeds the inoculum by the threshold (interpolated). Coverage: before the first complete frame, extrapolated from the last expansion rate.",
  frames: "Frames", setTimesFromNames: "Times from file names", setTimesFromCapture: "Times from capture time",
  addToSeries: "Add images", addToSeriesTitle: "Add images to this series", removeFromSeries: "Remove from the series",
  noTimesFound: "No time found for {n} image(s).", timesUpdated: "Times updated.",
  framesSkipped: "{n} frame(s) without time or analysis are left out of the kinetics.",
  needTwoFrames: "The kinetics need at least two analysed frames with a time.",
  analysePending: "Analyse {n} pending",
  kxSeries: "Series", kxRow: "Frame", kxTime: "Time (h)", kxRadius: "Eq. radius (mm)",
  kxRateArea: "Rate area (mm2/h)", kxRateRadius: "Rate radius (mm/h)", kxFitWindow: "Fit window",
  kxFitArea: "Fit rate area (mm2/h)", kxFitAreaR2: "Fit R2 area", kxFitRadius: "Fit rate radius (mm/h)", kxFitRadiusR2: "Fit R2 radius",
  kxMaxArea: "Max rate area (mm2/h)", kxMaxRadius: "Max rate radius (mm/h)", kxLag: "Lag (h)", kxCoverage: "Time to coverage (h)",
  kxSummary: "summary", kxSkipped: "left out: no time or not analysed",

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
  driveInbox: "From Drive inbox…",

  // photo quality (quality.js)
  qualityTitle: "Photo quality", qualityOk: "Good photo", qualityScore: "Quality {score}/100",
  qualityWarnN: "{n} warning(s)", qualityBadge: "Photo", qualityBadgeHint: "Photo quality warnings: open the image to see them",
  qualityLead: "You can continue, but the analysis may be less accurate.", qualityHowTo: "How to photograph plates",
  qualityImported: "{n} photo(s) with quality warnings (marked ⚠ Photo).", qualityChecking: "Checking the photo…",
  q_plate_not_found: "The plate could not be found in the photo.",
  q_plate_not_found_tip: "Photograph one dish from right above, filling most of the picture, on a dark uniform background. You can still fit the circle by hand.",
  q_plate_cut: "The plate is partly outside the photo ({pct} % of its radius).",
  q_plate_cut_tip: "Frame the whole dish with a small margin around the rim: the rim gives the scale.",
  q_plate_small: "The plate fills only {pct} % of the photo.",
  q_plate_small_tip: "Move closer (no digital zoom) or use Crop to plate: the automatic analysis expects the dish to fill the picture.",
  q_off_centre: "The plate is off-centre.",
  q_off_centre_tip: "Centre the dish, or use Crop to plate: the automatic analysis looks for it in the middle of the picture.",
  q_plate_frame: "The automatic analysis may not find this plate.",
  q_plate_frame_tip: "Use Crop to plate, or check the plate circle after the analysis.",
  q_tilt: "The plate looks oval ({pct} %): the phone was not parallel to it.",
  q_tilt_tip: "Hold the phone flat, right above the centre of the dish (a stand helps); areas are measured on a circle.",
  q_low_resolution: "Low resolution: the plate is about {px} px across.",
  q_low_resolution_tip: "Use the original photo at full camera resolution (at least 600 px across the plate); messaging apps reduce it.",
  q_blur: "The photo looks out of focus.",
  q_blur_tip: "Tap on the agar to focus, hold the phone steady or use a stand, and avoid digital zoom. The edge of the growth must be sharp.",
  q_dark: "The photo is very dark.", q_dark_tip: "Add light (diffuse, from the sides or from below) instead of raising the exposure afterwards.",
  q_overexposed: "Over-exposed: {pct} % of the plate is pure white.", q_overexposed_tip: "Lower the light or the exposure (tap the agar and slide the sun icon down).",
  q_glare: "Glare or reflections on the plate ({pct} % of it).",
  q_glare_tip: "Remove the lid, and move the lamps so they are not reflected in the agar; diffuse light from the sides works best.",
  q_low_contrast: "Very low contrast: the growth may not stand out from the agar.",
  q_low_contrast_tip: "Use a dark, matte background (black card) under the dish and avoid haze on the lid.",

  // capture (pages/capture.js)
  capture: "Capture", captureTitle: "Capture plates",
  captureLead: "Photograph plates with this phone or tablet, check each photo, and add them to an experiment or send them to your Google Drive to analyse them later on a computer.",
  captureLeadNoDrive: "Photograph plates with this phone or tablet, check each photo and add them to an experiment.",
  captureData: "Plate data", captureDataLead: "Given to every photo of this batch. Do not write data that identify patients or people.",
  captureTarget: "Experiment", captureNewExperiment: "New experiment…", captureNewName: "Name of the new experiment",
  captureNotes: "Notes", capturePhotos: "Photos",
  capturePhotosLead: "One plate per photo, from right above, centred, the whole rim visible, on a dark background, without the lid.",
  captureTips: "Tips", captureChoose: "Choose photos", captureRetake: "Retake", captureKeep: "Keep", captureCrop: "Crop to plate",
  captureCropped: "Cropped to the plate.", captureRemove: "Remove photo", captureNoPhotos: "No photos yet.",
  captureAddLocal: "Add {n} photo(s) to the experiment", captureAnalyseNow: "Analyse them now",
  captureSendDrive: "Send {n} photo(s) to the Drive inbox", captureDriveLead: "They go to MotilityJ/Inbox in your Google Drive, with the data above and the quality check. Open MotilityJ → Inbox on a computer to import and analyse them.",
  captureAdded: "{n} photo(s) added to “{name}”.", captureQueued: "{n} photo(s) queued for the Drive inbox.",
  captureOffline: "You are offline: photos are kept on this device and sent when the connection is back.",
  captureConnectDrive: "Connect Google Drive to send the photos.", captureExpiredDrive: "The Google Drive session expired.",
  captureReconnect: "Reconnect", captureConnect: "Connect Google Drive",
  captureQueue: "Waiting to be sent from this device", captureSent: "Sent to the inbox from this device",
  captureSendNow: "Send now", captureQueueWaiting: "Waiting to be sent", captureQueueUploading: "Uploading…",
  captureQueueFailed: "Failed: {error}", captureQueueDone: "✓ In the Drive inbox", captureQueueDelete: "Delete",
  captureQueueDeleteConfirm: "This photo has not been sent yet. Delete it from this device?",
  captureReviewTitle: "Check the photo", captureNeedTarget: "Choose an experiment first.",
  openExperiment: "Open the experiment",

  // inbox (pages/inbox.js)
  inbox: "Inbox", inboxTitle: "Drive inbox",
  inboxLead: "Photos sent from phones with Capture to MotilityJ/Inbox in your Google Drive. Import & analyse adds the selected ones to an experiment with their data and moves them to Inbox/Processed.",
  inboxNoDrive: "The Drive inbox needs Google Drive, which is not configured in this installation. Copy the photos to this computer and add them on the experiment page instead.",
  inboxConnect: "Connect Google Drive to see the photos sent from phones.", inboxRefresh: "Refresh",
  inboxEmpty: "The inbox is empty. On a phone, open MotilityJ → Capture, connect the same Google account and send photos.",
  inboxTarget: "Add to the experiment", inboxAnalyse: "Analyse after importing",
  inboxImport: "Import & analyse ({n})", inboxImportOnly: "Import ({n})", inboxSkip: "Skip",
  inboxSkipConfirm: "Move {n} photo(s) to Inbox/Processed without importing them?",
  inboxImported: "{n} photo(s) imported into “{name}”.", inboxReading: "Reading the Drive inbox…",
  inboxDownloading: "Importing {i} of {n}…", inboxNoData: "No plate data", inboxSelected: "{n} selected",
  inboxFrom: "{date}, {device}", inboxCount: "{n} photo(s) in the inbox",

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
    <li><b>AI outline</b>: drag a box around the growth or tap on it and Segment Anything outlines it (see <a href="#/help/sam">AI outline</a>).</li>
    <li><b>Plate</b>: move the circle or drag its edge to fit the inner rim of the dish; the scale follows it.</li>
    <li><b>Undo</b> (<kbd>Ctrl</kbd>+<kbd>Z</kbd>) reverts the last change; <b>Re-analyse</b> runs the automatic analysis again. <kbd>Alt</kbd>+<kbd>←</kbd>/<kbd>→</kbd> go to the previous/next image.</li>
  </ul>`,
  help_sam_title: "AI outline (Segment Anything)",
  help_sam_html: `<p>The automatic analysis outlines every image. When its outline is wrong, for example on very small colonies, the <b>✦ AI outline</b> tool of the review page lets you point at the growth and the <b>Segment Anything</b> model (SlimSAM, a small version of Meta's SAM) draws its outline for you.</p>
  <ul>
    <li><b>Drag a box</b> around the growth (mouse or one finger): this is the most reliable prompt.</li>
    <li><b>Tap</b> or click to add points: <b>Include</b> adds a region, <b>Exclude</b> removes one (<kbd>Alt</kbd>/<kbd>Shift</kbd>+click also excludes). A single point is often ambiguous; a box plus a few points works best.</li>
    <li>Each prompt replaces the outline, which you can still adjust with <b>Vertices</b>. <b>Undo</b> goes back one step; <b>Clear prompts</b> (<kbd>Esc</kbd>) starts a new selection.</li>
  </ul>
  <p>The model is downloaded the first time you open the tool (about 25 MB, or 39 MB in browsers with WebGPU) and then kept in this browser, so it also works offline. It runs on your device: the image is not sent anywhere. Preparing each image takes about 1 s with WebGPU or 5–10 s without it on a computer (longer on phones); after that every prompt takes a fraction of a second.</p>`,
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
  help_compare_title: "Comparison vs control",
  help_compare_html: `<p>Motility inhibitors (quorum-sensing inhibitors, sub-MIC antibiotics, anti-virulence compounds) are usually reported as <b>% motility inhibition</b> relative to an untreated or vehicle control, or as the <b>zone diameter, mean ± SD</b> per condition, tested across biological replicates.</p>
  <ul>
    <li><b>Mark the controls</b>: set the <b>Role</b> of the control plates to <i>Untreated control</i> or <i>Vehicle control</i> (e.g. DMSO); every other image is a sample. Give each treatment a <b>Condition</b> and each plate its <b>biological</b> (and, if any, technical) <b>replicate</b>. Use <b>Edit metadata</b> to set them for several images at once.</li>
    <li><b>Pairing</b>: by default the samples are compared with the controls of their <b>group</b>, the images with the same values of the fields you tick (strain and incubation time by default), so each strain is compared with its own control. Or compare every sample with <b>all the controls</b> of the experiment. With both kinds of controls, the vehicle control is the reference and the untreated control is shown as a condition (the effect of the vehicle itself).</li>
    <li><b>Measure</b>: the equivalent diameter (default, since most papers report zone diameters) or the area.</li>
  </ul>
  <p><b>Replicates.</b> The statistical unit is the <b>biological replicate</b>: plates of the same condition and biological replicate (technical replicates) are averaged first, and n is the number of biological replicates. An image without a biological replicate counts as one. Treating technical replicates as independent would inflate n and give p-values that are too small.</p>
  <p><b>Complete plates</b> (the zone reached the rim) count as the plate size (e.g. 90 mm, or its area). This is a lower bound of the real motility: they are drawn as squares, counted in the table (▣) and warned about.</p>
  <p><b>Formulas</b> (per condition, over its n biological replicates x<sub>i</sub>):</p>
  <ul>
    <li>mean x̄ = Σx<sub>i</sub>/n; SD = √(Σ(x<sub>i</sub> − x̄)²/(n − 1)); SEM = SD/√n; 95% CI = x̄ ± t<sub>0.975, n−1</sub>·SEM.</li>
    <li><b>% inhibition</b> = (1 − x̄<sub>T</sub>/x̄<sub>C</sub>) × 100, with SD propagated to first order from both SDs: SD = 100·(x̄<sub>T</sub>/x̄<sub>C</sub>)·√((SD<sub>T</sub>/x̄<sub>T</sub>)² + (SD<sub>C</sub>/x̄<sub>C</sub>)²). Positive values mean less motility than the control. In the results table and exports each image also gets its own % inhibition against the mean of its control.</li>
    <li><b>Welch's t-test</b> (two-sided, unequal variances) of each condition vs the control: t = (x̄<sub>T</sub> − x̄<sub>C</sub>)/√(s²<sub>T</sub>/n<sub>T</sub> + s²<sub>C</sub>/n<sub>C</sub>), with Welch–Satterthwaite degrees of freedom. It needs at least 2 replicates per condition.</li>
    <li><b>Multiple comparisons</b>: the p-values of the conditions compared with the same control are corrected with <b>Holm's</b> step-down method (sort them, multiply the k-th smallest by m − k + 1, keep them increasing, cap at 1). It controls the family-wise error rate like Dunnett's test, without assuming equal variances or equal n; it is slightly more conservative. Stars use the corrected p.</li>
    <li><b>One-way ANOVA</b> over the control and the conditions of each group (F, degrees of freedom and p), as an overall test.</li>
  </ul>
  <p>Fewer than 3 biological replicates, or a group without a control, are warned about. The t and F distributions are computed in the app (incomplete beta function) and checked against SciPy. The comparison is exported as a <b>Comparison</b> sheet of the Excel workbook and as a CSV, with all the numbers above and the replicate values.</p>`,
  help_series_title: "Time series and expansion kinetics",
  help_series_html: `<p>To measure how fast a strain spreads, photograph the <b>same plate</b> several times while it grows (for example every 30 min, or every 10 min with a scanner; a swarm usually covers a 9 cm plate in 10–20 h) and group the photos as a <b>series</b>.</p>
  <ul>
    <li><b>Group as series</b> (experiment page): select the photos of one plate. Their time comes from the <b>file names</b> (<code>plate1_t05h.jpg</code>, <code>A-30min.png</code>, <code>_2d</code>), from the <b>capture time</b> of the photos (EXIF, else the file date, relative to the first photo) or from a fixed interval. <b>Detect from file names</b> groups the images whose names differ only by the time. Times can be edited on the series page.</li>
    <li>The <b>overlay</b> registers every frame on its detected plate circle (shift and scale to the last photo), so the outlines of all time points can be compared even if the plate moved a little.</li>
    <li><b>Kinetics</b>: area and equivalent radius √(A/π) vs time; expansion rate in mm²/h and mm/h as the slope of a linear fit over a window you choose, and frame to frame; maximum rate; <b>lag time</b> (first time the area exceeds the inoculum by a threshold); <b>time to complete coverage</b> (first complete frame, interpolated). Complete frames count as the whole plate.</li>
    <li><b>Kinetics Excel / CSV</b>: one row per frame and a summary row per series.</li>
  </ul>
  <h3>Photographing a series consistently</h3>
  <ul>
    <li>A <b>flatbed scanner</b> (lid open or with a dark cover, plates upside down) with a scheduled scan is the most reproducible option; otherwise fix the phone or camera on a stand at the same height, straight above the plate.</li>
    <li>Keep the <b>position, distance, zoom and lighting</b> the same in every photo: mark the place of the plate, use the same dark background and avoid reflections and condensation on the lid.</li>
    <li>Do not change the camera settings between photos and keep the whole rim of the dish visible: it is used for the scale and for the registration.</li>
    <li>Name the files with the time (<code>strain_rep1_t02h.jpg</code>) or keep the original photo files so that their capture time can be read.</li>
  </ul>`,
  help_formats_title: "Image formats",
  help_formats_html: `<p>JPEG, PNG, WebP and the other formats of your browser are read directly. <b>TIFF</b> files are read by MotilityJ itself: 8 or 16 bits, grey, RGB or palette, in strips or tiles, uncompressed or compressed with LZW, PackBits, Deflate (ZIP) or JPEG. Not supported: BigTIFF, separate colour planes, floating-point samples and old-style JPEG; convert those to PNG first. Only the first page of a multi-page TIFF is used. iPhone HEIC photos taken from the app are converted to JPEG by the phone.</p>
  <p>Images are stored reduced to at most 2000 pixels on the longest side, which is enough for the analysis and keeps the browser storage small. The manual scale (pixels per mm) refers to the original image.</p>`,
  help_photos_title: "How to photograph plates",
  help_photos_html: `<p>The analysis is only as good as the photo. A few minutes setting up a fixed place to take the photos pays off:</p>
  <ul>
    <li><b>Dark, matte, uniform background</b> under the dish (black card or cloth), so the agar and the growth stand out.</li>
    <li><b>No lid, no glare</b>: take the lid off and use diffuse light from the sides (or a light box from below). Move the lamps until they are not reflected in the agar.</li>
    <li><b>The whole rim visible</b>, with a small margin: the rim is used to find the plate and for the scale in mm.</li>
    <li><b>Centred and filling most of the picture</b>: the automatic analysis looks for the dish in the middle, filling the photo. If it is small or off-centre, use <b>Crop to plate</b> on the Capture page.</li>
    <li><b>Phone parallel to the plate</b>, right above its centre; a phone stand or a box with a hole keeps the distance and the angle the same for every photo.</li>
    <li><b>Sharp</b>: tap on the agar to focus, hold still, no digital zoom; keep the original resolution.</li>
    <li>One plate per photo, the same light and camera settings for the whole experiment.</li>
  </ul>
  <p>MotilityJ checks every photo when it is added and shows non-blocking warnings: plate not found, cut off, small, off-centre or oval (phone tilted); out of focus; too dark, over-exposed, glare or low contrast; low resolution. You can keep the photo anyway; photos with warnings are marked <span class="badge cat-i">⚠ Photo</span> and the review page lists the warnings.</p>`,
  help_capture_title: "Capture on the phone, analyse on the computer",
  help_capture_html: `<p><b>Capture</b> (top bar) is made for phones in the lab: fill in the plate data once (experiment, strain, condition, replicates, incubation time), then <b>Take photo</b> for each plate. Each photo is checked at once, with the plate circle drawn on it: <b>Keep</b> it, <b>Retake</b> it or <b>Crop to plate</b>. Then either:</p>
  <ul>
    <li><b>Add to the experiment</b> on this device (and analyse them now if you like), or</li>
    <li><b>Send to the Drive inbox</b>: the photos and their data go to <code>MotilityJ/Inbox</code> in your Google Drive. Without a connection they wait on the phone and are sent when it is back.</li>
  </ul>
  <p>On the computer, open <b>Inbox</b> (or <b>From Drive inbox…</b> on an experiment), select the photos, choose the experiment and <b>Import &amp; analyse</b>: the strain, condition, replicates, incubation time and notes are filled in from the phone, and the imported photos are moved to <code>Inbox/Processed</code>. MotilityJ only sees the files it created in your Drive.</p>`,
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
    <li>The optional <b>AI outline</b> tool downloads its model files once from public servers (cdn.jsdelivr.net and huggingface.co); like any download, those servers see your IP address, but no image or result is sent.</li>
  </ul>`,
};

const LANGS = { en };
const LANG = "en";
Object.assign(en, dmStrings); // Deep-Motility tool (js/deepmotility/strings.js)
Object.assign(en, phStrings); // phenotype rules (js/phenotype-strings.js)

export function t(key, params) {
  let s = LANGS[LANG]?.[key] ?? en[key];
  if (s == null) { console.warn("Missing string:", key); return key; }
  if (params) s = s.replace(/\{(\w+)\}/g, (m, k) => (params[k] ?? m));
  return s;
}

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
    <li><b>Export</b> the table <i>File · Class · Area (mm²) · Notes</i> to <b>Excel</b> or <b>CSV</b>.</li>
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
  </ul>`,
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

// All user-visible strings. To add a language, add an object with the same keys (missing keys fall back to English)
// and select it in LANG (e.g. from navigator.language).
// Placeholders: {name} is replaced by params.name.

import { strings as dmStrings } from "./deepmotility/strings.js";

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
    <li>The optional <b>AI outline</b> tool downloads its model files once from public servers (cdn.jsdelivr.net and huggingface.co); like any download, those servers see your IP address, but no image or result is sent.</li>
  </ul>`,
};

const LANGS = { en };
const LANG = "en";
Object.assign(en, dmStrings); // Deep-Motility tool (js/deepmotility/strings.js)

export function t(key, params) {
  let s = LANGS[LANG]?.[key] ?? en[key];
  if (s == null) { console.warn("Missing string:", key); return key; }
  if (params) s = s.replace(/\{(\w+)\}/g, (m, k) => (params[k] ?? m));
  return s;
}

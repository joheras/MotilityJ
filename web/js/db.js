// IndexedDB storage: experiments, images (downscaled Blob + thumbnail + analysis result) and settings.
//
// experiment = { id, name, created, updated }
// experiment.meta = assay defaults, image.meta = per-image metadata and overrides (see metadata.js)
// image = { id, experimentId, name, blob, thumb, width, height, origWidth, origHeight, scale, added,
//           notes, meta, result: null | { klass, confidence, plate, contour, areaPx, edited, analysedAt },
//           capturedAt?, seriesId?, timeH? }
//   scale = width / origWidth (the stored image may be downscaled; coordinates are in stored pixels)
//   capturedAt = capture time in ms (EXIF DateTimeOriginal, else the file's lastModified), recorded at import
//   seriesId / timeH = plate series the image belongs to and its time point in hours (see series.js)
// series = { id, experimentId, name, created, params } : one physical plate photographed over time

import { DEFAULT_PLATE_DIAMETER_MM } from "./config.js";
import { normalizeExperiment, normalizeImage } from "./metadata.js";

const DB_NAME = "motilityj";
const DB_VERSION = 2; // 2: per-image assay metadata (migrated) + series store (time series of one plate)
let dbPromise = null;

function open() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = req.result;
      if (!db.objectStoreNames.contains("experiments")) db.createObjectStore("experiments", { keyPath: "id" });
      if (!db.objectStoreNames.contains("images")) {
        db.createObjectStore("images", { keyPath: "id" }).createIndex("experimentId", "experimentId");
      }
      if (!db.objectStoreNames.contains("settings")) db.createObjectStore("settings", { keyPath: "key" });
      if (e.oldVersion >= 1 && e.oldVersion < 2) migrateMetadata(req.transaction);
      if (!db.objectStoreNames.contains("series")) {
        db.createObjectStore("series", { keyPath: "id" }).createIndex("experimentId", "experimentId");
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error("The database is open in an older version of the app in another tab."));
  });
  return dbPromise;
}

// v1 -> v2: add the empty assay metadata to existing experiments and images.
function migrateMetadata(tx) {
  for (const [store, normalize] of [["experiments", normalizeExperiment], ["images", normalizeImage]]) {
    tx.objectStore(store).openCursor().onsuccess = (ev) => {
      const cur = ev.target.result;
      if (!cur) return;
      cur.update(normalize(cur.value));
      cur.continue();
    };
  }
}

const done = (req) => new Promise((resolve, reject) => {
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error);
});

async function run(stores, mode, fn) {
  const db = await open();
  const tx = db.transaction(stores, mode);
  const result = await fn(tx);
  await new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error("Transaction aborted"));
  });
  return result;
}

export const newId = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`);

// ------------------------------------------------------------- experiments
export async function listExperiments() {
  const all = await run("experiments", "readonly", (tx) => done(tx.objectStore("experiments").getAll()));
  all.forEach(normalizeExperiment);
  return all.sort((a, b) => b.updated - a.updated);
}
export const getExperiment = async (id) => normalizeExperiment(await run("experiments", "readonly", (tx) => done(tx.objectStore("experiments").get(id))));
export const putExperiment = (exp) => run("experiments", "readwrite", (tx) => done(tx.objectStore("experiments").put(exp)));

export async function createExperiment(name) {
  const now = Date.now();
  const exp = normalizeExperiment({ id: newId(), name, created: now, updated: now, meta: {} });
  await putExperiment(exp);
  return exp;
}

export async function touchExperiment(id) {
  const exp = await getExperiment(id);
  if (exp) { exp.updated = Date.now(); await putExperiment(exp); }
}

export function deleteExperiment(id) {
  return run(["experiments", "images", "series"], "readwrite", async (tx) => {
    tx.objectStore("experiments").delete(id);
    const keys = await done(tx.objectStore("images").index("experimentId").getAllKeys(id));
    for (const k of keys) tx.objectStore("images").delete(k);
    const series = await done(tx.objectStore("series").index("experimentId").getAllKeys(id));
    for (const k of series) tx.objectStore("series").delete(k);
  });
}

// ------------------------------------------------------------------ images
export async function listImages(experimentId) {
  const all = await run("images", "readonly", (tx) => done(tx.objectStore("images").index("experimentId").getAll(experimentId)));
  all.forEach(normalizeImage);
  return all.sort((a, b) => a.added - b.added || a.name.localeCompare(b.name, undefined, { numeric: true }));
}
export const getImage = async (id) => normalizeImage(await run("images", "readonly", (tx) => done(tx.objectStore("images").get(id))));
export const putImage = (img) => run("images", "readwrite", (tx) => done(tx.objectStore("images").put(img)));
export const deleteImage = (id) => run("images", "readwrite", (tx) => done(tx.objectStore("images").delete(id)));

// ------------------------------------------------------------------ series
export async function listSeries(experimentId) {
  const all = await run("series", "readonly", (tx) => done(tx.objectStore("series").index("experimentId").getAll(experimentId)));
  return all.sort((a, b) => a.created - b.created || a.name.localeCompare(b.name, undefined, { numeric: true }));
}
export const getSeries = (id) => run("series", "readonly", (tx) => done(tx.objectStore("series").get(id)));
export const putSeries = (series) => run("series", "readwrite", (tx) => done(tx.objectStore("series").put(series)));

/** Deletes a series; its images stay in the experiment (they keep their time, timeH). */
export function deleteSeries(id) {
  return run(["series", "images"], "readwrite", async (tx) => {
    const series = await done(tx.objectStore("series").get(id));
    tx.objectStore("series").delete(id);
    if (!series) return;
    const images = await done(tx.objectStore("images").index("experimentId").getAll(series.experimentId));
    for (const img of images) if (img.seriesId === id) { img.seriesId = null; tx.objectStore("images").put(img); }
  });
}

// ---------------------------------------------------------------- settings
// resultColumns: ids of the optional columns shown in the results table (null = default set, see columns.js).
const DEFAULT_SETTINGS = { plateDiameterMm: DEFAULT_PLATE_DIAMETER_MM, manualPxPerMm: null, resultColumns: null };

export async function getSettings() {
  const row = await run("settings", "readonly", (tx) => done(tx.objectStore("settings").get("settings")));
  return { ...DEFAULT_SETTINGS, ...(row?.value || {}) };
}
export const saveSettings = (value) =>
  run("settings", "readwrite", (tx) => done(tx.objectStore("settings").put({ key: "settings", value })));

export async function clearAll() {
  await run(["experiments", "images", "series"], "readwrite", (tx) => {
    tx.objectStore("experiments").clear();
    tx.objectStore("images").clear();
    tx.objectStore("series").clear();
  });
}

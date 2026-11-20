// Contract for the optional Google Drive integration (Google Identity Services token model,
// scope drive.file, Drive REST v3 from the browser; no server, no secret).
// Disabled when GOOGLE_CLIENT_ID in js/config.js is empty: isConfigured() returns false and the UI hides Drive.
//
// export function isConfigured(): boolean
// export async function connect(): Promise<void>          // loads accounts.google.com/gsi/client lazily, asks for a token
// export function isConnected(): boolean
// export function onStatusChange(cb: (status) => void)   // status: "disabled" | "disconnected" | "connected" | "expired" | "error"
// export async function backupExperiment(experiment): Promise<void>     // MotilityJ/Backups/<name>.motilityj.json, update in place
// export async function listBackups(): Promise<{id, name, modifiedTime}[]>
// export async function downloadBackup(id): Promise<object>
// export async function listInbox(): Promise<{id, name, thumbnailLink?, sidecar?}[]>   // MotilityJ/Inbox/ photos uploaded from phones
// export async function downloadFile(id): Promise<Blob>
// export async function uploadCapture(blob, sidecar): Promise<void>     // queued + retried when offline
//
// Additional functions (all optional for the UI):
// export function getStatus(): status                    // current status (same values as onStatusChange)
// export function getLastError(): DriveError | null      // why the status is "error" / "expired" (has .kind and .message)
// export function getAccountEmail(): string              // e-mail of the connected Google account ("" if unknown)
// export async function disconnect(): Promise<void>      // forgets and revokes the token
// export async function markProcessed(item): Promise<void>  // moves an inbox item (from listInbox) to Inbox/Processed/
// export async function processQueue(): Promise<void>    // uploads queued captures now (also runs on connect and on "online")
// export async function queuedCaptures(): Promise<{id, created_at, status, attempts, error, sidecar}[]>
// export async function removeQueuedCapture(id): Promise<void>
// export function onQueueChange(cb: () => void): () => void
// export class DriveError extends Error { kind: "auth"|"offline"|"quota"|"rateLimit"|"notFound"|"permission"|"config"|"other" }
// export function _setTestHooks(hooks)                   // tests only: { clientId, fetch, gis, isOnline, sleep, dbName, device }
//
// Notes for the UI:
// * onStatusChange(cb) calls cb immediately with the current status and returns an unsubscribe function.
// * connect() must be called from a click (Google opens a pop-up). The token lives in memory only (~1 h);
//   when it expires the status becomes "expired" and the UI should offer "Reconnect" (= connect()).
// * backupExperiment(experiment): experiment must be JSON-serialisable and have a stable `uid` (or `id`) and a
//   `name`. It resolves to { fileId, name, conflict }: conflict is true when the file had been changed in Drive
//   by another device since this one last synced it; then a separate "(conflict, <device> <date>)" copy is
//   written instead of overwriting. Loading (downloadBackup) never writes anything to Drive.
// * listInbox() items: { id (photo file id, for downloadFile), name, thumbnailLink?, sidecar (the JSON written
//   by uploadCapture: id, captured_at, device, width, height, thumbnail data URL + the caller's fields),
//   sidecarId, createdTime }.
// * uploadCapture(blob, sidecar) downscales the photo to a JPEG (max 3000 px), stores it in the IndexedDB
//   database "motilityj-drive-queue" and resolves; the upload happens now if connected and online, otherwise
//   on the next connect() or "online" event. The JSON sidecar is uploaded last and marks the capture complete.
//   `sidecar` is free-form JSON from the UI (suggested: strain, sample, name, notes, captured_at); strain,
//   sample and name are used in the Drive file name.
// * Tests: js/drive.mock-test.html runs this module against a fake Drive API and a fake Google sign-in.
// * Nothing here runs (no script, no listener, no IndexedDB) until the UI calls one of these functions.

import { GOOGLE_CLIENT_ID } from "./config.js";

const SCOPE = "https://www.googleapis.com/auth/drive.file";
const GIS_URL = "https://accounts.google.com/gsi/client";
const API = "https://www.googleapis.com/drive/v3";
const UPLOAD = "https://www.googleapis.com/upload/drive/v3";
const FOLDER_MIME = "application/vnd.google-apps.folder";
const FILE_FIELDS = "id,name,mimeType,size,createdTime,modifiedTime,version,parents,appProperties,thumbnailLink";
const RESUMABLE_OVER = 5 * 1024 * 1024; // bytes; smaller bodies go in a single multipart request
const MAX_SIDE = 3000; // px of the uploaded capture JPEG
const THUMB_SIDE = 240;
const SYNC_KEY = "motilityj.drive.sync."; // localStorage: last Drive {fileId, version} seen per experiment uid
const CAPTURE_FORMAT = "motilityj-capture";

// ------------------------------------------------------------------ state

const hooks = {
  clientId: GOOGLE_CLIENT_ID,
  fetch: (...a) => fetch(...a),
  gis: null, // a fake window.google for tests
  isOnline: () => typeof navigator === "undefined" || navigator.onLine !== false,
  sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
  dbName: "motilityj-drive-queue",
  device: null,
};

/** Tests only: replaces the client id, fetch, Google Identity Services, etc. Resets the session. */
export function _setTestHooks(h) {
  Object.assign(hooks, h);
  token = null; email = ""; folders = null; lastError = null; dbPromise = null;
  clearTimeout(expiryTimer);
  setStatus(hooks.clientId ? "disconnected" : "disabled");
}

let status = GOOGLE_CLIENT_ID ? "disconnected" : "disabled";
let token = null; // { value, expiresAt }
let email = "";
let lastError = null;
let expiryTimer = 0;
const statusListeners = new Set();
const queueListeners = new Set();

export class DriveError extends Error {
  constructor(kind, message, httpStatus = 0) {
    super(message);
    this.name = "DriveError";
    this.kind = kind;
    this.status = httpStatus;
  }
}

export function isConfigured() { return Boolean(hooks.clientId); }
export function isConnected() { return status === "connected" && Boolean(token) && token.expiresAt > Date.now(); }
export function getStatus() { return status; }
export function getLastError() { return lastError; }
export function getAccountEmail() { return email; }

export function onStatusChange(cb) {
  statusListeners.add(cb);
  try { cb(status); } catch (e) { console.error(e); }
  return () => statusListeners.delete(cb);
}

function setStatus(s, err = null) {
  if (err) lastError = err;
  else if (s === "connected" || s === "disconnected" || s === "disabled") lastError = null;
  if (s === status && !err) return;
  status = s;
  for (const cb of statusListeners) { try { cb(s); } catch (e) { console.error(e); } }
}

// ------------------------------------------------------------------ sign-in (GIS token model)

let gisPromise = null;
function loadGis() {
  if (hooks.gis) return Promise.resolve(hooks.gis);
  gisPromise ??= new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) return resolve(window.google);
    const s = document.createElement("script");
    s.src = GIS_URL;
    s.async = true;
    s.onload = () => (window.google?.accounts?.oauth2 ? resolve(window.google) : reject(new Error("Google sign-in did not load.")));
    s.onerror = () => reject(new DriveError("offline", "Cannot load Google sign-in. Check the connection (or an ad/tracker blocker) and try again."));
    document.head.appendChild(s);
  }).catch((e) => { gisPromise = null; throw e; });
  return gisPromise;
}

export async function connect() {
  if (!isConfigured()) throw new DriveError("config", "Google Drive is not configured in this installation of MotilityJ.");
  if (isConnected()) return;
  try {
    const gis = await loadGis();
    const response = await new Promise((resolve, reject) => {
      const client = gis.accounts.oauth2.initTokenClient({
        client_id: hooks.clientId,
        scope: SCOPE,
        callback: (r) => (r.error ? reject(new DriveError("auth", r.error_description || r.error)) : resolve(r)),
        error_callback: (e) => reject(new DriveError("auth",
          e.type === "popup_closed" ? "The Google window was closed before finishing."
            : e.type === "popup_failed_to_open" ? "The browser blocked the Google window. Allow pop-ups for this site and try again."
              : e.message || e.type)),
      });
      client.requestAccessToken(email ? { prompt: "", login_hint: email } : {});
    });
    if (!response.access_token || !gis.accounts.oauth2.hasGrantedAllScopes(response, SCOPE)) {
      throw new DriveError("permission", "Google Drive access was not granted. Tick the Google Drive permission to use these features.");
    }
    setToken(response.access_token, response.expires_in);
    try {
      const about = await getJson(`${API}/about?fields=user(emailAddress)`);
      email = about.user?.emailAddress ?? "";
    } catch { /* the e-mail is only informative */ }
    setStatus("connected");
  } catch (e) {
    token = null;
    setStatus("error", e instanceof DriveError ? e : new DriveError("other", e?.message || String(e)));
    throw e;
  }
  watchOnline();
  processQueue().catch(() => {});
}

function setToken(value, expiresIn) {
  token = { value, expiresAt: Date.now() + (Number(expiresIn) || 3600) * 1000 };
  clearTimeout(expiryTimer);
  // Flip to "expired" a minute early so that the UI offers to reconnect before requests fail.
  expiryTimer = setTimeout(expire, Math.max(0, token.expiresAt - Date.now() - 60_000));
}

function expire() {
  token = null;
  clearTimeout(expiryTimer);
  folders = null;
  if (status === "connected") setStatus("expired", new DriveError("auth", "The Google Drive session has expired. Reconnect to Google Drive."));
}

export async function disconnect() {
  const t = token?.value;
  token = null; email = ""; folders = null;
  clearTimeout(expiryTimer);
  setStatus(isConfigured() ? "disconnected" : "disabled");
  const gis = hooks.gis || window.google;
  if (t && gis?.accounts?.oauth2) await new Promise((r) => gis.accounts.oauth2.revoke(t, r));
}

function getToken() {
  if (token && token.expiresAt - 60_000 > Date.now()) return token.value;
  if (token) expire();
  throw status === "expired" ? lastError : new DriveError("auth", "Connect to Google Drive first.");
}

// ------------------------------------------------------------------ REST client

/** Sends an authorised request; retries rate-limit, server and network errors; maps failures to DriveError. */
async function request(url, init = {}, attempts = 4) {
  for (let attempt = 1; ; attempt++) {
    if (!hooks.isOnline()) throw new DriveError("offline", "You are offline. Try again when the connection is back.");
    const headers = { ...(init.headers || {}), Authorization: `Bearer ${getToken()}` };
    let res;
    try {
      res = await hooks.fetch(url, { ...init, headers });
    } catch {
      if (attempt < attempts) { await hooks.sleep(500 * 2 ** attempt); continue; }
      throw new DriveError("offline", "Cannot reach Google Drive. Check the connection and try again.");
    }
    if (res.ok) return res;
    const err = await errorOf(res);
    if (err.kind === "auth") { expire(); throw err; }
    if ((err.kind === "rateLimit" || res.status >= 500) && attempt < attempts) {
      await hooks.sleep(1000 * 2 ** (attempt - 1) + Math.random() * 250);
      continue;
    }
    throw err;
  }
}

const getJson = async (url, init) => (await request(url, init)).json();

async function errorOf(res) {
  let message = res.statusText, reason = "";
  try {
    const body = await res.json();
    message = body.error?.message ?? message;
    reason = body.error?.errors?.[0]?.reason ?? "";
  } catch { /* not JSON */ }
  const s = res.status;
  if (s === 401) return new DriveError("auth", "The Google Drive session has expired. Reconnect to Google Drive.", s);
  if (reason === "storageQuotaExceeded" || reason === "quotaExceeded")
    return new DriveError("quota", "Your Google Drive is full. Free up space and try again.", s);
  if (s === 429 || /rateLimitExceeded|userRateLimitExceeded/.test(reason))
    return new DriveError("rateLimit", "Google Drive is receiving too many requests. Wait a minute and try again.", s);
  if (reason === "dailyLimitExceeded")
    return new DriveError("rateLimit", "The daily Google Drive quota of MotilityJ is used up. Try again tomorrow.", s);
  if (s === 404) return new DriveError("notFound", "The file is no longer in Google Drive (it may have been deleted or moved).", s);
  if (s === 403) return new DriveError("permission", `Google Drive refused the request: ${message}`, s);
  return new DriveError("other", `Google Drive error ${s}: ${message}`, s);
}

/** Escapes a value as a Drive query string literal. */
const quote = (s) => `'${String(s).replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;

async function list(q, orderBy = "modifiedTime desc") {
  const files = [];
  let pageToken;
  do {
    const params = new URLSearchParams({ q, orderBy, pageSize: "200", spaces: "drive", fields: `nextPageToken,files(${FILE_FIELDS})` });
    if (pageToken) params.set("pageToken", pageToken);
    const r = await getJson(`${API}/files?${params}`);
    files.push(...(r.files || []));
    pageToken = r.nextPageToken;
  } while (pageToken);
  return files;
}

const getFile = (id) => getJson(`${API}/files/${encodeURIComponent(id)}?fields=${FILE_FIELDS}`);

/** Creates (no id) or replaces the content of (id) a file: multipart, or resumable for large bodies. */
async function upload(id, meta, body) {
  const mimeType = body.type || meta.mimeType || "application/octet-stream";
  const target = id ? `${UPLOAD}/files/${encodeURIComponent(id)}` : `${UPLOAD}/files`;
  const method = id ? "PATCH" : "POST";
  if (body.size <= RESUMABLE_OVER) {
    const boundary = `motilityj-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
    const blob = new Blob([
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n`,
      `--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`, body, `\r\n--${boundary}--`,
    ]);
    return getJson(`${target}?uploadType=multipart&fields=${FILE_FIELDS}`, {
      method, headers: { "Content-Type": `multipart/related; boundary=${boundary}` }, body: blob,
    });
  }
  const start = await request(`${target}?uploadType=resumable&fields=${FILE_FIELDS}`, {
    method, headers: { "Content-Type": "application/json; charset=UTF-8", "X-Upload-Content-Type": mimeType, "X-Upload-Content-Length": String(body.size) },
    body: JSON.stringify(meta),
  });
  const session = start.headers.get("Location");
  if (!session) throw new DriveError("other", "Google Drive did not start the upload.");
  return getJson(session, { method: "PUT", headers: { "Content-Type": mimeType }, body });
}

function createFolder(name, parent, appProperties) {
  return getJson(`${API}/files?fields=${FILE_FIELDS}`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, mimeType: FOLDER_MIME, parents: [parent], appProperties }),
  });
}

function move(id, addParent, removeParent) {
  const params = new URLSearchParams({ addParents: addParent, removeParents: removeParent, fields: FILE_FIELDS });
  return getJson(`${API}/files/${encodeURIComponent(id)}?${params}`, {
    method: "PATCH", headers: { "Content-Type": "application/json" }, body: "{}",
  });
}

/** The folder `name` in `parent` made by this app (the oldest one if there are several), or a new one. */
async function folder(name, parent, appProperties) {
  const found = await list(`name = ${quote(name)} and mimeType = '${FOLDER_MIME}' and ${quote(parent)} in parents and trashed = false`, "createdTime");
  return found[0]?.id ?? (await createFolder(name, parent, appProperties)).id;
}

// ------------------------------------------------------------------ folders

let folders = null; // Promise<{root, backups, inbox, processed}>, cached while connected

/** MotilityJ/{Backups, Inbox, Inbox/Processed} in "My Drive". */
function ensureFolders() {
  folders ??= (async () => {
    const root = await folder("MotilityJ", "root", { mj: "root" });
    const [backups, inbox] = await Promise.all([folder("Backups", root), folder("Inbox", root)]);
    const processed = await folder("Processed", inbox);
    return { root, backups, inbox, processed };
  })().catch((e) => { folders = null; throw e; });
  return folders;
}

/** Runs fn(folders); if a cached folder was deleted meanwhile, finds or recreates the folders once. */
async function withFolders(fn) {
  try {
    return await fn(await ensureFolders());
  } catch (e) {
    if (!(e instanceof DriveError && e.kind === "notFound")) throw e;
    folders = null;
    return fn(await ensureFolders());
  }
}

// ------------------------------------------------------------------ backups

const safeName = (s) => String(s ?? "").replace(/[\\/:*?"<>|\u0000-\u001f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 80) || "experiment";

/** "2026-11-17 09h31" or, with seconds, "2026-11-17 093105" (local time). */
function stamp(d, seconds = false) {
  const p = (n) => String(n).padStart(2, "0");
  const day = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  return seconds ? `${day} ${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}` : `${day} ${p(d.getHours())}h${p(d.getMinutes())}`;
}

function deviceName() {
  if (hooks.device) return hooks.device;
  const ua = typeof navigator === "undefined" ? "" : navigator.userAgent;
  return /iPhone/.test(ua) ? "iPhone" : /iPad/.test(ua) ? "iPad" : /Android/.test(ua) ? "Android"
    : /Windows/.test(ua) ? "Windows" : /Mac OS X/.test(ua) ? "Mac" : /CrOS/.test(ua) ? "ChromeOS" : /Linux/.test(ua) ? "Linux" : "browser";
}

function readSync(uid) {
  try { return JSON.parse(localStorage.getItem(SYNC_KEY + uid) || "null"); } catch { return null; }
}
function writeSync(uid, file) {
  try { localStorage.setItem(SYNC_KEY + uid, JSON.stringify({ fileId: file.id, version: file.version })); } catch { /* storage blocked */ }
}

function experimentKey(experiment) {
  const uid = experiment?.uid ?? experiment?.id;
  if (uid === undefined || uid === null || uid === "") throw new DriveError("other", "The experiment has no uid.");
  return String(uid);
}

export async function backupExperiment(experiment) {
  const uid = experimentKey(experiment);
  const label = String(experiment.name ?? uid);
  const body = new Blob([JSON.stringify(experiment)], { type: "application/json" });
  const appProperties = { mj: "experiment", uid: uid.slice(0, 100), name: label.slice(0, 80) };
  const name = `${safeName(label)}.motilityj.json`;
  return withFolders(async ({ backups }) => {
    const files = await list(`appProperties has { key='uid' and value=${quote(appProperties.uid)} } and appProperties has { key='mj' and value='experiment' } and ${quote(backups)} in parents and trashed = false`);
    const known = readSync(uid);
    const current = known && files.find((f) => f.id === known.fileId);
    let file, conflict = false;
    if (current && current.version === known.version) {
      // Unchanged in Drive since this device last synced it: update in place (a conflict copy keeps its name).
      const meta = current.appProperties?.conflict ? { appProperties: { ...appProperties, conflict: "1" } } : { name, appProperties };
      file = await upload(current.id, meta, body);
    } else if (!files.some((f) => !f.appProperties?.conflict)) {
      file = await upload(null, { name, parents: [backups], mimeType: "application/json", appProperties }, body);
    } else {
      // Changed elsewhere (or never synced from here): never overwrite, write a separate copy.
      conflict = true;
      file = await upload(null, {
        name: `${safeName(label)} (conflict, ${safeName(deviceName())} ${stamp(new Date())}).motilityj.json`,
        parents: [backups], mimeType: "application/json", appProperties: { ...appProperties, conflict: "1" },
      }, body);
    }
    writeSync(uid, file);
    return { fileId: file.id, name: file.name, conflict };
  });
}

export async function listBackups() {
  return withFolders(async ({ backups }) => {
    const files = await list(`${quote(backups)} in parents and trashed = false and mimeType != '${FOLDER_MIME}'`);
    return files.filter((f) => f.name.endsWith(".motilityj.json")).map((f) => ({
      id: f.id, name: f.name, modifiedTime: f.modifiedTime, size: f.size ? Number(f.size) : undefined,
      uid: f.appProperties?.uid, conflict: Boolean(f.appProperties?.conflict),
    }));
  });
}

/** Parses a backup. Read-only in Drive; remembers its version so that a later backupExperiment updates it in place. */
export async function downloadBackup(id) {
  const [meta, blob] = await Promise.all([getFile(id), downloadFile(id)]);
  let data;
  try { data = JSON.parse(await blob.text()); } catch { throw new DriveError("other", `${meta.name} is not a valid MotilityJ backup.`); }
  const uid = data?.uid ?? data?.id ?? meta.appProperties?.uid;
  if (uid !== undefined && uid !== null && uid !== "" && meta.appProperties?.mj === "experiment") writeSync(String(uid), meta);
  return data;
}

export async function downloadFile(id) {
  return (await request(`${API}/files/${encodeURIComponent(id)}?alt=media`)).blob();
}

// ------------------------------------------------------------------ inbox (phone captures)

export async function listInbox() {
  return withFolders(async ({ inbox }) => {
    const sidecars = await list(`${quote(inbox)} in parents and trashed = false and appProperties has { key='mj' and value='capture' }`, "createdTime desc");
    const items = [];
    for (let i = 0; i < sidecars.length; i += 6) {
      const batch = await Promise.all(sidecars.slice(i, i + 6).map(async (f) => {
        try {
          const sidecar = JSON.parse(await (await downloadFile(f.id)).text());
          if (sidecar?.format !== CAPTURE_FORMAT || !sidecar.image) return null;
          let thumbnailLink;
          try { thumbnailLink = (await getFile(sidecar.image)).thumbnailLink; } catch (e) {
            if (e instanceof DriveError && e.kind === "notFound") return null; // the photo was deleted
            throw e;
          }
          return { id: sidecar.image, name: f.name.replace(/\.json$/, ".jpg"), thumbnailLink, sidecar, sidecarId: f.id, createdTime: f.createdTime };
        } catch (e) {
          if (e instanceof DriveError && e.kind !== "notFound") throw e;
          return null; // not JSON, or deleted meanwhile
        }
      }));
      items.push(...batch.filter(Boolean));
    }
    return items;
  });
}

/** Moves the photo and its sidecar (sidecar last: it lists the capture) to Inbox/Processed/. */
export async function markProcessed(item) {
  return withFolders(async ({ inbox, processed }) => {
    for (const id of [item.id, item.sidecarId]) {
      if (!id) continue;
      try {
        if ((await getFile(id)).parents?.includes(inbox)) await move(id, processed, inbox);
      } catch (e) {
        if (!(e instanceof DriveError && e.kind === "notFound")) throw e;
      }
    }
  });
}

/** Uploads one capture: the photo, then the sidecar. Idempotent: an interrupted attempt's photo is reused. */
async function sendCapture(item) {
  return withFolders(async ({ inbox }) => {
    const parts = await list(`appProperties has { key='capture' and value=${quote(item.id)} } and trashed = false`, "createdTime");
    if (parts.some((f) => f.appProperties?.role === "meta")) return;
    const s = item.sidecar;
    const label = safeName([s.strain, s.sample, s.name].filter(Boolean).join(" ") || "plate");
    const base = `${stamp(new Date(s.captured_at), true)} ${label} ${item.id.slice(0, 8)}`;
    const image = parts.find((f) => f.appProperties?.role === "image") ?? await upload(null, {
      name: `${base}.jpg`, parents: [inbox], mimeType: "image/jpeg", appProperties: { capture: item.id, role: "image" },
    }, item.blob);
    await upload(null, {
      name: `${base}.json`, parents: [inbox], mimeType: "application/json", appProperties: { capture: item.id, role: "meta", mj: "capture" },
    }, new Blob([JSON.stringify({ ...s, image: image.id })], { type: "application/json" }));
  });
}

/** Downscales a photo to a JPEG of at most MAX_SIDE px, plus a small thumbnail (data URL). */
async function prepareImage(blob) {
  let bitmap;
  try { bitmap = await createImageBitmap(blob, { imageOrientation: "from-image" }); } catch {
    return { blob, width: 0, height: 0, thumbnail: "" }; // undecodable here: upload as is
  }
  const draw = (side) => {
    const k = Math.min(1, side / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * k)), h = Math.max(1, Math.round(bitmap.height * k));
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    canvas.getContext("2d").drawImage(bitmap, 0, 0, w, h);
    return { canvas, w, h };
  };
  try {
    let out = blob;
    const big = Math.max(bitmap.width, bitmap.height) > MAX_SIDE || blob.type !== "image/jpeg";
    const { canvas, w, h } = draw(MAX_SIDE);
    if (big) out = await new Promise((r) => canvas.toBlob(r, "image/jpeg", 0.9)) || blob;
    const thumbnail = draw(THUMB_SIDE).canvas.toDataURL("image/jpeg", 0.7);
    return { blob: out, width: w, height: h, thumbnail };
  } finally {
    bitmap.close?.();
  }
}

export async function uploadCapture(blob, sidecar = {}) {
  if (!isConfigured()) throw new DriveError("config", "Google Drive is not configured in this installation of MotilityJ.");
  const id = crypto.randomUUID();
  const img = await prepareImage(blob);
  const item = {
    id, created_at: new Date().toISOString(), blob: img.blob, status: "pending", attempts: 0, error: null,
    sidecar: {
      ...sidecar, format: CAPTURE_FORMAT, version: 1, id,
      captured_at: sidecar.captured_at || new Date().toISOString(), device: sidecar.device || deviceName(),
      width: img.width, height: img.height, thumbnail: img.thumbnail,
    },
  };
  await idb("readwrite", (s) => s.put(item));
  queueChanged();
  watchOnline();
  processQueue().catch(() => {});
}

// ------------------------------------------------------------------ offline queue (IndexedDB)

let dbPromise = null;
function openDb() {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(hooks.dbName, 1);
    req.onupgradeneeded = () => req.result.createObjectStore("outbox", { keyPath: "id" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("Cannot open the browser database."));
  }).catch((e) => { dbPromise = null; throw e; });
  return dbPromise;
}

function idb(mode, fn) {
  return openDb().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction("outbox", mode);
    const req = fn(tx.objectStore("outbox"));
    tx.oncomplete = () => resolve(req.result);
    tx.onerror = () => reject(tx.error ?? req.error);
    tx.onabort = () => reject(tx.error ?? new Error("Transaction aborted."));
  }));
}

function queueChanged() { for (const cb of queueListeners) { try { cb(); } catch (e) { console.error(e); } } }

export function onQueueChange(cb) {
  queueListeners.add(cb);
  return () => queueListeners.delete(cb);
}

export async function queuedCaptures() {
  const items = await idb("readonly", (s) => s.getAll());
  return items.sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map(({ id, created_at, status: st, attempts, error, sidecar }) => ({ id, created_at, status: st, attempts, error, sidecar }));
}

export async function removeQueuedCapture(id) {
  await idb("readwrite", (s) => s.delete(id));
  queueChanged();
}

let onlineWatched = false;
function watchOnline() {
  if (onlineWatched || typeof window === "undefined") return;
  onlineWatched = true;
  window.addEventListener("online", () => { processQueue().catch(() => {}); });
}

let running = null, rerun = false;
export function processQueue() {
  if (running) { rerun = true; return running; } // e.g. a capture queued during a run: go through the queue again after it
  // Cleared outside the async body: when it returns before its first await, an inner finally would run first.
  running = (async () => {
    if (!isConnected() || !hooks.isOnline()) return;
    const items = (await idb("readonly", (s) => s.getAll())).sort((a, b) => a.created_at.localeCompare(b.created_at));
    for (const item of items) {
      if (!isConnected()) break;
      await idb("readwrite", (s) => s.put({ ...item, status: "uploading" }));
      queueChanged();
      try {
        await sendCapture(item);
        await idb("readwrite", (s) => s.delete(item.id));
      } catch (e) {
        const stop = e instanceof DriveError && (e.kind === "auth" || e.kind === "offline");
        await idb("readwrite", (s) => s.put({ ...item, status: stop ? "pending" : "error", attempts: item.attempts + 1, error: e.message || String(e) }));
        if (stop) break;
      } finally {
        queueChanged();
      }
    }
  })().finally(() => {
    running = null;
    if (rerun) { rerun = false; processQueue().catch(() => {}); }
  });
  return running;
}

// Service worker of MotilityJ web. GENERATED from tools/sw.template.js by tools/build_sw.py, which
// fills in the list of app files and a version hash of their content: run it after changing any file.
// It precaches the whole app so that it starts and analyses images offline. Each version has its own
// cache; a new version waits until the page asks it to take over ("Reload" in the app).
const VERSION = "388d2ed2c414";
const FILES = [
 "css/styles.css",
 "icons/apple-touch-icon.png",
 "icons/favicon-48.png",
 "icons/icon-192.png",
 "icons/icon-512.png",
 "icons/maskable-512.png",
 "index.html",
 "js/analysis/core.js",
 "js/analysis/eval.html",
 "js/analysis/index.js",
 "js/analysis/models.json",
 "js/analysis/worker.js",
 "js/analyze.js",
 "js/app.js",
 "js/columns.js",
 "js/config.js",
 "js/db.js",
 "js/deepmotility/analyzer.js",
 "js/deepmotility/eval.html",
 "js/deepmotility/files.js",
 "js/deepmotility/index.js",
 "js/deepmotility/review-tool.js",
 "js/deepmotility/settings-section.js",
 "js/deepmotility/strings.js",
 "js/deepmotility/worker.js",
 "js/dom.js",
 "js/drive-ui.js",
 "js/drive.js",
 "js/drive.mock-test.html",
 "js/exif.js",
 "js/export.js",
 "js/geometry.js",
 "js/i18n.js",
 "js/images.js",
 "js/measure.js",
 "js/measure.test.html",
 "js/measure.test.js",
 "js/metadata-ui.js",
 "js/metadata.js",
 "js/pages/experiment.js",
 "js/pages/experiments.js",
 "js/pages/help.js",
 "js/pages/review.js",
 "js/pages/series.js",
 "js/pages/settings.js",
 "js/pwa.js",
 "js/sam/eval.html",
 "js/sam/files.js",
 "js/sam/index.js",
 "js/sam/worker.js",
 "js/series-export.js",
 "js/series-ui.js",
 "js/series.js",
 "js/tiff.js",
 "js/ui.js",
 "js/xlsx.js",
 "manifest.webmanifest",
 "privacy.html"
];
const CACHE = `motilityj-${VERSION}`;
const scope = new URL(self.registration.scope);
const urlOf = (path) => new URL(path, scope).href;
const PRECACHED = new Set(FILES.map(urlOf));
const INDEX = urlOf("index.html");

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // Bypass the HTTP cache: GitHub Pages lets browsers reuse files for 10 minutes.
    await cache.addAll(FILES.map((f) => new Request(urlOf(f), { cache: "reload" })));
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith("motilityj-") && key !== CACHE) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

self.addEventListener("message", (event) => {
  if (event.data === "skip-waiting") self.skipWaiting();
  if (event.data === "version") event.source?.postMessage({ version: VERSION });
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== scope.origin) return;
  url.search = "";
  url.hash = "";
  // The app uses hash URLs: every page is index.html.
  const key = req.mode === "navigate" && url.href.startsWith(scope.href) ? INDEX
    : url.href === scope.href ? INDEX : PRECACHED.has(url.href) ? url.href : null;
  if (!key) return;
  event.respondWith((async () => {
    const cached = await caches.match(key, { cacheName: CACHE });
    return cached ?? fetch(req);
  })());
});

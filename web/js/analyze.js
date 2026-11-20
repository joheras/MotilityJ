// Runs the analysis module on stored images and normalises its result.
import { analyzeImage } from "./analysis/index.js";
import * as db from "./db.js";
import { polygonArea } from "./geometry.js";
import { blobToImageData } from "./images.js";
import { t } from "./i18n.js";
import { busy, idle } from "./ui.js";

const nextFrame = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));

export async function analyse(image, onProgress) {
  const data = await blobToImageData(image.blob);
  const r = await analyzeImage(data, { onProgress });
  const contour = Array.isArray(r.contour) ? r.contour.map(([x, y]) => [x, y]) : [];
  return {
    klass: r.klass === "complete" ? "complete" : "incomplete",
    confidence: Number.isFinite(r.confidence) ? r.confidence : null,
    plate: r.plate && r.plate.r > 0 ? { cx: r.plate.cx, cy: r.plate.cy, r: r.plate.r } : null,
    contour,
    areaPx: Number.isFinite(r.areaPx) ? r.areaPx : polygonArea(contour),
    edited: false,
    analysedAt: Date.now(),
  };
}

/** Analyses the images one after the other with a progress overlay; saves each result. Returns the count. */
export async function analyseImages(images) {
  let cancelled = false, n = 0;
  const errors = [];
  const cancel = () => { cancelled = true; };
  try {
    for (let i = 0; i < images.length && !cancelled; i++) {
      const img = images[i];
      const show = (f = 0, label = "") => busy(
        h2(t("analysingN", { i: i + 1, n: images.length }), img.name, label),
        (i + Math.min(1, Math.max(0, f))) / images.length, cancel);
      show();
      await nextFrame();
      try {
        img.result = await analyse(img, (f, label) => show(f, label));
        await db.putImage(img);
        n++;
      } catch (e) {
        console.error(e);
        errors.push(`${img.name}: ${e.message || e}`);
      }
    }
  } finally {
    idle();
  }
  if (images[0]) await db.touchExperiment(images[0].experimentId);
  return { n, errors, cancelled };
}

function h2(title, file, label) {
  const el = document.createElement("div");
  el.append(title);
  const d = document.createElement("div");
  d.className = "busy-detail";
  d.textContent = label ? `${file} · ${label}` : file;
  el.append(d);
  return el;
}

// Results export (CSV, Excel) and backup/restore of experiments (.motilityj.json).
import * as db from "./db.js";
import { tableRows, tidyRows } from "./columns.js";
import { t } from "./i18n.js";
import { normalizeExperiment, normalizeImage } from "./metadata.js";
import { xlsxWorkbookBlob } from "./xlsx.js";

export const BACKUP_FORMAT = "motilityj-backup";
export const BACKUP_EXT = ".motilityj.json";

export function safeFileName(name) {
  return (name || "motilityj").replace(/[\\/:*?"<>|\u0000-\u001f]+/g, "_").trim().slice(0, 120) || "motilityj";
}

export function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** The results table as shown (visible columns). */
export const resultRows = (images, exp, settings) => tableRows(images, exp, settings);

/** Tidy table of one experiment: one row per image with all metadata and measurements. */
export const tidyTable = (images, exp, settings) => tidyRows([{ exp, images }], settings);

export function csvBlob(rows) {
  const cell = (v) => {
    const s = v == null ? "" : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  // BOM so that Excel reads UTF-8 file names correctly.
  return new Blob(["﻿" + rows.map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n"], { type: "text/csv;charset=utf-8" });
}

/** Workbook with two sheets: the results as shown and the tidy data (all metadata and measurements). */
export function excelBlob(images, exp, settings) {
  const results = resultRows(images, exp, settings);
  const tidy = tidyTable(images, exp, settings);
  return xlsxWorkbookBlob([
    { name: t("sheetResults"), rows: results, widths: [36, 14, ...results[0].slice(2).map(() => 16)] },
    { name: t("sheetTidy"), rows: tidy, widths: tidy[0].map((h) => Math.max(12, Math.min(30, h.length + 2))) },
  ]);
}

// ------------------------------------------------------------------ backup
const blobToDataUrl = (blob) => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(r.result);
  r.onerror = () => reject(r.error);
  r.readAsDataURL(blob);
});

async function dataUrlToBlob(url) {
  return (await fetch(url)).blob();
}

async function experimentEntry(exp) {
  const images = await db.listImages(exp.id);
  return {
    ...exp,
    images: await Promise.all(images.map(async ({ blob, thumb, experimentId, ...rest }) => ({
      ...rest, blob: await blobToDataUrl(blob), thumb: thumb ? await blobToDataUrl(thumb) : null,
    }))),
  };
}

/** The content of a .motilityj.json file. `name` is the experiment name (single) or a generic name. */
export async function makeBackup(experiments) {
  return {
    format: BACKUP_FORMAT,
    version: 1,
    name: experiments.length === 1 ? experiments[0].name : "MotilityJ",
    exportedAt: new Date().toISOString(),
    settings: await db.getSettings(),
    experiments: await Promise.all(experiments.map(experimentEntry)),
  };
}

export async function backupBlob(experiments) {
  return new Blob([JSON.stringify(await makeBackup(experiments))], { type: "application/json" });
}

/** Adds the experiments of a backup as new experiments. Returns how many were added. */
export async function restoreBackup(data) {
  if (!data || data.format !== BACKUP_FORMAT || !Array.isArray(data.experiments)) throw new Error(t("restoreInvalid"));
  let n = 0;
  for (const e of data.experiments) {
    const now = Date.now();
    const exp = normalizeExperiment({ id: db.newId(), name: e.name || t("untitled"), created: e.created || now, updated: now, meta: e.meta });
    await db.putExperiment(exp);
    for (const im of e.images || []) {
      await db.putImage(normalizeImage({
        ...im, id: db.newId(), experimentId: exp.id,
        blob: await dataUrlToBlob(im.blob), thumb: im.thumb ? await dataUrlToBlob(im.thumb) : null,
      }));
    }
    n++;
  }
  return n;
}

export async function readJsonFile(file) {
  try {
    return JSON.parse(await file.text());
  } catch {
    throw new Error(t("restoreInvalid"));
  }
}

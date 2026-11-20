// Time series on the experiment page: the "Time series" card (list, Group as series, Detect from file
// names, kinetics export) and the dialogs shared with the series page.
import * as db from "./db.js";
import { fmtNumber, h } from "./dom.js";
import { csvBlob, download, safeFileName } from "./export.js";
import { t } from "./i18n.js";
import { DEFAULT_PARAMS, groupByFileName, orderFrames, timesFromCapture, timesFromNames } from "./series.js";
import { KINETICS_WIDTHS, kineticsRows } from "./series-export.js";
import { confirmDialog, modal, showError, toast } from "./ui.js";
import { xlsxBlob } from "./xlsx.js";

/** Map id -> hours for `images` according to a time source: "name", "capture", "interval" or "keep". */
export function timesFor(images, source, intervalH = 1) {
  if (source === "name") return timesFromNames(images);
  if (source === "capture") return timesFromCapture(images);
  if (source === "interval") {
    const sorted = images.slice().sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    return new Map(sorted.map((img, i) => [img.id, Math.round(i * intervalH * 1e4) / 1e4]));
  }
  return new Map(images.filter((i) => Number.isFinite(i.timeH)).map((i) => [i.id, i.timeH]));
}

/** Sets the times of `images` from a source and saves them; returns how many images got no time. */
export async function applyTimes(images, source, intervalH) {
  const times = timesFor(images, source, intervalH);
  let missing = 0;
  for (const img of images) {
    if (times.has(img.id)) img.timeH = times.get(img.id);
    else if (source !== "keep") { img.timeH = null; missing++; }
    await db.putImage(img);
  }
  return missing;
}

export async function createSeries(expId, name, images, source, intervalH) {
  const series = { id: db.newId(), experimentId: expId, name, created: Date.now(), params: { ...DEFAULT_PARAMS } };
  await db.putSeries(series);
  for (const img of images) img.seriesId = series.id;
  const missing = await applyTimes(images, source, intervalH);
  await db.touchExperiment(expId);
  return { series, missing };
}

/** Kinetics workbook / CSV of a list of series ([{ series, images }]). */
export function downloadKinetics(seriesList, settings, baseName, kind) {
  const rows = kineticsRows(seriesList, settings);
  const file = `${safeFileName(baseName)}-kinetics`;
  if (kind === "csv") download(csvBlob(rows), `${file}.csv`);
  else download(xlsxBlob(rows, { sheetName: t("kineticsSheet"), widths: KINETICS_WIDTHS }), `${file}.xlsx`);
}

/** A checkbox list of images (thumbnail, name, current series). Returns { el, selected() }. */
export function imagePicker(images, seriesById, { checked = () => false, urls }) {
  const boxes = images.map((img) => {
    const url = URL.createObjectURL(img.thumb || img.blob);
    urls.push(url);
    const box = h("input", { type: "checkbox", value: img.id, checked: checked(img) });
    const s = img.seriesId && seriesById.get(img.seriesId);
    return { img, box, el: h("label", { class: "pick-item" }, box, h("img", { src: url, alt: "", loading: "lazy" }),
      h("span", { class: "grow pick-name" }, img.name, s ? h("span", { class: "muted small" }, ` · ${t("inSeries", { name: s.name })}`) : null)) };
  });
  return { el: h("div", { class: "pick-list" }, boxes.map((b) => b.el)), selected: () => boxes.filter((b) => b.box.checked).map((b) => b.img) };
}

/** "Group as series" dialog: name, images and time source. Resolves to the new series or null. */
export async function groupDialog(exp, images, seriesList, preselected = []) {
  const urls = [];
  const seriesById = new Map(seriesList.map((s) => [s.id, s]));
  const picker = imagePicker(images, seriesById, { checked: (img) => preselected.includes(img.id), urls });
  const name = h("input", { value: t("defaultSeriesName", { n: seriesList.length + 1 }), required: true, maxlength: 200 });
  const interval = h("input", { type: "number", min: 0, step: "any", value: 1, class: "interval-input", "aria-label": t("intervalH") });
  const sources = [["name", t("timeFromName")], ["capture", t("timeFromCapture")], ["interval", t("timeInterval")], ["keep", t("timeKeep")]];
  const radios = sources.map(([v, label], i) => h("label", { class: "radio" },
    h("input", { type: "radio", name: "time-source", value: v, checked: i === 0 }), h("span", null, label),
    v === "interval" ? interval : null));
  const err = h("p", { class: "error", hidden: true });
  try {
    return await modal((close) => h("form", { class: "series-dialog", onsubmit: async (e) => {
      e.preventDefault();
      const chosen = picker.selected();
      if (chosen.length < 2) { err.textContent = t("selectAtLeast2"); err.hidden = false; return; }
      const source = radios.map((r) => r.querySelector("input")).find((i) => i.checked)?.value || "keep";
      try {
        const { series, missing } = await createSeries(exp.id, name.value.trim() || t("defaultSeriesName", { n: seriesList.length + 1 }), chosen, source, Number(interval.value) || 0);
        toast(t("seriesCreated", { name: series.name, n: chosen.length }), "ok");
        if (missing) toast(t("noTimesFound", { n: missing }), "error");
        close(series);
      } catch (x) { showError(x); }
    } },
    h("h2", null, t("groupAsSeries")),
    h("label", null, t("seriesName"), name),
    h("fieldset", null, h("legend", null, t("selectFrames")), picker.el),
    h("fieldset", null, h("legend", null, t("timeSource")), radios),
    err,
    h("div", { class: "actions dialog-actions" },
      h("button", { type: "button", onclick: () => close(null) }, t("cancel")),
      h("button", { type: "submit", class: "primary" }, t("groupAsSeries")))));
  } finally {
    urls.forEach(URL.revokeObjectURL);
  }
}

/** Creates one series per group of file names that differ only by a time token. Returns the count. */
export async function detectSeries(exp, images) {
  const free = images.filter((i) => !i.seriesId);
  const groups = groupByFileName(free);
  for (const g of groups) await createSeries(exp.id, g.key, g.images, "name");
  return groups.length;
}

/** The "Time series" card of the experiment page. `refresh` redraws the page. */
export async function seriesCard(exp, images, settings, refresh, urls) {
  const seriesList = await db.listSeries(exp.id);
  const members = (s) => orderFrames(images.filter((i) => i.seriesId === s.id));
  const run = (fn) => async () => { try { await fn(); } catch (e) { showError(e); } };

  const items = seriesList.map((s) => {
    const frames = members(s);
    const times = frames.map((f) => f.timeH).filter(Number.isFinite);
    const thumbs = frames.slice(0, 8).map((img) => {
      const url = URL.createObjectURL(img.thumb || img.blob);
      urls.push(url);
      return h("img", { src: url, alt: "", loading: "lazy" });
    });
    return h("li", { class: "series-item" },
      h("a", { class: "series-link", href: `#/e/${exp.id}/s/${s.id}` },
        h("span", { class: "series-thumbs" }, thumbs),
        h("span", { class: "grow" }, h("b", null, s.name), h("br"),
          h("span", { class: "muted small" }, t("nFrames", { n: frames.length }),
            times.length ? ` · ${fmtNumber(Math.min(...times), 1)}–${fmtNumber(Math.max(...times), 1)} h` : ""))),
      h("button", { class: "small ghost danger", title: t("deleteSeries"), "aria-label": t("deleteSeries"), onclick: run(async () => {
        if (await confirmDialog(t("deleteSeriesConfirm", { name: s.name }), { ok: t("deleteSeries"), danger: true })) { await db.deleteSeries(s.id); await refresh(); }
      }) }, "✕"));
  });

  const exportList = () => seriesList.map((s) => ({ series: s, images: members(s) }));
  return h("section", { class: "card series-card" },
    h("div", { class: "section-head" },
      h("div", null, h("h2", null, t("timeSeries")), h("p", { class: "muted small" }, t("timeSeriesLead"))),
      h("div", { class: "actions" },
        h("button", { disabled: images.length < 2, onclick: run(async () => {
          const s = await groupDialog(exp, images, seriesList);
          if (s) location.hash = `#/e/${exp.id}/s/${s.id}`;
        }) }, "+ ", t("groupAsSeries")),
        h("button", { disabled: images.length < 2, onclick: run(async () => {
          const n = await detectSeries(exp, images);
          toast(n ? t("seriesDetected", { n }) : t("noSeriesDetected"), n ? "ok" : "");
          if (n) await refresh();
        }) }, t("detectSeries")),
        seriesList.length ? h("button", { onclick: () => downloadKinetics(exportList(), settings, exp.name, "xlsx") }, t("kineticsExcel")) : null,
        seriesList.length ? h("button", { onclick: () => downloadKinetics(exportList(), settings, exp.name, "csv") }, t("kineticsCsv")) : null)),
    seriesList.length ? h("ul", { class: "series-list" }, items) : h("p", { class: "muted small" }, t("noSeries")));
}

// Series page: one plate photographed over time. Overlay of the outlines of every frame registered on the
// plate circle (colour ramp by time) with a time slider; area and equivalent-radius charts; expansion rate,
// lag and time to coverage; frame table with editable times; kinetics export.
import { analyseImages } from "../analyze.js";
import * as db from "../db.js";
import { fmtNumber, h, s } from "../dom.js";
import { t } from "../i18n.js";
import { applyTransform, computeKinetics, orderFrames, plateTransform, rampColor, seriesParams } from "../series.js";
import { applyTimes, downloadKinetics, imagePicker } from "../series-ui.js";
import { confirmDialog, modal, promptDialog, showError, toast } from "../ui.js";
import { classBadge } from "./experiment.js";

const num = (x, d = 2) => (x == null || !Number.isFinite(x) ? t("statNone") : fmtNumber(x, d));

export async function render(view, { expId, seriesId }, ctx) {
  const [exp, series] = await Promise.all([db.getExperiment(expId), db.getSeries(seriesId)]);
  if (!exp || !series || series.experimentId !== expId) {
    view.replaceChildren(h("div", { class: "card empty" }, h("h2", null, t("notFound")), h("a", { href: exp ? `#/e/${expId}` : "#/" }, t("back"))));
    return;
  }
  const urls = new Map(); // image id -> object URL of the stored image
  const thumbUrls = [];
  let current = -1; // index of the frame shown by the slider
  let playTimer = null;
  let showAll = true, showFrameImage = true;

  const urlOf = (img) => {
    if (!urls.has(img.id)) urls.set(img.id, URL.createObjectURL(img.blob));
    return urls.get(img.id);
  };
  const run = (fn) => async (...a) => { try { await fn(...a); } catch (e) { showError(e); } };

  async function draw() {
    stopPlay();
    const all = await db.listImages(expId);
    const frames = orderFrames(all.filter((i) => i.seriesId === series.id));
    const settings = ctx.settings;
    const params = seriesParams(series);
    const kin = computeKinetics(frames, settings, params);
    if (current < 0 || current >= frames.length) current = frames.length - 1;

    const head = h("div", { class: "page-head" },
      h("div", null, h("h1", null, series.name), h("p", { class: "muted" }, t("nFrames", { n: frames.length }), " · ", exp.name)),
      h("div", { class: "actions" },
        h("button", { onclick: () => downloadKinetics([{ series, images: frames }], settings, `${exp.name}-${series.name}`, "xlsx"), disabled: !frames.length }, t("kineticsExcel")),
        h("button", { onclick: () => downloadKinetics([{ series, images: frames }], settings, `${exp.name}-${series.name}`, "csv"), disabled: !frames.length }, t("kineticsCsv")),
        h("button", { onclick: run(async () => {
          const name = await promptDialog(t("renameSeries"), series.name, { ok: t("rename"), label: t("name") });
          if (name && name !== series.name) { series.name = name; await db.putSeries(series); await draw(); }
        }) }, t("rename")),
        h("button", { class: "danger", onclick: run(async () => {
          if (await confirmDialog(t("deleteSeriesConfirm", { name: series.name }), { ok: t("deleteSeries"), danger: true })) {
            await db.deleteSeries(series.id);
            location.hash = `#/e/${expId}`;
          }
        }) }, t("deleteSeries"))));

    const pending = frames.filter((f) => !f.result);
    const notes = [
      pending.length ? h("p", null, h("button", { class: "primary", onclick: run(async () => {
        const { n, errors } = await analyseImages(pending);
        if (n) toast(t("analysedN", { n }), "ok");
        errors.forEach((e) => toast(e, "error"));
        await draw();
      }) }, "▶ ", t("analysePending", { n: pending.length }))) : null,
      kin.skipped.length ? h("p", { class: "muted small" }, t("framesSkipped", { n: kin.skipped.length })) : null,
    ];

    view.replaceChildren(
      h("div", { class: "crumbs" }, h("a", { href: "#/" }, t("experiments")), " › ", h("a", { href: `#/e/${expId}` }, exp.name), " › ", series.name),
      head, ...notes.filter(Boolean),
      h("div", { class: "series-layout" }, overlayCard(frames, kin), statsCard(kin, params)),
      chartsCard(kin),
      framesCard(frames, kin, all));
  }

  // ---------------------------------------------------------------- overlay
  function overlayCard(frames, kin) {
    const withResult = frames.filter((f) => f.result);
    // Reference: the last frame with a detected plate (its photo is the background).
    const ref = [...frames].reverse().find((f) => f.result?.plate) || frames[frames.length - 1];
    if (!ref) return h("section", { class: "card" }, h("h2", null, t("seriesOverlay")), h("p", { class: "muted" }, t("needTwoFrames")));
    const W = ref.width, H = ref.height;
    const times = frames.map((f) => f.timeH).filter(Number.isFinite);
    const tMin = times.length ? Math.min(...times) : 0, tMax = times.length ? Math.max(...times) : 1;
    const frac = (f, i) => (Number.isFinite(f.timeH) && tMax > tMin ? (f.timeH - tMin) / (tMax - tMin) : frames.length > 1 ? i / (frames.length - 1) : 1);

    const bg = s("image", { href: urlOf(ref), x: 0, y: 0, width: W, height: H, preserveAspectRatio: "none" });
    const frameImg = s("image", { preserveAspectRatio: "none" });
    const layer = s("g");
    const svg = s("svg", { viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: "xMidYMid meet", style: `aspect-ratio: ${W} / ${H}`, role: "img", "aria-label": t("seriesOverlay") }, bg, frameImg, layer);
    const label = h("div", { class: "frame-label" });
    const warn = h("p", { class: "muted small", hidden: true }, t("notRegistered"));
    const slider = h("input", { type: "range", min: 0, max: Math.max(0, frames.length - 1), step: 1, value: current, "aria-label": t("timeH"),
      oninput: () => { current = Number(slider.value); paint(); } });
    const prev = h("button", { class: "small", "aria-label": t("previous"), onclick: () => step(-1) }, "◀");
    const next = h("button", { class: "small", "aria-label": t("next"), onclick: () => step(1) }, "▶");
    const play = h("button", { class: "small", onclick: () => (playTimer ? stopPlay() : startPlay()) }, t("play"));
    const allBox = h("input", { type: "checkbox", checked: showAll, onchange: () => { showAll = allBox.checked; paint(); } });
    const imgBox = h("input", { type: "checkbox", checked: showFrameImage, onchange: () => { showFrameImage = imgBox.checked; paint(); } });

    function step(d) {
      current = (current + d + frames.length) % frames.length;
      slider.value = current;
      paint();
    }
    function startPlay() {
      play.textContent = t("pause");
      playTimer = setInterval(() => step(1), 700);
    }
    stopPlay = () => { clearInterval(playTimer); playTimer = null; play.textContent = t("play"); };

    function paint() {
      const f = frames[current];
      const tf = plateTransform(f, ref);
      // Photo of the selected frame, registered onto the reference plate.
      if (showFrameImage && f !== ref) {
        frameImg.setAttribute("href", urlOf(f));
        frameImg.setAttribute("width", f.width);
        frameImg.setAttribute("height", f.height);
        frameImg.setAttribute("transform", `matrix(${tf.k} 0 0 ${tf.k} ${tf.tx} ${tf.ty})`);
        frameImg.removeAttribute("display");
      } else frameImg.setAttribute("display", "none");
      warn.hidden = !f.result || tf.registered;
      layer.replaceChildren();
      const u = W / 700; // stroke width in image units for a ~700 px wide view
      frames.forEach((g, i) => {
        if (!g.result || (!showAll && i !== current)) return;
        const color = rampColor(frac(g, i));
        const tg = plateTransform(g, ref);
        const later = i > current;
        const common = { fill: "none", stroke: color, "stroke-width": (i === current ? 3.2 : 1.8) * u, "stroke-linejoin": "round",
          "stroke-opacity": later ? 0.25 : 1, "stroke-dasharray": later ? `${6 * u} ${4 * u}` : null };
        if (g.result.klass === "complete" && ref.result?.plate) {
          const p = ref.result.plate;
          layer.append(s("circle", { cx: p.cx, cy: p.cy, r: p.r, ...common }));
        } else if (g.result.contour?.length) {
          layer.append(s("polygon", { points: applyTransform(g.result.contour, tg).map((q) => q.join(",")).join(" "), ...common }));
        }
      });
      const row = kin.frames.find((r) => r.image === f);
      label.replaceChildren(h("b", null, t("frameN", { i: current + 1, n: frames.length })), " · ",
        Number.isFinite(f.timeH) ? t("hUnit", { v: fmtNumber(f.timeH, 2) }) : t("statNone"), " · ", f.name,
        row ? ` · ${num(row.area)} mm²` : "");
    }
    paint();

    const legend = h("div", { class: "ramp-legend" },
      h("span", null, t("hUnit", { v: fmtNumber(tMin, 1) })),
      h("span", { class: "ramp-bar", style: { background: `linear-gradient(90deg, ${[0, 0.25, 0.5, 0.75, 1].map(rampColor).join(", ")})` } }),
      h("span", null, t("hUnit", { v: fmtNumber(tMax, 1) })));
    return h("section", { class: "card overlay-card" },
      h("h2", null, t("seriesOverlay")),
      h("div", { class: "editor series-editor" }, svg),
      label,
      h("div", { class: "slider-row" }, prev, slider, next, play),
      h("div", { class: "toggles" }, h("label", { class: "check" }, allBox, t("showAllContours")), h("label", { class: "check" }, imgBox, t("showFrameImage")), legend),
      warn,
      h("p", { class: "muted small" }, t("seriesOverlayHint")),
      withResult.length ? null : h("p", { class: "muted small" }, t("needTwoFrames")));
  }
  let stopPlay = () => {};

  // ------------------------------------------------------------------ stats
  function statsCard(kin, params) {
    const field = (key, value, placeholder) => {
      const input = h("input", { type: "number", step: "any", min: 0, value: value ?? "", placeholder,
        onchange: run(async () => {
          const v = input.value.trim() === "" ? null : Number(input.value);
          series.params = { ...seriesParams(series), [key]: Number.isFinite(v) ? v : null };
          await db.putSeries(series);
          await draw();
        }) });
      return input;
    };
    const fit = kin.fit;
    const stat = (label, value, ...details) => h("div", { class: "stat" }, h("span", { class: "muted small" }, label), h("b", null, value),
      details.filter(Boolean).map((d) => h("span", { class: "muted small" }, d)));
    const enough = kin.frames.length >= 2;
    return h("section", { class: "card stats-card" },
      h("h2", null, t("kinetics")),
      enough ? null : h("p", { class: "muted small" }, t("needTwoFrames")),
      h("div", { class: "stats" },
        stat(t("statFitArea"), fit ? `${num(fit.area.slope)} ${t("rateAreaShort")}` : t("statNone"), fit ? `${t("r2")} ${num(fit.area.r2, 3)} · n=${fit.n}` : null),
        stat(t("statFitRadius"), fit ? `${num(fit.radius.slope, 3)} ${t("rateRadiusShort")}` : t("statNone"), fit ? `${t("r2")} ${num(fit.radius.r2, 3)}` : null),
        stat(t("statMax"), kin.maxRateArea ? `${num(kin.maxRateArea.value)} ${t("rateAreaShort")}` : t("statNone"),
          kin.maxRateArea ? t("between", { a: fmtNumber(kin.maxRateArea.t0, 1), b: fmtNumber(kin.maxRateArea.t1, 1) }) : null,
          kin.maxRateRadius ? `${num(kin.maxRateRadius.value, 3)} ${t("rateRadiusShort")} · ${t("between", { a: fmtNumber(kin.maxRateRadius.t0, 1), b: fmtNumber(kin.maxRateRadius.t1, 1) })}` : null),
        stat(t("statLag"), kin.lagH == null ? t("notCovered") : t("hUnit", { v: num(kin.lagH) }), `${t("inoculumArea")}: ${num(kin.inoculumMm2)}`),
        stat(t("statCoverage"), kin.coverageH == null ? t("notCovered") : t("hUnit", { v: num(kin.coverageH) }),
          kin.firstCompleteH != null ? `${t("complete")}: ${t("hUnit", { v: num(kin.firstCompleteH) })}` : null),
        stat(t("statFinal"), kin.finalAreaMm2 == null ? t("statNone") : `${num(kin.finalAreaMm2)} mm²`, `${num(kin.finalAreaMm2 == null ? null : (100 * kin.finalAreaMm2) / kin.plateAreaMm2, 0)} %`)),
      h("div", { class: "param-grid" },
        h("label", null, `${t("fitWindow")} · ${t("fitFrom")}`, field("fitStartH", params.fitStartH, t("auto"))),
        h("label", null, t("fitTo"), field("fitEndH", params.fitEndH, t("auto"))),
        h("label", null, t("lagThreshold"), field("lagThresholdMm2", params.lagThresholdMm2, "10")),
        h("label", null, t("inoculumArea"), field("inoculumMm2", params.inoculumMm2, t("inoculumAuto")))),
      h("p", { class: "muted small" }, t("statsHelp")));
  }

  // ----------------------------------------------------------------- charts
  function chartsCard(kin) {
    if (kin.frames.length < 1) return h("section", { class: "card" }, h("h2", null, t("kinetics")), h("p", { class: "muted" }, t("needTwoFrames")));
    const fit = kin.fit;
    const markers = [];
    if (kin.lagH != null) markers.push({ x: kin.lagH, label: t("statLag") });
    if (kin.coverageH != null) markers.push({ x: kin.coverageH, label: t("statCoverage") });
    const common = { frames: kin.frames, window: fit ? [fit.t0, fit.t1] : null, markers };
    return h("section", { class: "card" },
      h("h2", null, t("kinetics")),
      h("div", { class: "charts" },
        chart({ ...common, title: t("areaVsTime"), y: (f) => f.area, yMax: kin.plateAreaMm2, fit: fit?.area, ceiling: kin.plateAreaMm2 }),
        chart({ ...common, title: t("radiusVsTime"), y: (f) => f.radius, yMax: kin.plateRadiusMm, fit: fit?.radius, ceiling: kin.plateRadiusMm })));
  }

  /** Scatter + line chart in plain SVG: frames coloured by time, hollow squares for complete frames, fit line. */
  function chart({ title, frames, y, yMax, fit, window, markers, ceiling }) {
    const Wc = 520, Hc = 300, m = { l: 56, r: 14, t: 14, b: 40 };
    const xs = frames.map((f) => f.t), ys = frames.map(y);
    let x0 = Math.min(...xs), x1 = Math.max(...xs);
    if (!(x1 > x0)) { x0 -= 1; x1 += 1; }
    const yHi = niceMax(Math.max(yMax * 0.05, ...ys) * 1.05);
    const X = (v) => m.l + ((v - x0) / (x1 - x0)) * (Wc - m.l - m.r);
    const Y = (v) => Hc - m.b - (v / yHi) * (Hc - m.t - m.b);
    const g = [], plot = []; // plot: data marks, clipped to the plot area
    const clipId = `clip-${Math.random().toString(36).slice(2)}`;
    for (const v of ticks(0, yHi, 5)) {
      g.push(s("line", { x1: m.l, x2: Wc - m.r, y1: Y(v), y2: Y(v), class: "grid" }));
      g.push(s("text", { x: m.l - 6, y: Y(v) + 4, class: "tick", "text-anchor": "end" }, fmtTick(v)));
    }
    for (const v of ticks(x0, x1, 6)) g.push(s("text", { x: X(v), y: Hc - m.b + 16, class: "tick", "text-anchor": "middle" }, fmtTick(v)));
    if (window) g.unshift(s("rect", { x: X(Math.max(x0, window[0])), y: m.t, width: Math.max(0, X(Math.min(x1, window[1])) - X(Math.max(x0, window[0]))), height: Hc - m.t - m.b, class: "fit-window" }));
    if (ceiling <= yHi) g.push(s("line", { x1: m.l, x2: Wc - m.r, y1: Y(ceiling), y2: Y(ceiling), class: "ceiling" }));
    for (const mk of markers) {
      if (mk.x < x0 || mk.x > x1) continue;
      g.push(s("line", { x1: X(mk.x), x2: X(mk.x), y1: m.t, y2: Hc - m.b, class: "marker" }, s("title", null, `${mk.label}: ${fmtNumber(mk.x, 2)} h`)));
    }
    plot.push(s("polyline", { points: frames.map((f) => `${X(f.t)},${Y(y(f))}`).join(" "), class: "series-line" }));
    if (fit && window) {
      const a = Math.max(x0, window[0]), b = Math.min(x1, window[1]);
      plot.push(s("line", { x1: X(a), y1: Y(fit.intercept + fit.slope * a), x2: X(b), y2: Y(fit.intercept + fit.slope * b), class: "fit-line" }));
    }
    g.push(s("defs", null, s("clipPath", { id: clipId }, s("rect", { x: m.l, y: m.t - 8, width: Wc - m.l - m.r + 8, height: Hc - m.t - m.b + 8 }))),
      s("g", { "clip-path": `url(#${clipId})` }, plot));
    const span = x1 - x0;
    frames.forEach((f) => {
      const c = rampColor((f.t - x0) / span), cx = X(f.t), cy = Y(y(f));
      const tip = s("title", null, `${f.image.name}: ${fmtNumber(f.t, 2)} h, ${fmtNumber(y(f), 2)}`);
      g.push(f.klass === "complete"
        ? s("rect", { x: cx - 5, y: cy - 5, width: 10, height: 10, fill: "var(--surface)", stroke: c, "stroke-width": 2.5 }, tip)
        : s("circle", { cx, cy, r: 5, fill: c, stroke: "var(--surface)", "stroke-width": 1 }, tip));
    });
    g.push(s("line", { x1: m.l, x2: m.l, y1: m.t, y2: Hc - m.b, class: "axis" }), s("line", { x1: m.l, x2: Wc - m.r, y1: Hc - m.b, y2: Hc - m.b, class: "axis" }));
    g.push(s("text", { x: (m.l + Wc - m.r) / 2, y: Hc - 6, class: "axis-label", "text-anchor": "middle" }, t("timeH")));
    return h("figure", { class: "chart" }, h("figcaption", null, title), s("svg", { viewBox: `0 0 ${Wc} ${Hc}`, role: "img", "aria-label": title }, g));
  }

  // ----------------------------------------------------------------- frames
  function framesCard(frames, kin, all) {
    const byImage = new Map(kin.frames.map((f) => [f.image, f]));
    const rows = frames.map((img, i) => {
      const k = byImage.get(img);
      const time = h("input", { type: "number", step: "any", class: "time-input", value: Number.isFinite(img.timeH) ? img.timeH : "", "aria-label": t("timeH"),
        onchange: run(async () => {
          const v = time.value.trim() === "" ? null : Number(time.value);
          img.timeH = Number.isFinite(v) ? v : null;
          await db.putImage(img);
          await draw();
        }) });
      const url = URL.createObjectURL(img.thumb || img.blob);
      thumbUrls.push(url);
      return h("tr", { class: i === current ? "current" : null },
        h("td", { class: "num" }, i + 1),
        h("td", null, h("img", { class: "row-thumb", src: url, alt: "", loading: "lazy" })),
        h("td", { class: "file-cell" }, h("a", { href: `#/e/${expId}/i/${img.id}` }, img.name)),
        h("td", { class: "num" }, time),
        h("td", null, classBadge(img.result)),
        h("td", { class: "num" }, k ? fmtNumber(k.area) : ""),
        h("td", { class: "num" }, k ? fmtNumber(k.radius) : ""),
        h("td", { class: "num" }, k?.rateArea != null ? fmtNumber(k.rateArea) : ""),
        h("td", { class: "num" }, k?.rateRadius != null ? fmtNumber(k.rateRadius, 3) : ""),
        h("td", { class: "row-actions" }, h("button", { class: "small ghost danger", title: t("removeFromSeries"), "aria-label": t("removeFromSeries"),
          onclick: run(async () => { img.seriesId = null; await db.putImage(img); await draw(); }) }, "✕")));
    });
    const setTimes = (source) => run(async () => {
      const missing = await applyTimes(frames, source);
      toast(missing ? t("noTimesFound", { n: missing }) : t("timesUpdated"), missing ? "error" : "ok");
      await draw();
    });
    const others = all.filter((i) => i.seriesId !== series.id);
    return h("section", { class: "card" },
      h("div", { class: "section-head" }, h("h2", null, t("frames")),
        h("div", { class: "actions" },
          h("button", { class: "small", onclick: setTimes("name") }, t("setTimesFromNames")),
          h("button", { class: "small", onclick: setTimes("capture") }, t("setTimesFromCapture")),
          h("button", { class: "small", disabled: !others.length, onclick: run(() => addImages(others)) }, "+ ", t("addToSeries")))),
      h("div", { class: "table-wrap" }, h("table", { class: "results frames-table" },
        h("thead", null, h("tr", null, h("th", { class: "num" }, "#"), h("th"), h("th", null, t("colFile")), h("th", { class: "num" }, t("timeH")), h("th", null, t("colClass")),
          h("th", { class: "num" }, t("colArea")), h("th", { class: "num" }, t("eqRadius")), h("th", { class: "num" }, t("rateAreaCol")), h("th", { class: "num" }, t("rateRadiusCol")), h("th"))),
        h("tbody", null, rows))));
  }

  async function addImages(others) {
    const pickUrls = [];
    const seriesById = new Map((await db.listSeries(expId)).map((x) => [x.id, x]));
    const picker = imagePicker(others, seriesById, { urls: pickUrls });
    try {
      const chosen = await modal((close) => h("form", { class: "series-dialog", onsubmit: (e) => { e.preventDefault(); close(picker.selected()); } },
        h("h2", null, t("addToSeriesTitle")), picker.el,
        h("div", { class: "actions dialog-actions" },
          h("button", { type: "button", onclick: () => close(null) }, t("cancel")),
          h("button", { type: "submit", class: "primary" }, t("addToSeries")))));
      if (!chosen?.length) return;
      for (const img of chosen) { img.seriesId = series.id; await db.putImage(img); }
      await draw();
    } finally { pickUrls.forEach(URL.revokeObjectURL); }
  }

  await draw();
  return () => {
    stopPlay();
    urls.forEach(URL.revokeObjectURL);
    thumbUrls.forEach(URL.revokeObjectURL);
  };
}

// ------------------------------------------------------------ chart helpers
function niceMax(v) {
  if (!(v > 0)) return 1;
  const p = 10 ** Math.floor(Math.log10(v)), f = v / p;
  return ([1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 7, 8, 10].find((n) => f <= n + 1e-9) || 10) * p;
}

function ticks(a, b, n) {
  const span = b - a;
  if (!(span > 0)) return [a];
  const raw = span / n, p = 10 ** Math.floor(Math.log10(raw)), f = raw / p;
  const step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p;
  const out = [];
  for (let v = Math.ceil(a / step - 1e-9) * step; v <= b + 1e-9 * span; v += step) out.push(Math.round(v / step) * step || 0); // || 0: no "-0"
  return out;
}

const fmtTick = (v) => (Math.abs(v) >= 100 ? fmtNumber(v, 0) : fmtNumber(v, Math.abs(v) >= 10 || Number.isInteger(v) ? 0 : 1));

// Image review: image with the plate circle and the growth contour; pinch-zoom and pan; class toggle;
// contour editing (drag/insert/delete vertices, freehand redraw); plate adjustment; live area; undo.
import { analyse } from "../analyze.js";
import { deepMotilityTool } from "../deepmotility/review-tool.js";
import * as db from "../db.js";
import { fmtNumber, h, s, setAttrs } from "../dom.js";
import { areaMm2, distToSegment, mmPerPx, polygonArea, simplify } from "../geometry.js";
import { t } from "../i18n.js";
import { busy, confirmDialog, idle, showError, toast } from "../ui.js";

const MODES = ["view", "vertices", "draw", "plate"];
const MODE_ICONS = { view: "✋", vertices: "◆", draw: "✎", plate: "◯" };
const clone = (x) => (x == null ? x : JSON.parse(JSON.stringify(x)));

export async function render(view, { expId, imageId }, ctx) {
  const [exp, images] = await Promise.all([db.getExperiment(expId), db.listImages(expId)]);
  const idx = images.findIndex((i) => i.id === imageId);
  if (!exp || idx < 0) {
    view.replaceChildren(h("div", { class: "card empty" }, h("h2", null, t("notFound")), h("a", { href: exp ? `#/e/${expId}` : "#/" }, t("back"))));
    return;
  }
  const img = images[idx];
  const W = img.width, H = img.height;
  const url = URL.createObjectURL(img.blob);
  let result = clone(img.result);
  let mode = "view";
  const undoStack = [];
  let vb = { x: 0, y: 0, w: W, h: H };
  let draft = null; // freehand points while drawing

  // ------------------------------------------------------------------ svg
  const imageEl = s("image", { href: url, x: 0, y: 0, width: W, height: H, preserveAspectRatio: "none" });
  const plateFill = s("circle", { class: "plate-fill" });
  const plateEl = s("circle", { class: "plate-circle", "vector-effect": "non-scaling-stroke" });
  const contourEl = s("polygon", { class: "contour", "vector-effect": "non-scaling-stroke" });
  const draftEl = s("polyline", { class: "draft", "vector-effect": "non-scaling-stroke" });
  const handles = s("g", { class: "handles" });
  const svg = s("svg", { viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: "xMidYMid meet", style: `aspect-ratio: ${W} / ${H}`, role: "img", "aria-label": img.name },
    imageEl, plateFill, contourEl, plateEl, draftEl, handles);

  const zoomIn = h("button", { title: t("zoomIn"), "aria-label": t("zoomIn"), onclick: () => zoomAt(1.6, [vb.x + vb.w / 2, vb.y + vb.h / 2]) }, "+");
  const zoomOut = h("button", { title: t("zoomOut"), "aria-label": t("zoomOut"), onclick: () => zoomAt(1 / 1.6, [vb.x + vb.w / 2, vb.y + vb.h / 2]) }, "−");
  const zoomFit = h("button", { title: t("zoomFit"), "aria-label": t("zoomFit"), onclick: () => setView({ x: 0, y: 0, w: W }) }, "⤢");
  const editor = h("div", { class: "editor" }, svg, h("div", { class: "zoom-buttons" }, zoomIn, zoomOut, zoomFit));

  const unitsPerPx = () => 1 / (svg.getScreenCTM()?.a || 1);
  const toImage = (e) => {
    const m = svg.getScreenCTM();
    if (!m) return [0, 0];
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    return [p.x, p.y];
  };

  function setView(v) {
    const w = Math.min(W, Math.max(W / 40, v.w)), hh = (w * H) / W;
    const x = Math.min(Math.max(v.x, 0), W - w), y = Math.min(Math.max(v.y, 0), H - hh);
    vb = { x, y, w, h: hh };
    svg.setAttribute("viewBox", `${x} ${y} ${w} ${hh}`);
    zoomOut.disabled = zoomFit.disabled = w >= W;
    zoomIn.disabled = w <= W / 40 + 1e-9;
    drawOverlay();
  }
  function zoomAt(f, [cx, cy]) {
    const w = Math.min(W, Math.max(W / 40, vb.w / f)), k = w / vb.w;
    setView({ x: cx - (cx - vb.x) * k, y: cy - (cy - vb.y) * k, w });
  }

  function drawOverlay() {
    const u = unitsPerPx();
    const p = result?.plate;
    setAttrs(plateEl, p ? { cx: p.cx, cy: p.cy, r: p.r, display: null } : { display: "none" });
    setAttrs(plateFill, p && result.klass === "complete" ? { cx: p.cx, cy: p.cy, r: p.r, display: null } : { display: "none" });
    const pts = result?.contour || [];
    setAttrs(contourEl, { points: pts.map((q) => q.join(",")).join(" "), display: pts.length ? null : "none", class: result?.klass === "complete" ? "contour dim" : "contour" });
    setAttrs(draftEl, { points: draft ? draft.map((q) => q.join(",")).join(" ") : "", display: draft ? null : "none" });
    handles.replaceChildren();
    const r = 5 * u;
    if (mode === "vertices") {
      for (const [x, y] of pts) handles.append(s("circle", { cx: x, cy: y, r, class: "handle", "stroke-width": 1.5 * u }));
    } else if (mode === "plate" && p) {
      handles.append(s("circle", { cx: p.cx, cy: p.cy, r: r * 1.4, class: "handle plate-handle", "stroke-width": 1.5 * u }));
      for (let a = 0; a < 4; a++) {
        handles.append(s("circle", { cx: p.cx + p.r * Math.cos(a * Math.PI / 2), cy: p.cy + p.r * Math.sin(a * Math.PI / 2), r: r * 1.4, class: "handle plate-handle", "stroke-width": 1.5 * u }));
      }
    }
  }

  // ----------------------------------------------------------- edit model
  function ensureResult() {
    if (!result) {
      const r = Math.min(W, H) * 0.45;
      result = { klass: "incomplete", confidence: null, plate: { cx: W / 2, cy: H / 2, r }, contour: [], areaPx: 0, edited: true, analysedAt: null };
    }
    if (!result.plate) result.plate = { cx: W / 2, cy: H / 2, r: Math.min(W, H) * 0.45 };
    return result;
  }
  const snapshot = () => clone(result);
  function pushUndo(snap) {
    undoStack.push(snap);
    if (undoStack.length > 50) undoStack.shift();
  }
  function changed({ contour = false } = {}) {
    result.edited = true;
    if (contour) result.areaPx = polygonArea(result.contour);
    drawOverlay();
    updatePanel();
    scheduleSave();
  }
  function undo() {
    if (!undoStack.length) return;
    result = undoStack.pop();
    drawOverlay();
    updatePanel();
    scheduleSave();
  }

  let saveTimer = null;
  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(save, 300);
    savedEl.textContent = t("saving");
  }
  async function save() {
    clearTimeout(saveTimer);
    saveTimer = null;
    img.result = clone(result);
    img.notes = notesEl.value;
    try {
      await db.putImage(img);
      await db.touchExperiment(expId);
      savedEl.textContent = t("saved");
    } catch (e) { showError(e); }
  }

  // ------------------------------------------------------------- pointers
  const pointers = new Map();
  let gesture = null;

  function startGesture(e) {
    const p = toImage(e), u = unitsPerPx();
    const tol = (e.pointerType === "touch" ? 22 : 10) * u;
    const start = { client: [e.clientX, e.clientY], vb: { ...vb }, u };
    if (mode === "vertices" && result?.contour?.length) {
      const pts = result.contour;
      let best = -1, bd = Infinity;
      pts.forEach((q, i) => { const d = Math.hypot(q[0] - p[0], q[1] - p[1]); if (d < bd) { bd = d; best = i; } });
      if (bd <= tol) return { kind: "vertex", index: best, snap: snapshot(), ...start };
      let edge = -1, ed = Infinity;
      for (let i = 0; i < pts.length; i++) {
        const d = distToSegment(p, pts[i], pts[(i + 1) % pts.length]);
        if (d < ed) { ed = d; edge = i; }
      }
      if (ed <= tol) {
        const snap = snapshot();
        pts.splice(edge + 1, 0, p);
        return { kind: "vertex", index: edge + 1, snap, inserted: true, ...start };
      }
    }
    if (mode === "draw") {
      ensureResult();
      draft = [p];
      drawOverlay();
      return { kind: "draw", ...start };
    }
    if (mode === "plate") {
      const pl = ensureResult().plate;
      const d = Math.hypot(p[0] - pl.cx, p[1] - pl.cy);
      if (Math.abs(d - pl.r) <= tol) return { kind: "radius", snap: snapshot(), ...start };
      if (d < pl.r) return { kind: "move", from: p, plate: { ...pl }, snap: snapshot(), ...start };
    }
    return { kind: "pan", ...start };
  }

  function moveGesture(e) {
    const g = gesture;
    if (g.kind === "pan") {
      setView({ x: g.vb.x - (e.clientX - g.client[0]) * g.u, y: g.vb.y - (e.clientY - g.client[1]) * g.u, w: g.vb.w });
      return;
    }
    const p = toImage(e);
    if (g.kind === "vertex") {
      result.contour[g.index] = [Math.min(Math.max(p[0], 0), W), Math.min(Math.max(p[1], 0), H)];
      result.areaPx = polygonArea(result.contour);
      g.moved = true;
      drawOverlay();
      updateArea();
    } else if (g.kind === "draw") {
      const last = draft[draft.length - 1];
      if (Math.hypot(p[0] - last[0], p[1] - last[1]) >= 2 * g.u) { draft.push(p); drawOverlay(); }
    } else if (g.kind === "radius") {
      const pl = result.plate;
      pl.r = Math.max(10, Math.hypot(p[0] - pl.cx, p[1] - pl.cy));
      g.moved = true;
      drawOverlay();
      updateArea();
    } else if (g.kind === "move") {
      result.plate.cx = g.plate.cx + p[0] - g.from[0];
      result.plate.cy = g.plate.cy + p[1] - g.from[1];
      g.moved = true;
      drawOverlay();
      updateArea();
    }
  }

  function endGesture(commit) {
    const g = gesture;
    gesture = null;
    if (!g) return;
    if (g.kind === "draw") {
      const pts = draft;
      draft = null;
      if (commit && pts && pts.length >= 3) {
        const poly = simplify(pts, 0.8 * g.u);
        if (poly.length >= 3 && polygonArea(poly) > 4) {
          pushUndo(snapshot());
          result.contour = poly;
          result.klass = "incomplete";
          changed({ contour: true });
          return;
        }
      }
      drawOverlay();
    } else if (g.snap && (g.moved || g.inserted)) {
      if (commit) {
        pushUndo(g.snap);
        changed({ contour: g.kind === "vertex" });
      } else {
        result = g.snap;
        drawOverlay();
        updatePanel();
      }
    }
  }

  svg.addEventListener("pointerdown", (e) => {
    if (e.button > 0) return;
    try { svg.setPointerCapture(e.pointerId); } catch { /* synthetic or already released pointer */ }
    pointers.set(e.pointerId, [e.clientX, e.clientY]);
    if (pointers.size === 1) {
      gesture = startGesture(e);
    } else if (pointers.size === 2) {
      // A second finger turns any gesture into pinch-zoom; a half-done edit is discarded.
      endGesture(false);
      const [a, b] = [...pointers.values()];
      const mid = { clientX: (a[0] + b[0]) / 2, clientY: (a[1] + b[1]) / 2 };
      gesture = { kind: "pinch", dist: Math.hypot(a[0] - b[0], a[1] - b[1]) || 1, anchor: toImage(mid), vb: { ...vb } };
    }
    e.preventDefault();
  });
  svg.addEventListener("pointermove", (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, [e.clientX, e.clientY]);
    if (!gesture) return;
    if (gesture.kind === "pinch") {
      if (pointers.size < 2) return;
      const [a, b] = [...pointers.values()];
      const g = gesture;
      const f = Math.hypot(a[0] - b[0], a[1] - b[1]) / g.dist;
      setView({ x: g.vb.x, y: g.vb.y, w: g.vb.w / f });
      const now = toImage({ clientX: (a[0] + b[0]) / 2, clientY: (a[1] + b[1]) / 2 });
      setView({ x: vb.x + g.anchor[0] - now[0], y: vb.y + g.anchor[1] - now[1], w: vb.w });
    } else moveGesture(e);
  });
  const up = (e, commit) => {
    if (!pointers.delete(e.pointerId)) return;
    if (gesture?.kind === "pinch") {
      if (pointers.size === 1) { // keep panning with the remaining finger
        const [[x, y]] = [...pointers.values()];
        gesture = { kind: "pan", client: [x, y], vb: { ...vb }, u: unitsPerPx() };
      } else if (!pointers.size) gesture = null;
    } else if (!pointers.size) endGesture(commit);
  };
  svg.addEventListener("pointerup", (e) => up(e, true));
  svg.addEventListener("pointercancel", (e) => up(e, false));
  svg.addEventListener("wheel", (e) => { e.preventDefault(); zoomAt(Math.exp(-e.deltaY * 0.0015), toImage(e)); }, { passive: false });
  svg.addEventListener("dblclick", (e) => {
    if (mode === "vertices" && result?.contour?.length > 3) {
      const p = toImage(e), tol = 10 * unitsPerPx();
      const i = result.contour.findIndex((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) <= tol);
      if (i >= 0) { pushUndo(snapshot()); result.contour.splice(i, 1); changed({ contour: true }); return; }
    }
    if (mode === "view") zoomAt(vb.w < W ? 1 / 2 : 2, toImage(e));
  });
  svg.addEventListener("contextmenu", (e) => e.preventDefault());

  // ---------------------------------------------------------------- panel
  const classBtns = ["complete", "incomplete"].map((k) => h("button", { type: "button", class: `class-${k}`, onclick: () => setClass(k) }, t(k)));
  const areaEl = h("div", { class: "area-value" });
  const scaleEl = h("div", { class: "muted small" });
  const statusEl = h("div", { class: "small" });
  const savedEl = h("span", { class: "muted small saved" });
  const modeBtns = MODES.map((m) => h("button", { type: "button", "data-mode": m, onclick: () => setMode(m), title: t(`mode_${m}_help`) }, MODE_ICONS[m], " ", t(`mode_${m}`)));
  const modeHelp = h("p", { class: "help" });
  const undoBtn = h("button", { onclick: undo }, "↶ ", t("undo"));
  const notesEl = h("textarea", { rows: 2, placeholder: t("notesPlaceholder"), oninput: () => scheduleSave() });
  notesEl.value = img.notes || "";

  function setClass(k) {
    if (result?.klass === k) return;
    const snap = snapshot();
    ensureResult();
    pushUndo(snap);
    result.klass = k;
    changed();
  }
  function setMode(m) {
    mode = m;
    editor.dataset.mode = m;
    drawOverlay();
    updatePanel();
  }

  function updateArea() {
    const area = result ? areaMm2({ ...img, result }, ctx.settings) : null;
    areaEl.replaceChildren(area == null ? "—" : h("span", null, fmtNumber(area), h("small", null, " mm²")));
    const k = result ? mmPerPx({ ...img, result }, ctx.settings) : null;
    scaleEl.textContent = k == null ? t("noScale")
      : ctx.settings.manualPxPerMm > 0 ? t("scaleManual", { k: fmtNumber(k, 4) })
        : t("scalePlate", { k: fmtNumber(k, 4), d: ctx.settings.plateDiameterMm });
  }
  function updatePanel() {
    classBtns.forEach((b, i) => b.classList.toggle("active", result?.klass === ["complete", "incomplete"][i]));
    modeBtns.forEach((b) => b.classList.toggle("active", b.dataset.mode === mode));
    modeHelp.textContent = t(`mode_${mode}_help`);
    undoBtn.disabled = !undoStack.length;
    statusEl.replaceChildren(!result ? h("span", { class: "badge cat-na" }, t("notAnalysed"))
      : result.edited ? h("span", { class: "auto review" }, t("editedByHand"))
        : h("span", { class: "auto" }, t("automatic"), result.confidence != null ? ` · ${t("confidence")} ${Math.round(result.confidence * 100)}%` : ""));
    navClass.replaceChildren(result ? t(result.klass) : t("pending"));
    updateArea();
  }

  async function reanalyse() {
    if (result?.edited && !(await confirmDialog(t("reanalyseConfirm"), { ok: t("reanalyse") }))) return;
    try {
      busy(t("analysing"), 0);
      const r = await analyse(img, (f, label) => busy(label ? `${t("analysing")} · ${label}` : t("analysing"), f));
      pushUndo(snapshot());
      result = r;
      drawOverlay();
      updatePanel();
      await save();
    } catch (e) { showError(e); } finally { idle(); }
  }

  const go = (j) => { if (j >= 0 && j < images.length) location.hash = `#/e/${expId}/i/${images[j].id}`; };
  const prevBtn = h("button", { onclick: () => go(idx - 1), disabled: idx === 0, "aria-label": t("previous") }, "‹ ", h("span", { class: "nav-wide" }, t("previous")));
  const nextBtn = h("button", { class: "primary", onclick: () => go(idx + 1), disabled: idx === images.length - 1, "aria-label": t("next") }, h("span", { class: "nav-wide" }, t("next")), " ›");
  const navClass = h("b");
  const nav = h("div", { class: "nav" }, prevBtn,
    h("span", { class: "nav-info" }, `${idx + 1}/${images.length}`, h("span", { class: "nav-narrow" }, " · ", navClass)),
    nextBtn);

  const dm = deepMotilityTool({ img, svg, settings: ctx.settings, getResult: () => result,
    apply: (r) => { pushUndo(snapshot()); result = r; drawOverlay(); updatePanel(); scheduleSave(); } });

  const panel = h("div", { class: "panel" },
    h("div", { class: "section-head" }, h("h2", { class: "file-title", title: img.name }, img.name), savedEl),
    statusEl,
    h("div", { class: "tabs class-tabs", role: "group", "aria-label": t("colClass") }, classBtns),
    h("div", { class: "area-box" }, h("div", { class: "muted small" }, t("growthArea")), areaEl, scaleEl),
    h("h3", null, t("edit")),
    h("div", { class: "mode-grid", role: "group" }, modeBtns),
    modeHelp,
    h("div", { class: "btn-row" }, undoBtn, h("button", { onclick: reanalyse }, "⟳ ", result ? t("reanalyse") : t("analyse"))),
    dm.element,
    h("label", null, t("colNotes"), notesEl),
    nav);

  const legend = h("div", { class: "legend" },
    h("span", null, h("i", { class: "lg-plate" }), t("legendPlate")),
    h("span", null, h("i", { class: "lg-growth" }), t("legendGrowth")));

  view.classList.add("wizard", "review");
  view.replaceChildren(
    h("div", { class: "crumbs" }, h("a", { href: "#/" }, t("experiments")), " › ", h("a", { href: `#/e/${expId}` }, exp.name), " › ", img.name),
    h("div", { class: "step-layout" }, h("div", { class: "editor-col" }, editor, legend), panel));

  const onKey = (e) => {
    if (e.target.closest?.("input, textarea, select")) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") { e.preventDefault(); undo(); }
    else if (e.key === "ArrowLeft" && e.altKey) go(idx - 1);
    else if (e.key === "ArrowRight" && e.altKey) go(idx + 1);
  };
  document.addEventListener("keydown", onKey);
  const onResize = () => drawOverlay();
  window.addEventListener("resize", onResize);

  setMode("view");
  setView(vb);
  requestAnimationFrame(drawOverlay); // handle sizes need the laid-out svg
  if (!result) toast(t("notAnalysedHint"));

  return () => {
    document.removeEventListener("keydown", onKey);
    window.removeEventListener("resize", onResize);
    if (saveTimer) save();
    URL.revokeObjectURL(url);
    dm.destroy();
  };
}

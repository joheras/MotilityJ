// "Refine with Deep-Motility" on the review page: runs the models on the current image and shows their
// outline as a dashed proposal that the user accepts (undoable, through apply()) or discards.
//
// deepMotilityTool({ img, svg, settings, getResult, apply }) -> { element, destroy }
//   img: the stored image record; svg: the editor's <svg> (image pixel coordinates);
//   getResult(): the page's current result (may be null); apply(newResult): push undo + set + redraw + save.
import { fmtNumber, h, s, setAttrs } from "../dom.js";
import { areaMm2, polygonArea } from "../geometry.js";
import { t } from "../i18n.js";
import { blobToImageData } from "../images.js";
import { busy, confirmDialog, idle, showError, toast } from "../ui.js";
import { TOTAL_BYTES, analyzeImageDM, dmSupported, isModelCached, loadModel } from "./index.js";

export const downloadMb = () => (TOTAL_BYTES / 1e6).toFixed(0);

/** Asks to download the models when they are not cached yet. Resolves false if the user declines. */
export async function ensureModel() {
  if (!(await isModelCached())) {
    if (!(await confirmDialog(t("dmDownloadConfirm", { mb: downloadMb() }), { ok: t("dmDownload") }))) return false;
  }
  busy(t("dmDownloading"), 0);
  try {
    await loadModel((f) => busy(t("dmDownloading"), f));
  } finally { idle(); }
  return true;
}

export function deepMotilityTool({ img, svg, settings, getResult, apply }) {
  const proposalEl = s("polygon", {
    fill: "rgba(255, 212, 0, 0.12)", stroke: "#ffd400", "stroke-width": 2.5, "stroke-dasharray": "7 5",
    "vector-effect": "non-scaling-stroke", "pointer-events": "none", display: "none",
  });
  svg.append(proposalEl);
  let proposal = null;

  const info = h("div", { class: "small" });
  const box = h("div", { class: "dm-proposal", style: { border: "1px dashed #c9a400", borderRadius: "8px", padding: "8px 10px", display: "none", flexDirection: "column", gap: "6px" } },
    h("b", { class: "small" }, t("dmProposal")), info,
    h("div", { class: "btn-row" },
      h("button", { class: "primary", onclick: () => accept(true) }, "✓ ", t("dmAccept")),
      h("button", { onclick: () => accept(false), title: t("dmAcceptOutlineHint") }, t("dmAcceptOutline")),
      h("button", { onclick: discard }, "✕ ", t("dmDiscard"))));
  const button = h("button", { onclick: run, title: t("dmRefineHint") }, "✦ ", t("dmRefine"));
  const element = h("div", { class: "dm-tool", style: { display: "flex", flexDirection: "column", gap: "8px" } }, button, box);
  if (!dmSupported()) { button.disabled = true; button.title = t("dmUnsupported"); }

  function show(p) {
    proposal = p;
    const pts = p?.growthContour || [];
    setAttrs(proposalEl, { points: pts.map((q) => q.join(",")).join(" "), display: pts.length ? null : "none" });
    box.style.display = p ? "flex" : "none";
    if (!p) return;
    const cur = getResult();
    const area = areaMm2({ ...img, result: { ...p, plate: cur?.plate || p.plate } }, settings);
    info.replaceChildren(...[
      h("div", null, t("dmProposalLine", { klass: t(p.klass), conf: Math.round(p.confidence * 100), area: area == null ? "—" : `${fmtNumber(area)} mm²` })),
      cur && cur.klass !== p.klass ? h("div", { class: "muted" }, t("dmProposalClassDiffers", { klass: t(p.klass) })) : null,
      pts.length ? null : h("div", { class: "muted" }, t("dmProposalEmpty"))].filter(Boolean));
  }

  async function run() {
    try {
      if (!(await ensureModel())) return;
      busy(t("dmRunning"), 0);
      const data = await blobToImageData(img.blob);
      const p = await analyzeImageDM(data, { plate: getResult()?.plate || null, onProgress: (f) => busy(t("dmRunning"), f) });
      show(p);
    } catch (e) {
      showError(e);
    } finally { idle(); }
  }

  function accept(withClass) {
    if (!proposal) return;
    const cur = getResult();
    const p = proposal, plate = cur?.plate || p.plate;
    const klass = withClass || !cur ? p.klass : cur.klass;
    const outline = p.growthContour;
    apply({
      ...(cur || {}),
      klass,
      confidence: withClass ? p.confidence : cur?.confidence ?? null,
      plate,
      contour: klass === "complete" ? [] : outline,
      areaPx: klass === "complete" ? Math.PI * plate.r * plate.r : polygonArea(outline),
      growthContour: outline,
      analyzer: "deepmotility",
      edited: !withClass, // outline only: the class is the user's
      analysedAt: Date.now(),
    });
    show(null);
    toast(t("dmAccepted"), "ok");
  }

  function discard() { show(null); }

  return { element, destroy: () => proposalEl.remove() };
}

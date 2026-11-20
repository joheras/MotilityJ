// Kinetics table of plate series for Excel and CSV: one row per frame and one summary row per series.
import { t } from "./i18n.js";
import { computeKinetics, seriesParams } from "./series.js";

const r4 = (x) => (x == null || !Number.isFinite(x) ? "" : Math.round(x * 1e4) / 1e4);

export const KINETICS_WIDTHS = [24, 10, 32, 10, 12, 12, 12, 14, 14, 12, 14, 10, 14, 10, 14, 14, 10, 14, 30];

/** seriesList: [{ series, images }] -> rows (rows[0] = header). */
export function kineticsRows(seriesList, settings) {
  const header = [t("kxSeries"), t("kxRow"), t("colFile"), t("kxTime"), t("colClass"), t("colAreaPlain"), t("kxRadius"),
    t("kxRateArea"), t("kxRateRadius"), t("kxFitWindow"), t("kxFitArea"), t("kxFitAreaR2"), t("kxFitRadius"), t("kxFitRadiusR2"),
    t("kxMaxArea"), t("kxMaxRadius"), t("kxLag"), t("kxCoverage"), t("colNotes")];
  const rows = [header];
  for (const { series, images } of seriesList) {
    const k = computeKinetics(images, settings, seriesParams(series));
    k.frames.forEach((f, i) => rows.push([series.name, i + 1, f.image.name, r4(f.t), f.klass, r4(f.area), r4(f.radius),
      r4(f.rateArea), r4(f.rateRadius), "", "", "", "", "", "", "", "", "", f.image.notes || ""]));
    for (const img of k.skipped) rows.push([series.name, "", img.name, r4(img.timeH), img.result?.klass || t("pending"), "", "", "", "", "", "", "", "", "", "", "", "", "", t("kxSkipped")]);
    rows.push([series.name, t("kxSummary"), t("nFrames", { n: k.frames.length }), "", "", r4(k.finalAreaMm2), k.finalAreaMm2 == null ? "" : r4(Math.sqrt(k.finalAreaMm2 / Math.PI)),
      "", "", k.fit ? `${r4(k.fit.t0)}–${r4(k.fit.t1)} h (n=${k.fit.n})` : "",
      r4(k.fit?.area.slope), r4(k.fit?.area.r2), r4(k.fit?.radius.slope), r4(k.fit?.radius.r2),
      r4(k.maxRateArea?.value), r4(k.maxRateRadius?.value), r4(k.lagH), r4(k.coverageH), ""]);
  }
  return rows;
}

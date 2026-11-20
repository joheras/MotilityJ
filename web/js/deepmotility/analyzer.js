// Hook for js/analyze.js: when Settings choose Deep-Motility as the default analyzer and its models are
// downloaded, analyse with it; otherwise return null so that the built-in analyzer runs.
import * as db from "../db.js";
import { t } from "../i18n.js";
import { toast } from "../ui.js";
import { analyzeImageDM, isModelCached } from "./index.js";

let warned = false;

export async function analyzeWithDeepMotility(imageData, onProgress) {
  const st = await db.getSettings().catch(() => null);
  if (st?.analyzer !== "deepmotility") return null;
  if (!(await isModelCached())) {
    if (!warned) { warned = true; toast(t("dmFallback")); }
    return null;
  }
  try {
    return await analyzeImageDM(imageData, { onProgress });
  } catch (e) {
    console.error(e);
    toast(t("dmFailed", { msg: e.message || e }), "error");
    return null;
  }
}

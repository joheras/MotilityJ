// Shortcut from the isolate profiles to the experiment page: opens it with some images selected and the
// bulk-edit dialog open (e.g. the images without a strain or an assay type).
const SHORTCUT = "motilityj.bulkEdit";

export function bulkEditShortcut(expId, imageIds) {
  try { sessionStorage.setItem(SHORTCUT, JSON.stringify({ expId, imageIds })); } catch { /* still opens the page */ }
  location.hash = `#/e/${expId}`;
}

/** Image ids to select and bulk-edit on the experiment page, once (null when there is no pending shortcut). */
export function takeBulkEditShortcut(expId) {
  try {
    const v = JSON.parse(sessionStorage.getItem(SHORTCUT) || "null");
    sessionStorage.removeItem(SHORTCUT);
    return v?.expId === expId && Array.isArray(v.imageIds) ? v.imageIds : null;
  } catch { return null; }
}

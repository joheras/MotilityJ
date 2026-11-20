// Shared UI pieces: busy overlay with progress, toasts, dialogs (confirm, prompt, choose), file pickers.
import { h } from "./dom.js";
import { t } from "./i18n.js";

// -------------------------------------------------------------------- busy
let busyEl = null;
export function busy(label, fraction = null, onCancel = null) {
  if (!busyEl) {
    busyEl = h("div", { class: "busy", role: "status", "aria-live": "polite" });
    document.body.append(busyEl);
  }
  busyEl.replaceChildren(
    h("div", { class: "spinner" }),
    h("div", { class: "busy-label" }, label),
    fraction == null ? null : h("div", { class: "progress" }, h("span", { style: { width: `${Math.round(fraction * 100)}%` } })),
    onCancel ? h("button", { class: "small", onclick: onCancel }, t("cancel")) : null,
  );
}
export function idle() { busyEl?.remove(); busyEl = null; }

// ------------------------------------------------------------------- toast
export function toast(message, kind = "") {
  let box = document.querySelector(".toasts");
  if (!box) { box = h("div", { class: "toasts", role: "status", "aria-live": "polite" }); document.body.append(box); }
  const el = h("div", { class: ["toast", kind] }, message);
  box.append(el);
  setTimeout(() => el.remove(), kind === "error" ? 7000 : 3500);
}

export function showError(e) {
  console.error(e);
  toast(e?.message || String(e), "error");
}

// ----------------------------------------------------------------- dialogs
function modal(build) {
  return new Promise((resolve) => {
    const dlg = h("dialog", { class: "dialog" });
    const close = (v) => { dlg.close(); dlg.remove(); resolve(v); };
    dlg.addEventListener("cancel", (e) => { e.preventDefault(); close(null); });
    dlg.append(build(close));
    document.body.append(dlg);
    dlg.showModal();
    dlg.querySelector("[autofocus]")?.focus();
  });
}

export function confirmDialog(message, { ok = t("ok"), danger = false, title = null } = {}) {
  return modal((close) => h("form", { method: "dialog", onsubmit: (e) => { e.preventDefault(); close(true); } },
    title && h("h2", null, title),
    h("p", null, message),
    h("div", { class: "actions dialog-actions" },
      h("button", { type: "button", onclick: () => close(false) }, t("cancel")),
      h("button", { type: "submit", class: danger ? "primary danger-fill" : "primary", autofocus: true }, ok)),
  )).then(Boolean);
}

export function promptDialog(title, value = "", { ok = t("ok"), label = "" } = {}) {
  const input = h("input", { value, required: true, maxlength: 200, autofocus: true });
  return modal((close) => h("form", { onsubmit: (e) => { e.preventDefault(); const v = input.value.trim(); if (v) close(v); } },
    h("h2", null, title),
    label ? h("label", null, label, input) : input,
    h("div", { class: "actions dialog-actions" },
      h("button", { type: "button", onclick: () => close(null) }, t("cancel")),
      h("button", { type: "submit", class: "primary" }, ok)),
  ));
}

/** items: [{ value, label, detail? }] -> chosen value or null. */
export function chooseDialog(title, items, { empty = "" } = {}) {
  return modal((close) => h("div", null,
    h("h2", null, title),
    items.length
      ? h("div", { class: "choose-list" }, items.map((it) =>
        h("button", { class: "choose-item", onclick: () => close(it.value) }, h("span", { class: "grow" }, it.label), it.detail && h("span", { class: "muted small" }, it.detail))))
      : h("p", { class: "muted" }, empty),
    h("div", { class: "actions dialog-actions" }, h("button", { onclick: () => close(null) }, t("cancel"))),
  ));
}

/** A label styled as a button that opens a file chooser. */
export function fileButton(text, { accept, multiple = false, capture = null, className = "button", onFiles }) {
  const input = h("input", { type: "file", accept, multiple, capture: capture || null,
    onchange: () => { const files = [...input.files]; input.value = ""; if (files.length) onFiles(files); } });
  return h("label", { class: ["file-button", className] }, input, text);
}

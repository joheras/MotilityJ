// Installable app: service worker registration, "update available" and "install" state, persistent storage.

const state = { waiting: null, installPrompt: null };
const listeners = new Set();
const changed = () => listeners.forEach((fn) => fn());

export function onPwaChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
export const canInstall = () => !!state.installPrompt;
export const updateAvailable = () => !!state.waiting;

export function registerServiceWorker() {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); // offered from the top bar and the Help page instead
    state.installPrompt = e;
    changed();
  });
  window.addEventListener("appinstalled", () => {
    state.installPrompt = null;
    changed();
    navigator.storage?.persist?.().catch(() => undefined);
  });
  if (!("serviceWorker" in navigator)) return;
  const register = async () => {
    let reg;
    try {
      reg = await navigator.serviceWorker.register("./sw.js", { scope: "./" });
    } catch (e) {
      console.warn("Service worker not registered:", e);
      return;
    }
    const track = (sw) => {
      if (!sw) return;
      const check = () => {
        // A new version is installed while an older one controls the page.
        if (sw.state === "installed" && navigator.serviceWorker.controller) { state.waiting = sw; changed(); }
      };
      check();
      sw.addEventListener("statechange", check);
    };
    track(reg.waiting);
    track(reg.installing);
    reg.addEventListener("updatefound", () => track(reg.installing));
    // Installed apps can stay open for days: look for updates when they come back to the front.
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") reg.update().catch(() => undefined);
    });
  };
  if (document.readyState === "complete") register();
  else window.addEventListener("load", register);
}

/** Activates the waiting version and reloads the page when it has taken over. */
export function applyUpdate() {
  const sw = state.waiting;
  if (!sw) return location.reload();
  navigator.serviceWorker.addEventListener("controllerchange", () => location.reload(), { once: true });
  sw.postMessage("skip-waiting");
}

export async function promptInstall() {
  const e = state.installPrompt;
  if (!e) return;
  await e.prompt();
  await e.userChoice.catch(() => undefined);
  state.installPrompt = null;
  changed();
}

export const isStandalone = () =>
  matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;

/** Whether the browser has promised not to evict the data (null: unknown). */
export async function isPersisted() {
  try { return navigator.storage?.persisted ? await navigator.storage.persisted() : null; } catch { return null; }
}
export async function requestPersistence() {
  try { return navigator.storage?.persist ? await navigator.storage.persist() : false; } catch { return false; }
}

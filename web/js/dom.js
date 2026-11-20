// Tiny DOM helpers: h() builds HTML elements, s() SVG elements.
// props: class, style (object or string), on<Event> handlers, dataset, any other attribute or property.

const SVG_NS = "http://www.w3.org/2000/svg";

function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false || c === true) continue;
    el.append(c instanceof Node ? c : String(c));
  }
}

function setProps(el, props, svg) {
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === "class") el.setAttribute("class", Array.isArray(v) ? v.filter(Boolean).join(" ") : v);
    else if (k === "style" && typeof v === "object") Object.assign(el.style, v);
    else if (k === "dataset") Object.assign(el.dataset, v);
    else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === "html") el.innerHTML = v;
    else if (!svg && k in el && typeof v !== "string") el[k] = v;
    else if (!svg && (k === "value" || k === "checked" || k === "disabled")) el[k] = v;
    else el.setAttribute(k, v === true ? "" : v);
  }
}

export function h(tag, props, ...children) {
  const el = document.createElement(tag);
  setProps(el, props, false);
  append(el, children);
  return el;
}

export function s(tag, props, ...children) {
  const el = document.createElementNS(SVG_NS, tag);
  setProps(el, props, true);
  append(el, children);
  return el;
}

export function setAttrs(el, attrs) {
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) el.removeAttribute(k);
    else el.setAttribute(k, v);
  }
}

export function clear(el) { while (el.firstChild) el.firstChild.remove(); return el; }

export function fmtNumber(x, digits = 2) {
  return x == null || !Number.isFinite(x) ? "" : x.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function fmtDate(ms) {
  return ms ? new Date(ms).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "";
}

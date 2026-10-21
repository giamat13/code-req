// DOM helpers. Nodes are built from objects and children, never from markup strings, so user data
// cannot become HTML. Text children are inserted as text nodes.

const SVG_NS = "http://www.w3.org/2000/svg";
const PROPERTY_ATTRS = new Set([
  "value",
  "checked",
  "disabled",
  "selected",
  "hidden",
  "required",
  "readOnly",
]);

function applyProps(node, props = {}) {
  for (const [key, value] of Object.entries(props)) {
    if (value === null || value === undefined) continue;
    // false removes a boolean attribute. aria-* keep the string "false", which assistive technology needs.
    if (value === false && !key.startsWith("aria-")) continue;
    if (key === "text") node.textContent = value;
    else if (key === "dataset") Object.assign(node.dataset, value);
    else if (key.startsWith("on") && typeof value === "function")
      node.addEventListener(key.slice(2), value);
    else if (PROPERTY_ATTRS.has(key) && key in node) node[key] = value;
    else if (value === true) node.setAttribute(key, key.startsWith("aria-") ? "true" : "");
    else node.setAttribute(key, String(value));
  }
}

function appendChildren(node, children) {
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
}

export function h(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  applyProps(node, props);
  appendChildren(node, children);
  return node;
}

export function svg(tag, props = {}, ...children) {
  const node = document.createElementNS(SVG_NS, tag);
  applyProps(node, props);
  appendChildren(node, children);
  return node;
}

export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

export function clear(node) {
  node.replaceChildren();
}

export function setBusy(control, busy) {
  control.disabled = busy;
  if (busy) control.setAttribute("aria-busy", "true");
  else control.removeAttribute("aria-busy");
}

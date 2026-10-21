import { LIMITS } from "./constants.js";

// Passed to DOMPurify. It removes script, event handlers, and references that can run code.
export const SANITIZE_OPTIONS = Object.freeze({
  USE_PROFILES: { svg: true, svgFilters: true },
  FORBID_TAGS: ["script", "foreignObject", "use", "animate", "set", "iframe", "embed", "object"],
});

// XML declarations, comments, and DOCTYPE declarations may appear before the root element.
// The DOCTYPE is dropped entirely, so no entity definitions reach the parser.
const PROLOG_PATTERN = /^(\s*(<\?xml[^>]*\?>|<!--[\s\S]*?-->|<!DOCTYPE[^>]*>))+/i;

export function byteLength(text) {
  return new TextEncoder().encode(text).length;
}

export function checkSvgSource(text) {
  const source = String(text ?? "").trim();
  if (source === "") return { ok: false, error: { key: "errors.svg.empty" }, source: null };
  if (byteLength(source) > LIMITS.svgBytes) {
    return {
      ok: false,
      error: { key: "errors.svg.tooLarge", params: { kb: LIMITS.svgBytes / 1000 } },
      source: null,
    };
  }
  const body = source.replace(PROLOG_PATTERN, "").trimStart();
  if (!/^<svg[\s>]/i.test(body))
    return { ok: false, error: { key: "errors.svg.notSvg" }, source: null };
  return { ok: true, error: null, source: body };
}

export function sanitizeSvg(source, purifier) {
  const clean = purifier.sanitize(source, SANITIZE_OPTIONS);
  return typeof clean === "string" ? clean.trim() : "";
}

export function isWellFormedSvg(markup, parser) {
  if (!/^<svg[\s>]/i.test(markup)) return false;
  const doc = parser.parseFromString(markup, "image/svg+xml");
  if (doc.getElementsByTagNameNS("*", "parsererror").length > 0) return false;
  return doc.documentElement?.localName === "svg";
}

// Checks, sanitizes, and re-parses an SVG. The result is the markup to store, or an error key.
export function prepareSvg(text, { purifier, parser }) {
  const checked = checkSvgSource(text);
  if (!checked.ok) return { ok: false, error: checked.error, svg: null };
  const svg = sanitizeSvg(checked.source, purifier);
  if (!isWellFormedSvg(svg, parser))
    return { ok: false, error: { key: "errors.svg.invalid" }, svg: null };
  return { ok: true, error: null, svg };
}

// Renders stored markup as an image. Scripts in an image never run, and the page never parses the markup.
export function svgDataUri(svg) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

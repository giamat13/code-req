import { storage } from "./storage.js";

export const SUPPORTED_LOCALES = Object.freeze(["en", "he"]);
export const RTL_LOCALES = Object.freeze(["he", "ar"]);
const STORAGE_KEY = "apprequest.locale";

let locale = "en";
let dictionary = {};
let fallbackDictionary = {};

// Pure function, so the tests can call it without a browser. Plural forms are looked up as
// "key.one", "key.two", and so on. When a form is missing, "key.other" and then "key" are used.
export function translate(dict, fallbackDict, lang, key, params = {}) {
  let template;
  if (typeof params.count === "number") {
    const form = new Intl.PluralRules(lang).select(params.count);
    template =
      dict[`${key}.${form}`] ??
      dict[`${key}.other`] ??
      fallbackDict[`${key}.${form}`] ??
      fallbackDict[`${key}.other`];
  }
  template ??= dict[key] ?? fallbackDict[key];
  if (template === undefined) return key;
  return template.replace(/\{(\w+)\}/g, (match, name) =>
    name in params ? String(params[name]) : match,
  );
}

export function t(key, params = {}) {
  return translate(dictionary, fallbackDictionary, locale, key, params);
}

export function currentLocale() {
  return locale;
}

export function isRtl() {
  return RTL_LOCALES.includes(locale);
}

async function loadLocale(code) {
  const response = await fetch(new URL(`../../locales/${code}.json`, import.meta.url));
  if (!response.ok) throw new Error(`Cannot load the ${code} translations (${response.status}).`);
  return response.json();
}

function applyDocumentLocale() {
  document.documentElement.lang = locale;
  document.documentElement.dir = isRtl() ? "rtl" : "ltr";
}

export async function initI18n() {
  const saved = storage.get(STORAGE_KEY);
  const browser = (navigator.language ?? "en").slice(0, 2).toLowerCase();
  const chosen = SUPPORTED_LOCALES.includes(saved)
    ? saved
    : SUPPORTED_LOCALES.includes(browser)
      ? browser
      : "en";
  fallbackDictionary = await loadLocale("en");
  dictionary = chosen === "en" ? fallbackDictionary : await loadLocale(chosen);
  locale = chosen;
  applyDocumentLocale();
}

// Pages reload after a language change, so every string is rendered in the new language.
export function saveLocale(code) {
  if (SUPPORTED_LOCALES.includes(code)) storage.set(STORAGE_KEY, code);
}

// Fills elements marked with data-i18n (text) and data-i18n-attr="attribute:key;attribute:key" (attributes).
export function applyTranslations(root = document) {
  for (const node of root.querySelectorAll("[data-i18n]")) {
    node.textContent = t(node.dataset.i18n);
  }
  for (const node of root.querySelectorAll("[data-i18n-attr]")) {
    for (const pair of node.dataset.i18nAttr.split(";")) {
      const [attribute, key] = pair.split(":").map((part) => part.trim());
      if (attribute && key) node.setAttribute(attribute, t(key));
    }
  }
}

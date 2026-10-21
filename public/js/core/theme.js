import { storage } from "./storage.js";

export const THEMES = Object.freeze(["system", "light", "dark"]);
const STORAGE_KEY = "apprequest.theme";

export function getTheme() {
  const saved = storage.get(STORAGE_KEY);
  return THEMES.includes(saved) ? saved : "system";
}

// "system" removes the attribute, so the CSS media query decides the colors.
export function applyTheme(mode) {
  const root = document.documentElement;
  if (mode === "system") root.removeAttribute("data-theme");
  else root.dataset.theme = mode;
}

export function setTheme(mode) {
  if (!THEMES.includes(mode)) return;
  storage.set(STORAGE_KEY, mode);
  applyTheme(mode);
}

export function nextTheme(mode) {
  return THEMES[(THEMES.indexOf(mode) + 1) % THEMES.length];
}

export function initTheme() {
  applyTheme(getTheme());
}

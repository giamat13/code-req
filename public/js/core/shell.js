import { icon } from "./icons.js";
import { h } from "./dom.js";
import { applyTheme, getTheme, nextTheme, setTheme, THEMES } from "./theme.js";
import { currentLocale, saveLocale, SUPPORTED_LOCALES, t } from "./i18n.js";
import { isConfigured } from "./config.js";

const LANGUAGE_NAMES = Object.freeze({ en: "English", he: "עברית" });

function wireTheme() {
  const button = document.getElementById("theme-toggle");
  if (!button) return;

  const render = (mode) => {
    button.replaceChildren(
      icon(mode === "dark" ? "moon" : mode === "light" ? "sun" : "monitor", { size: 20 }),
    );
    button.setAttribute("aria-label", t("theme.toggleLabel", { mode: t(`theme.${mode}`) }));
    button.title = t(`theme.${mode}`);
  };

  let mode = getTheme();
  render(mode);
  button.addEventListener("click", () => {
    mode = nextTheme(mode);
    setTheme(mode);
    render(mode);
  });
  // Keeps the icon in sync when another tab changes the theme.
  window.addEventListener("storage", (event) => {
    if (event.key === "apprequest.theme" && THEMES.includes(event.newValue)) {
      mode = event.newValue;
      applyTheme(mode);
      render(mode);
    }
  });
}

function wireLanguage() {
  const select = document.getElementById("language-select");
  if (!select) return;
  select.replaceChildren(
    ...SUPPORTED_LOCALES.map((code) =>
      h(
        "option",
        { value: code, selected: code === currentLocale(), lang: code },
        LANGUAGE_NAMES[code],
      ),
    ),
  );
  select.addEventListener("change", () => {
    saveLocale(select.value);
    // Pages render strings once at load, so a reload is the simplest way to switch languages.
    location.reload();
  });
}

function wireNavigation() {
  const toggle = document.getElementById("nav-toggle");
  const nav = document.getElementById("site-nav");
  if (toggle && nav) {
    toggle.addEventListener("click", () => {
      const open = toggle.getAttribute("aria-expanded") !== "true";
      toggle.setAttribute("aria-expanded", String(open));
      nav.dataset.open = String(open);
    });
  }

  const current = location.pathname.split("/").pop() || "index.html";
  for (const link of document.querySelectorAll("[data-nav]")) {
    if (link.getAttribute("href")?.split("?")[0] === current)
      link.setAttribute("aria-current", "page");
  }
}

function wireFooter() {
  const year = document.getElementById("year");
  if (year) year.textContent = String(new Date().getFullYear());

  const notice = document.getElementById("setup-notice");
  if (notice && !isConfigured) notice.hidden = false;
}

export function initShell() {
  wireTheme();
  wireLanguage();
  wireNavigation();
  wireFooter();
}

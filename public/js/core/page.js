import { applyTranslations, initI18n } from "./i18n.js";
import { initShell } from "./shell.js";
import { initTheme } from "./theme.js";

// Every page starts the same way: theme, translations, shared chrome, then page-specific code.
export async function startPage(init) {
  initTheme();
  await initI18n();
  applyTranslations(document);
  initShell();
  await init?.();
}

// Shows a message in a page's status region and makes it visible to screen readers.
export function setStatus(node, message, { error = false } = {}) {
  node.textContent = message;
  node.dataset.state = error ? "error" : "ok";
  node.hidden = !message;
}

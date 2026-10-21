import { h } from "./dom.js";
import { icon } from "./icons.js";
import { t } from "./i18n.js";

const DEFAULT_TIMEOUT_MS = 4000;
const LEAVE_MS = 180;

function region() {
  let node = document.getElementById("toast-region");
  if (!node) {
    node = h("div", { id: "toast-region", class: "toast-region", "aria-live": "polite" });
    document.body.append(node);
  }
  return node;
}

// Errors use role="alert" so screen readers interrupt. Other messages wait for a pause.
export function toast(message, { type = "info", timeout = DEFAULT_TIMEOUT_MS } = {}) {
  let timer = null;
  const item = h(
    "div",
    { class: `toast toast-${type}`, role: type === "error" ? "alert" : "status" },
    h("span", { class: "toast-text" }, message),
    h(
      "button",
      {
        type: "button",
        class: "icon-button toast-close",
        "aria-label": t("common.dismiss"),
        onclick: () => dismiss(),
      },
      icon("x", { size: 16 }),
    ),
  );

  const pause = () => clearTimeout(timer);
  const resume = () => {
    pause();
    timer = setTimeout(dismiss, timeout);
  };
  function dismiss() {
    pause();
    item.classList.add("is-leaving");
    setTimeout(() => item.remove(), LEAVE_MS);
  }

  item.addEventListener("mouseenter", pause);
  item.addEventListener("focusin", pause);
  item.addEventListener("mouseleave", resume);
  item.addEventListener("focusout", resume);
  region().append(item);
  resume();
  return item;
}

import { h } from "../core/dom.js";
import { icon } from "../core/icons.js";
import { t } from "../core/i18n.js";
import { PLATFORMS } from "../domain/constants.js";

// Presentational helpers shared by the pages.

// Built-in platforms are translated. Names a developer wrote are shown as they are.
export function platformLabel(value) {
  return PLATFORMS.includes(value) ? t(`platform.${value}`) : value;
}

export function avatar({ src = null, name = "", size = "md" }) {
  if (src) {
    return h("img", {
      class: `avatar avatar-${size}`,
      src,
      alt: "",
      loading: "lazy",
      referrerpolicy: "no-referrer",
    });
  }
  const initials = String(name)
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
  return h(
    "span",
    { class: `avatar avatar-${size} avatar-initials`, "aria-hidden": "true" },
    initials || "?",
  );
}

const STATUS_ICONS = {
  new: "inbox",
  in_progress: "clock",
  done: "check",
  declined: "x",
  cancelled: "x",
};

// Color is never the only signal: each status also has an icon and a text label.
export function statusBadge(status) {
  return h(
    "span",
    { class: `badge badge-${status}` },
    icon(STATUS_ICONS[status] ?? "alert", { size: 14 }),
    t(`status.${status}`),
  );
}

export function platformChips(platforms) {
  return h(
    "ul",
    { class: "chip-list", "aria-label": t("common.platforms") },
    platforms.map((platform) => h("li", { class: "chip" }, platformLabel(platform))),
  );
}

export function emptyState({ iconName = "inbox", title, body = null, action = null }) {
  return h(
    "div",
    { class: "empty-state" },
    h("span", { class: "empty-icon" }, icon(iconName, { size: 32 })),
    h("h3", { class: "empty-title" }, title),
    body ? h("p", { class: "empty-body" }, body) : null,
    action,
  );
}

export function skeletonRows(count = 3) {
  return Array.from({ length: count }, () =>
    h("div", { class: "skeleton", "aria-hidden": "true" }),
  );
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Older browsers and some embedded views refuse the async clipboard API.
    const field = h("textarea", { class: "visually-hidden", value: text });
    document.body.append(field);
    field.select();
    const copied = document.execCommand("copy");
    field.remove();
    return copied;
  }
}

export function copyButton({ getText, label, className = "btn btn-secondary btn-sm" }) {
  const text = h("span", {}, label);
  const button = h(
    "button",
    { type: "button", class: className },
    icon("copy", { size: 16 }),
    text,
  );
  button.addEventListener("click", async () => {
    const copied = await copyText(getText());
    text.textContent = copied ? t("common.copied") : t("common.copyFailed");
    setTimeout(() => {
      text.textContent = label;
    }, 1500);
  });
  return button;
}

export function linkButton({
  href,
  label,
  className = "btn btn-secondary btn-sm",
  external = false,
}) {
  return h(
    "a",
    {
      class: className,
      href,
      ...(external ? { target: "_blank", rel: "noopener noreferrer" } : {}),
    },
    label,
  );
}

export function definitionList(items) {
  return h(
    "dl",
    { class: "details-list" },
    items
      .filter((item) => item.value !== null && item.value !== undefined && item.value !== "")
      .flatMap((item) => [h("dt", {}, item.label), h("dd", {}, item.value)]),
  );
}

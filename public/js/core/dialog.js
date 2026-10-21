import { h } from "./dom.js";
import { icon } from "./icons.js";
import { t } from "./i18n.js";

let counter = 0;

// A native <dialog> gives focus trapping and Escape handling for free. Focus returns to the element
// that opened the dialog. The result promise resolves with the value of the action that closed it.
// Actions with onClick(dialog) returning false stay open, which is useful for forms that validate first.
export function showDialog({ title, content, actions = [], size = "md" }) {
  const returnFocus = document.activeElement;
  counter += 1;
  const titleId = `dialog-title-${counter}`;

  const dialog = h(
    "dialog",
    { class: `dialog dialog-${size}`, "aria-labelledby": titleId },
    h(
      "header",
      { class: "dialog-header" },
      h("h2", { id: titleId, class: "dialog-title" }, title),
      h(
        "button",
        {
          type: "button",
          class: "icon-button",
          "aria-label": t("common.close"),
          onclick: () => dialog.close("cancel"),
        },
        icon("x"),
      ),
    ),
    h("div", { class: "dialog-body" }, content),
    actions.length > 0
      ? h(
          "footer",
          { class: "dialog-actions" },
          actions.map((action) =>
            h(
              "button",
              {
                type: "button",
                class: `btn btn-${action.variant ?? "secondary"}`,
                onclick: () => {
                  if (action.onClick && action.onClick(dialog) === false) return;
                  dialog.close(action.value ?? "confirm");
                },
              },
              action.label,
            ),
          ),
        )
      : null,
  );

  document.body.append(dialog);
  const result = new Promise((resolve) => {
    dialog.addEventListener(
      "close",
      () => {
        resolve(dialog.returnValue);
        dialog.remove();
        returnFocus?.focus?.();
      },
      { once: true },
    );
  });
  dialog.showModal();
  return { dialog, result };
}

export async function confirmDialog({ title, message, confirmLabel, danger = false }) {
  const { result } = showDialog({
    title,
    size: "sm",
    content: h("p", {}, message),
    actions: [
      { label: t("common.cancel"), value: "cancel" },
      { label: confirmLabel, value: "confirm", variant: danger ? "danger" : "primary" },
    ],
  });
  return (await result) === "confirm";
}

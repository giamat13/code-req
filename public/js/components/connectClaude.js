import { h } from "../core/dom.js";
import { connectorUrl } from "../core/config.js";
import { t } from "../core/i18n.js";
import { copyButton } from "./ui.js";

// The personal link carries the signed-in user's refresh token, so the connector can act as them and
// firestore.rules still apply. It is built only when the user asks, and never stored or sent anywhere here.
function personalLink(user) {
  const base = connectorUrl.replace(/\/$/, "");
  return `${base}/mcp?key=${encodeURIComponent(user.refreshToken)}`;
}

export function renderConnectClaude(container, user) {
  if (connectorUrl.startsWith("REPLACE_WITH_")) {
    container.replaceChildren();
    container.hidden = true;
    return;
  }
  container.hidden = false;
  const output = h("div", { class: "link-row" });
  const create = h(
    "button",
    { type: "button", class: "btn btn-secondary btn-sm" },
    t("connect.create"),
  );
  create.addEventListener("click", () => {
    const link = personalLink(user);
    output.replaceChildren(
      h("input", {
        class: "tracking-input",
        dir: "ltr",
        readonly: true,
        value: link,
        "aria-label": t("connect.title"),
      }),
      copyButton({ getText: () => link, label: t("common.copyLink") }),
    );
    create.hidden = true;
  });
  container.replaceChildren(
    h("p", { class: "link-label" }, t("connect.title")),
    h("p", { class: "muted" }, t("connect.body")),
    create,
    output,
    h("p", { class: "field-help" }, t("connect.warning")),
  );
}

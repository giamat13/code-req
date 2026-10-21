import { h } from "../core/dom.js";
import { formatDate } from "../core/format.js";
import { icon } from "../core/icons.js";
import { t } from "../core/i18n.js";

// Field labels for edit notices in the thread.
export const FIELD_LABELS = {
  requesterName: "form.requesterName",
  title: "form.title",
  appName: "form.appName",
  appDescription: "form.appDescription",
  platforms: "form.platforms",
  svgIcon: "form.svgLabel",
  notes: "form.notes",
  template: "form.template",
  budgetRange: "form.budget",
  deadline: "form.deadline",
};

function noticeText(message) {
  if (message.kind === "edit") {
    const fields = (message.body ?? "")
      .split(",")
      .filter(Boolean)
      .map((field) => t(FIELD_LABELS[field] ?? "form.title"));
    return t("thread.noticeEdit", { fields: fields.join(", ") });
  }
  if (message.kind === "contact") return t("thread.noticeContact");
  return null;
}

// viewer is "requester" or "developer". The viewer's own messages align to the end.
export function renderThread(list, messages, viewer) {
  const nearBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 80;
  const previous = Number(list.dataset.count ?? 0);

  if (messages.length === 0) {
    list.replaceChildren(h("li", { class: "thread-empty" }, t("thread.empty")));
  } else {
    list.replaceChildren(
      ...messages.map((message) => {
        const notice = noticeText(message);
        if (notice) {
          return h(
            "li",
            { class: "thread-notice" },
            icon("clock", { size: 14 }),
            h("span", {}, notice),
            h("time", {}, formatDate(message.createdAt, { time: true })),
          );
        }
        const role = message.authorRole === "developer" ? "developer" : "requester";
        const own = role === viewer ? " bubble-own" : "";
        return h(
          "li",
          { class: `bubble bubble-${role}${own}` },
          h(
            "p",
            { class: "bubble-meta" },
            h("span", { class: "bubble-author" }, t(`thread.role.${role}`)),
            h("time", {}, formatDate(message.createdAt, { time: true })),
          ),
          h("p", { class: "bubble-body" }, message.body),
        );
      }),
    );
  }

  list.dataset.count = String(messages.length);
  if (nearBottom || messages.length > previous) list.scrollTop = list.scrollHeight;
}

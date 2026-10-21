import { $, h } from "../core/dom.js";
import { isConfigured } from "../core/config.js";
import { formatDate, formatRelative } from "../core/format.js";
import { t } from "../core/i18n.js";
import { setStatus, startPage } from "../core/page.js";
import { pageUrl, trackUrl } from "../core/router.js";
import { emptyState, skeletonRows, statusBadge } from "../components/ui.js";
import { watchSignIn } from "../services/auth.js";
import { watchMyRequests } from "../services/requests.js";

// Where a request stands decides the group it sits in. Any status not listed here is shown under Closed.
const GROUPS = [
  { id: "active", statuses: ["new", "in_progress"] },
  { id: "finished", statuses: ["done"] },
  { id: "closed", statuses: ["declined", "cancelled"] },
];

let stopWatching = null;

function requestRow(request) {
  return h(
    "li",
    { class: "my-request" },
    h(
      "a",
      { class: "my-request-link", href: trackUrl(request.id) },
      h(
        "span",
        { class: "my-request-head" },
        statusBadge(request.status),
        h("time", { datetime: "" }, formatDate(request.createdAt)),
      ),
      h("span", { class: "my-request-app" }, request.appName),
      h("span", { class: "my-request-title" }, request.title),
      h(
        "span",
        { class: "my-request-meta" },
        t("myRequests.toDeveloper", { username: request.developerUsername }),
        " · ",
        t("myRequests.updated", { when: formatRelative(request.updatedAt ?? request.createdAt) }),
      ),
    ),
  );
}

function render(requests) {
  const container = $("#my-requests-groups");
  $("#my-requests-count").textContent = t("myRequests.count", { count: requests.length });

  if (requests.length === 0) {
    container.replaceChildren(
      emptyState({
        iconName: "inbox",
        title: t("myRequests.emptyTitle"),
        body: t("myRequests.emptyBody"),
        action: h(
          "a",
          { class: "btn btn-primary", href: pageUrl("index.html") },
          t("myRequests.browse"),
        ),
      }),
    );
    return;
  }

  const sections = GROUPS.map((group) => {
    const items = requests.filter((request) =>
      group.id === "closed"
        ? group.statuses.includes(request.status) ||
          !GROUPS.some((other) => other.statuses.includes(request.status))
        : group.statuses.includes(request.status),
    );
    if (items.length === 0) return null;
    return h(
      "section",
      { class: "my-group", "aria-labelledby": `group-${group.id}` },
      h(
        "h2",
        { id: `group-${group.id}`, class: "section-title" },
        t(`myRequests.group.${group.id}`),
        " ",
        h("span", { class: "group-count" }, String(items.length)),
      ),
      h("ul", { class: "my-request-list" }, items.map(requestRow)),
    );
  }).filter(Boolean);

  container.replaceChildren(...sections);
}

startPage(() => {
  if (!isConfigured) {
    $("#my-requests-groups").replaceChildren(
      emptyState({
        iconName: "alert",
        title: t("setup.notConfiguredTitle"),
        body: t("setup.notConfigured"),
      }),
    );
    return;
  }

  $("#my-requests-groups").replaceChildren(...skeletonRows(3));
  watchSignIn((user) => {
    stopWatching?.();
    stopWatching = null;
    // No anonymous session yet means no requests from this browser.
    if (!user) {
      render([]);
      return;
    }
    stopWatching = watchMyRequests(user.uid, render, () => {
      setStatus($("#my-requests-status"), t("errors.network"), { error: true });
    });
  });
});

import { $, h } from "../../core/dom.js";
import { formatRelative } from "../../core/format.js";
import { t } from "../../core/i18n.js";
import { developerUrl } from "../../core/router.js";
import { toast } from "../../core/toast.js";
import { setStatus } from "../../core/page.js";
import {
  copyButton,
  emptyState,
  linkButton,
  platformChips,
  skeletonRows,
  statusBadge,
} from "../../components/ui.js";
import { STATUSES } from "../../domain/constants.js";
import { watchOwnRequests } from "../../services/requests.js";
import { closeDrawer, openDrawer, refreshDrawer, wireDrawer } from "./drawer.js";

const state = {
  uid: null,
  requests: [],
  filter: "all",
  stop: null,
  wired: false,
  announced: false,
};

function renderLink(developer) {
  const link = new URL(developerUrl(developer.username), location.href).href;
  $("#developer-link").replaceChildren(
    h("p", { class: "link-label" }, t("dashboard.yourLink")),
    h(
      "div",
      { class: "link-row" },
      h("input", {
        class: "tracking-input",
        readonly: true,
        value: link,
        "aria-label": t("dashboard.yourLink"),
      }),
      copyButton({ getText: () => link, label: t("common.copyLink") }),
      linkButton({ href: link, label: t("dashboard.openPage"), external: true }),
    ),
  );
}

function wireOnce() {
  if (state.wired) return;
  state.wired = true;
  const filter = $("#status-filter");
  filter.replaceChildren(
    h("option", { value: "all" }, t("dashboard.filterAll")),
    ...STATUSES.map((status) => h("option", { value: status }, t(`status.${status}`))),
  );
  filter.addEventListener("change", () => {
    state.filter = filter.value;
    renderList();
  });
  wireDrawer();
}

function requestCard(request) {
  return h(
    "article",
    { class: "request-card" },
    h(
      "button",
      {
        type: "button",
        class: "request-card-open",
        onclick: () => openDrawer(request),
      },
      h(
        "span",
        { class: "request-card-head" },
        statusBadge(request.status),
        h("time", { datetime: "" }, formatRelative(request.createdAt)),
      ),
      h("span", { class: "request-card-app" }, request.appName),
      h("span", { class: "request-card-title" }, request.title),
      h("span", { class: "request-card-meta" }, request.requesterName),
    ),
    platformChips(request.platforms),
  );
}

function renderList() {
  const list = $("#request-list");
  const visible =
    state.filter === "all"
      ? state.requests
      : state.requests.filter((request) => request.status === state.filter);
  $("#requests-count").textContent = t("dashboard.count", { count: visible.length });

  if (state.requests.length === 0) {
    list.replaceChildren(
      emptyState({
        iconName: "inbox",
        title: t("dashboard.emptyTitle"),
        body: t("dashboard.emptyBody"),
      }),
    );
    return;
  }
  if (visible.length === 0) {
    list.replaceChildren(emptyState({ iconName: "search", title: t("dashboard.noMatches") }));
    return;
  }
  list.replaceChildren(...visible.map(requestCard));
}

function onRequests(requests) {
  const known = new Set(state.requests.map((request) => request.id));
  state.requests = requests;
  renderList();
  for (const request of requests) refreshDrawer(request);
  // The first snapshot is the existing list. Only later arrivals are new requests.
  if (state.announced) {
    for (const request of requests.filter((item) => !known.has(item.id))) {
      toast(t("dashboard.newRequest", { app: request.appName }));
    }
  }
  state.announced = true;
}

export function mountRequests(developer, user) {
  if (state.uid === user.uid) return;
  unmountRequests();
  state.uid = user.uid;
  wireOnce();
  renderLink(developer);
  $("#request-list").replaceChildren(...skeletonRows(4));
  state.stop = watchOwnRequests(user.uid, onRequests, () =>
    setStatus($("#requests-count"), t("errors.network"), { error: true }),
  );
}

export function unmountRequests() {
  state.stop?.();
  state.stop = null;
  state.uid = null;
  state.requests = [];
  state.announced = false;
  closeDrawer();
}

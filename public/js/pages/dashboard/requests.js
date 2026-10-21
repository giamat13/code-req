import { $, h } from "../../core/dom.js";
import { showDialog } from "../../core/dialog.js";
import { describeError } from "../../core/errors.js";
import { formatRelative } from "../../core/format.js";
import { t } from "../../core/i18n.js";
import { setStatus } from "../../core/page.js";
import { developerUrl, pageUrl, replaceQuery } from "../../core/router.js";
import { markSeen, seenAt } from "../../core/seen.js";
import { toast } from "../../core/toast.js";
import {
  definitionList,
  emptyState,
  linkButton,
  platformChips,
  platformLabel,
  skeletonRows,
  statusBadge,
  copyButton,
} from "../../components/ui.js";
import {
  BOARD_STATUSES,
  BUDGET_RANGES,
  PLATFORMS,
  STATUSES,
  TEMPLATES,
} from "../../domain/constants.js";
import {
  applyFilters,
  filtersToParams,
  isUnread,
  parseFilters,
  RANGES,
  SORTS,
  sortRequests,
} from "../../domain/filters.js";
import { getPrivateNotes, setRequestStatus, watchOwnRequests } from "../../services/requests.js";
import { toDate } from "../../domain/time.js";

const SEARCH_DEBOUNCE_MS = 200;
// Requests this developer just moved. Their own writes change updatedAt, which would otherwise mark them unread.
const ownWrites = new Set();

const state = {
  uid: null,
  requests: [],
  notes: {},
  filters: parseFilters(new URLSearchParams(location.search)),
  stop: null,
  wired: false,
  announced: false,
  searchTimer: null,
};

function isRequestUnread(request) {
  return isUnread(request, seenAt(request.id));
}

function unreadCount() {
  return state.requests.filter(isRequestUnread).length;
}

function renderLink(developer) {
  const link = developerUrl(developer.username);
  $("#developer-link").replaceChildren(
    h("p", { class: "link-label" }, t("dashboard.yourLink")),
    h(
      "div",
      { class: "link-row" },
      h("input", {
        class: "tracking-input",
        dir: "ltr",
        readonly: true,
        value: link,
        "aria-label": t("dashboard.yourLink"),
      }),
      copyButton({ getText: () => link, label: t("common.copyLink") }),
      linkButton({ href: link, label: t("dashboard.openPage"), external: true }),
    ),
  );
}

function setOptions(select, items, selected) {
  select.replaceChildren(
    ...items.map((item) =>
      h("option", { value: item.value, selected: item.value === selected }, item.label),
    ),
  );
}

function renderFilters() {
  const f = state.filters;
  const all = { value: "all", label: t("dashboard.all") };
  const platforms = [
    ...new Set([...PLATFORMS, ...state.requests.flatMap((request) => request.platforms)]),
  ];
  const tags = [...new Set(Object.values(state.notes).flatMap((notes) => notes.tags))].sort();

  setOptions(
    $("#filter-status"),
    [all, ...STATUSES.map((status) => ({ value: status, label: t(`status.${status}`) }))],
    f.status,
  );
  setOptions(
    $("#filter-platform"),
    [all, ...platforms.map((platform) => ({ value: platform, label: platformLabel(platform) }))],
    f.platform,
  );
  setOptions(
    $("#filter-budget"),
    [all, ...BUDGET_RANGES.map((range) => ({ value: range, label: t(`budget.${range}`) }))],
    f.budget,
  );
  setOptions(
    $("#filter-template"),
    [
      all,
      { value: "none", label: t("template.none") },
      ...TEMPLATES.map((template) => ({ value: template, label: t(`template.${template}`) })),
    ],
    f.template,
  );
  setOptions($("#filter-tag"), [all, ...tags.map((tag) => ({ value: tag, label: tag }))], f.tag);
  setOptions(
    $("#filter-range"),
    RANGES.map((range) => ({ value: range, label: t(`dashboard.range.${range}`) })),
    f.range,
  );
  setOptions(
    $("#filter-sort"),
    SORTS.map((sort) => ({ value: sort, label: t(`dashboard.sort.${sort}`) })),
    f.sort,
  );
  $("#filter-q").value = f.q;
  // The extra filters stay hidden until one of them is set, for example from a shared link.
  if (f.template !== "all" || f.tag !== "all" || f.range !== "all") $("#filter-more").open = true;
  $("#view-board").setAttribute("aria-pressed", String(f.view === "board"));
  $("#view-list").setAttribute("aria-pressed", String(f.view === "list"));
}

// Each request has its own page. Opening it marks it seen here first, so the card is not unread when we come back.
function openRequest(request) {
  markSeen(request.id);
  window.location.assign(pageUrl("request.html", { r: request.id }));
}

// Moves a request to another status. The board updates at once and rolls back if the save fails.
async function moveRequest(request, status) {
  if (request.status === status || !BOARD_STATUSES.includes(status)) return;
  const previous = request.status;
  ownWrites.add(request.id);
  request.status = status;
  renderAll();
  try {
    await setRequestStatus(request.id, status);
    toast(t("dashboard.moved", { status: t(`status.${status}`) }));
  } catch (error) {
    request.status = previous;
    ownWrites.delete(request.id);
    renderAll();
    toast(describeError(error), { type: "error" });
  }
}

function onCardKey(event, request) {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    openRequest(request);
    return;
  }
  if (event.altKey && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
    event.preventDefault();
    const next =
      BOARD_STATUSES[
        BOARD_STATUSES.indexOf(request.status) + (event.key === "ArrowRight" ? 1 : -1)
      ];
    if (!next) return;
    moveRequest(request, next);
    $(`[data-card="${request.id}"]`)?.focus();
  }
}

function card(request) {
  const unread = isRequestUnread(request);
  const tags = state.notes[request.id]?.tags ?? [];
  return h(
    "li",
    {
      class: unread ? "board-card is-unread" : "board-card",
      tabindex: "0",
      draggable: "true",
      dataset: { card: request.id },
      ondragstart: (event) => {
        event.dataTransfer.setData("text/plain", request.id);
        event.dataTransfer.effectAllowed = "move";
      },
      onclick: () => openRequest(request),
      onkeydown: (event) => onCardKey(event, request),
    },
    h(
      "span",
      { class: "card-head" },
      unread
        ? h("span", { class: "unread-dot", role: "img", "aria-label": t("dashboard.unread") })
        : null,
      h(
        "time",
        { datetime: toDate(request.createdAt)?.toISOString() ?? null },
        formatRelative(request.createdAt),
      ),
    ),
    h("span", { class: "card-app" }, request.appName),
    h("span", { class: "card-title" }, request.title),
    h("span", { class: "card-meta" }, request.requesterName),
    platformChips(request.platforms),
    tags.length > 0
      ? h(
          "ul",
          { class: "chip-list" },
          tags.map((tag) => h("li", { class: "chip" }, tag)),
        )
      : null,
  );
}

function onDrop(event, status) {
  event.preventDefault();
  const id = event.dataTransfer.getData("text/plain");
  const request = state.requests.find((item) => item.id === id);
  if (request) moveRequest(request, status);
}

function renderBoard(visible) {
  const columns = BOARD_STATUSES.map((status) => {
    const items = visible.filter((request) => request.status === status);
    return h(
      "section",
      {
        class: "board-column",
        "aria-labelledby": `col-${status}`,
        ondragover: (event) => event.preventDefault(),
        ondrop: (event) => onDrop(event, status),
      },
      h(
        "header",
        { class: "board-column-head" },
        h("h2", { id: `col-${status}`, class: "board-column-title" }, t(`status.${status}`)),
        h("span", { class: "group-count" }, String(items.length)),
      ),
      h("ul", { class: "board-cards" }, items.map(card)),
    );
  });

  const cancelled = visible.filter((request) => request.status === "cancelled").length;
  return h(
    "div",
    { class: "board-wrap" },
    h("div", { class: "board" }, columns),
    cancelled > 0
      ? h("p", { class: "muted" }, t("dashboard.cancelledNote", { count: cancelled }))
      : null,
  );
}

function renderList(visible) {
  const columns = [
    "dashboard.colDate",
    "dashboard.colApp",
    "dashboard.colStatus",
    "dashboard.colBudget",
    "dashboard.colPlatforms",
  ];
  return h(
    "div",
    { class: "table-wrap" },
    h(
      "table",
      { class: "request-table" },
      h(
        "thead",
        {},
        h(
          "tr",
          {},
          columns.map((key) => h("th", { scope: "col" }, t(key))),
        ),
      ),
      h(
        "tbody",
        {},
        visible.map((request) =>
          h(
            "tr",
            {
              class: isRequestUnread(request) ? "request-row is-unread" : "request-row",
              tabindex: "0",
              dataset: { card: request.id },
              onclick: () => openRequest(request),
              onkeydown: (event) => {
                if (event.key === "Enter") openRequest(request);
              },
            },
            h("td", {}, formatRelative(request.createdAt)),
            h("td", {}, h("strong", {}, request.appName), h("br"), request.title),
            h("td", {}, statusBadge(request.status)),
            h(
              "td",
              {},
              request.budgetRange ? t(`budget.${request.budgetRange}`) : t("budget.notGiven"),
            ),
            h("td", {}, platformChips(request.platforms)),
          ),
        ),
      ),
    ),
  );
}

function renderCount(visible) {
  $("#requests-count").textContent = t("dashboard.count", { count: visible.length });
}

function renderView() {
  const visible = sortRequests(
    applyFilters(state.requests, state.filters, { notes: state.notes }),
    state.filters.sort,
  );
  renderCount(visible);
  const container = $("#requests-view");

  if (state.requests.length === 0) {
    container.replaceChildren(
      emptyState({
        iconName: "inbox",
        title: t("dashboard.emptyTitle"),
        body: t("dashboard.emptyBody"),
      }),
    );
    return;
  }
  if (visible.length === 0) {
    container.replaceChildren(emptyState({ iconName: "search", title: t("dashboard.noMatches") }));
    return;
  }
  container.replaceChildren(
    state.filters.view === "list" ? renderList(visible) : renderBoard(visible),
  );
}

function renderAll() {
  renderFilters();
  renderView();
  const unread = unreadCount();
  document.title =
    unread > 0 ? `(${unread}) ${t("dashboard.pageTitle")}` : t("dashboard.pageTitle");
}

function updateFilter(key, value) {
  state.filters = { ...state.filters, [key]: value };
  replaceQuery(filtersToParams(state.filters));
  renderAll();
}

// Private notes are loaded once per request, so tags can be shown on cards and used by the filters.
async function loadNotes(requests) {
  const missing = requests.filter((request) => !(request.id in state.notes));
  if (missing.length === 0) return;
  await Promise.all(
    missing.map(async (request) => {
      try {
        const data = await getPrivateNotes(request.id);
        state.notes[request.id] = {
          internalNotes: data?.internalNotes ?? "",
          tags: data?.tags ?? [],
        };
      } catch {
        state.notes[request.id] = { internalNotes: "", tags: [] };
      }
    }),
  );
  renderAll();
}

function onRequests(requests) {
  const known = new Set(state.requests.map((request) => request.id));
  for (const request of requests) {
    if (ownWrites.has(request.id)) markSeen(request.id);
    // updatedAt stays null until the server confirms the write, so the confirmed snapshot is the one that counts.
    if (request.updatedAt) ownWrites.delete(request.id);
  }
  state.requests = requests;
  renderAll();
  // The first snapshot is the existing list. Only later arrivals are new requests.
  if (state.announced) {
    for (const request of requests.filter((item) => !known.has(item.id))) {
      toast(t("dashboard.newRequest", { app: request.appName }));
    }
  }
  state.announced = true;
  loadNotes(requests);
}

function moveFocus(step) {
  const cards = [...document.querySelectorAll("[data-card]")];
  if (cards.length === 0) return;
  const current = cards.indexOf(document.activeElement);
  let index;
  if (current === -1) index = step > 0 ? 0 : cards.length - 1;
  else index = Math.min(cards.length - 1, Math.max(0, current + step));
  cards[index].focus();
}

function openHelp() {
  showDialog({
    title: t("dashboard.shortcutsTitle"),
    size: "sm",
    content: definitionList([
      { label: "/", value: t("dashboard.shortcut.search") },
      { label: "j / k", value: t("dashboard.shortcut.move") },
      { label: "Enter", value: t("dashboard.shortcut.open") },
      { label: "Alt + ← / →", value: t("dashboard.shortcut.moveColumn") },
      { label: "Esc", value: t("dashboard.shortcut.close") },
      { label: "?", value: t("dashboard.shortcut.help") },
    ]),
    actions: [{ label: t("common.close"), value: "close", variant: "primary" }],
  });
}

function wireShortcuts() {
  document.addEventListener("keydown", (event) => {
    if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
    if (["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName)) return;
    if (event.key === "/") {
      event.preventDefault();
      $("#filter-q").focus();
    } else if (event.key === "?") {
      event.preventDefault();
      openHelp();
    } else if (event.key === "j" || event.key === "k") {
      moveFocus(event.key === "j" ? 1 : -1);
    }
  });
}

function wireFilters() {
  const bind = (id, key) => {
    $(id).addEventListener("change", (event) => updateFilter(key, event.currentTarget.value));
  };
  bind("#filter-status", "status");
  bind("#filter-platform", "platform");
  bind("#filter-budget", "budget");
  bind("#filter-template", "template");
  bind("#filter-tag", "tag");
  bind("#filter-range", "range");
  bind("#filter-sort", "sort");
  $("#filter-q").addEventListener("input", (event) => {
    clearTimeout(state.searchTimer);
    const value = event.currentTarget.value.trim();
    state.searchTimer = setTimeout(() => updateFilter("q", value), SEARCH_DEBOUNCE_MS);
  });
  $("#view-board").addEventListener("click", () => updateFilter("view", "board"));
  $("#view-list").addEventListener("click", () => updateFilter("view", "list"));
  $("#request-filters").addEventListener("submit", (event) => event.preventDefault());
}

function wireOnce() {
  if (state.wired) return;
  state.wired = true;
  wireFilters();
  wireShortcuts();
}

export function mountRequests(developer, user) {
  if (state.uid === user.uid) return;
  unmountRequests();
  state.uid = user.uid;
  wireOnce();
  renderLink(developer);
  $("#requests-view").replaceChildren(...skeletonRows(4));
  state.stop = watchOwnRequests(user.uid, onRequests, () =>
    setStatus($("#requests-count"), t("errors.network"), { error: true }),
  );
}

export function unmountRequests() {
  state.stop?.();
  state.stop = null;
  state.uid = null;
  state.requests = [];
  state.notes = {};
  state.announced = false;
}

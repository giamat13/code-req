import { $, h } from "../core/dom.js";
import { isConfigured } from "../core/config.js";
import { formatDate } from "../core/format.js";
import { t } from "../core/i18n.js";
import { startPage, setStatus } from "../core/page.js";
import { developerUrl, trackUrl } from "../core/router.js";
import {
  avatar,
  emptyState,
  platformChips,
  platformLabel,
  skeletonRows,
} from "../components/ui.js";
import { PAGE_SIZE } from "../domain/constants.js";
import { toMillis } from "../domain/time.js";
import { extractUsername, usernameError } from "../domain/usernames.js";
import { watchSignIn } from "../services/auth.js";
import { findDeveloper, listDevelopers } from "../services/developers.js";
import { listMyRequests } from "../services/requests.js";

const state = {
  developers: [],
  query: "",
  sort: "name",
  shown: PAGE_SIZE,
};

function developerCard(developer) {
  return h(
    "a",
    { class: "developer-card", href: developerUrl(developer.username) },
    avatar({ src: developer.avatarUrl, name: developer.displayName, size: "lg" }),
    h(
      "div",
      { class: "developer-card-body" },
      h("h3", { class: "developer-card-name" }, developer.displayName),
      h("p", { class: "developer-card-handle" }, `@${developer.username}`),
      developer.pricingNote
        ? h("p", { class: "developer-card-note" }, developer.pricingNote)
        : null,
      platformChips(developer.acceptedPlatforms ?? []),
    ),
  );
}

// Matches the name, the handle, and the translated platform names.
function matches(developer, query) {
  if (!query) return true;
  const haystack = [
    developer.displayName,
    developer.username,
    ...(developer.acceptedPlatforms ?? []).map((platform) => platformLabel(platform)),
  ]
    .join("\n")
    .toLowerCase();
  return haystack.includes(query);
}

function visibleDevelopers() {
  const query = state.query.trim().toLowerCase();
  const list = state.developers.filter((developer) => matches(developer, query));
  if (state.sort === "newest") {
    list.sort((a, b) => (toMillis(b.createdAt) ?? 0) - (toMillis(a.createdAt) ?? 0));
  } else {
    list.sort((a, b) => a.displayName.localeCompare(b.displayName));
  }
  return list;
}

function renderDirectory() {
  const grid = $("#directory-grid");
  const list = visibleDevelopers();
  if (state.developers.length === 0) {
    grid.replaceChildren(
      emptyState({
        iconName: "users",
        title: t("landing.directoryEmpty"),
        body: t("landing.directoryEmptyBody"),
      }),
    );
  } else if (list.length === 0) {
    grid.replaceChildren(emptyState({ iconName: "search", title: t("landing.noMatches") }));
  } else {
    grid.replaceChildren(...list.slice(0, state.shown).map(developerCard));
  }
  $("#load-more").hidden = list.length <= state.shown;
  $("#directory-count").textContent = t("landing.directoryCount", { count: list.length });
}

async function loadDirectory() {
  const grid = $("#directory-grid");
  grid.replaceChildren(...skeletonRows(6));
  try {
    state.developers = await listDevelopers();
    renderDirectory();
  } catch {
    grid.replaceChildren(emptyState({ iconName: "alert", title: t("errors.network") }));
  }
}

function myRequestItem(request) {
  return h(
    "li",
    { class: "link-item" },
    h("a", { href: trackUrl(request.id) }, request.appName),
    " ",
    h("span", { class: "muted" }, t(`status.${request.status}`)),
    " ",
    h("span", { class: "muted" }, formatDate(request.createdAt)),
  );
}

// Shows requests sent from this browser's anonymous session. The section stays hidden when there are none.
async function loadMyRequests(user) {
  const section = $("#my-requests");
  if (!user) {
    section.hidden = true;
    return;
  }
  try {
    const requests = await listMyRequests(user.uid);
    section.hidden = requests.length === 0;
    $("#my-requests-list").replaceChildren(...requests.map(myRequestItem));
  } catch {
    section.hidden = true;
  }
}

async function findByUsername(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const status = $("#find-status");
  const username = extractUsername(form.elements.username.value);
  const problem = usernameError(username);
  if (problem) {
    setStatus(status, t(problem), { error: true });
    form.elements.username.setAttribute("aria-invalid", "true");
    form.elements.username.focus();
    return;
  }
  if (!isConfigured) {
    setStatus(status, t("setup.notConfigured"), { error: true });
    return;
  }
  const button = form.querySelector("button[type=submit]");
  button.disabled = true;
  try {
    const developer = await findDeveloper(username);
    if (!developer) {
      setStatus(status, t("landing.notFound", { username }), { error: true });
      form.elements.username.setAttribute("aria-invalid", "true");
      return;
    }
    // A suspended developer still gets a page, which explains that they are not available.
    window.location.assign(developerUrl(username));
  } catch {
    setStatus(status, t("errors.network"), { error: true });
  } finally {
    button.disabled = false;
  }
}

function wireDirectory() {
  $("#directory-search").addEventListener("input", (event) => {
    state.query = event.currentTarget.value;
    state.shown = PAGE_SIZE;
    renderDirectory();
  });
  $("#directory-sort").addEventListener("change", (event) => {
    state.sort = event.currentTarget.value;
    renderDirectory();
  });
  $("#load-more").addEventListener("click", () => {
    state.shown += PAGE_SIZE;
    renderDirectory();
  });
}

startPage(() => {
  const form = $("#find-form");
  form.addEventListener("submit", findByUsername);
  form.elements.username.addEventListener("input", (event) => {
    event.currentTarget.removeAttribute("aria-invalid");
  });
  wireDirectory();
  if (isConfigured) watchSignIn((user) => loadMyRequests(user));
  return loadDirectory();
});

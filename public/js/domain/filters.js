import { BUDGET_RANGES, LIMITS, STATUSES, TEMPLATES } from "./constants.js";
import { DAY_MS, dayKey, toMillis } from "./time.js";

export const RANGES = Object.freeze(["all", "today", "week", "month"]);
export const SORTS = Object.freeze(["newest", "oldest", "budget", "app"]);
export const VIEWS = Object.freeze(["board", "list"]);

const DEFAULTS = Object.freeze({
  q: "",
  status: "all",
  platform: "all",
  budget: "all",
  template: "all",
  tag: "all",
  range: "all",
  sort: "newest",
  view: "board",
});

// Free is the lowest budget, like an unknown one.
const BUDGET_ORDER = Object.freeze({
  unknown: 0,
  free: 0,
  under_500: 1,
  "500_2000": 2,
  "2000_10000": 3,
  over_10000: 4,
});

function pick(params, key, allowed) {
  const value = params.get(key);
  return allowed.includes(value) ? value : DEFAULTS[key];
}

// Developers name their own platforms, so any name up to the length limit is a valid filter.
function parsePlatform(value) {
  const text = (value ?? "").trim();
  return text === "" || [...text].length > LIMITS.platformName.max ? DEFAULTS.platform : text;
}

export function parseFilters(params) {
  return {
    q: (params.get("q") ?? "").trim(),
    status: pick(params, "status", ["all", ...STATUSES]),
    platform: parsePlatform(params.get("platform")),
    budget: pick(params, "budget", ["all", ...BUDGET_RANGES]),
    template: pick(params, "template", ["all", "none", ...TEMPLATES]),
    tag: (params.get("tag") ?? "").trim() || DEFAULTS.tag,
    range: pick(params, "range", RANGES),
    sort: pick(params, "sort", SORTS),
    view: pick(params, "view", VIEWS),
  };
}

// Only values that differ from the defaults go into the URL, so the default view has a clean address.
export function filtersToParams(filters) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== DEFAULTS[key]) params.set(key, value);
  }
  return params;
}

function rangeCutoff(range, now) {
  if (range === "today") return new Date(now).setHours(0, 0, 0, 0);
  if (range === "week") return now - 7 * DAY_MS;
  if (range === "month") return now - 30 * DAY_MS;
  return null;
}

function searchText(request, tags) {
  return [request.requesterName, request.title, request.appName, request.appDescription, ...tags]
    .join("\n")
    .toLowerCase();
}

// notes maps request IDs to private data, which holds the tags.
export function applyFilters(requests, filters, { now = Date.now(), notes = {} } = {}) {
  const query = filters.q.toLowerCase();
  const cutoff = rangeCutoff(filters.range, now);
  return requests.filter((request) => {
    const tags = notes[request.id]?.tags ?? [];
    if (filters.status !== "all" && request.status !== filters.status) return false;
    if (filters.platform !== "all" && !request.platforms.includes(filters.platform)) return false;
    if (filters.budget !== "all" && (request.budgetRange ?? "unknown") !== filters.budget)
      return false;
    if (filters.template !== "all" && (request.template ?? "none") !== filters.template)
      return false;
    if (filters.tag !== "all" && !tags.includes(filters.tag)) return false;
    if (cutoff !== null && (toMillis(request.createdAt) ?? now) < cutoff) return false;
    if (query && !searchText(request, tags).includes(query)) return false;
    return true;
  });
}

export function sortRequests(requests, sort) {
  const created = (request) => toMillis(request.createdAt) ?? Number.MAX_SAFE_INTEGER;
  const budget = (request) => BUDGET_ORDER[request.budgetRange ?? "unknown"] ?? 0;
  const list = [...requests];
  if (sort === "oldest") return list.sort((a, b) => created(a) - created(b));
  if (sort === "budget") return list.sort((a, b) => budget(b) - budget(a));
  if (sort === "app") return list.sort((a, b) => a.appName.localeCompare(b.appName));
  return list.sort((a, b) => created(b) - created(a));
}

export function latestActivity(request) {
  return Math.max(
    toMillis(request.createdAt) ?? 0,
    toMillis(request.updatedAt) ?? 0,
    toMillis(request.lastMessageAt) ?? 0,
  );
}

// lastSeen is the time the developer last opened the request, or null when they never did.
export function isUnread(request, lastSeen) {
  if (lastSeen === undefined || lastSeen === null) return true;
  return latestActivity(request) > lastSeen;
}

export function countByStatus(requests) {
  const counts = Object.fromEntries(STATUSES.map((status) => [status, 0]));
  for (const request of requests) counts[request.status] = (counts[request.status] ?? 0) + 1;
  return counts;
}

export function countSince(requests, days, now = Date.now()) {
  const cutoff = now - days * DAY_MS;
  return requests.filter((request) => (toMillis(request.createdAt) ?? now) >= cutoff).length;
}

// One bucket per local day, oldest first, for the activity chart.
export function dailySeries(requests, { days = 14, now = Date.now() } = {}) {
  const buckets = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date(now);
    date.setDate(date.getDate() - offset);
    buckets.push({ key: dayKey(date), date, count: 0 });
  }
  const byKey = new Map(buckets.map((bucket) => [bucket.key, bucket]));
  for (const request of requests) {
    const bucket = byKey.get(dayKey(toMillis(request.createdAt) ?? now));
    if (bucket) bucket.count += 1;
  }
  return buckets;
}

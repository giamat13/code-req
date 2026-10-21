import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  applyFilters,
  countByStatus,
  countSince,
  dailySeries,
  filtersToParams,
  isUnread,
  latestActivity,
  parseFilters,
  sortRequests,
} from "../../public/js/domain/filters.js";

const NOW = new Date(2026, 9, 21, 12, 0, 0).getTime();
const DAY = 24 * 60 * 60 * 1000;

const request = (overrides) => ({
  id: "r1",
  requesterName: "Dana",
  title: "Habit tracker",
  appName: "Habits",
  appDescription: "Track daily habits.",
  platforms: ["web"],
  status: "new",
  budgetMin: null,
  budgetMax: null,
  template: null,
  createdAt: NOW,
  updatedAt: NOW,
  lastMessageAt: null,
  ...overrides,
});

describe("parseFilters", () => {
  test("uses defaults for missing or unknown values", () => {
    const filters = parseFilters(new URLSearchParams("status=bogus&view=nope"));
    assert.equal(filters.status, "all");
    assert.equal(filters.view, "board");
  });

  test("reads valid values", () => {
    const filters = parseFilters(new URLSearchParams("status=done&platform=ios&q=%20habit%20"));
    assert.equal(filters.status, "done");
    assert.equal(filters.platform, "ios");
    assert.equal(filters.q, "habit");
  });
});

describe("filtersToParams", () => {
  test("leaves out values that equal the defaults", () => {
    const params = filtersToParams(parseFilters(new URLSearchParams("status=done")));
    assert.equal(params.toString(), "status=done");
  });

  test("produces an empty query for the default view", () => {
    assert.equal(filtersToParams(parseFilters(new URLSearchParams(""))).toString(), "");
  });
});

describe("applyFilters", () => {
  const requests = [
    request({ id: "a", appName: "Habits", status: "new", platforms: ["ios"] }),
    request({ id: "b", appName: "Budget", title: "Money app", status: "done", platforms: ["web"] }),
    request({
      id: "c",
      appName: "Old",
      status: "new",
      createdAt: NOW - 40 * DAY,
      platforms: ["web"],
    }),
  ];

  test("filters by status and platform together", () => {
    const filters = parseFilters(new URLSearchParams("status=new&platform=web"));
    assert.deepEqual(
      applyFilters(requests, filters, { now: NOW }).map((r) => r.id),
      ["c"],
    );
  });

  test("searches the requester, title, and app name, ignoring case", () => {
    const filters = parseFilters(new URLSearchParams("q=MONEY"));
    assert.deepEqual(
      applyFilters(requests, filters, { now: NOW }).map((r) => r.id),
      ["b"],
    );
  });

  test("keeps only the last 30 days for the month range", () => {
    const filters = parseFilters(new URLSearchParams("range=month"));
    assert.deepEqual(
      applyFilters(requests, filters, { now: NOW }).map((r) => r.id),
      ["a", "b"],
    );
  });

  test("filters by tag using the private notes map", () => {
    const filters = parseFilters(new URLSearchParams("tag=urgent"));
    const notes = { b: { tags: ["urgent"] } };
    assert.deepEqual(
      applyFilters(requests, filters, { now: NOW, notes }).map((r) => r.id),
      ["b"],
    );
  });
});

describe("sortRequests", () => {
  const requests = [
    request({ id: "a", appName: "Zeta", createdAt: NOW - DAY, budgetMin: 100, budgetMax: 500 }),
    request({ id: "b", appName: "Alpha", createdAt: NOW, budgetMin: 5000, budgetMax: 10000 }),
  ];

  test("newest first by default", () => {
    assert.deepEqual(
      sortRequests(requests, "newest").map((r) => r.id),
      ["b", "a"],
    );
  });

  test("oldest first", () => {
    assert.deepEqual(
      sortRequests(requests, "oldest").map((r) => r.id),
      ["a", "b"],
    );
  });

  test("largest budget first", () => {
    assert.deepEqual(
      sortRequests(requests, "budget").map((r) => r.id),
      ["b", "a"],
    );
  });

  test("by app name", () => {
    assert.deepEqual(
      sortRequests(requests, "app").map((r) => r.id),
      ["b", "a"],
    );
  });
});

describe("unread state", () => {
  test("latestActivity uses the newest of the three timestamps", () => {
    const item = request({ createdAt: NOW - 3 * DAY, updatedAt: NOW - DAY, lastMessageAt: NOW });
    assert.equal(latestActivity(item), NOW);
  });

  test("a request never opened is unread", () => {
    assert.equal(isUnread(request({}), null), true);
  });

  test("a request is unread only when activity is newer than the last look", () => {
    const item = request({ updatedAt: NOW });
    assert.equal(isUnread(item, NOW), false);
    assert.equal(isUnread(item, NOW - 1), true);
  });
});

describe("counts and the activity chart", () => {
  test("countByStatus includes every status, even empty ones", () => {
    const counts = countByStatus([request({ status: "done" }), request({ status: "done" })]);
    assert.equal(counts.done, 2);
    assert.equal(counts.new, 0);
    assert.equal(counts.cancelled, 0);
  });

  test("countSince counts requests from the last N days", () => {
    const items = [request({ createdAt: NOW - 2 * DAY }), request({ createdAt: NOW - 20 * DAY })];
    assert.equal(countSince(items, 7, NOW), 1);
  });

  test("dailySeries returns one bucket per day, oldest first", () => {
    const series = dailySeries([request({ createdAt: NOW }), request({ createdAt: NOW - DAY })], {
      days: 3,
      now: NOW,
    });
    assert.equal(series.length, 3);
    assert.deepEqual(
      series.map((bucket) => bucket.count),
      [0, 1, 1],
    );
  });
});

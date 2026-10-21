import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { buildBrief } from "../../public/js/domain/brief.js";
import { csvCell, toCsv } from "../../public/js/domain/csv.js";
import { dayKey, serializeValue, toMillis } from "../../public/js/domain/time.js";
import { translate } from "../../public/js/core/i18n.js";

describe("csvCell", () => {
  test("doubles quotes and wraps the cell in quotes", () => {
    assert.equal(csvCell('say "hi"'), '"say ""hi"""');
  });

  test("prefixes formula triggers so spreadsheets do not run them", () => {
    for (const text of ["=1+1", "+cmd", "-2", "@SUM", "\tcell", "\rcell"]) {
      assert.ok(
        csvCell(text).startsWith("\"'"),
        `expected a quote prefix for ${JSON.stringify(text)}`,
      );
    }
  });

  test("keeps commas and line breaks inside the cell", () => {
    assert.equal(csvCell("a,b\nc"), '"a,b\nc"');
  });

  test("joins arrays and treats null as empty", () => {
    assert.equal(csvCell(["web", "ios"]), '"web; ios"');
    assert.equal(csvCell(null), '""');
  });
});

describe("toCsv", () => {
  test("writes a header row and one line per row", () => {
    const csv = toCsv(
      [
        { header: "Title", value: (row) => row.title },
        { header: "Status", value: (row) => row.status },
      ],
      [{ title: "Habits", status: "new" }],
    );
    assert.equal(csv, '"Title","Status"\r\n"Habits","new"\r\n');
  });
});

describe("buildBrief", () => {
  const request = {
    title: "Habit tracker",
    appName: "Habits",
    requesterName: "Dana",
    status: "in_progress",
    platforms: ["ios", "web"],
    template: "mobile",
    budgetMin: 100,
    budgetMax: 500,
    deadline: null,
    appDescription: "Track daily habits.",
    notes: "Dark mode please.",
    quote: { amount: "450", currency: "USD", timeline: "2 weeks", validUntil: "2026-12-01" },
  };

  test("includes the main fields and the quote", () => {
    const brief = buildBrief(request, { preferredChannel: "email" });
    assert.match(brief, /^# Habit tracker/);
    assert.match(brief, /\*\*Quote:\*\* 450 USD, 2 weeks, valid until 2026-12-01/);
    assert.match(brief, /\*\*Preferred contact:\*\* email/);
    assert.match(brief, /Dark mode please\./);
  });

  test("leaves internal notes out unless they are passed in", () => {
    assert.doesNotMatch(buildBrief(request), /Internal notes/);
    assert.match(buildBrief(request, { internalNotes: "Ask about budget." }), /## Internal notes/);
  });

  test("says when no quote exists yet", () => {
    assert.match(buildBrief({ ...request, quote: null }), /\*\*Quote:\*\* not sent/);
  });
});

describe("time helpers", () => {
  test("toMillis reads dates, numbers, and Firestore-like timestamps", () => {
    assert.equal(toMillis(1000), 1000);
    assert.equal(toMillis({ toDate: () => new Date(2000) }), 2000);
    assert.equal(toMillis(null), null);
  });

  test("dayKey uses the local calendar date", () => {
    assert.equal(dayKey(new Date(2026, 0, 5, 23, 59)), "2026-01-05");
  });

  test("serializeValue turns timestamps into ISO strings, recursively", () => {
    const value = serializeValue({
      at: { toDate: () => new Date(0) },
      list: [{ at: new Date(0) }],
    });
    assert.deepEqual(value, {
      at: "1970-01-01T00:00:00.000Z",
      list: [{ at: "1970-01-01T00:00:00.000Z" }],
    });
  });
});

describe("translate", () => {
  const dict = {
    greet: "Hello {name}",
    "items.one": "{count} item",
    "items.other": "{count} items",
  };
  const fallback = { greet: "Hi {name}", "only.fallback": "Fallback text" };

  test("uses the locale value and fills placeholders", () => {
    assert.equal(translate(dict, fallback, "en", "greet", { name: "Dana" }), "Hello Dana");
  });

  test("falls back to the English dictionary for a missing key", () => {
    assert.equal(translate(dict, fallback, "he", "only.fallback"), "Fallback text");
  });

  test("returns the key itself when no dictionary has it", () => {
    assert.equal(translate(dict, fallback, "en", "missing.key"), "missing.key");
  });

  test("chooses the plural form from the count", () => {
    assert.equal(translate(dict, fallback, "en", "items", { count: 1 }), "1 item");
    assert.equal(translate(dict, fallback, "en", "items", { count: 5 }), "5 items");
  });

  test("keeps placeholders it does not know", () => {
    assert.equal(translate(dict, fallback, "en", "greet", {}), "Hello {name}");
  });
});

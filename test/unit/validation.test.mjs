import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  normalizeTags,
  validateContact,
  validateProfile,
  validateProjectUrl,
  validateQuote,
  validateRequestForm,
  contactState,
  deadlineError,
  normalizePlatforms,
} from "../../public/js/domain/validation.js";

const TODAY = "2026-10-21";

const validRequest = {
  requesterName: "Dana Levi",
  title: "Habit tracker",
  appName: "Habits",
  appDescription: "A simple app to track daily habits and streaks.",
  platforms: ["ios", "android", "web"],
  template: "mobile",
  budgetMin: "100",
  budgetMax: "500",
  deadline: "2026-12-01",
  notes: "",
};

describe("validateRequestForm", () => {
  test("accepts a complete request and orders platforms canonically", () => {
    const result = validateRequestForm(validRequest, { today: TODAY });
    assert.equal(result.ok, true);
    assert.deepEqual(result.values.platforms, ["web", "android", "ios"]);
    assert.equal(result.values.notes, null);
  });

  test("reports missing required fields with translation keys", () => {
    const result = validateRequestForm({ ...validRequest, title: "  " }, { today: TODAY });
    assert.equal(result.ok, false);
    assert.equal(result.errors.title.key, "errors.required");
    assert.equal(result.firstError, "title");
  });

  test("drops platforms that the developer does not accept", () => {
    const result = validateRequestForm(validRequest, { acceptedPlatforms: ["web"], today: TODAY });
    assert.deepEqual(result.values.platforms, ["web"]);
  });

  test("requires at least one accepted platform", () => {
    const result = validateRequestForm(
      { ...validRequest, platforms: ["ios"] },
      { acceptedPlatforms: ["web"], today: TODAY },
    );
    assert.equal(result.errors.platforms.key, "errors.platforms");
  });

  test("treats a filled honeypot as spam and stores nothing", () => {
    const result = validateRequestForm(
      { ...validRequest, website: "https://spam.example" },
      { today: TODAY },
    );
    assert.equal(result.spam, true);
    assert.equal(result.ok, false);
    assert.equal(result.values, null);
  });

  test("rejects a deadline in the past", () => {
    const result = validateRequestForm(
      { ...validRequest, deadline: "2026-01-01" },
      { today: TODAY },
    );
    assert.equal(result.errors.deadline.key, "errors.dateInPast");
  });

  test("rejects dates that do not exist", () => {
    const result = validateRequestForm(
      { ...validRequest, deadline: "2026-02-30" },
      { today: TODAY },
    );
    assert.equal(result.errors.deadline.key, "errors.dateFormat");
  });

  test("rejects an unknown template", () => {
    const result = validateRequestForm(
      { ...validRequest, template: "spaceship" },
      { today: TODAY },
    );
    assert.equal(result.errors.template.key, "errors.choice");
  });

  test("counts characters the way Firestore does (code points, not UTF-16 units)", () => {
    const result = validateRequestForm({ ...validRequest, appName: "😀" }, { today: TODAY });
    assert.equal(result.errors.appName.key, "errors.tooShort");
  });
});

describe("validateRequestForm budget", () => {
  const withBudget = (budgetMin, budgetMax) =>
    validateRequestForm({ ...validRequest, budgetMin, budgetMax }, { today: TODAY });

  test("a range of whole numbers becomes numbers", () => {
    const result = withBudget("500", "2000");
    assert.equal(result.ok, true);
    assert.deepEqual([result.values.budgetMin, result.values.budgetMax], [500, 2000]);
  });

  test("empty ends together mean no budget was given", () => {
    const result = withBudget("", "");
    assert.equal(result.ok, true);
    assert.deepEqual([result.values.budgetMin, result.values.budgetMax], [null, null]);
  });

  test("a free project is 0 to 0", () => {
    assert.equal(withBudget("0", "0").ok, true);
  });

  test("one end alone is rejected at the empty end", () => {
    const result = withBudget("500", "");
    assert.equal(result.errors.budgetMax.key, "errors.budget.pair");
    assert.equal(result.errors.budgetMin, undefined);
  });

  test("the top cannot be below the bottom", () => {
    assert.equal(withBudget("2000", "500").errors.budgetMax.key, "errors.budget.order");
  });

  test("decimals, negatives and text are rejected", () => {
    assert.equal(withBudget("500.5", "900").errors.budgetMin.key, "errors.budget.integer");
    assert.equal(withBudget("-5", "900").errors.budgetMin.key, "errors.budget.integer");
    assert.equal(withBudget("abc", "900").errors.budgetMin.key, "errors.budget.integer");
  });

  test("amounts above the limit are rejected", () => {
    const result = withBudget("500", "10000001");
    assert.equal(result.errors.budgetMax.key, "errors.budget.integer");
  });
});

describe("validateContact", () => {
  test("requires an email when email is the chosen channel", () => {
    const result = validateContact({ channel: "email", email: "", phone: "", availability: "" });
    assert.equal(result.errors.email.key, "errors.required");
  });

  test("requires a phone number when phone is the chosen channel", () => {
    const result = validateContact({ channel: "phone", email: "", phone: "", availability: "" });
    assert.equal(result.errors.phone.key, "errors.required");
  });

  test("rejects an invalid phone number", () => {
    const result = validateContact({
      channel: "thread",
      phone: "call me",
      email: "",
      availability: "",
    });
    assert.equal(result.errors.phone.key, "errors.phone");
  });

  test("accepts the thread channel with nothing else", () => {
    const result = validateContact({ channel: "thread", email: "", phone: "", availability: "" });
    assert.equal(result.ok, true);
    assert.deepEqual(contactState(result.values), { stored: false, hasContact: false });
  });

  test("stores availability without counting it as a way to reach the requester", () => {
    const result = validateContact({
      channel: "thread",
      email: "",
      phone: "",
      availability: "weekdays",
    });
    assert.deepEqual(contactState(result.values), { stored: true, hasContact: false });
  });

  test("marks a saved email as contact on file", () => {
    const result = validateContact({
      channel: "email",
      email: "dana@example.com",
      phone: "",
      availability: "",
    });
    assert.deepEqual(contactState(result.values), { stored: true, hasContact: true });
  });
});

describe("validateProfile", () => {
  test("accepts a profile with an https website", () => {
    const result = validateProfile({
      displayName: "Noa",
      bio: "I build small tools.",
      website: "https://noa.example",
      pricingNote: null,
      acceptedPlatforms: ["web"],
      acceptingRequests: true,
    });
    assert.equal(result.ok, true);
  });

  test("rejects a website without https", () => {
    const result = validateProfile({
      displayName: "Noa",
      website: "http://noa.example",
      acceptedPlatforms: ["web"],
    });
    assert.equal(result.errors.website.key, "errors.url");
  });

  test("requires at least one platform", () => {
    const result = validateProfile({ displayName: "Noa", acceptedPlatforms: [] });
    assert.equal(result.errors.acceptedPlatforms.key, "errors.platforms");
  });
});

describe("validateQuote", () => {
  test("accepts a three-letter code typed after choosing other", () => {
    const result = validateQuote(
      {
        amount: "450",
        currency: "other",
        customCurrency: "ils",
        timeline: "2 weeks",
        validUntil: "",
      },
      { today: TODAY },
    );
    assert.equal(result.ok, true);
    assert.equal(result.values.currency, "ILS");
  });

  test("rejects a currency that is not three letters", () => {
    const result = validateQuote(
      { amount: "450", currency: "other", customCurrency: "dollars" },
      { today: TODAY },
    );
    assert.equal(result.errors.currency.key, "errors.currency");
  });
});

describe("normalizeTags", () => {
  test("lowercases, trims, and removes duplicates", () => {
    const result = normalizeTags(" Urgent, urgent , Mobile ");
    assert.equal(result.ok, true);
    assert.deepEqual(result.value, ["urgent", "mobile"]);
  });

  test("allows at most five tags", () => {
    const result = normalizeTags("a1,b1,c1,d1,e1,f1");
    assert.equal(result.error.key, "errors.tags.count");
  });

  test("rejects characters outside the allowed set", () => {
    const result = normalizeTags("bad_tag");
    assert.equal(result.error.key, "errors.tags.format");
  });
});

describe("validateProjectUrl", () => {
  test("accepts an empty value", () => {
    assert.deepEqual(validateProjectUrl(""), { ok: true, error: null, value: null });
  });

  test("rejects plain http", () => {
    assert.equal(validateProjectUrl("http://example.com").error.key, "errors.url");
  });
});

describe("deadlineError and normalizePlatforms", () => {
  test("a date equal to today is allowed", () => {
    assert.equal(deadlineError(TODAY, TODAY), null);
  });

  test("platforms keep the canonical order and drop unknown names", () => {
    assert.deepEqual(normalizePlatforms(["ios", "mars", "web"]), ["web", "ios"]);
  });
});

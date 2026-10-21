import { CONTACT_CHANNELS, LIMITS, PLATFORMS, TEMPLATES } from "./constants.js";
import { normalizeAcceptedPlatforms } from "./platforms.js";
import { todayIso } from "./time.js";

// Each validator returns { ok, errors, values, firstError }. An error is { key, params } so the UI can translate it.

const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const PHONE_PATTERN = /^\+?[0-9][0-9 ()-]{5,24}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TAG_PATTERN = /^[a-z0-9][a-z0-9 -]*$/;
const HTTPS_PATTERN = /^https:\/\/\S+$/;
const CURRENCY_PATTERN = /^[A-Z]{3}$/;

const clean = (value) => (typeof value === "string" ? value.trim() : "");
const optional = (value) => {
  const text = clean(value);
  return text === "" ? null : text;
};
const length = (text) => [...text].length;

function textError(text, { min = 0, max }, required) {
  if (text.length === 0) return required ? { key: "errors.required" } : null;
  if (length(text) < min) return { key: "errors.tooShort", params: { min } };
  if (length(text) > max) return { key: "errors.tooLong", params: { max } };
  return null;
}

function emailError(email) {
  return length(email) > LIMITS.email.max || !EMAIL_PATTERN.test(email)
    ? { key: "errors.email" }
    : null;
}

function phoneError(phone) {
  return PHONE_PATTERN.test(phone) ? null : { key: "errors.phone" };
}

export function deadlineError(value, today = todayIso()) {
  if (!DATE_PATTERN.test(value)) return { key: "errors.dateFormat" };
  const parsed = new Date(`${value}T00:00:00Z`);
  // Rejects calendar dates that do not exist, such as 2026-02-30.
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    return { key: "errors.dateFormat" };
  }
  return value < today ? { key: "errors.dateInPast" } : null;
}

// Keeps the requester's choice inside the developer's accepted list, in the developer's order.
export function normalizePlatforms(list, accepted = PLATFORMS) {
  const wanted = new Set(Array.isArray(list) ? list : []);
  return accepted.filter((platform) => wanted.has(platform));
}

// An empty box is null. Otherwise the text becomes a number, and the check below rejects anything that is not a whole number.
const amountValue = (value) => {
  const text = clean(value);
  return text === "" ? null : Number(text);
};

function amountError(amount) {
  if (amount === null) return null;
  return Number.isInteger(amount) && amount >= 0 && amount <= LIMITS.budget.max
    ? null
    : { key: "errors.budget.integer", params: { max: LIMITS.budget.max } };
}

// The two ends are optional together. A range needs both, and its top cannot be below its bottom.
function budgetErrors(min, max) {
  const errors = { budgetMin: amountError(min), budgetMax: amountError(max) };
  if (errors.budgetMin || errors.budgetMax) return errors;
  if (min === null && max === null) return errors;
  if (min === null) errors.budgetMin = { key: "errors.budget.pair" };
  else if (max === null) errors.budgetMax = { key: "errors.budget.pair" };
  else if (max < min) errors.budgetMax = { key: "errors.budget.order" };
  return errors;
}

function collect(checks) {
  const errors = {};
  for (const [field, error] of checks) {
    if (error) errors[field] = error;
  }
  return errors;
}

function result(values, errors) {
  const firstError = Object.keys(errors)[0] ?? null;
  return { ok: firstError === null, errors, values, firstError };
}

// Used for new requests and for edits. Contact details are validated separately.
export function validateRequestForm(
  input,
  { acceptedPlatforms = PLATFORMS, today = todayIso() } = {},
) {
  // A filled honeypot means a bot. The caller pretends the submission worked and stores nothing.
  if (clean(input.website) !== "")
    return { ok: false, spam: true, errors: {}, values: null, firstError: null };

  const values = {
    requesterName: clean(input.requesterName),
    title: clean(input.title),
    appName: clean(input.appName),
    appDescription: clean(input.appDescription),
    platforms: normalizePlatforms(input.platforms, acceptedPlatforms),
    svgIcon: input.svgIcon ?? null,
    notes: optional(input.notes),
    template: optional(input.template),
    budgetMin: amountValue(input.budgetMin),
    budgetMax: amountValue(input.budgetMax),
    deadline: optional(input.deadline),
  };

  const errors = collect([
    ["requesterName", textError(values.requesterName, LIMITS.requesterName, true)],
    ["title", textError(values.title, LIMITS.title, true)],
    ["appName", textError(values.appName, LIMITS.appName, true)],
    ["appDescription", textError(values.appDescription, LIMITS.appDescription, true)],
    ["platforms", values.platforms.length === 0 ? { key: "errors.platforms" } : null],
    ["notes", textError(values.notes ?? "", { max: LIMITS.notes.max }, false)],
    [
      "template",
      values.template === null || TEMPLATES.includes(values.template)
        ? null
        : { key: "errors.choice" },
    ],
    ["budgetMin", budgetErrors(values.budgetMin, values.budgetMax).budgetMin],
    ["budgetMax", budgetErrors(values.budgetMin, values.budgetMax).budgetMax],
    ["deadline", values.deadline === null ? null : deadlineError(values.deadline, today)],
  ]);

  return result(values, errors);
}

export function validateContact(input) {
  const channel = clean(input.channel) || "thread";
  const values = {
    channel,
    email: optional(input.email),
    phone: optional(input.phone),
    availability: optional(input.availability),
  };

  const errors = collect([
    ["channel", CONTACT_CHANNELS.includes(channel) ? null : { key: "errors.choice" }],
    [
      "email",
      values.email !== null
        ? emailError(values.email)
        : channel === "email"
          ? { key: "errors.required" }
          : null,
    ],
    [
      "phone",
      values.phone !== null
        ? phoneError(values.phone)
        : channel === "phone"
          ? { key: "errors.required" }
          : null,
    ],
    ["availability", textError(values.availability ?? "", { max: LIMITS.availability.max }, false)],
  ]);

  return result(values, errors);
}

// stored: something was entered, so a contact document is written.
// hasContact: the developer has a way to reach the requester by email or phone.
export function contactState(values) {
  return {
    stored: values.email !== null || values.phone !== null || values.availability !== null,
    hasContact: values.email !== null || values.phone !== null,
  };
}

export function validateProfile(input) {
  const accepted = normalizeAcceptedPlatforms(input.acceptedPlatforms);
  const values = {
    displayName: clean(input.displayName),
    bio: optional(input.bio),
    website: optional(input.website),
    pricingNote: optional(input.pricingNote),
    acceptedPlatforms: accepted.value,
    acceptingRequests: Boolean(input.acceptingRequests),
  };

  const errors = collect([
    ["displayName", textError(values.displayName, LIMITS.displayName, true)],
    ["bio", textError(values.bio ?? "", { max: LIMITS.bio.max }, false)],
    ["pricingNote", textError(values.pricingNote ?? "", { max: LIMITS.pricingNote.max }, false)],
    [
      "website",
      values.website === null ||
      (HTTPS_PATTERN.test(values.website) && length(values.website) <= LIMITS.website.max)
        ? null
        : { key: "errors.url" },
    ],
    ["acceptedPlatforms", accepted.error],
  ]);

  return result(values, errors);
}

export function validateProjectUrl(value) {
  const text = optional(value);
  if (text === null) return { ok: true, error: null, value: null };
  if (!HTTPS_PATTERN.test(text) || length(text) > LIMITS.projectUrl.max) {
    return { ok: false, error: { key: "errors.url" }, value: null };
  }
  return { ok: true, error: null, value: text };
}

export function validateQuote(input, { today = todayIso() } = {}) {
  const amount = clean(input.amount);
  const choice = clean(input.currency);
  const currency = choice === "other" ? clean(input.customCurrency).toUpperCase() : choice;
  const values = {
    amount,
    currency,
    timeline: optional(input.timeline),
    validUntil: optional(input.validUntil),
  };

  const errors = collect([
    ["amount", textError(amount, { max: LIMITS.quoteAmount.max }, true)],
    ["currency", CURRENCY_PATTERN.test(currency) ? null : { key: "errors.currency" }],
    ["timeline", textError(values.timeline ?? "", { max: LIMITS.quoteTimeline.max }, false)],
    ["validUntil", values.validUntil === null ? null : deadlineError(values.validUntil, today)],
  ]);

  return result(values, errors);
}

export function validateMessage(text) {
  const body = clean(text);
  const error = textError(body, LIMITS.messageBody, true);
  return { ok: error === null, error, value: body };
}

export function validateReportReason(text) {
  const reason = clean(text);
  const error = textError(reason, LIMITS.reportReason, true);
  return { ok: error === null, error, value: reason };
}

export function validateInternalNotes(text) {
  const value = clean(text);
  const error = textError(value, { max: LIMITS.internalNotes.max }, false);
  return { ok: error === null, error, value };
}

export function normalizeTags(raw) {
  const tags = [
    ...new Set(
      String(raw ?? "")
        .split(",")
        .map((tag) => tag.trim().toLowerCase())
        .filter((tag) => tag !== ""),
    ),
  ];
  if (tags.length > LIMITS.tags.count) {
    return {
      ok: false,
      error: { key: "errors.tags.count", params: { max: LIMITS.tags.count } },
      value: [],
    };
  }
  for (const tag of tags) {
    if (length(tag) > LIMITS.tags.length) {
      return {
        ok: false,
        error: { key: "errors.tags.length", params: { max: LIMITS.tags.length } },
        value: [],
      };
    }
    if (!TAG_PATTERN.test(tag))
      return { ok: false, error: { key: "errors.tags.format" }, value: [] };
  }
  return { ok: true, error: null, value: tags };
}

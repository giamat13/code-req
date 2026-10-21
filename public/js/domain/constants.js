// Shared vocabulary. Every list here must match firestore.rules and the translation keys in public/locales/.

export const PLATFORMS = ["web", "windows", "macos", "linux", "android", "ios", "other"];

export const STATUSES = ["new", "in_progress", "done", "declined", "cancelled"];

// Columns of the developer board. A cancelled request is shown as a badge, not as a column.
export const BOARD_STATUSES = ["new", "in_progress", "done", "declined"];

export const TEMPLATES = ["landing", "mobile", "tool", "extension", "desktop", "other"];

export const CURRENCIES = ["USD", "EUR", "GBP", "ILS", "CAD", "AUD", "other"];

// How the developer should reach the requester. "thread" means the message thread on the tracking page.
export const CONTACT_CHANNELS = ["email", "phone", "thread"];

// Fields a requester may change while the request is new or in progress. Must match firestore.rules.
export const EDITABLE_FIELDS = [
  "requesterName",
  "title",
  "appName",
  "appDescription",
  "platforms",
  "svgIcon",
  "notes",
  "template",
  "budgetMin",
  "budgetMax",
  "deadline",
];

// A developer can accept at most PLATFORM_LIMIT platforms, and CUSTOM_PLATFORM_LIMIT of them can be names of their own.
export const PLATFORM_LIMIT = 20;
export const CUSTOM_PLATFORM_LIMIT = 10;

export const LIMITS = Object.freeze({
  requesterName: { min: 2, max: 100 },
  email: { max: 254 },
  title: { min: 2, max: 120 },
  appName: { min: 2, max: 80 },
  appDescription: { min: 10, max: 2000 },
  notes: { max: 2000 },
  availability: { max: 200 },
  platformName: { max: 30 },
  svgBytes: 100000,
  displayName: { min: 1, max: 60 },
  bio: { max: 280 },
  pricingNote: { max: 120 },
  website: { max: 200 },
  projectUrl: { max: 300 },
  internalNotes: { max: 5000 },
  tags: { count: 5, length: 24 },
  messageBody: { min: 1, max: 2000 },
  budget: { max: 10000000 },
  quoteAmount: { max: 20 },
  quoteTimeline: { max: 200 },
  reportReason: { min: 10, max: 1000 },
  requestListMax: 200,
  directoryMax: 200,
  threadMax: 500,
});

export const PAGE_SIZE = 24;
export const COOLDOWN_SECONDS = 60;
export const DRAFT_DEBOUNCE_MS = 500;

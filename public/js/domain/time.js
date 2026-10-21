export const DAY_MS = 24 * 60 * 60 * 1000;

const pad = (number) => String(number).padStart(2, "0");

// Accepts Date objects, Firestore Timestamps (anything with toDate()), epoch milliseconds, or null.
export function toDate(value) {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date) return value;
  if (typeof value.toDate === "function") return value.toDate();
  if (typeof value === "number") return new Date(value);
  return null;
}

export function toMillis(value) {
  const date = toDate(value);
  return date ? date.getTime() : null;
}

// Local calendar day as YYYY-MM-DD. Used for deadlines and the activity chart.
export function dayKey(value = new Date()) {
  const date = toDate(value) ?? new Date();
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function todayIso(now = new Date()) {
  return dayKey(now);
}

// Turns Firestore values into plain JSON-safe values for exports.
export function serializeValue(value) {
  if (value && typeof value.toDate === "function") return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(serializeValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, serializeValue(item)]),
    );
  }
  return value;
}

// Must match the reserved list in firestore.rules (see docs/decisions/0004-username-as-developer-code.md).
export const RESERVED_USERNAMES = Object.freeze([
  "about",
  "admin",
  "api",
  "assets",
  "code-req",
  "dashboard",
  "developer",
  "help",
  "login",
  "logout",
  "moderation",
  "new",
  "null",
  "official",
  "privacy",
  "root",
  "settings",
  "static",
  "support",
  "track",
  "undefined",
]);

const USERNAME_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])$/;

export function normalizeUsername(input) {
  return String(input ?? "")
    .trim()
    .replace(/^@/, "")
    .toLowerCase();
}

// Accepts a bare username, "@username", or a developer link such as "developer.html?u=alice".
export function extractUsername(input) {
  const text = String(input ?? "").trim();
  const match = text.match(/[?&]u=([^&#\s]+)/);
  if (!match) return normalizeUsername(text);
  try {
    return normalizeUsername(decodeURIComponent(match[1]));
  } catch {
    return "";
  }
}

// Returns a translation key, or null when the username is valid.
export function usernameError(username) {
  if (username.length < 3 || username.length > 30) return "errors.username.length";
  if (!USERNAME_PATTERN.test(username)) return "errors.username.format";
  if (RESERVED_USERNAMES.includes(username)) return "errors.username.reserved";
  return null;
}

// Suggests a username from a display name. Returns "" when nothing usable is left.
export function slugifyUsername(text) {
  const slug = normalizeUsername(text)
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30)
    .replace(/-+$/g, "");
  return slug.length >= 3 ? slug : "";
}

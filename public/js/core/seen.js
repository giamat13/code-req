import { storage } from "./storage.js";

// Per-device "last opened" times. A request is unread when something changed after the last time it was opened.
const SEEN_KEY = "apprequest.seen.v1";

export function seenAt(id) {
  return storage.getJSON(SEEN_KEY, {})[id] ?? null;
}

export function markSeen(id) {
  const map = storage.getJSON(SEEN_KEY, {});
  map[id] = Date.now();
  storage.setJSON(SEEN_KEY, map);
}

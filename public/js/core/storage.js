// localStorage can be unavailable (private windows, blocked storage). Every access is guarded,
// and the app keeps working without it.

export const storage = {
  get(key) {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key, value) {
    try {
      window.localStorage.setItem(key, value);
      return true;
    } catch {
      return false;
    }
  },
  remove(key) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Nothing to do: the value is simply not there.
    }
  },
  getJSON(key, fallback = null) {
    const raw = storage.get(key);
    if (raw === null) return fallback;
    try {
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  },
  setJSON(key, value) {
    return storage.set(key, JSON.stringify(value));
  },
};

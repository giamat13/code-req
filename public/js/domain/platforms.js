import { CUSTOM_PLATFORM_LIMIT, LIMITS, PLATFORM_LIMIT, PLATFORMS } from "./constants.js";

// Built-in platforms are stored under their lowercase id, such as "ios" or "macos".
const BUILT_IN = new Set(PLATFORMS);

export function isBuiltInPlatform(value) {
  return BUILT_IN.has(value);
}

export function cleanPlatformName(text) {
  return String(text ?? "")
    .trim()
    .replace(/\s+/g, " ");
}

// Returns { key, params } when a name cannot be added, or null when it can.
export function customPlatformError(name, existing) {
  if (name === "") return { key: "errors.platform.empty" };
  if ([...name].length > LIMITS.platformName.max) {
    return { key: "errors.platform.tooLong", params: { max: LIMITS.platformName.max } };
  }
  if (BUILT_IN.has(name.toLowerCase())) return { key: "errors.platform.builtIn" };
  if (existing.some((item) => item.toLowerCase() === name.toLowerCase())) {
    return { key: "errors.platform.duplicate" };
  }
  if (existing.length >= CUSTOM_PLATFORM_LIMIT) {
    return { key: "errors.platform.limit", params: { max: CUSTOM_PLATFORM_LIMIT } };
  }
  return null;
}

// Built-in platforms keep their canonical order. Names of the developer's own follow, in the order they were added.
export function buildPlatformList(builtIn, custom) {
  return [...PLATFORMS.filter((platform) => builtIn.includes(platform)), ...custom];
}

// A developer's accepted platforms: built-in ids and custom names, without duplicates.
export function normalizeAcceptedPlatforms(list) {
  const seen = new Set();
  const value = [];
  for (const raw of Array.isArray(list) ? list : []) {
    const name = cleanPlatformName(raw);
    const lower = name.toLowerCase();
    if (name === "" || seen.has(lower)) continue;
    seen.add(lower);
    value.push(BUILT_IN.has(lower) ? lower : name);
  }

  if (value.length === 0) return { ok: false, error: { key: "errors.platforms" }, value };
  if (value.length > PLATFORM_LIMIT) {
    return {
      ok: false,
      error: { key: "errors.platform.total", params: { max: PLATFORM_LIMIT } },
      value,
    };
  }
  const custom = value.filter((item) => !BUILT_IN.has(item));
  if (custom.some((item) => [...item].length > LIMITS.platformName.max)) {
    return {
      ok: false,
      error: { key: "errors.platform.tooLong", params: { max: LIMITS.platformName.max } },
      value,
    };
  }
  if (custom.length > CUSTOM_PLATFORM_LIMIT) {
    return {
      ok: false,
      error: { key: "errors.platform.limit", params: { max: CUSTOM_PLATFORM_LIMIT } },
      value,
    };
  }
  return { ok: true, error: null, value };
}

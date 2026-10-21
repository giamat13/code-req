import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  buildPlatformList,
  cleanPlatformName,
  customPlatformError,
  normalizeAcceptedPlatforms,
} from "../../public/js/domain/platforms.js";
import { validateProfile } from "../../public/js/domain/validation.js";

describe("cleanPlatformName", () => {
  test("trims and collapses spaces", () => {
    assert.equal(cleanPlatformName("  Apple   Watch "), "Apple Watch");
  });
});

describe("customPlatformError", () => {
  test("rejects an empty name", () => {
    assert.equal(customPlatformError("", []).key, "errors.platform.empty");
  });

  test("rejects a built-in name, in any letter case", () => {
    assert.equal(customPlatformError("iOS", []).key, "errors.platform.builtIn");
    assert.equal(customPlatformError("Other", []).key, "errors.platform.builtIn");
  });

  test("rejects a name that is already in the list", () => {
    assert.equal(
      customPlatformError("apple watch", ["Apple Watch"]).key,
      "errors.platform.duplicate",
    );
  });

  test("rejects a name longer than thirty characters", () => {
    assert.equal(customPlatformError("a".repeat(31), []).key, "errors.platform.tooLong");
  });

  test("allows a new name", () => {
    assert.equal(customPlatformError("Apple Watch", []), null);
  });
});

describe("buildPlatformList", () => {
  test("keeps built-in platforms in their order, and custom names after them", () => {
    assert.deepEqual(buildPlatformList(["ios", "web"], ["Apple Watch"]), [
      "web",
      "ios",
      "Apple Watch",
    ]);
  });
});

describe("normalizeAcceptedPlatforms", () => {
  test("maps a built-in name to its id and removes duplicates", () => {
    const result = normalizeAcceptedPlatforms(["iOS", "ios", "Apple Watch"]);
    assert.equal(result.ok, true);
    assert.deepEqual(result.value, ["ios", "Apple Watch"]);
  });

  test("requires at least one platform", () => {
    assert.equal(normalizeAcceptedPlatforms([]).error.key, "errors.platforms");
  });

  test("allows at most twenty platforms", () => {
    const many = Array.from({ length: 21 }, (_, index) => `Device ${index}`);
    assert.equal(normalizeAcceptedPlatforms(many).error.key, "errors.platform.total");
  });

  test("allows at most ten custom names", () => {
    const names = Array.from({ length: 11 }, (_, index) => `Device ${index}`);
    assert.equal(normalizeAcceptedPlatforms(names).error.key, "errors.platform.limit");
  });
});

describe("validateProfile with custom platforms", () => {
  test("accepts a profile that lists a platform of the developer's own", () => {
    const result = validateProfile({
      displayName: "Noa",
      acceptedPlatforms: ["web", "Apple Watch"],
      acceptingRequests: true,
    });
    assert.equal(result.ok, true);
    assert.deepEqual(result.values.acceptedPlatforms, ["web", "Apple Watch"]);
  });
});

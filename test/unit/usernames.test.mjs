import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  extractUsername,
  normalizeUsername,
  slugifyUsername,
  usernameError,
} from "../../public/js/domain/usernames.js";

describe("normalizeUsername", () => {
  test("trims, lowercases, and drops a leading @", () => {
    assert.equal(normalizeUsername("  @Alice  "), "alice");
  });

  test("treats missing input as empty", () => {
    assert.equal(normalizeUsername(undefined), "");
  });
});

describe("extractUsername", () => {
  test("reads the username from a developer link", () => {
    assert.equal(extractUsername("https://example.com/developer.html?u=Alice"), "alice");
  });

  test("reads a relative link too", () => {
    assert.equal(extractUsername("developer.html?u=bob-smith&x=1"), "bob-smith");
  });

  test("returns a bare username unchanged apart from case", () => {
    assert.equal(extractUsername("Carol"), "carol");
  });

  test("returns an empty string for a malformed escape", () => {
    assert.equal(extractUsername("developer.html?u=%E0%A4%A"), "");
  });
});

describe("usernameError", () => {
  test("accepts a valid username", () => {
    assert.equal(usernameError("ada-lovelace"), null);
  });

  test("rejects names that are too short", () => {
    assert.equal(usernameError("ab"), "errors.username.length");
  });

  test("rejects names that are too long", () => {
    assert.equal(usernameError("a".repeat(31)), "errors.username.length");
  });

  test("rejects a leading hyphen", () => {
    assert.equal(usernameError("-abc"), "errors.username.format");
  });

  test("rejects uppercase letters", () => {
    assert.equal(usernameError("Abc"), "errors.username.format");
  });

  test("rejects reserved names", () => {
    assert.equal(usernameError("admin"), "errors.username.reserved");
    assert.equal(usernameError("code-req"), "errors.username.reserved");
  });
});

describe("slugifyUsername", () => {
  test("turns a display name into a username", () => {
    assert.equal(slugifyUsername("Ada Lovelace!"), "ada-lovelace");
  });

  test("removes accents", () => {
    assert.equal(slugifyUsername("Zoë Ångström"), "zoe-angstrom");
  });

  test("returns an empty string when nothing usable is left", () => {
    assert.equal(slugifyUsername("!!"), "");
  });
});

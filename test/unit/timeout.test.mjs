import { test } from "node:test";
import assert from "node:assert/strict";
import { withTimeout } from "../../public/js/core/timeout.js";

test("withTimeout", async (t) => {
  await t.test("resolves with the value when the promise settles in time", async () => {
    assert.equal(await withTimeout(Promise.resolve("profile"), 1000), "profile");
  });

  await t.test("passes a rejection through unchanged", async () => {
    await assert.rejects(withTimeout(Promise.reject(new Error("denied")), 1000), /denied/);
  });

  await t.test("rejects when the promise is still pending after the limit", async () => {
    const never = new Promise(() => {});
    await assert.rejects(withTimeout(never, 20), /timed out/);
  });
});

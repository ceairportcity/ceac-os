import test from "node:test";
import assert from "node:assert/strict";
import { settleWorkforceDatasets } from "../src/lib/workforceQueries.js";

test("one rejected Workforce dataset cannot hide the successfully loaded data", async () => {
  const failed = new Error("simulated network interruption");
  const results = await settleWorkforceDatasets([
    ["people", Promise.resolve({ data: [{ profile_id: "a" }], error: null })],
    ["sessions", Promise.reject(failed)],
    ["leave", Promise.resolve({ data: [{ id: "leave1" }], error: null })],
  ]);
  assert.deepEqual(results.map((item) => item.name), ["people", "sessions", "leave"]);
  assert.deepEqual(results[0].data, [{ profile_id: "a" }]);
  assert.equal(results[1].data, null);
  assert.equal(results[1].error, failed);
  assert.deepEqual(results[2].data, [{ id: "leave1" }]);
});

test("PostgREST error responses retain their dataset identity and error", async () => {
  const denied = { code: "42501", message: "restricted" };
  const result = await settleWorkforceDatasets([
    ["protected leave", Promise.resolve({ data: null, error: denied })],
  ]);
  assert.equal(result[0].name, "protected leave");
  assert.equal(result[0].error, denied);
  assert.equal(result[0].data, null);
});

test("missing datasets do not introduce imaginary workforce rows", async () => {
  assert.deepEqual(await settleWorkforceDatasets([]), []);
  assert.deepEqual(await settleWorkforceDatasets(null), []);
  const result = await settleWorkforceDatasets([["missing", Promise.resolve(null)]]);
  assert.deepEqual(result, [{ name: "missing", data: null, error: null }]);
});

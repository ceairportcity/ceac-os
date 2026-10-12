import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

// Exercise the actual checked-in async save handler with isolated Supabase
// stand-ins. This is not a React render, browser or live Storage test.
const source = readFileSync(new URL("../src/screens/AdminProtectedHR.jsx", import.meta.url), "utf8");
const start = source.indexOf("  async function saveRecord() {");
const end = source.indexOf("\n  async function openDocument(", start);
assert.ok(start >= 0 && end > start, "Protected HR save handler is available");
const functionSource = source.slice(start, end).trim();

async function exercise(outcome) {
  const seen = { busy: [], errors: [], notices: [], removals: 0, refreshes: 0, closes: 0 };
  const storage = {
    async upload() {
      if (outcome === "upload-rejected") throw new Error("network upload failed");
      return { error: null };
    },
    async remove() {
      seen.removals++;
      if (outcome === "cleanup-rejected") throw new Error("storage cleanup failed");
      return { error: null };
    },
  };
  const bindings = {
    formReady: true,
    busy: false,
    scopeRef: { current: {
      snapshot: () => ({ employee: "A" }),
      matches: token => token?.employee === "A",
    } },
    setBusy: value => seen.busy.push(value),
    setError: value => seen.errors.push(value),
    setNotice: value => seen.notices.push(value),
    payloadForType: () => ({}),
    recordType: "document",
    me: { org_id: "isolated-org" },
    employeeId: "A",
    crypto: { randomUUID: () => "generated-id" },
    safeFileName: name => name,
    file: { name: "example.pdf" },
    supabase: {
      storage: { from: () => storage },
      async rpc() {
        if (outcome === "rpc-rejected") throw new Error("network outcome unknown");
        if (outcome === "server-error" || outcome === "cleanup-rejected")
          return { error: new Error("transaction rejected") };
        return { error: null };
      },
    },
    fields: { documentType: "contract", title: "Test" },
    replaceId: null,
    reason: "Test reason",
    setComposerOpen: () => { seen.closes++; },
    resetForm: () => {},
    loadSummary: async () => { seen.refreshes++; },
    humanError: (_error, fallback) => fallback,
  };
  const save = runInNewContext("(" + functionSource + ")", bindings, { timeout: 1000 });
  await save();
  return seen;
}

for (const [scenario, expectedRemovals, expectedRefreshes, expectedMessage] of [
  ["upload-rejected", 1, 0, "could not be uploaded"],
  ["server-error", 1, 0, "could not be saved"],
  ["rpc-rejected", 0, 0, "outcome is unconfirmed"],
  ["cleanup-rejected", 1, 0, "could not be saved"],
  ["success", 0, 1, null],
]) {
  test(`Protected HR ${scenario} clears save lock without unsafe file deletion`, async () => {
    const result = await exercise(scenario);
    assert.deepEqual(result.busy, [true, false]);
    assert.equal(result.removals, expectedRemovals);
    assert.equal(result.refreshes, expectedRefreshes);
    if (expectedMessage) {
      assert.match(result.errors.at(-1), new RegExp(expectedMessage));
      assert.equal(result.closes, 0);
    } else {
      assert.equal(result.errors.at(-1), null);
      assert.equal(result.closes, 1);
    }
  });
}

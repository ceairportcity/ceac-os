import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

// Execute the checked-in roster-load callback, not an approximate rewrite.
const source = readFileSync(new URL("../src/screens/AdminProtectedHR.jsx", import.meta.url), "utf8");
const start = source.indexOf("  async function loadPeople() {");
const end = source.indexOf("\n  async function loadSummary(", start);
assert.ok(start >= 0 && end > start);
const handler = source.slice(start, end).trim();

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

function harness(initialRemembered = "") {
  const calls = [];
  const seen = { loading: [], errors: [], people: [], selected: [], contexts: [] };
  const rosterReadGeneration = { current: 0 };
  const scopeRef = { current: { select: id => seen.contexts.push(id) } };
  const bindings = {
    rosterReadGeneration,
    scopeRef,
    setLoading: value => seen.loading.push(value),
    setError: value => seen.errors.push(value),
    setPeople: rows => seen.people.push(rows),
    setEmployeeId: id => seen.selected.push(id),
    employeeId: "",
    me: { id: "hr-fixture" },
    sessionStorage: { getItem: () => initialRemembered },
    humanError: (_error, fallback) => fallback,
    supabase: { rpc: () => {
      const pending = deferred();
      calls.push(pending);
      return pending.promise;
    } },
  };
  const loadPeople = runInNewContext("(" + handler + ")", bindings, { timeout: 1000 });
  return { loadPeople, calls, seen, rosterReadGeneration };
}

test("rejected roster call stops loading and exposes a retryable error", async () => {
  const h = harness();
  const pending = h.loadPeople();
  h.calls[0].reject(new Error("network unavailable"));
  await pending;
  assert.deepEqual(h.seen.loading, [true, false]);
  assert.match(h.seen.errors.at(-1), /could not load/);
  assert.equal(h.seen.people.length, 0);
});

test("stale older roster response cannot replace a later verified roster", async () => {
  const h = harness();
  const old = h.loadPeople();
  const current = h.loadPeople();
  h.calls[1].resolve({ data: [{ id: "employee-B" }], error: null });
  await current;
  h.calls[0].resolve({ data: [{ id: "employee-A" }], error: null });
  await old;
  assert.equal(h.seen.people.length, 1);
  assert.equal(h.seen.people[0][0].id, "employee-B");
  assert.deepEqual(h.seen.selected, ["employee-B"]);
});

test("unmount invalidation discards late confidential employee roster", async () => {
  const h = harness();
  const pending = h.loadPeople();
  h.rosterReadGeneration.current += 1;
  h.calls[0].resolve({ data: [{ id: "employee-A" }], error: null });
  await pending;
  assert.equal(h.seen.people.length, 0);
  assert.equal(h.seen.selected.length, 0);
});

test("remembered employee outside the authorized roster is not selected", async () => {
  const h = harness("unknown-employee");
  const pending = h.loadPeople();
  h.calls[0].resolve({ data: [{ id: "employee-A" }], error: null });
  await pending;
  assert.deepEqual(h.seen.selected, ["employee-A"]);
  assert.deepEqual(h.seen.contexts, ["employee-A"]);
});

test("empty authorized roster settles without fabricating a record", async () => {
  const h = harness();
  const pending = h.loadPeople();
  h.calls[0].resolve({ data: [], error: null });
  await pending;
  assert.deepEqual(h.seen.loading, [true, false]);
  assert.equal(h.seen.selected.length, 0);
});

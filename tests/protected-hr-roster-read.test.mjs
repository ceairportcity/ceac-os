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

function harness(initialRemembered = "", initialEmployeeId = null) {
  const calls = [];
  const seen = { loading: [], errors: [], people: [], selected: [], contexts: [], clearedSummary: 0, clearedLoaded: 0, clearedHistory: 0, closed: 0 };
  const rosterReadGeneration = { current: 0 };
  let currentEmployeeId = null;
  const scopeRef = { current: {
    select: id => { currentEmployeeId=id || null; seen.contexts.push(id); },
    snapshot: () => ({ employeeId: currentEmployeeId }),
  } };
  const bindings = {
    rosterReadGeneration,
    scopeRef,
    setLoading: value => seen.loading.push(value),
    setError: value => seen.errors.push(value),
    setPeople: rows => seen.people.push(rows),
    setSummary: value => { if(value===null) seen.clearedSummary++; },
    setLoadedEmployeeId: value => { if(value===null) seen.clearedLoaded++; },
    setHistoryOpen: () => { seen.clearedHistory++; },
    setComposerOpen: () => { seen.closed++; },
    setEmployeeId: id => seen.selected.push(id),
    employeeId: "",
    initialEmployeeId,
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
  return { loadPeople, calls, seen, rosterReadGeneration, scopeRef };
}

test("rejected roster call stops loading and exposes a retryable error", async () => {
  const h = harness();
  const pending = h.loadPeople();
  h.calls[0].reject(new Error("network unavailable"));
  await pending;
  assert.deepEqual(h.seen.loading, [true, false]);
  assert.match(h.seen.errors.at(-1), /could not load/);
  assert.equal(h.seen.people.length, 1);
  assert.equal(h.seen.people[0].length, 0);
  assert.equal(h.seen.clearedSummary, 1);
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

test("roster removal invalidates previously selected employee and cached HR data", async () => {
  const h = harness();
  h.scopeRef.current.select("employee-A");
  const pending = h.loadPeople();
  h.calls[0].resolve({ data: [{ id: "employee-B" }], error: null });
  await pending;
  assert.deepEqual(h.seen.selected, ["employee-B"]);
  assert.equal(h.scopeRef.current.snapshot().employeeId, "employee-B");
  assert.equal(h.seen.clearedSummary, 1);
  assert.equal(h.seen.clearedLoaded, 1);
  assert.equal(h.seen.closed, 1);
});

test("existing selected employee survives a refresh when still authorised", async () => {
  const h = harness();
  h.scopeRef.current.select("employee-A");
  const pending = h.loadPeople();
  h.calls[0].resolve({ data: [{ id: "employee-A" }, { id: "employee-B" }], error: null });
  await pending;
  assert.deepEqual(h.seen.selected, []);
  assert.equal(h.scopeRef.current.snapshot().employeeId, "employee-A");
  assert.equal(h.seen.clearedSummary, 0);
});

test("empty refreshed roster clears existing selection and protected details", async () => {
  const h = harness();
  h.scopeRef.current.select("employee-A");
  const pending = h.loadPeople();
  h.calls[0].resolve({ data: [], error: null });
  await pending;
  assert.deepEqual(h.seen.selected, [""]);
  assert.equal(h.scopeRef.current.snapshot().employeeId, null);
  assert.equal(h.seen.clearedSummary, 1);
  assert.equal(h.seen.clearedLoaded, 1);
});

test("failed refreshed roster revokes previously displayed confidential selection", async () => {
  const h = harness();
  h.scopeRef.current.select("employee-A");
  const pending = h.loadPeople();
  h.calls[0].reject(new Error("permission unavailable"));
  await pending;
  assert.deepEqual(h.seen.selected, [""]);
  assert.equal(h.seen.people.length, 1);
  assert.equal(h.seen.people[0].length, 0);
  assert.equal(h.scopeRef.current.snapshot().employeeId, null);
  assert.equal(h.seen.clearedSummary, 1);
  assert.equal(h.seen.clearedLoaded, 1);
  assert.equal(h.seen.closed, 1);
});

test("payroll employee link takes precedence over a remembered different employee", async () => {
  const h = harness("employee-A", "employee-B");
  const pending = h.loadPeople();
  h.calls[0].resolve({data:[{id:"employee-A"},{id:"employee-B"}],error:null});
  await pending;
  assert.deepEqual(h.seen.selected,["employee-B"]);
});

test("unavailable payroll employee never silently selects somebody else's salary", async () => {
  const h = harness("employee-A", "outside-roster");
  const pending = h.loadPeople();
  h.calls[0].resolve({data:[{id:"employee-A"}],error:null});
  await pending;
  assert.deepEqual(h.seen.selected,[""]);
  assert.equal(h.scopeRef.current.snapshot().employeeId,null);
});

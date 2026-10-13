import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const source = readFileSync(new URL("../src/screens/AdminPayroll.jsx", import.meta.url), "utf8");
const start = source.indexOf("  async function loadDetail(id) {");
const end = source.indexOf("\n  async function createRun(", start);
assert.ok(start >= 0 && end > start, "Payroll detail reader remains present");
const reader = source.slice(start, end).trim();

function deferred() {
  let resolve, reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

function harness() {
  const pending = [];
  const seen = { loading: [], errors: [], details: [] };
  const detailReadGeneration = { current: 0 };
  const selectedRunRef = { current: null };
  const scope = {
    selectedRunRef,
    detailReadGeneration,
    setDetailLoading: value => seen.loading.push(value),
    setError: value => seen.errors.push(value),
    setDetail: value => seen.details.push(value),
    supabase: { rpc: (_name, args) => {
      const op = deferred();
      pending.push({ ...op, runId: args.p_run_id });
      return op.promise;
    } },
  };
  return { read: runInNewContext("(" + reader + ")", scope, { timeout: 1000 }),
    pending, seen, detailReadGeneration, selectedRunRef };
}

test("late payroll run A may not replace a selected run B", async () => {
  const h = harness();
  h.selectedRunRef.current = "A";
  const old = h.read("A");
  h.selectedRunRef.current = "B";
  const latest = h.read("B");
  h.pending[1].resolve({ data: { run: { id:"B" }, entries:[{ id:"B-employee" }] }, error: null });
  await latest;
  h.pending[0].resolve({ data: { run: { id:"A" }, entries:[{ id:"A-employee" }] }, error: null });
  await old;
  assert.equal(h.seen.details.length, 1);
  assert.equal(h.seen.details[0].run.id, "B");
  assert.equal(h.seen.details[0].entries[0].id, "B-employee");
});

test("payroll RPC must not render details whose run id differs from requested id", async () => {
  const h = harness();
  h.selectedRunRef.current = "B";
  const request = h.read("B");
  h.pending[0].resolve({ data: { run: { id:"A" }, entries:[] }, error: null });
  await request;
  assert.deepEqual(h.seen.details, [null]);
  assert.match(h.seen.errors.at(-1), /could not be verified/);
});

test("empty run detail response is unavailable rather than silently showing old data", async () => {
  const h = harness();
  h.selectedRunRef.current = "B";
  const request = h.read("B");
  h.pending[0].resolve({ data: null, error: null });
  await request;
  assert.deepEqual(h.seen.details, [null]);
  assert.match(h.seen.errors.at(-1), /could not be verified/);
});

test("rejected payroll detail RPC clears the loading state", async () => {
  const h = harness();
  h.selectedRunRef.current = "B";
  const request = h.read("B");
  h.pending[0].reject(new Error("network unavailable"));
  await request;
  assert.deepEqual(h.seen.loading, [true, false]);
  assert.deepEqual(h.seen.details, [null]);
  assert.match(h.seen.errors.at(-1), /network unavailable/);
});

test("unmounted payroll detail request is discarded", async () => {
  const h = harness();
  h.selectedRunRef.current = "A";
  const request = h.read("A");
  h.detailReadGeneration.current += 1;
  h.pending[0].resolve({ data: { run: { id:"A" }, entries:[] }, error: null });
  await request;
  assert.equal(h.seen.details.length, 0);
});

test("payroll render and composer are scoped to selected run before effects settle", () => {
  assert.match(source, /const verifiedDetail = detail\?\.run\?\.id === selectedId \? detail : null/);
  assert.match(source, /const run = verifiedDetail\?\.run \|\| null/);
  assert.match(source, /const entries = Array\.isArray\(verifiedDetail\?\.entries\)/);
  assert.match(source, /run && sheet\?\.runId === selectedId \? sheet : null/);
  assert.match(source, /setSheet\(\{ type:"entry", runId:run\.id, entry \}\)/);
  assert.match(source, /setSheet\(\{ type:"approve", runId:run\.id \}\)/);
  assert.match(source, /setSheet\(null\);\s*if \(selectedId\) void loadDetail/);
});


test("payroll detail refuses an outdated write callback before RPC starts", async () => {
  const h = harness();
  h.selectedRunRef.current = "B";
  await h.read("A");
  assert.equal(h.pending.length, 0);
  assert.equal(h.seen.loading.length, 0);
});

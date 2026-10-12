import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const source = readFileSync(new URL("../src/screens/AdminPayroll.jsx", import.meta.url), "utf8");
const begin = source.indexOf("  async function loadRuns(preferId = null, preferCreated = false) {");
const end = source.indexOf("\n  async function loadDetail(", begin);
assert.ok(begin >= 0 && end > begin);
const loader = source.slice(begin, end).trim();
const defer = () => {
  let resolve, reject;
  const promise = new Promise((rs, rj) => { resolve = rs; reject = rj; });
  return { promise, resolve, reject };
};
function harness() {
  const calls = [];
  const observed = { loading: [], errors: [], rows: [], readiness: [], selections: [], details: [], detailLoading: [], sheets: [], notices: [] };
  const runsReadGeneration = { current: 0 };
  const selectedRunRef = { current: null };
  const manualSelectionGeneration = { current: 0 };
  const detailReadGeneration = { current: 0 };
  const context = {
    runsReadGeneration,
    selectedRunRef,
    manualSelectionGeneration,
    detailReadGeneration,
    setDetail: value => observed.details.push(value),
    setDetailLoading: value => observed.detailLoading.push(value),
    setSheet: value => observed.sheets.push(value),
    setNotice: value => observed.notices.push(value),
    setLoading: value => observed.loading.push(value),
    setError: value => observed.errors.push(value),
    setRuns: rows => observed.rows.push(rows),
    setReadiness: value => observed.readiness.push(value),
    selectRun: id => { selectedRunRef.current = id; observed.selections.push(id); },
    supabase: { rpc: () => {
      const call = defer();
      calls.push(call);
      return call.promise;
    } },
  };
  const read = runInNewContext("(" + loader + ")", context, { timeout: 1000 });
  return { read, calls, observed, runsReadGeneration, selectedRunRef, manualSelectionGeneration, detailReadGeneration };
}
const payload = (ids) => [
  { data: ids.map(id => ({ id })), error: null },
  { data: { employee_count: ids.length }, error: null },
];

test("failed payroll run list request settles loading without stale success", async () => {
  const h = harness();
  const promise = h.read();
  h.calls[0].reject(new Error("network timeout"));
  h.calls[1].resolve({ data: null, error: null });
  await promise;
  assert.deepEqual(h.observed.loading, [true, false]);
  assert.match(h.observed.errors.at(-1), /access could not be verified/);
  assert.equal(h.observed.rows.length, 0);
});

test("older list refresh cannot replace the newer payroll list", async () => {
  const h = harness();
  const old = h.read();
  const recent = h.read();
  const [rr, rs] = payload(["run-B"]);
  h.calls[2].resolve(rr);
  h.calls[3].resolve(rs);
  await recent;
  const [or, os] = payload(["run-A"]);
  h.calls[0].resolve(or);
  h.calls[1].resolve(os);
  await old;
  assert.equal(h.observed.rows.length, 1);
  assert.equal(h.observed.rows[0][0].id, "run-B");
  assert.deepEqual(h.observed.selections, ["run-B"]);
});

test("manual run selection wins over an older create-run refresh preference", async () => {
  const h = harness();
  const pending = h.read("run-A");
  h.selectedRunRef.current = "run-B";
  h.manualSelectionGeneration.current += 1;
  const [rows, status] = payload(["run-A","run-B"]);
  h.calls[0].resolve(rows);
  h.calls[1].resolve(status);
  await pending;
  assert.deepEqual(h.observed.selections, ["run-B"]);
});

test("newly created run is selected when no user selection intervenes", async () => {
  const h = harness();
  const pending = h.read("run-A", true);
  const [rows, status] = payload(["run-A","run-B"]);
  h.calls[0].resolve(rows);
  h.calls[1].resolve(status);
  await pending;
  assert.deepEqual(h.observed.selections, ["run-A"]);
});

test("unmounted payroll list response cannot mutate confidential screen", async () => {
  const h = harness();
  const pending = h.read();
  h.runsReadGeneration.current += 1;
  const [rows, status] = payload(["run-A"]);
  h.calls[0].resolve(rows);
  h.calls[1].resolve(status);
  await pending;
  assert.equal(h.observed.rows.length, 0);
  assert.equal(h.observed.selections.length, 0);
});

test("stale A refresh cannot reselect A when B was selected before refresh started", async () => {
  const h = harness();
  h.selectedRunRef.current = "run-B";
  h.manualSelectionGeneration.current += 1;
  const pending = h.read("run-A");
  const [rows, status] = payload(["run-A", "run-B"]);
  h.calls[0].resolve(rows); h.calls[1].resolve(status);
  await pending;
  assert.deepEqual(h.observed.selections, ["run-B"]);
});

test("failed refresh after authorised load clears cached payroll and composer", async () => {
  const h = harness();
  let pending = h.read();
  let [rows, status] = payload(["run-A"]);
  h.calls[0].resolve(rows); h.calls[1].resolve(status);
  await pending;
  h.observed.details.push({ run: { id: "run-A" } });
  h.observed.sheets.push({ type: "approve", runId: "run-A" });
  pending = h.read();
  h.calls[2].resolve({ error: { message: "permission denied" } });
  h.calls[3].resolve({ data: {}, error: null });
  await pending;
  assert.deepEqual(h.observed.rows.at(-1), []);
  assert.equal(h.observed.readiness.at(-1), null);
  assert.equal(h.observed.details.at(-1), null);
  assert.equal(h.observed.sheets.at(-1), null);
  assert.equal(h.selectedRunRef.current, null);
  assert.match(h.observed.errors.at(-1), /access could not be verified/);
});

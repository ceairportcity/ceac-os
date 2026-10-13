import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

// Exercise the EXACT committed approval/submit handlers against deferred,
// isolated RPC stand-ins. Does not access the real Supabase project.
const source = readFileSync(new URL("../src/screens/AdminPayroll.jsx", import.meta.url), "utf8");
function getHandler(name) {
  const start = source.indexOf(`  async function ${name}(note) {`);
  const end = source.indexOf("\n  async function ", start + 5);
  assert.ok(start >= 0 && end > start, `${name} must remain present`);
  return source.slice(start, end).trim();
}
function deferred() {
  let resolve, reject;
  const promise = new Promise((ok, bad) => { resolve = ok; reject = bad; });
  return { promise, resolve, reject };
}
function harness(name) {
  const calls = [];
  const seen = { busy: [], errors: [], notices: [], sheets: [], loads: [], rpcNames: [] };
  const selectedRunRef = { current:"A" };
  const detailReadGeneration = { current:1 };
  const decisionWriteBusyRef = { current:false };
  const context = {
    detail:{ run:{ id:"A" } },
    busy:false,
    selectedRunRef,
    detailReadGeneration,
    decisionWriteBusyRef,
    setBusy: v => seen.busy.push(v),
    setError: v => seen.errors.push(v),
    setNotice: v => seen.notices.push(v),
    setSheet: v => seen.sheets.push(v),
    loadDetail: async id => { seen.loads.push("detail:" + id); },
    loadRuns: async id => { seen.loads.push("runs:" + id); },
    supabase:{ rpc:(name, args) => {
      const call = deferred();
      seen.rpcNames.push({ name, id: args.p_run_id });
      calls.push(call);
      return call.promise;
    } },
  };
  const save = runInNewContext("(" + getHandler(name) + ")", context, { timeout:1000 });
  return { calls, save, context, seen, selectedRunRef, detailReadGeneration, decisionWriteBusyRef };
}

for (const [name, rpcName, success] of [
  ["submitRun", "payroll_submit_run", "Payroll submitted for Group Pastor approval."],
  ["approveRun", "payroll_approve_run", "Payroll approved and locked."],
]) {
  test(`${name} sends correct run once and refreshes after confirmed success`, async () => {
    const h = harness(name);
    const work = h.save("Documented decision");
    assert.equal(h.calls.length, 1);
    assert.deepEqual(h.seen.rpcNames, [{ name:rpcName, id:"A" }]);
    h.calls[0].resolve({ error:null });
    await work;
    assert.equal(h.seen.notices.at(-1), success);
    assert.deepEqual(h.seen.loads, ["detail:A", "runs:A"]);
    assert.deepEqual(h.seen.busy, [true, false]);
    assert.equal(h.decisionWriteBusyRef.current, false);
  });

  test(`${name} rejects duplicate rapid clicks before React state updates`, async () => {
    const h = harness(name);
    const first = h.save("Decision");
    const second = h.save("Decision");
    assert.equal(h.calls.length, 1);
    h.calls[0].resolve({ error:null });
    await Promise.all([first, second]);
    assert.deepEqual(h.seen.busy, [true, false]);
  });

  test(`${name} preserves retry warning when outcome is network-ambiguous`, async () => {
    const h = harness(name);
    const first = h.save("Decision");
    h.calls[0].reject(new Error("connection interrupted"));
    await first;
    assert.match(h.seen.errors.at(-1), /outcome is unconfirmed/);
    assert.equal(h.seen.sheets.length, 0);
    assert.deepEqual(h.seen.busy, [true, false]);
  });

  test(`${name} reports a confirmed denied transition without claiming success`, async () => {
    const h = harness(name);
    const first = h.save("Decision");
    h.calls[0].resolve({ error:new Error("not authorised") });
    await first;
    assert.equal(h.seen.errors.at(-1), "not authorised");
    assert.equal(h.seen.notices.at(-1), null);
    assert.deepEqual(h.seen.busy, [true, false]);
  });

  test(`${name} never posts old run result into newly selected run`, async () => {
    const h = harness(name);
    const first = h.save("Decision");
    h.selectedRunRef.current = "B";
    h.detailReadGeneration.current += 1;
    h.calls[0].resolve({ error:null });
    await first;
    assert.equal(h.seen.sheets.length, 0);
    assert.equal(h.seen.loads.length, 0);
    assert.equal(h.seen.notices.at(-1), null);
    assert.deepEqual(h.seen.busy, [true, false]);
  });
}

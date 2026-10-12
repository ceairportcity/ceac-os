import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const source = readFileSync(new URL("../src/screens/AdminPayroll.jsx", import.meta.url), "utf8");
function extract(name) {
  const start = source.indexOf("  async function " + name + "(");
  const nextFunction = source.indexOf("\n  async function ", start + 5);
  const nextRender = source.indexOf("\n  // Render only data", start + 5);
  const end = nextFunction >= 0 ? nextFunction : nextRender;
  assert.ok(start >= 0 && end > start, name + " function source must exist");
  return source.slice(start, end).trim();
}
const pause = () => {
  let resolve, reject;
  const promise = new Promise((ok, bad) => { resolve = ok; reject = bad; });
  return { promise, resolve, reject };
};
function harness(action) {
  const requests = [];
  const seen = { busy:[], errors:[], notices:[], sheets:[], reload:[] };
  const creationWriteBusyRef = { current:false };
  const selectedRunRef = { current:"payroll-A" };
  const context = {
    busy:false,
    creationWriteBusyRef,
    selectedRunRef,
    detail:{ run:{ id:"payroll-A" } },
    setBusy: value => seen.busy.push(value),
    setError: value => seen.errors.push(value),
    setNotice: value => seen.notices.push(value),
    setSheet: value => seen.sheets.push(value),
    loadRuns: async id => seen.reload.push(id),
    supabase: { rpc:(name, args) => {
      const pending = pause();
      requests.push({ ...pending, name, args });
      return pending.promise;
    } },
  };
  return {
    act:runInNewContext("(" + extract(action) + ")", context, { timeout:1000 }),
    requests, seen, creationWriteBusyRef, selectedRunRef,
  };
}
const draft = {
  label:"October", start:"2026-10-01", end:"2026-10-31",
  currency:"GHS", payDate:"", note:"Approved period",
};

for (const [action, input, rpcName] of [
  ["createRun", draft, "payroll_create_run"],
  ["createCorrection", "Reason for correction", "payroll_create_correction"],
]) {
  test(action + " sends one RPC and reports confirmed success", async () => {
    const h = harness(action);
    const work = h.act(input);
    assert.equal(h.requests.length, 1);
    assert.equal(h.requests[0].name, rpcName);
    h.requests[0].resolve({ data:"new-run-id", error:null });
    await work;
    assert.deepEqual(h.seen.reload, ["new-run-id"]);
    assert.equal(h.seen.sheets.at(-1), null);
    assert.deepEqual(h.seen.busy, [true,false]);
    assert.equal(h.creationWriteBusyRef.current, false);
  });

  test(action + " rejects rapid duplicate creation", async () => {
    const h = harness(action);
    const first = h.act(input);
    const second = h.act(input);
    assert.equal(h.requests.length, 1);
    h.requests[0].resolve({ data:"new-run-id", error:null });
    await Promise.all([first,second]);
    assert.deepEqual(h.seen.busy, [true,false]);
  });

  test(action + " exposes a denied write without claiming a created run", async () => {
    const h = harness(action);
    const first = h.act(input);
    h.requests[0].resolve({ data:null, error:new Error("unauthorised") });
    await first;
    assert.equal(h.seen.errors.at(-1), "unauthorised");
    assert.equal(h.seen.reload.length, 0);
    assert.deepEqual(h.seen.busy, [true,false]);
  });

  test(action + " preserves uncertainty on network rejection", async () => {
    const h = harness(action);
    const first = h.act(input);
    h.requests[0].reject(new Error("network dropped"));
    await first;
    assert.match(h.seen.errors.at(-1), /outcome is unconfirmed/);
    assert.equal(h.seen.reload.length, 0);
    assert.deepEqual(h.seen.busy, [true,false]);
  });

  test(action + " rejects an apparently successful response without an ID", async () => {
    const h = harness(action);
    const first = h.act(input);
    h.requests[0].resolve({ data:null, error:null });
    await first;
    assert.match(h.seen.errors.at(-1), /could not be confirmed/);
    assert.equal(h.seen.reload.length, 0);
  });
}

test("a switched payroll run cannot accept old correction completion", async () => {
  const h = harness("createCorrection");
  const work = h.act("Correct amount");
  h.selectedRunRef.current = "payroll-B";
  h.requests[0].resolve({ data:"correction-A", error:null });
  await work;
  assert.equal(h.seen.reload.length, 0);
  assert.equal(h.seen.sheets.length, 0);
  assert.deepEqual(h.seen.busy, [true,false]);
});

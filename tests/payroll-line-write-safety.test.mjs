import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const source = readFileSync(new URL("../src/screens/AdminPayroll.jsx", import.meta.url), "utf8");
function getHandler(name) {
  const start = source.indexOf("  async function " + name + "(");
  const end = source.indexOf("\n  async function ", start + 5);
  assert.ok(start >= 0 && end > start, "Missing employee payroll mutation " + name);
  return source.slice(start, end).trim();
}
function deferred() {
  let resolve, reject;
  const promise = new Promise((ok, bad) => { resolve = ok; reject = bad; });
  return { promise, resolve, reject };
}
function harness(name) {
  const requests = [];
  const events = { busy:[], errors:[], notices:[], sheets:[], reload:[] };
  const selectedRunRef = { current:"run-A" };
  const lineWriteBusyRef = { current:false };
  const context = {
    busy:false,
    detail:{ run:{ id:"run-A" } },
    selectedRunRef,
    lineWriteBusyRef,
    setBusy: value => events.busy.push(value),
    setError: value => events.errors.push(value),
    setNotice: value => events.notices.push(value),
    setSheet: value => events.sheets.push(value),
    amountToMinor: value => Number(value) * 100,
    loadDetail: async id => events.reload.push("detail:" + id),
    loadRuns: async id => events.reload.push("runs:" + id),
    supabase: { rpc:(rpc,args) => {
      const req = deferred();
      requests.push({ ...req, rpc, args });
      return req.promise;
    } },
  };
  return {
    work:runInNewContext("(" + getHandler(name) + ")", context, { timeout:1000 }),
    requests, events, selectedRunRef, lineWriteBusyRef,
  };
}
const entry = {
  employeeId:"person-A", category:"transport_allowance", direction:"addition",
  label:"Travel", amount:"20", note:"Authorised expense",
};
const employee = { employee_id:"person-A" };
const line = {
  id:"line-A", category:"transport_allowance", direction:"addition",
  label:"Travel",
};
for (const [name, args] of [
  ["saveLine", [entry]],
  ["removeLine", [employee,line]],
]) {
  test(name + " writes once and refreshes only the actual run", async () => {
    const h = harness(name);
    const result = h.work(...args);
    assert.equal(h.requests.length, 1);
    assert.equal(h.requests[0].rpc, "payroll_set_line");
    assert.equal(h.requests[0].args.p_run_id, "run-A");
    h.requests[0].resolve({ error:null });
    await result;
    assert.deepEqual(h.events.reload, ["detail:run-A", "runs:run-A"]);
    assert.equal(h.events.sheets.at(-1), null);
    assert.deepEqual(h.events.busy, [true,false]);
    assert.equal(h.lineWriteBusyRef.current, false);
  });

  test(name + " suppresses a duplicate rapid click", async () => {
    const h = harness(name);
    const first = h.work(...args);
    const second = h.work(...args);
    assert.equal(h.requests.length, 1);
    h.requests[0].resolve({ error:null });
    await Promise.all([first,second]);
    assert.deepEqual(h.events.busy, [true,false]);
  });

  test(name + " keeps form unlocked on a confirmed permission denial", async () => {
    const h = harness(name);
    const result = h.work(...args);
    h.requests[0].resolve({ error:new Error("permission denied") });
    await result;
    assert.equal(h.events.errors.at(-1), "permission denied");
    assert.equal(h.events.reload.length, 0);
    assert.deepEqual(h.events.busy, [true,false]);
  });

  test(name + " does not claim success on uncertain network rejection", async () => {
    const h = harness(name);
    const result = h.work(...args);
    h.requests[0].reject(new Error("connection failed"));
    await result;
    assert.match(h.events.errors.at(-1), /outcome is unconfirmed/);
    assert.equal(h.events.reload.length, 0);
    assert.deepEqual(h.events.busy, [true,false]);
  });

  test(name + " does not send stale success to the next selected run", async () => {
    const h = harness(name);
    const result = h.work(...args);
    h.selectedRunRef.current = "run-B";
    h.requests[0].resolve({ error:null });
    await result;
    assert.equal(h.events.reload.length, 0);
    assert.equal(h.events.sheets.length, 0);
    assert.equal(h.events.notices.at(-1), null);
    assert.deepEqual(h.events.busy, [true,false]);
  });
}
test("base salary lines remain immutable through removeLine UI", async () => {
  const h = harness("removeLine");
  await h.work(employee,{...line,category:"base_salary"});
  assert.equal(h.requests.length, 0);
  assert.equal(h.events.busy.length, 0);
});

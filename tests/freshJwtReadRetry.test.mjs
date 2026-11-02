import { test } from "node:test";
import assert from "node:assert/strict";
import { isFreshJwtClockRejection, retryFreshJwtRejection } from "../src/lib/freshJwtReadRetry.js";

const clockError = () => Object.assign(new Error("JWT issued at future"), { code: "PGRST303" });

test("fresh JWT read retries are bounded and only for verified PostgREST clock errors", async () => {
  const waits = [];
  let calls = 0;
  const result = await retryFreshJwtRejection(async () => {
    if (++calls < 3) throw clockError();
    return { id: "verified", permissions: ["read"] };
  }, async ms => { waits.push(ms); });
  assert.deepEqual(result, { id: "verified", permissions: ["read"] });
  assert.equal(calls, 3);
  assert.deepEqual(waits, [250, 700]);
  assert.equal(isFreshJwtClockRejection({ code: "PGRST303", message: "JWT issued at future" }), true);
  assert.equal(isFreshJwtClockRejection({ code: "42501", message: "Permission denied" }), false);
});

test("access denial is never retried, and persistent clock errors fail closed", async () => {
  let count = 0;
  const denied = Object.assign(new Error("Permission denied"), { code: "42501" });
  await assert.rejects(retryFreshJwtRejection(async () => { count++; throw denied; }, async () => {}), err => err === denied);
  assert.equal(count, 1);
  count = 0;
  const delays = [];
  await assert.rejects(retryFreshJwtRejection(async () => { count++; throw clockError(); }, async ms => { delays.push(ms); }), err => err.code === "PGRST303");
  assert.equal(count, 4);
  assert.deepEqual(delays, [250, 700, 1500]);
});

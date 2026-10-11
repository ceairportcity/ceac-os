import test from "node:test";
import assert from "node:assert/strict";
import { isValidPolicyAmount } from "../src/lib/workforcePolicyNumbers.js";

test("policy amounts accept zero and positive finite Ghana leave entitlements", () => {
  for (const value of [0, "0", "0.0", "24", 24, "6.5", " 10 "]) {
    assert.equal(isValidPolicyAmount(value), true, String(value));
  }
});

test("policy activation rejects Infinity, NaN, negative and missing values", () => {
  for (const value of ["", "   ", null, undefined, "Infinity", Infinity,
    "-Infinity", -Infinity, Number.NaN, "NaN", -1, "-0.1", "24 days", {}, true, "1e9999"]) {
    assert.equal(isValidPolicyAmount(value), false, String(value));
  }
});

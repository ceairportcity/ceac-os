import test from "node:test";
// Already registered in verify:source; include the protected Payroll run privacy regression.
import "./payroll-run-context-integrity.test.mjs";
import "./payroll-run-list-scope.test.mjs";
import assert from "node:assert/strict";
import { amountToMinor, protectedMoney } from "../src/lib/protectedCompensation.js";

test("employee compensation records safe whole Ghana minor units", () => {
  assert.equal(amountToMinor("1,245.50"), 124550);
  assert.equal(amountToMinor("24"), 2400);
  assert.equal(amountToMinor("0.10"), 10);
  assert.equal(amountToMinor("0"), 0);
});

test("invalid and missing compensation inputs never silently overflow", () => {
  for (const input of [undefined, null, "", "not a number", "NaN", "Infinity", "1e307", "1e1000"]) {
    assert.equal(amountToMinor(input), 0, String(input));
  }
});

test("fractional minor units round rather than misrepresent monetary units", () => {
  assert.equal(amountToMinor("1.234"), 123);
  assert.equal(amountToMinor("1.236"), 124);
});

test("protected HR renderers distinguish missing and unverifiable compensation", () => {
  assert.equal(protectedMoney(null), "Not recorded");
  assert.equal(protectedMoney("invalid"), "Amount could not be verified");
  assert.equal(protectedMoney(Number.POSITIVE_INFINITY), "Amount could not be verified");
  assert.equal(protectedMoney(5000, "BAD4"), "Currency could not be verified");
  assert.match(protectedMoney(245050), /GHS/);
});

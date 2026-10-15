import test from "node:test";
import assert from "node:assert/strict";
import { accraDayOffset } from "../src/lib/workforceDate.js";

const iso = (date) => date.toISOString().slice(0, 10);

test("Accra day math does not depend on a remote browser timezone or clock time", () => {
  const now = Date.parse("2026-10-11T23:59:59Z");
  assert.equal(iso(accraDayOffset(0, now)), "2026-10-11");
  assert.equal(iso(accraDayOffset(1, now)), "2026-10-12");
  assert.equal(iso(accraDayOffset(13, now)), "2026-10-24");
});

test("Accra leave planning calendar crosses month and year boundaries correctly", () => {
  const now = Date.parse("2026-12-31T01:15:00Z");
  assert.equal(iso(accraDayOffset(-1, now)), "2026-12-30");
  assert.equal(iso(accraDayOffset(0, now)), "2026-12-31");
  assert.equal(iso(accraDayOffset(1, now)), "2027-01-01");
});

test("attendance calendar rejects fractional offsets and invalid timestamps", () => {
  assert.throws(() => accraDayOffset(0.5, Date.now()), TypeError);
  assert.throws(() => accraDayOffset(0, Number.NaN), TypeError);
});

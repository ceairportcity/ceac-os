import test from "node:test";
import assert from "node:assert/strict";
import { verifiedReportingQuarter } from "../src/lib/quarterlyReportingWindow.js";

test("recognises exact first and final quarters", () => {
  assert.deepEqual(verifiedReportingQuarter({ starts_on:"2026-01-01", ends_on:"2026-03-31" }),
    { year:2026,quarter:1,label:"Q1 2026",starts_on:"2026-01-01",ends_on:"2026-03-31" });
  assert.equal(verifiedReportingQuarter({ starts_on:"2026-10-01", ends_on:"2026-12-31" })?.label,"Q4 2026");
});
test("requires precise quarterly bounds and does not promote a monthly or custom period", () => {
  for (const [starts_on,ends_on] of [["2026-04-01","2026-05-31"],["2026-07-02","2026-09-30"],
    ["2026-07-01","2026-09-29"],["2026-02-01","2026-04-30"],["2026-13-01","2026-15-99"]]) {
    assert.equal(verifiedReportingQuarter({ starts_on,ends_on }),null);
  }
});
test("does not infer invalid, empty or missing dates", () => {
  for (const entry of [null,{}, {starts_on:null,ends_on:null},
    {starts_on:"2026-1-1",ends_on:"2026-03-31"}]) {
    assert.equal(verifiedReportingQuarter(entry),null);
  }
});

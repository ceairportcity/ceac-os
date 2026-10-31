import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { reportQuarterRange } from "../src/lib/ghanaReportingDates.js";
import { verifiedReportingQuarter } from "../src/lib/quarterlyReportingWindow.js";
const text=path=>readFileSync(path,"utf8");

test("Ghana quarter spans whole calendar months, including leap days",()=>{
  const q1=reportQuarterRange(new Date("2028-02-29T16:00:00Z"));
  assert.deepEqual(q1,{start:"2028-01-01",end:"2028-03-31",label:"Q1 2028"});
  assert.deepEqual(reportQuarterRange(new Date("2026-10-31T22:20:00Z")),
    {start:"2026-10-01",end:"2026-12-31",label:"Q4 2026"});
  assert.deepEqual(verifiedReportingQuarter({starts_on:q1.start,ends_on:q1.end}),
    {year:2028,quarter:1,label:"Q1 2028",starts_on:"2028-01-01",ends_on:"2028-03-31"});
  assert.equal(verifiedReportingQuarter({starts_on:"2026-10-01",ends_on:"2026-11-30"}),null);
});

test("quarterly filing is an Admin-opened validated period, not a relabelled month",()=>{
 const migration=text("supabase/migrations/20261031020346_quarterly_reporting_periods.sql");
 const admin=text("src/screens/Reports.jsx");
 const manager=text("src/screens/ManagerReports.jsx");
 assert.match(migration,/report_periods_kind_check/);
 assert.match(migration,/report_periods_quarter_calendar_check/);
 assert.match(migration,/kind IN \('week','month','quarter','project','year'\)/);
 assert.match(admin,/reportQuarterRange\(now\)/);
 assert.match(admin,/kind === "quarter" && !verifiedReportingQuarter/);
 assert.match(manager,/\["quarter","Quarterly"\]/);
 assert.match(manager,/mode === "quarter" \? 93 : 62/);
 assert.match(manager,/save_and_submit_report/);
});

import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const screen=readFileSync("src/screens/Compliance.jsx","utf8");
const report=readFileSync("src/components/CompliancePeriodReport.jsx","utf8");
test("attendance reporting is available within authorised Compliance",()=>{
 assert.match(screen,/tab==="reports"&&canManage/);
 assert.match(screen,/import CompliancePeriodReport/);
 assert.match(report,/compliance_period_facts/);
 assert.match(report,/p_limit:25/);
 assert.match(report,/onClick=\{\(\)=>setPage/);
});
test("period report distinguishes missing evidence from misconduct",()=>{
 assert.match(report,/No start recorded does not mean a confirmed absence/);
 assert.match(report,/Approved leave/);
 assert.match(report,/Open session requires review/);
});

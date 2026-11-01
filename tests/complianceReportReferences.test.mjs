import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const src=readFileSync("src/components/ComplianceReportReferences.jsx","utf8");
const admin=readFileSync("src/screens/Reports.jsx","utf8");
const exec=readFileSync("src/screens/ExecutiveReports.jsx","utf8");
test("HR and Executive Reports reuse authorised immutable Memo submissions",()=>{
 assert.match(src,/from\("memos"\)/);
 assert.match(src,/sent_at/);
 assert.match(src,/\.neq\("status","draft"\)/);
 assert.match(src,/Monthly Compliance Summary/);
 assert.match(admin,/ComplianceReportReferences me=\{me\}/);
 assert.match(exec,/ComplianceReportReferences me=\{me\}/);
 assert.doesNotMatch(src,/service_role|org_staff_directory|payroll/);
});

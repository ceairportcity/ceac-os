import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const report=readFileSync("src/components/CompliancePeriodReport.jsx","utf8");
test("monthly Compliance Memo is reviewed and recipient-selected before sending",()=>{
 assert.match(report,/prepareMonthlyMemo/);
 assert.match(report,/save_memo_draft/);
 assert.match(report,/p_decision_scope:"cross_department"/);
 assert.match(report,/p_to:\[\],p_cc:\[\]/);
 assert.match(report,/new Set\(people\.map/);
 assert.match(report,/A missing start is not automatically an absence/);
 assert.doesNotMatch(report,/send_memo\(/);
});

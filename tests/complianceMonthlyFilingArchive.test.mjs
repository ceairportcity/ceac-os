import { test } from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const sql=readFileSync("supabase/migrations/20261101140000_compliance_monthly_filing_archive.sql","utf8");
test("official Compliance filings require sent, verified, authorised and immutable records",()=>{
 for(const term of ["compliance.manage","scope_unit_id IS NULL","sent_at IS NOT NULL",
 "compliance_period_facts","app_can_access_memo(memo_id)","BEFORE UPDATE OR DELETE"])
  assert.ok(sql.includes(term),term);
 assert.doesNotMatch(sql,/payroll|wage deduction|employee score/);
});

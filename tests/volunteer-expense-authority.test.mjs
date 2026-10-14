import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read=(p)=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const sql=read("supabase/migrations/20261014231500_145_volunteer_expense_workflow.sql");
const ui=read("src/components/VolunteerExpenseWorkflow.jsx");

test("volunteer claims are separate from salary/payroll and require active roster membership",()=>{
  assert.match(sql,/employment_type='volunteer' and er\.employment_status='active'/);
  assert.match(sql,/volunteer_expense_idempotency unique\(org_id,client_key\)/);
  assert.doesNotMatch(sql,/insert into hr_private\.payroll|update hr_private\.payroll/i);
  assert.match(ui,/Volunteers are unsalaried/);
});
test("manager confirms duty; HR and Finance consultation both precede approval",()=>{
  assert.match(sql,/r\.unit_id not in\(select public\.app_managed_units\(\)\)/);
  assert.match(sql,/p_authority in \('hr','finance'\)/);
  assert.match(sql,/v_consult_count<>2 or v_ready<>2/);
  assert.match(sql,/not public\.app_has_capability\('people\.manage'|v_hr:=public\.app_is_admin\(\)/);
  assert.match(sql,/u\.handles_finance/);
  assert.match(sql,/v_actor=v_request\.volunteer_profile_id|v_request\.volunteer_profile_id=v_actor/);
});
test("only Finance records actual payment with a reference after approval",()=>{
  assert.match(sql,/state='approved' for update/);
  assert.match(sql,/payment_reference=btrim\(p_payment_reference\)/);
  assert.match(sql,/revoke all on function public\.volunteer_expense_record_payment/);
  assert.match(ui,/Approval does not mean payment was made/);
});
test("no authenticated direct writes to volunteer expense or consultation rows",()=>{
  assert.match(sql,/revoke all on public\.volunteer_expense_requests from public,anon,authenticated/);
  assert.match(sql,/revoke all on public\.volunteer_expense_consultations from public,anon,authenticated/);
  assert.match(sql,/volunteer_expense_my_assignments\(\)/);
  assert.match(ui,/crypto\.randomUUID\(\)/);
});

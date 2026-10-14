import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const text=(file)=>readFileSync(new URL("../"+file,import.meta.url),"utf8");
const sql=text("supabase/migrations/20261014224500_144_performance_manager_hr_publication.sql");
const page=text("src/screens/Performance.jsx");

test("unreleased manager narratives and legacy confidential columns are not exposed through authenticated Data API",()=>{
  assert.match(sql,/revoke select on public\.appraisals from public,anon,authenticated/);
  assert.match(sql,/grant select \(/);
  const safeCols=sql.slice(sql.indexOf("grant select ("),sql.indexOf(") on public.appraisals"));
  assert.doesNotMatch(safeCols,/assessment|development_notes/);
  assert.match(sql,/appraisal_entries\.entry_type in \('employee_reflection','staff_response'\)/);
  assert.match(sql,/a\.status in \('shared','closed'\)/);
  assert.match(sql,/drop policy if exists stage7_development_read/);
});
test("assigned Manager requests review release and HR independently authorises publication",()=>{
  assert.match(sql,/public\.performance_request_release/);
  assert.match(sql,/v_review\.manager_id is distinct from v_actor/);
  assert.match(sql,/e\.entry_type='manager_assessment'/);
  assert.match(sql,/public\.performance_hr_authorise_release/);
  assert.match(sql,/not public\.app_is_admin\(\)/);
  assert.match(sql,/not public\.app_has_capability\('performance\.admin',null\)/);
  assert.match(sql,/v_req\.requested_by=v_actor/);
  assert.match(sql,/status='shared'/);
  assert.match(sql,/revoke execute on function public\.share_performance_review\(uuid\)/);
});
test("recording formal review protects draft publication and released narrative history",()=>{
  assert.match(sql,/p_entry_type='staff_response' and v_appraisal\.status not in \('shared','closed'\)/);
  assert.match(sql,/p_entry_type in \('manager_assessment','conversation_record'\)/);
  assert.match(sql,/v_appraisal\.status in \('shared','closed'\)/);
  assert.doesNotMatch(sql,/delete from public\.appraisal_entries|delete from public\.appraisals/i);
});
test("Review page requests HR authorization and does not claim unpublished manager narrative is visible",()=>{
  assert.match(page,/rpc\("performance_request_release"/);
  assert.match(page,/rpc\("performance_hr_authorise_release"/);
  assert.match(page,/HR authorise publication/);
  assert.match(page,/Manager request recorded/);
  assert.match(page,/Formal manager assessment and development-plan narrative are visible only after HR release/);
  assert.doesNotMatch(page,/supabase\.rpc\("share_performance_review"|The employee already sees recorded narrative as it is written/);
});

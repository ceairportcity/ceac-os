import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const sql=read("supabase/migrations/20261014224500_144_hr_performance_release.sql");
const ui=read("src/screens/Performance.jsx");
test("manager cannot directly release an assessment",()=>{
  assert.match(ui,/rpc\("performance_request_release"/);
  assert.doesNotMatch(ui,/rpc\("share_performance_review"/);
  assert.match(sql,/Manager requests assessment release; HR authorises publication/);
});
test("HR approves exact version and controls employee visibility",()=>{
  assert.match(sql,/not public\.app_is_admin\(\)/);
  assert.match(sql,/not public\.app_has_capability\('people\.manage',null\)/);
  assert.match(sql,/v_latest is distinct from v_request\.requested_assessment_id/);
  assert.match(sql,/performance_employee_release_visible/);
  assert.match(sql,/revoke select on public\.appraisals/);
  assert.match(ui,/rpc\("performance_hr_decide_release"/);
});

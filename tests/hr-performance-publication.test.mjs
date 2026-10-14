import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
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

test("publication SQL is validly quoted, unique and requires independent HR approval",()=>{
  const existing=readdirSync(new URL("../supabase/migrations/",import.meta.url))
    .filter(name=>name.startsWith("20261014224500_144"));
  assert.deepEqual(existing,["20261014224500_144_hr_performance_release.sql"]);
  assert.doesNotMatch(sql,/as \$\s*\n|\n\$;/);
  assert.match(sql,/language sql stable security definer set search_path=''\s+as \$\$/);
  assert.match(sql,/v_actor=v_request\.requested_by/);
  assert.match(ui,/currentReleaseRequest\.requested_by === me\.id/);
});
test("unreleased narrative and development plans are hidden from the employee",()=>{
  assert.match(sql,/drop policy if exists stage7_entries_read/);
  assert.match(sql,/drop policy if exists stage7_development_read/);
  assert.match(sql,/revoke select on public\.appraisals from public,anon,authenticated/);
  assert.match(sql,/performance_employee_release_visible\(appraisal_id,created_at\)/);
});

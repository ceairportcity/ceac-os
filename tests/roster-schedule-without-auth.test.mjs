import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const sql=read("supabase/migrations/20261014231500_145_roster_schedule_no_fake_auth.sql");
const people=read("src/screens/People.jsx");
const editor=read("src/components/EmployeeScheduleEditor.jsx");
test("HR can record a seven-day roster schedule without a fabricated Auth identity",()=>{
  assert.match(sql,/workforce_record_roster_pattern/);
  assert.match(sql,/alter column profile_id drop not null/);
  assert.match(sql,/employee_id is not null/);
  assert.match(sql,/not public\.app_is_admin\(\)/);
  assert.match(sql,/not public\.app_has_capability\('workforce\.manage',null\)/);
  assert.match(sql,/jsonb_object_keys\(p_day_map\)\)<>7/);
  assert.doesNotMatch(sql,/insert into auth\.users|delete from auth\.users/i);
});
test("roster-only employee detail offers effective-dated HR editor",()=>{
  assert.match(people,/<EmployeeScheduleEditor me=\{me\} profileId=\{person\.profile_id\} employeeId=\{person\.employee_id\}/);
  assert.match(editor,/workforce_record_roster_pattern/);
  assert.match(editor,/p_employee_id:employeeId/);
  assert.match(sql,/workforce_roster_schedule_link/);
});

test("HR schedule is always edited and reviewed as a full recorded week with real version history",()=>{
 const workforce=read("src/screens/Workforce.jsx");
 const workspace=read("src/components/WorkforceEmployeeScheduleWorkspace.jsx");
 const week=read("src/lib/workforceRecordedWeek.js");
 assert.match(workforce,/<WorkforceEmployeeScheduleWorkspace me=\{me\}/);
 assert.doesNotMatch(workforce,/<summary>Adjust one weekday \(legacy\)<\/summary>/);
 assert.match(workspace,/admin_employee_roster_summary/);
 assert.match(workspace,/employeeId=\{person\.id\}/);
 assert.match(editor,/workforceRecordedWeek\(inspected,visibleTypes\)/);
 assert.match(editor,/Inspect a saved schedule version/);
 assert.match(editor,/p_supersedes_id:previous\?\.id/);
 assert.match(editor,/const refreshed=await load\(data\)/);
 assert.match(week,/Recorded day type not available/);
});
test("Unlinked employee scheduling does not infer login, attendance or leave entitlement",()=>{
 assert.match(editor,/employeeId \? "workforce_record_roster_pattern" : "workforce_record_pattern"/);
 assert.match(editor,/The server returned a schedule reference, but its employee-history readback could not be verified/);
 assert.match(editor,/Do not calculate historical leave or lateness from an unconfirmed schedule/);
 assert.doesNotMatch(editor,/supabase\.auth\.signUp|insert\("auth\.users"\)/);
});

test("schedule closes stale HR employee evidence on account switch and incomplete day-type reads",()=>{
 assert.match(editor,/const verified = verifiedScope === scope && !loading && !error/);
 assert.match(editor,/setVerifiedScope\(null\)/);
 assert.match(editor,/setVersions\(\[\]\)/);
 assert.match(editor,/types\.count!==types\.data\.length/);
 assert.match(editor,/Reload authorised schedule/);
 assert.match(editor,/if \(!verified\) return/);
 assert.match(editor,/writeBusy\.current \|\| !verified \|\| !valid/);
});

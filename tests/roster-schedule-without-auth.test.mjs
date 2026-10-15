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

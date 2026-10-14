import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const text = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const people = text("src/screens/People.jsx");
const editor = text("src/components/EmployeeScheduleEditor.jsx");
const sql = text("supabase/migrations/20261014220000_142_hr_schedule_authority.sql");

test("People Time & Leave exposes actual HR-authorised seven-day editor", () => {
  assert.match(people, /<EmployeeScheduleEditor me=\{me\} profileId=\{person\.profile_id\}/);
  assert.match(editor, /Boolean\(me\?\.is_admin\)/);
  assert.match(editor, /includes\("workforce\.manage"\)/);
  for (const day of ["mon","tue","wed","thu","fri","sat","sun"]) {
    assert.match(editor, new RegExp('"'+day+'"'));
  }
  assert.match(editor, /const complete = DAYS\.every/);
  assert.match(editor, /type\.session_expected/);
});

test("the People edit saves attributable versioned schedule and never silently rewrites history", () => {
  assert.match(editor, /supabase\.rpc\("workforce_record_pattern"/);
  assert.match(editor, /p_supersedes_id:previous\?\.id \|\| null/);
  assert.match(editor, /p_reason:reason\.trim\(\)/);
  assert.match(editor, /p_effective_from:startDate/);
  assert.match(editor, /Check recorded history before trying again/);
  assert.doesNotMatch(editor, /from\("workforce_schedule_versions"\)\.update\(/);
});

test("DB scheduling authority is HR/Admin-only independent of browser capabilities", () => {
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.workforce_record_pattern/i);
  assert.match(sql, /not public\.app_is_admin\(\)/);
  assert.match(sql, /not public\.app_has_capability\('workforce\.manage',null\)/);
  assert.match(sql, /revoke all on function public\.workforce_record_pattern/);
  assert.match(sql, /to authenticated,service_role/);
  assert.doesNotMatch(sql, /delete from public\.workforce_schedule_versions|drop table/i);
});

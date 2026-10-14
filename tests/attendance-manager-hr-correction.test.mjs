import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const sql = read("supabase/migrations/20261014223000_143_attendance_manager_hr_correction.sql");
const ui = read("src/components/AttendanceCorrectionWorkflow.jsx");
const workforce = read("src/screens/Workforce.jsx");

test("staff correction requests do not rewrite factual work sessions or create payroll effects", () => {
  assert.match(sql, /create table if not exists public\.attendance_correction_requests/);
  assert.match(sql, /public\.attendance_request_correction\(/);
  assert.match(sql, /p_profile_id<>v_actor and not public\.app_is_admin\(\)/);
  assert.match(sql, /p_session_id is not null and not exists\(select 1 from public\.work_sessions/);
  assert.doesNotMatch(sql, /update public\.work_sessions|delete from public\.work_sessions|update hr_private\.payroll/i);
});

test("manager approval is scoped to current managed units and records a separate correction overlay", () => {
  assert.match(sql, /public\.attendance_manager_decide_correction\(/);
  assert.match(sql, /where id=p_request_id and org_id=v_org for update/);
  assert.match(sql, /er\.unit_id in\(select public\.app_managed_units\(\)\)/);
  assert.match(sql, /insert into public\.attendance_corrections/);
  assert.match(sql, /status='manager_approved'/);
  assert.match(sql, /decision_note=btrim\(p_note\)/);
});

test("HR audit is separately authorised and attributable; API users cannot edit evidence", () => {
  assert.match(sql, /public\.attendance_hr_audit_correction/);
  assert.match(sql, /not public\.app_is_admin\(\)/);
  assert.match(sql, /not public\.app_has_capability\('attendance\.correct',null\)/);
  assert.match(sql, /public\.attendance_correction_audits/);
  assert.match(sql, /request_id uuid not null unique/);
  assert.match(sql, /grant select on public\.attendance_correction_requests to authenticated/);
  assert.match(sql, /grant select on public\.attendance_correction_audits to authenticated/);
  assert.doesNotMatch(sql, /grant (insert|update|delete) on public\.attendance_correction_/i);
});

test("all four Workforce variants expose the shared correction queue and do not invent missing schema", () => {
  assert.equal((workforce.match(/<AttendanceCorrectionWorkflow me=\{me\} \/>/g)||[]).length,4);
  assert.match(ui, /isPendingSchema/);
  assert.match(ui, /Existing attendance history remains available/);
  assert.match(ui, /supabase\.rpc\("attendance_request_correction"/);
  assert.match(ui, /supabase\.rpc\("attendance_manager_decide_correction"/);
  assert.match(ui, /supabase\.rpc\("attendance_hr_audit_correction"/);
  assert.match(ui, /original work session is never replaced/);
});

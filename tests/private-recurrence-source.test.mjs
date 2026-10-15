import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import test from "node:test";

const file=(path)=>readFileSync(path,"utf8");
const migration=file("supabase/migrations/20261015090000_147_private_personal_task_recurrence.sql");
const security=file("supabase/tests/private_personal_recurrence_gate.sql");
const calendar=file("src/screens/StaffCalendar.jsx");
const recurrence=file("src/components/PersonalRecurringTaskComposer.jsx");
const editor=file("src/components/PersonalPlanningEditor.jsx");
const manifest=file("scripts/ops/ceac-release-baseline-readonly.sql");
const compatibility=file("src/lib/stage1SchemaCompatibility.js");

test("recurrence is an owner-private, unprivileged and idempotent database surface",()=>{
  assert.match(migration,/create policy personal_task_series_owner_all/);
  assert.match(migration,/profile_id=auth\.uid\(\) and org_id=public\.app_org_id\(\)/);
  assert.match(migration,/personal_materialize_task_series/);
  assert.match(migration,/security invoker/g);
  assert.doesNotMatch(migration.split("\n").filter(line=>!line.trimStart().startsWith("--")).join("\n"), /security definer/i, "new recurring RPCs must not run with elevated privileges");
  assert.match(migration,/on conflict \(series_id,plan_date\).*where series_id is not null/s);
  assert.match(migration,/get diagnostics v_rows=row_count/);
  assert.match(migration,/personal_task_series_owner_guard/);
  assert.match(migration,/dismissed_at timestamptz/);
  assert.match(security,/Manager read another person private series/);
  assert.match(security,/Manager materialised Staff series without ownership/);
  assert.match(security,/missed occurrences were silently completed or hidden/);
  assert.match(security,/editing series rewrote completed occurrence history/);
  assert.match(security,/monthly rollover must clamp to month-end/);
  assert.match(security,/dismissed occurrence was resurrected/);
});

test("private calendar supports the complete approved recurrence and edit/remove contract",()=>{
  for (const choice of ["daily","weekdays","weekly","monthly","custom"]) {
    assert.ok(recurrence.includes(`"${choice}"`),`Missing cadence ${choice}`);
  }
  for (const value of ["never","on_date","after_count"]) {
    assert.ok(recurrence.includes(`"${value}"`),`Missing end condition ${value}`);
  }
  assert.match(recurrence,/personal_materialize_task_series/);
  assert.match(recurrence,/edit\(series\)/);
  assert.match(recurrence,/Delete repetition/);
  assert.match(recurrence,/Past completed tasks will be preserved/);
  assert.match(calendar,/Overdue private tasks/);
  assert.match(calendar,/task\.series_id/);
  assert.match(calendar,/is\("dismissed_at",null\)/);
  assert.match(calendar,/PersonalPlanningEditor/);
  assert.match(editor,/\.eq\("profile_id",me\.id\)/);
  assert.match(editor,/dismissed_at:new Date\(\)\.toISOString\(\)/);
  assert.match(editor,/new Date\(`\$\{date\}T\$\{time\}:00Z`\)/);
  assert.match(compatibility,/personal_task_series/);
  assert.match(compatibility,/personal_materialize_task_series/);
});

test("one-bundle manifest includes recurrence, never silently activates Stage 2 Google/AAL2",()=>{
  const list=manifest.slice(manifest.indexOf("WITH expected_pending"),manifest.indexOf("SELECT\n"));
  const versions=[...list.matchAll(/'([0-9]{14})'/g)].map(match=>match[1]);
  assert.equal(versions.length,32);
  assert.equal(new Set(versions).size,32);
  assert.ok(versions.includes("20261015090000"));
  assert.ok(!versions.includes("20261012172718"));
});

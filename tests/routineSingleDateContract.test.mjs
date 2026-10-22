import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const content=path=>readFileSync(path,"utf8");
const sql=content("supabase/migrations/20261021235000_175_single_date_routine_exception.sql");
const gate=content("supabase/tests/stage2_single_date_routine_exception_gate.sql");
const reader=content("src/lib/readRoutineSchedulePreview.js");
const calendar=content("src/lib/readRoutineCalendar.js");
const proof=content("src/components/RoutineDateProgress.jsx");
const server=content("scripts/ci/run-sql-security-gates.sh");

test("a single-date exception is append-only, stale-version and actor restricted",()=>{
 for(const must of [
  "CREATE TABLE public.routine_date_exceptions",
  "UNIQUE(operation_id,scheduled_on,version)",
  "action IN ('skip','restore')",
  "REVOKE ALL ON public.routine_date_exceptions",
  "IF p_expected_version IS DISTINCT FROM v_version",
  "USING ERRCODE='40001'",
  "public.app_managed_units()",
  "u.id=v_operation.unit_id",
  "m.profile_id=auth.uid()",
  "v_operation.origin='self_created'",
  "public.operation_occurrences",
  "public.routine_date_progress",
  "INSERT INTO public.routine_date_exceptions",
  "INSERT INTO public.activity_events",
 ]) assert.ok(sql.includes(must),`Missing server exception guard: ${must}`);
 assert.doesNotMatch(sql,/DELETE FROM public\.routine_date_exceptions/i);
 assert.doesNotMatch(sql,/UPDATE public\.routine_date_exceptions\s+SET/i);
});

test("the original schedule, outcome and dated-progress paths all exclude skips",()=>{
 assert.match(sql,/case when c\.exception_action='skip' then 'skipped'/);
 assert.match(sql,/p\.state<>'skipped'/);
 assert.match(sql,/FROM public\.routine_schedule_preview\(ARRAY\[v_work\],NEW\.scheduled_on,NEW\.scheduled_on\) p WHERE p\.state<>'skipped'/);
 assert.match(reader,/\["recorded","unrecorded_past","scheduled","skipped"\]/);
 assert.match(calendar,/skipped: "Skipped by authorised exception"/);
 assert.match(proof,/dateScheduleState!=="skipped"/);
});

test("reminder delivery remains bound to its approved day-specific working-hour controls",()=>{
 assert.match(sql,/where d\.state IN \('scheduled','unrecorded_past'\) and v\.reminder_minutes_before is not null/);
 assert.match(sql,/pattern\.clock_map \? v_key/);
 assert.match(sql,/dt\.session_expected/);
 assert.match(sql,/not exists\(select 1 from public\.leave_requests/);
 assert.doesNotMatch(sql,/where d\.state<>'recorded'/);
});
test("rollback-only negative-role acceptance is included in the existing runner",()=>{
 assert.match(gate,/SET LOCAL ROLE authenticated/);
 assert.match(gate,/Another department changed a protected routine/);
 assert.match(gate,/Assigned Staff changed its manager-owned schedule/);
 assert.match(gate,/Stale date revision was not rejected/);
 assert.match(gate,/Manager erased recorded outcome/);
 assert.match(gate,/ROLLBACK;/);
 assert.match(server,/stage2_single_date_routine_exception_gate\.sql/);
});

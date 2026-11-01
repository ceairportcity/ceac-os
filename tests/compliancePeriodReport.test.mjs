import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const sql = readFileSync("supabase/migrations/20261101111000_compliance_period_facts.sql","utf8");
test("attendance period facts remain server-scoped and bounded",()=>{
 assert.match(sql,/SECURITY INVOKER/);
 assert.match(sql,/app_stage2_universal_aal_allowed/);
 assert.match(sql,/attendance_day_evidence\(work_date\)/);
 assert.match(sql,/p_to-p_from>30/);
 assert.match(sql,/p_limit NOT BETWEEN 1 AND 50/);
});
test("attendance period reports are factual, not payroll or discipline",()=>{
 assert.match(sql,/days_needing_check/);
 assert.match(sql,/approved_leave_days/);
 assert.match(sql,/open_session_days/);
 assert.doesNotMatch(sql,/('start_lat'|'start_lng'|'lng'|'lat')/);
 assert.doesNotMatch(sql,/(\bINSERT INTO public\.work_sessions|\bUPDATE public\.work_sessions)/);
});

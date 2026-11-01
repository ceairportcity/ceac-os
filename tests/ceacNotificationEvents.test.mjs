import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const sql=readFileSync("supabase/migrations/20261101114000_ceac_notification_events.sql","utf8");
test("notifications require current source access, not just a recipient row",()=>{
 assert.match(sql,/ceac_notification_context_visible/);
 assert.match(sql,/compliance_attendance_case_visible/);
 assert.match(sql,/app_can_access_memo/);
 assert.match(sql,/app_stage2_universal_aal_allowed/);
 assert.match(sql,/recipient_id=auth\.uid\(\)/);
 assert.match(sql,/REVOKE ALL ON public\.ceac_notification_events/);
});
test("notification creation is stable and does not copy restricted content",()=>{
 assert.match(sql,/UNIQUE\(org_id,recipient_id,event_kind,source_event_id\)/);
 assert.match(sql,/ON CONFLICT\(org_id,recipient_id,event_kind,source_event_id\) DO NOTHING/);
 assert.doesNotMatch(sql,/NEW\.(body|factual_note|interpretation_note)/);
 assert.doesNotMatch(sql,/UPDATE public\.work_sessions|UPDATE public\.payroll/);
});

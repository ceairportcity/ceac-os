import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const sql=readFileSync("supabase/migrations/20261101130000_compliance_policy_evidence_notifications.sql","utf8");
test("Compliance policy evidence and exception alerts recheck protected-record scope",()=>{
 for(const kind of ["compliance_policy","compliance_evidence","compliance_exception"])assert.match(sql,new RegExp(kind));
 assert.match(sql,/ceac_notification_context_visible/);
 assert.match(sql,/content_record_is_live/);
 assert.match(sql,/app_managed_units/);
 assert.match(sql,/app_stage2_universal_aal_allowed/);
 assert.match(sql,/version ID/);
 assert.doesNotMatch(sql,/NEW\.(reason|note|evidence_reference|body_text)/);
});

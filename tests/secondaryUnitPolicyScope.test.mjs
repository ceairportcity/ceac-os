import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const sql=readFileSync("supabase/migrations/20261101141500_secondary_unit_policy_scope.sql","utf8");
test("secondary-unit policy scope grants read visibility without management power",()=>{
 for(const snippet of ["compliance_secondary_unit_applicability_read","compliance_secondary_unit_policy_read",
 "org_id=public.app_org_id()","unit_id IN(SELECT public.app_my_units())",
 "ceac_notification_context_visible","ceac_notify_policy_applicability"])
  assert.ok(sql.includes(snippet),snippet);
 assert.doesNotMatch(sql,/GRANT.*(INSERT|UPDATE|DELETE)|ALTER TABLE.*DISABLE ROW LEVEL SECURITY/i);
});

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration=readFileSync(
  "supabase/migrations/20261011123000_132_guard_last_authority_execute_lock.sql",
  "utf8"
);
const gate=readFileSync("supabase/tests/security_definer_surface_gate.sql","utf8");

test("trigger-only last-authority guard is not browser executable after replay",()=>{
  assert.match(migration,/REVOKE ALL ON FUNCTION public\.guard_last_authority\(\)/);
  assert.match(migration,/FROM PUBLIC, anon, authenticated;/);
  assert.match(migration,/GRANT EXECUTE ON FUNCTION public\.guard_last_authority\(\)/);
  assert.match(migration,/TO service_role;/);
  assert.doesNotMatch(migration,/DROP FUNCTION|DROP TRIGGER/i);
  assert.match(gate,/has_function_privilege\('authenticated','public\.guard_last_authority\(\)','EXECUTE'\)/);
  assert.match(gate,/has_function_privilege\('service_role','public\.guard_last_authority\(\)','EXECUTE'\)/);
});

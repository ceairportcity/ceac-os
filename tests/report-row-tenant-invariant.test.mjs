import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration=readFileSync("supabase/migrations/20261011120000_131_report_row_tenant_invariant.sql","utf8");
const gate=readFileSync("supabase/tests/report_row_tenant_invariant_gate.sql","utf8");
const runner=readFileSync("scripts/ci/run-sql-security-gates.sh","utf8");

test("report row trigger preserves normal grants and RLS while denying cross-tenant FK use",()=>{
  assert.match(migration,/CREATE OR REPLACE FUNCTION public\.guard_report_tenant_references\(\)/);
  assert.match(migration,/RETURNS trigger/i);
  assert.match(migration,/SECURITY DEFINER/);
  assert.match(migration,/SET search_path = ''/);
  assert.match(migration,/rp\.id = NEW\.period_id AND rp\.org_id = NEW\.org_id/);
  assert.match(migration,/u\.id = NEW\.unit_id AND u\.org_id = NEW\.org_id/);
  assert.match(migration,/p\.id = NEW\.project_id AND p\.org_id = NEW\.org_id/);
  assert.match(migration,/subject\.id = NEW\.profile_id AND subject\.org_id = NEW\.org_id/);
  assert.match(migration,/submitter\.id = NEW\.submitted_by AND submitter\.org_id = NEW\.org_id/);
  assert.match(migration,/reviewer\.id = NEW\.confirmed_by AND reviewer\.org_id = NEW\.org_id/);
  assert.match(migration,/previous\.id = NEW\.supersedes_report_id/);
  assert.match(migration,/previous\.org_id = NEW\.org_id/);
  assert.match(migration,/BEFORE INSERT OR UPDATE OF org_id, period_id, unit_id, project_id/);
  assert.match(migration,/REVOKE ALL ON FUNCTION public\.guard_report_tenant_references\(\)/);
  assert.doesNotMatch(migration,/DISABLE ROW LEVEL SECURITY|DROP TABLE|DELETE FROM public\.reports/i);
});

test("all direct cross-tenant report writes are tested and positive same-org editing survives",()=>{
  assert.match(gate,/^BEGIN;/m);
  assert.match(gate,/^ROLLBACK;/m);
  assert.match(gate,/SET LOCAL ROLE authenticated;/);
  assert.match(gate,/public\.save_report_draft\(/);
  assert.match(gate,/Correct report unit edited/);
  assert.match(gate,/accepted direct cross-org unit INSERT/);
  assert.match(gate,/accepted direct cross-org project INSERT/);
  assert.match(gate,/accepted direct cross-org period INSERT/);
  assert.match(gate,/accepted cross-org draft UPDATE/);
  assert.match(gate,/accepted cross-org correction lineage UPDATE/);
  assert.match(gate,/cross-tenant record persisted/);
  assert.match(runner,/report_row_tenant_invariant_gate\.sql/);
});

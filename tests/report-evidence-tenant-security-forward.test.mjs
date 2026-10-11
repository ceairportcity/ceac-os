import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  "supabase/migrations/20261011110000_129_report_evidence_tenant_integrity.sql",
  "utf8"
);
const gate = readFileSync(
  "supabase/tests/report_evidence_tenant_integrity_gate.sql",
  "utf8"
);
const runner = readFileSync("scripts/ci/run-sql-security-gates.sh", "utf8");

test("evidence RPC preserves its existing signature and authority boundaries", () => {
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.save_and_submit_report\(p_period_id uuid, p_scope text, p_unit_id uuid, p_project_id uuid/);
  assert.match(migration, /SECURITY DEFINER/);
  assert.match(migration, /SET search_path TO 'public'/);
  assert.match(migration, /public\.save_report_draft\(p_period_id,p_scope,p_unit_id,p_project_id,p_narrative,p_challenges\)/);
  assert.match(migration, /public\.submit_report\(v_report,p_evidence\)/);
  assert.doesNotMatch(migration, /^\s*(?:GRANT|REVOKE|DROP TABLE|DELETE FROM|ALTER TABLE)\b/im);
});

test("all evidence types and membership joins are report-organisation scoped", () => {
  assert.match(migration, /r\.org_id is distinct from public\.app_org_id\(\)/i);
  assert.match(migration, /rp\.org_id is distinct from r\.org_id/i);
  assert.match(migration, /r\.period_id is distinct from rp\.id/i);
  assert.match(migration, /w\.id=v_object and w\.org_id=r\.org_id and w\.unit_id=p_unit_id/i);
  assert.match(migration, /s\.id=v_object and s\.org_id=r\.org_id\s+and w\.org_id=r\.org_id/i);
  assert.match(migration, /um\.org_id=r\.org_id and um\.unit_id=p_unit_id/i);
  assert.match(migration, /where ws\.id=v_object and ws\.org_id=r\.org_id/i);
  assert.match(migration, /w\.visibility<>'private'/);
});

test("existing SQL gate runs transactional positive and three distinct negative evidence cases", () => {
  assert.match(gate, /^BEGIN;/m);
  assert.match(gate, /^ROLLBACK;/m);
  assert.match(gate, /SET LOCAL ROLE authenticated;/);
  assert.match(gate, /Legitimate report evidence/);
  assert.match(gate, /foreign work item accepted/);
  assert.match(gate, /foreign submission accepted/);
  assert.match(gate, /foreign work session accepted/);
  assert.match(gate, /invalid report or evidence persisted/);
  assert.match(runner, /report_evidence_tenant_integrity_gate\.sql/);
});

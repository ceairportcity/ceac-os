import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration=readFileSync(
  "supabase/migrations/20261011113000_130_report_evidence_browser_write_lock.sql","utf8"
);
const sqlGate=readFileSync(
  "supabase/tests/report_evidence_browser_write_gate.sql","utf8"
);
const runner=readFileSync("scripts/ci/run-sql-security-gates.sh","utf8");
const reports=readFileSync("src/screens/ManagerReports.jsx","utf8");

test("report evidence privileges close direct browser writes while preserving read and service authorisation",()=>{
  assert.match(migration,/REVOKE ALL ON TABLE public\.report_evidence_refs FROM PUBLIC, anon, authenticated;/);
  assert.match(migration,/GRANT SELECT ON TABLE public\.report_evidence_refs TO authenticated;/);
  assert.match(migration,/GRANT ALL ON TABLE public\.report_evidence_refs TO service_role;/);
  assert.doesNotMatch(migration,/DISABLE ROW LEVEL SECURITY/i);
  assert.doesNotMatch(migration,/DROP POLICY/i);
  assert.doesNotMatch(migration,/UPDATE public\.report_evidence_refs/i);
});

test("manager report UI uses SELECT read and vetted submission RPC rather than raw evidence writes",()=>{
  assert.match(reports,/\.from\("report_evidence_refs"\)\s*\.select\(/);
  assert.match(reports,/\.rpc\("save_and_submit_report"/);
  assert.doesNotMatch(reports,/\.from\("report_evidence_refs"\)\s*\.(?:insert|update|upsert|delete)\(/);
});

test("rollback-only SQL acceptance denies direct DML and requires normal SELECT and RPC availability",()=>{
  assert.match(sqlGate,/^BEGIN;/m);
  assert.match(sqlGate,/^ROLLBACK;/m);
  assert.match(sqlGate,/browser direct DML is still exposed/);
  assert.match(sqlGate,/legitimate read or RPC write boundary was altered/);
  assert.match(sqlGate,/table RLS is disabled/);
  assert.match(sqlGate,/direct authenticated INSERT succeeded/);
  assert.match(sqlGate,/EXCEPTION WHEN insufficient_privilege THEN/);
  assert.match(runner,/report_evidence_browser_write_gate\.sql/);
});

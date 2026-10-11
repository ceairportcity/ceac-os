import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  "supabase/migrations/20261011103000_128_unit_budget_tenant_boundary.sql",
  "utf8"
);
const gate = readFileSync(
  "supabase/tests/unit_budget_tenant_boundary_gate.sql",
  "utf8"
);
const runner = readFileSync("scripts/ci/run-sql-security-gates.sh", "utf8");

test("budget-position remains the same SECURITY DEFINER RPC without privilege expansion", () => {
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.unit_budget_position\(p_unit_id uuid, p_year integer/);
  assert.match(migration, /STABLE SECURITY DEFINER/);
  assert.match(migration, /SET search_path TO 'public'/);
  assert.doesNotMatch(migration, /^\s*(?:GRANT|REVOKE|DROP TABLE|UPDATE public\.|DELETE FROM public\.)\b/im);
});

test("budget-position accepts only in-tenant target units and in-tenant Finance membership", () => {
  assert.match(migration, /requested\.id=p_unit_id\s+and requested\.org_id=public\.app_org_id\(\)/i);
  assert.match(migration, /finance_unit\.id=m\.unit_id\s+and finance_unit\.org_id=m\.org_id/i);
  assert.match(migration, /m\.profile_id=auth\.uid\(\)\s+and m\.org_id=public\.app_org_id\(\)/i);
  assert.match(migration, /finance_unit\.handles_finance/i);
  assert.match(migration, /public\.app_managed_units\(\)/i);
  assert.match(migration, /public\.app_is_admin\(\)/i);
  assert.match(migration, /public\.app_is_exec\(\)/i);
});

test("existing local SQL runner includes rollback-only foreign-budget adversarial tests", () => {
  assert.match(runner, /unit_budget_tenant_boundary_gate\.sql/);
  assert.match(gate, /^BEGIN;/m);
  assert.match(gate, /^ROLLBACK;/m);
  assert.match(gate, /SET LOCAL ROLE authenticated;/m);
  assert.match(gate, /Finance-unit membership exposed a foreign tenant/i);
  assert.match(gate, /admin disclosed another tenant budget/i);
  assert.match(gate, /ordinary staff unexpectedly read budget/i);
});

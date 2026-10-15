import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  "supabase/migrations/20261011100000_127_report_draft_tenant_integrity.sql",
  "utf8"
);
const sqlGate = readFileSync(
  "supabase/tests/report_draft_tenant_integrity_gate.sql",
  "utf8"
);
const runner = readFileSync("scripts/ci/run-sql-security-gates.sh", "utf8");

test("forward-only report-draft patch retains the reviewed authority and function signature", () => {
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.save_report_draft\(p_period_id uuid, p_scope text/);
  assert.match(migration, /SECURITY DEFINER/);
  assert.match(migration, /SET search_path TO 'public'/);
  assert.match(migration, /v_period\.org_id is distinct from public\.app_org_id\(\)/i);
  assert.match(migration, /p_unit_id in \(select public\.app_managed_units\(\)\) or public\.app_is_admin\(\)/i);
  assert.match(migration, /p_project_id not in \(select public\.app_visible_projects\(\)\)/i);
  assert.doesNotMatch(migration, /^(?:\s*)(?:GRANT|REVOKE|DROP TABLE|DELETE FROM|UPDATE public\.organisations)\b/im);
});

test("all foreign linkage and update paths are scoped to the report period organisation", () => {
  assert.match(migration, /from public\.units u\s+where u\.id = p_unit_id and u\.org_id = v_period\.org_id/i);
  assert.match(migration, /from public\.projects p\s+where p\.id = p_project_id and p\.org_id = v_period\.org_id/i);
  assert.match(migration, /from public\.reports r\s+where r\.org_id = v_period\.org_id and r\.period_id = p_period_id/gi);
  assert.match(migration, /update public\.reports set[\s\S]*?where id = v_id and org_id = v_period\.org_id and period_id = p_period_id/i);
  assert.match(migration, /insert into public\.reports\s*\(org_id, period_id/i);
  assert.match(migration, /using errcode='42501'/);
});

test("SQL adversarial gate tests foreign unit/project/period and legitimate updates transactionally", () => {
  assert.match(sqlGate, /BEGIN;/);
  assert.match(sqlGate, /ROLLBACK;/);
  assert.match(sqlGate, /SET LOCAL ROLE authenticated;/);
  assert.match(sqlGate, /cross-tenant unit was accepted/i);
  assert.match(sqlGate, /cross-tenant project was accepted/i);
  assert.match(sqlGate, /foreign optional project was accepted/i);
  assert.match(sqlGate, /foreign report period was accepted/i);
  assert.match(sqlGate, /Tenant acceptance update/);
  assert.match(runner, /report_draft_tenant_integrity_gate\.sql/);
});

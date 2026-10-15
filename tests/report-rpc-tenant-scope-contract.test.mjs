import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sql = readFileSync("supabase/proposals/save_report_draft_tenant_scope_guard.sql", "utf8");

test("report-draft RPC retains its existing privileged caller-authorisation boundary", () => {
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.save_report_draft\(/);
  assert.match(sql, /SECURITY DEFINER/);
  assert.match(sql, /SET search_path TO 'public'/);
  assert.match(sql, /v_period\.org_id <> app_org_id\(\)/);
  assert.match(sql, /p_unit_id in \(select app_managed_units\(\)\) or app_is_admin\(\)/);
  assert.doesNotMatch(sql, /GRANT\s+.*(people\.manage|hr_private|authority\.manage)/i);
});

test("report-draft RPC rejects foreign-key references to another organisation", () => {
  assert.match(sql, /from public\.units u\s+where u\.id = p_unit_id and u\.org_id = v_period\.org_id/);
  assert.match(sql, /from public\.projects p\s+where p\.id = p_project_id and p\.org_id = v_period\.org_id/);
  assert.match(sql, /using errcode='42501'/);
});

test("report-draft SQL stays a review-only proposal until restored-backup migration gates", () => {
  assert.match(sql, /REVIEW-ONLY SQL PROPOSAL/);
  assert.match(sql, /DO NOT execute against production/);
  assert.doesNotMatch(sql, /^(?:INSERT|UPDATE|DELETE|ALTER TABLE|GRANT)\b/im);
});

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

test("Manager reports never render another actor or unit's pending source results", () => {
  const source = readFileSync("src/screens/ManagerReports.jsx", "utf8");
  assert.match(source, /const reportScope = \[me\.org_id, me\.id, me\.unit_id\]\.join\(":"\)/);
  assert.match(source, /currentReportScope\.current = reportScope/);
  assert.match(source, /const request = \+\+baseRequestRef\.current/);
  assert.match(source, /const isCurrent = \(\) => request === baseRequestRef\.current\s*&& currentReportScope\.current === requestedScope/);
  assert.match(source, /if \(!isCurrent\(\)\) return;/);
  assert.match(source, /setLoadedScope\(requestedScope\)/);
  assert.match(source, /loadedScope !== reportScope \|\| loading/,
    "Old unit or actor data must be visually withheld BEFORE useEffect re-fetches");
  assert.match(source, /historyRequestRef\.current \+= 1/);
  assert.match(source, /refsReadSequence\.current \+= 1/);
  assert.match(source, /currentReportScope\.current !== requestedScope/);
  assert.match(source, /currentReportScope\.current !== reportScope/);
  assert.match(source, /\[matchingPeriod\?\.id, scope, projectId, reportScope, loadedScope\]/);
  assert.match(source, /\[selectedReportId, reportScope, loadedScope\]/);
  assert.match(source, /loadedScope !== reportScope \|\| !range \|\| !memberIds\.length/);
  assert.match(source, /setPeriodRowsState\(loadedScope === reportScope \? "ready" : "loading"\)/);
  assert.match(source, /\[range\?\.start, range\?\.end, mode, projectId, memberIds\.join\(","\), work, reportScope, loadedScope\]/);
});

test("submitted Manager reports fail closed on missing frozen evidence rather than mixing live numbers", () => {
  const source = readFileSync("src/screens/ManagerReports.jsx", "utf8");
  assert.match(source, /function validFrozenReportSnapshot\(snapshot\)/);
  assert.match(source, /\["completed", "submissions", "overdue", "attendance_days"\]\.every/);
  assert.match(source, /Number\.isSafeInteger\(counts\[key\]\)/);
  assert.match(source, /\["daily", "by_project", "status_mix", "attendance", "objectives"\]\.every/);
  assert.match(source, /const invalidFrozenEvidence = Boolean\(frozenReport && !validFrozenReportSnapshot\(frozen\)\)/);
  assert.doesNotMatch(source, /frozen\.counts \|\| liveCounts/);
  assert.doesNotMatch(source, /frozen\.objectives \|\| \[\]/);
  assert.match(source, /if \(invalidFrozenEvidence\) return/);
  assert.match(source, /Submitted report evidence could not be verified/);
  assert.match(source, /Current live figures cannot replace its historical counts/);
});

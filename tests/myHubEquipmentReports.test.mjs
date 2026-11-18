import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = file => readFileSync(file, "utf8");

test("My Hub exposes a direct equipment path for staff and HR without giving staff inventory rights", () => {
  const hub = source("src/screens/Me.jsx");
  const assets = source("src/screens/Assets.jsx");
  const reports = source("src/components/EquipmentReports.jsx");
  assert.match(hub, /title="Equipment register"/);
  assert.match(hub, /ariaLabel="HR equipment register"/);
  assert.match(hub, /title="Equipment"/);
  assert.match(hub, /report items missing from your record/);
  assert.match(assets, /<EquipmentReports me=\{me\} canManage=\{canManage\} assets=\{assets\} people=\{people\} onAccepted=\{load\} \/>/);
  assert.match(assets, /assets\.filter\(asset=>asset\.current_assignee_profile_id===me\.id\)/);
  assert.match(assets, /assignments\.filter\(event=>event\.from_profile_id===me\.id\|\|event\.to_profile_id===me\.id\)/);
  assert.match(assets, /shownAssets\.map/);
  assert.match(assets, /shownAssignments\.map/);
  assert.match(reports, /Report equipment/);
  assert.match(reports, /asset_submit_staff_report/);
  assert.match(reports, /asset_resolve_staff_report/);
  assert.match(reports, /Register new equipment and assign it/);
  assert.match(reports, /Assign equipment already in the register/);
  assert.match(reports, /Cannot confirm this report/);
  assert.doesNotMatch(reports, /\.from\("asset_items"\)\.(insert|update)/);
  assert.doesNotMatch(reports, /supabase\.rpc\("asset_record_item"/);
  assert.doesNotMatch(reports, /supabase\.rpc\("asset_assign"/);
});

test("staff equipment reports are unverified until authorised HR atomically registers or assigns", () => {
  const sql = source("supabase/migrations/20261117170000_myhub_equipment_reports.sql");
  assert.match(sql, /create table public\.asset_staff_reports/);
  assert.match(sql, /alter table public\.asset_staff_reports enable row level security/);
  assert.match(sql, /grant select on public\.asset_staff_reports to authenticated/);
  assert.match(sql, /revoke all on public\.asset_staff_reports from public,anon,authenticated/);
  assert.match(sql, /reporter_id=auth\.uid\(\)/);
  assert.match(sql, /public\.app_has_capability\('asset\.manage',null\)/);
  assert.match(sql, /public\.app_stage2_universal_aal_allowed\(\)/);
  assert.match(sql, /create or replace function public\.asset_submit_staff_report/);
  assert.match(sql, /create or replace function public\.asset_resolve_staff_report/);
  assert.match(sql, /for update/);
  assert.match(sql, /public\.asset_record_item\(/);
  assert.match(sql, /public\.asset_assign\(/);
  assert.match(sql, /reviewed_by=v_actor,reviewed_at=now\(\)/);
  assert.match(sql, /audit_asset_staff_reports/);
  assert.doesNotMatch(sql, /update public\.profiles|delete from public\.asset_items/);
});

test("focused role-gate checks prevent staff confirmation, cross-staff leaks and duplicate HR decisions", () => {
  const gate = source("supabase/tests/myhub_equipment_reports_gate.sql");
  const runner = source("scripts/ci/run-sql-security-gates.sh");
  assert.match(runner, /myhub_equipment_reports_gate\.sql/);
  assert.match(gate, /Staff report silently created official inventory/);
  assert.match(gate, /Staff confirmed their own inventory report/);
  assert.match(gate, /One staff member can read another person equipment report/);
  assert.match(gate, /Previously reviewed report was accepted again/);
  assert.match(gate, /HR verification did not register and assign the equipment atomically/);
  assert.match(gate, /rollback;/);
});

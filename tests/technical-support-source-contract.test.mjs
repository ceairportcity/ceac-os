import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";

const read = (path) => readFileSync(join(process.cwd(), path), "utf8");
const backend = read("supabase/proposals/technical_support_v1_backend.sql");
const proposedGate = read("supabase/proposals/technical_support_v1_gate.sql");
const app = read("src/App.jsx");
const navigation = read("src/experience-v2/shell/navigation.js");
const supportPanel = read("src/screens/TechnicalSupport.jsx");
const supportHelp = read("src/screens/TechnicalHelp.jsx");
const activeMe = read("src/lib/supabase.js");

test("proposed SQL functions use valid paired dollar-quote delimiters", () => {
  assert.equal((backend.match(/\bAS \$\$/g) || []).length, 3);
  assert.equal((backend.match(/^\$\$;$/gm) || []).length, 3);
  assert.doesNotMatch(backend, /\bAS \$(?!\$)/);
  assert.doesNotMatch(backend, /^\$;$/m);
});

test("support-specific privileges never grant general administration or payroll", () => {
  assert.match(backend, /CREATE POLICY support_cases_visible/);
  assert.match(backend, /CREATE POLICY support_cases_manage/);
  assert.match(backend, /app_has_capability\('support\.case\.manage',NULL\)/);
  assert.match(backend, /support_team_memberships tm/);
  assert.match(backend, /AND tm\.active/);
  assert.doesNotMatch(backend, /grant\s+select\s+on\s+hr_private\./i);
  assert.doesNotMatch(backend, /grant\s+.*\bpeople\.manage\b/i);
  assert.doesNotMatch(backend, /grant\s+.*\bauthority\.manage\b/i);
});

test("case records and immutable audit history are deny-by-default", () => {
  for (const table of ["support_cases", "support_case_events", "support_team_memberships"]) {
    assert.match(backend, new RegExp("ALTER TABLE public\\." + table + " ENABLE ROW LEVEL SECURITY"));
    assert.match(backend, new RegExp("REVOKE ALL ON public\\." + table + " FROM PUBLIC,anon,authenticated"));
  }
  assert.match(backend, /support_case_events_immutable/);
  assert.match(backend, /EXECUTE FUNCTION public\.platform_audit_immutable\(\)/);
  assert.match(backend, /AFTER INSERT ON public\.support_cases/);
  assert.match(backend, /BEFORE UPDATE ON public\.support_cases/);
  assert.match(proposedGate, /support_case_events_immutable/);
  assert.doesNotMatch(backend, /GRANT\s+(INSERT|UPDATE|DELETE)\s+ON\s+public\.support_case_events\s+TO\s+authenticated/i);
});

test("support authority is separate from ordinary employment role and client-side checks", () => {
  assert.match(app, /if \(tab === "technical-support"\) return canManageSupport/);
  assert.match(app, /if \(tab === "technical-help"\) return/);
  assert.match(navigation, /capabilities\.has\("support\.case\.manage"\)/);
  assert.match(supportPanel, /support_team_memberships/);
  assert.match(supportPanel, /\.eq\("active", true\)/);
  assert.match(supportPanel, /Access execution is not enabled/);
  assert.match(supportHelp, /reported_by: me\.id/);
  assert.doesNotMatch(supportPanel, /supabase\.auth\.admin/);
  assert.doesNotMatch(supportPanel, /supabase\.rpc\("grant_capability"/);
});

test("approved Executive stylesheet has exactly the same Git blob", () => {
  const css = read("src/role-styles/executive-redesign.css");
  const digest = createHash("sha1")
    .update("blob " + Buffer.byteLength(css) + "\0")
    .update(css)
    .digest("hex");
  assert.equal(digest, "5613e38749322da28f6bfd6f4a584dd4bebd6d47");
});

test("canonical S3 migration is ordered before ten pending files, with no duplicate versions", () => {
  const folder = "supabase/migrations";
  const migrations = readdirSync(folder).filter((file) => /^\d+_.+\.sql$/.test(file)).sort();
  const versions = migrations.map((file) => file.split("_")[0]);
  assert.equal(new Set(versions).size, versions.length, "duplicate migration version");
  const s3 = "20261007083250_118_capability_delegation_expiry.sql";
  assert.ok(migrations.includes(s3), "S3 migration is missing");
  const pending = [
    "20261007090000_119_phase6_volunteer_operating_model.sql",
    "20261007093000_120_phase6_private_day_planning.sql",
    "20261007094500_121_phase6_personal_planning_extensions.sql",
    "20261007095500_122_phase6_personal_event_note_primitives.sql",
    "20261007102000_123_phase6_attendance_integrity.sql",
    "20261007103000_123_phase6_attendance_integrity.sql",
    "20261007104000_124_phase6_attendance_integrity_reconcile.sql",
    "20261007180500_go_live_annual_leave_policy.sql",
    "20261010010000_125_restrict_legacy_office_code_rpcs.sql",
    "20261010030000_126_phase6_network_service_role_guard.sql",
  ];
  const s3Index = migrations.indexOf(s3);
  for (const file of pending) {
    assert.ok(migrations.indexOf(file) > s3Index, "pending file missing or ahead of S3: " + file);
  }
  const s3Source = read(join(folder, s3));
  assert.match(s3Source, /capability_grants\s+add column if not exists expires_at/i);
  assert.match(activeMe, /\.select\("id,capability,scope_unit_id,granted_at,expires_at"\)/);
  assert.match(activeMe, /Date\.parse\(grant\.expires_at\) > Date\.now\(\)/);
});

test("S3 security gates and newer Phase 6 gates coexist", () => {
  const runner = read("scripts/ci/run-sql-security-gates.sh");
  const mfa = read("supabase/tests/privileged_mfa_aal2_gate.sql");
  const surface = read("supabase/tests/security_definer_surface_gate.sql");
  assert.match(runner, /capability_delegation_expiry_gate\.sql/);
  assert.match(runner, /go_live_annual_leave_policy_gate\.sql/);
  assert.match(runner, /attendance_phase6_integrity_gate\.sql/);
  assert.match(mfa, /callable_count<>135/);
  assert.match(mfa, /non-TOTP AAL2 session retained privileged authority/);
  assert.match(surface, /p_expires_at timestamp with time zone/);
});

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
  // PostgreSQL pg_trigger.tgtype: BEFORE=2, DELETE=8, UPDATE=16.
  // INSERT=4 must not be mistaken for DELETE when proving immutability.
  assert.match(proposedGate, /\(t\.tgtype & 2\)<>0/);
  assert.match(proposedGate, /\(t\.tgtype & 8\)<>0/);
  assert.match(proposedGate, /\(t\.tgtype & 16\)<>0/);
  assert.doesNotMatch(proposedGate, /AND \(t\.tgtype & 4\)<>0/);

  const auditPolicy = backend.split("CREATE POLICY support_case_events_visible")[1]
    ?.split("CREATE OR REPLACE FUNCTION public.support_case_insert_guard")[0] || "";
  assert.ok(auditPolicy.includes("support.case.manage"));
  assert.ok(auditPolicy.includes("support_team_memberships"));
  assert.ok(auditPolicy.includes("tm.active"));
  assert.ok(proposedGate.includes("Internal support-case audit events are not support-only"));

  assert.doesNotMatch(backend, /GRANT\s+(INSERT|UPDATE|DELETE)\s+ON\s+public\.support_case_events\s+TO\s+authenticated/i);
  // Direct close must set its own authoritative timestamps. Otherwise a
  // browser could forge resolved_at while changing a case to 'closed'.
  assert.match(backend, /ELSIF NEW\.state='closed' THEN\s*(?:--[^\n]*\n\s*)*NEW\.resolved_at:=coalesce\(OLD\.resolved_at,now\(\)\);\s*NEW\.closed_at:=now\(\);/);

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
  assert.equal(migrations.length, 130, "expected reviewed 119-history + 11-pending migration source tree");
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


test("later migrations may not redefine S3 authority functions", () => {
  const folder = "supabase/migrations";
  const s3Filename = "20261007083250_118_capability_delegation_expiry.sql";
  const pending = readdirSync(folder).filter((file) =>
    /^\d+_.+\.sql$/.test(file) && file > s3Filename
  );
  const extractDefinitions = (sql) => {
    const pattern = /(?:create\s+(?:or\s+replace\s+)?function|drop\s+function\s+(?:if\s+exists\s+)?)\s+(?:public\.)?([a-zA-Z_][\w]*)\s*\(/gi;
    return [...sql.matchAll(pattern)].map((match) => match[1].toLowerCase());
  };
  const s3Functions = new Set(extractDefinitions(read(join(folder, s3Filename))));
  assert.ok(s3Functions.has("app_has_capability"));
  assert.ok(s3Functions.has("app_identity_confirmed"));
  assert.ok(s3Functions.has("grant_capability"));
  for (const migration of pending) {
    for (const functionName of extractDefinitions(read(join(folder, migration)))) {
      assert.equal(s3Functions.has(functionName), false,
        migration + " illegally replaces/overrides S3 security function " + functionName);
    }
  }
});

test("reporters can inspect only their own recorded case status and response", () => {
  assert.match(supportHelp, /\.eq\("reported_by", me\.id\)\.eq\("org_id", me\.org_id\)/);
  assert.match(supportHelp, /setSelectedId/);
  assert.match(supportHelp, /aria-pressed=\{selectedId === item\.id\}/);
  assert.match(supportHelp, /selected\.resolution_summary/);
  assert.match(supportHelp, /Technical Support response/);
  assert.doesNotMatch(supportHelp, /support_case_events/);
  assert.doesNotMatch(supportHelp, /supabase\.auth\.admin/);
});

test("Support Help Desk clearly bounds and filters the permitted queue", () => {
  assert.match(supportPanel, /filterSupportCases\(cases, deskQuery, deskStatus\)/);
  assert.match(supportPanel, /150 recent cases/);
  assert.match(supportPanel, /Find a request/);
  assert.match(supportPanel, /Case status/);
  assert.match(supportPanel, /\.eq\("org_id", me\.org_id\)/);
});

test("Support case taking is conditional on current assignment, without granting access", () => {
  assert.match(supportPanel, /onClaim\(item\.id\)/);
  assert.match(supportPanel, /!item\.assigned_to/);
  assert.match(supportPanel, /\.is\("assigned_to", null\)/);
  assert.match(supportPanel, /\.not\("state", "in", "\(resolved,closed\)"\)/);
  assert.match(supportPanel, /\.maybeSingle\(\)/);
  assert.match(supportPanel, /support_team_memberships/);
  assert.doesNotMatch(supportPanel, /\.rpc\("grant_capability"/);
});

test("case status edits require a matching server revision, with an explicit collision message", () => {
  assert.match(supportPanel, /onUpdate\(item\.id, nextState, resolution, item\.updated_at\)/);
  assert.match(supportPanel, /\.eq\("updated_at", expectedUpdatedAt\)/);
  assert.match(supportPanel, /\.maybeSingle\(\)/);
  assert.match(supportPanel, /The case changed since you opened it/);
  assert.match(supportPanel, /item\.updated_at\]/);
  const caseReads = supportPanel.match(/\.select\("id,reference,category,summary,description,affected_service,impact,state,assigned_to,opened_at,resolved_at,closed_at,resolution_summary,updated_at"\)/g) || [];
  assert.equal(caseReads.length, 4, "all current case projections must include server revision");
});

test("an assigned case may be returned only by its current holder", () => {
  assert.match(supportPanel, /item\.assigned_to === myId && item\.state !== "resolved"/);
  assert.match(supportPanel, /Return to unassigned queue/);
  assert.match(supportPanel, /\.update\(\{ assigned_to: null \}\)\.eq\("id", id\)\.eq\("org_id", me\.org_id\)/);
  assert.match(supportPanel, /\.eq\("assigned_to", me\.id\)/);
  assert.match(supportPanel, /\.not\("state", "in", "\(resolved,closed\)"\)/);
  assert.match(supportPanel, /onRelease=\{releaseCase\}/);
});

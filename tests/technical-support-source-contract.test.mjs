import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";

const read = (path) => readFileSync(join(process.cwd(), path), "utf8");
const backend = read("supabase/migrations/20261011130000_133_technical_support_v1_backend.sql");
const hardening = read("supabase/migrations/20261011183000_134_technical_support_authority_hardening.sql");
const invokerRepair = read("supabase/migrations/20261016090159_148_support_invoker_projection.sql");
const invokerGate = read("supabase/tests/support_invoker_projection_gate.sql");
const proposedGate = read("supabase/tests/technical_support_v1_gate.sql");
const app = read("src/App.jsx");
const navigation = read("src/experience-v2/shell/navigation.js");
const supportPanel = read("src/screens/TechnicalSupport.jsx");
const supportHelp = read("src/screens/TechnicalHelp.jsx");
const activeMe = read("src/lib/supabase.js");

test("canonical Technical Support SQL functions use valid paired dollar-quote delimiters", () => {
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

test("independent review hardening preserves membership history and safe reporter projection", () => {
  assert.match(hardening, /support_membership_events_immutable/);
  assert.match(hardening, /BEFORE INSERT OR UPDATE OR DELETE ON public\.support_team_memberships/);
  assert.match(hardening, /A membership may only transition once from active to ended/);
  assert.match(hardening, /capability LIKE 'support\.%'/);
  assert.match(hardening, /Technical Support capability cannot be self-granted/);
  assert.match(hardening, /cg\.capability='support\.case\.manage'/);
  assert.match(hardening, /CREATE VIEW public\.support_case_safe_status/);
  const safeView = hardening.split("CREATE VIEW public.support_case_safe_status")[1]
    ?.split("REVOKE ALL ON public.support_case_safe_status")[0] || "";
  assert.doesNotMatch(safeView, /assigned_to/);
  assert.doesNotMatch(safeView, /affected_profile_id\s*(?:,|FROM)/i);
  assert.match(supportHelp, /from\("support_case_safe_status"\)/);
  assert.doesNotMatch(supportHelp, /from\("support_cases"\)\s*\.select/);
});

test("new Support status projection remains invoker, narrow and reporter-scoped", () => {
  assert.match(invokerRepair, /create or replace function private\.support_case_safe_status_rows\(\)/i);
  assert.match(invokerRepair, /set search_path = ''/);
  assert.match(invokerRepair, /sc\.org_id = public\.app_org_id\(\)/);
  assert.match(invokerRepair, /sc\.reported_by = auth\.uid\(\) or sc\.affected_profile_id = auth\.uid\(\)/);
  assert.match(invokerRepair, /public\.app_identity_confirmed\(\)/);
  assert.match(invokerRepair, /security_invoker = true, security_barrier = true/);
  assert.match(invokerRepair, /revoke all on function private\.support_case_safe_status_rows\(\)/i);
  assert.match(invokerRepair, /grant select on public\.support_case_safe_status to authenticated/i);
  assert.doesNotMatch(invokerRepair, /grant\s+select\s+on\s+public\.support_cases\s+to\s+authenticated/i);
  assert.match(invokerGate, /security_invoker=true/);
  assert.match(invokerGate, /ROLLBACK;/);
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
  const caseEventTriggerCheck = proposedGate.split("t.tgname='support_case_events_immutable'")[1]
    ?.split("THEN RAISE EXCEPTION 'Support audit event immutability trigger missing.'")[0] || "";
  assert.ok(caseEventTriggerCheck);
  // PostgreSQL pg_trigger.tgtype: BEFORE=2, DELETE=8, UPDATE=16.
  // INSERT=4 must not be mistaken for DELETE when proving immutability.
  assert.match(caseEventTriggerCheck, /\(t\.tgtype & 2\)<>0/);
  assert.match(caseEventTriggerCheck, /\(t\.tgtype & 8\)<>0/);
  assert.match(caseEventTriggerCheck, /\(t\.tgtype & 16\)<>0/);
  assert.doesNotMatch(caseEventTriggerCheck, /AND \(t\.tgtype & 4\)<>0/);

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

  assert.match(backend, /Only the current case holder or Support Lead can change this case/);
  assert.match(backend, /A support member can claim only for themselves/);
  assert.match(backend, /Access requests require recorded business approval and a reviewed execution path/);
  assert.match(proposedGate, /Membership without support\.case\.manage exposed the queue/);
  assert.match(proposedGate, /Cross-tenant reporter visibility is not isolated/);
  assert.match(proposedGate, /Access request was resolved without approved execution evidence/);

});

test("support authority is separate from ordinary employment role and client-side checks", () => {
  assert.match(app, /if \(tab === "technical-support"\) return canManageSupport/);
  assert.match(app, /if \(tab === "technical-help"\) return/);
  assert.match(navigation, /capabilities\.has\("support\.case\.manage"\)/);
  assert.match(supportPanel, /support_team_memberships/);
  assert.match(supportPanel, /\.eq\("active", true\)/);
  assert.match(supportPanel, /SupportAccessCaseActions/);
  assert.match(supportPanel, /canRecordSupportOutcome\(currentCase, state, accessLedger\)/);
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

test("canonical S3 migration and fifteen reviewed security migrations have unique ordered versions", () => {
  const folder = "supabase/migrations";
  const migrations = readdirSync(folder).filter((file) => /^\d+_.+\.sql$/.test(file)).sort();
  const versions = migrations.map((file) => file.split("_")[0]);
  assert.equal(new Set(versions).size, versions.length, "duplicate migration version");
  const stagedPortraitMigration = "20261016164000_149_private_portrait_media_stage2.sql";
  assert.ok(migrations.includes(stagedPortraitMigration), "Stage 2 private portrait migration must remain available for isolated replay");
  const stagedAppraisalMigration = "20261016180000_151_stage2_human_appraisal_ratings.sql";
  assert.ok(migrations.includes(stagedAppraisalMigration), "Owner-approved quarterly Manager ratings migration missing");
  const stagedIntegratedSecurity = [
    stagedPortraitMigration,
    "20261016170000_150_universal_totp_all_roles_stage2.sql",
    stagedAppraisalMigration,
    "20261016183000_152_quarterly_ministry_review_events.sql",
    "20261016190000_153_stage2_human_report_security_integration.sql",
    "20261016210000_154_stage2_universal_rpc_auth_gate.sql",
    "20261016220000_155_stage2_published_human_rating_timestamp_integrity.sql",
    "20261017010000_156_stage2_provider_neutral_auth_storage_reconciliation.sql",
    "20261019160000_157_stage2_password_release_private_portraits.sql",
    "20261019174500_158_owner_work_activity_diary.sql",
    "20261019175500_159_owner_activity_project_attribution.sql",
    "20261019181500_160_project_person_optional_assessments.sql",
    "20261019183500_161_technical_support_under_it.sql",
    "20261019213252_162_owner_activity_guard_reconciliation.sql",
    "20261020031648_163_retire_legacy_google_rpc_grants.sql",
    "20261020035143_164_self_created_organisational_routines.sql",
    "20261020070455_165_published_rating_invoker_boundary.sql",
    "20261020072046_166_routine_pause_history.sql",
    "20261020095000_167_routine_occurrence_reviews.sql",
  "20261020120556_168_organisational_schedule_options.sql",
    "20261020124352_169_routine_reminder_delivery.sql",
    "20261020125855_170_routine_reminder_explicit_hours_guard.sql",
    "20261021205049_171_routine_date_progress.sql",
    "20261021212537_172_routine_date_file_evidence.sql",
    "20261021222500_173_attendance_start_location_evidence.sql",
    "20261021224000_174_roster_only_hr_employment.sql",
    "20261021235000_175_single_date_routine_exception.sql",
    "20261022041632_176_routine_single_date_cover.sql",

  ];
  for (const migration of stagedIntegratedSecurity) {
    assert.ok(migrations.includes(migration), "Missing single-candidate Stage 2 migration: " + migration);
  }
  assert.equal(migrations.filter((file) => !stagedIntegratedSecurity.includes(file)).length, 153,
    "Stage 1's 153 reviewed migrations remain identical; all Stage 2 additions are explicitly inventoried");
  assert.equal(migrations.length, 181, "expected 153 reviewed Stage 1 plus 28 explicitly inventoried Stage 2 migrations");
  assert.ok(migrations.includes("20261016090159_148_support_invoker_projection.sql"), "forward-only support view repair is missing");
  assert.ok(migrations.includes("20261015090000_147_private_personal_task_recurrence.sql"), "owner-private recurrence migration missing");
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
  assert.match(runner, /technical_support_v1_gate\.sql/);
  // The one-bundle change records 12 additional guarded RPC/predicate surfaces
  // and removes obsolete direct attendance-correction and performance-share grants.
  // Fail closed at 148: 145 original, one TOTP helper and two explicitly inventoried owner Work RPCs.
  assert.match(mfa, /callable_count<>148/);
  assert.match(surface, /has_function_privilege\('authenticated','public\.share_performance_review\(uuid\)','EXECUTE'\)/);
  assert.match(mfa, /non-TOTP AAL2 session retained privileged authority/);
  assert.match(surface, /p_expires_at timestamp with time zone/);
});


test("S3 security function overrides are forbidden except the exact Stage 2 TOTP identity guards", () => {
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
      if (!s3Functions.has(functionName)) continue;
      const approvedFile = "20261016210000_154_stage2_universal_rpc_auth_gate.sql";
      const approvedFunctions = new Set(["app_org_id","app_identity_confirmed","app_privileged_aal_allowed"]);
      assert.ok(migration === approvedFile && approvedFunctions.has(functionName),
        migration + " illegally replaces/overrides S3 security function " + functionName);
      assert.match(read(join(folder,migration)), /public\.app_stage2_universal_aal_allowed\(\)/,
        "Only the new verified-TOTP AAL2 prerequisite may extend an S3 authority function");
    }
  }
});

test("reporters can inspect only their own recorded case status and response", () => {
  assert.match(supportHelp, /from\("support_case_safe_status"\)/);
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
  assert.match(supportPanel, /onUpdate\(item\.id, nextState, resolution, item\.updated_at, accessLedger\)/);
  assert.match(supportPanel, /\.eq\("updated_at", expectedUpdatedAt\)/);
  assert.match(supportPanel, /\.maybeSingle\(\)/);
  assert.match(supportPanel, /The case changed since you opened it/);
  assert.match(supportPanel, /item\.updated_at\]/);
  const caseReads = [...supportPanel.matchAll(/\.from\("support_cases"\)[\s\S]{0,300}?\.select\("([^"]+)"\)/g)];
  assert.equal(caseReads.length, 5, "all current case reads must remain explicit projections");
  assert.ok(caseReads.every((match) => match[1].split(",").includes("updated_at")),
    "all current case projections must include server revision");
});

test("an assigned case may be returned only by its current holder", () => {
  assert.match(supportPanel, /item\.assigned_to === myId && item\.state !== "resolved"/);
  assert.match(supportPanel, /Return to unassigned queue/);
  assert.match(supportPanel, /\.update\(\{ assigned_to: null \}\)\.eq\("id", id\)\.eq\("org_id", me\.org_id\)/);
  assert.match(supportPanel, /\.eq\("assigned_to", me\.id\)/);
  assert.match(supportPanel, /\.not\("state", "in", "\(resolved,closed\)"\)/);
  assert.match(supportPanel, /onRelease=\{releaseCase\}/);
});

test("needs-you queue excludes colleagues' assigned work", () => {
  assert.match(supportPanel, /supportCasesNeedingMe\(cases, me\.id\)/);
  assert.match(supportPanel, /<SupportRows cases=\{needsYou\}/);
  assert.doesNotMatch(supportPanel, /<SupportRows cases=\{groups\.attention\}/);
});

test("People & Access invalidates confidential roster state across identity changes", () => {
  const peopleAccess = read("src/components/PeopleAccess.jsx");
  assert.match(peopleAccess, /const loadGeneration = useRef\(0\)/);
  assert.match(peopleAccess, /setSnapshot\(null\)/);
  assert.match(peopleAccess, /\[me\.id, me\.org_id, canManage\]/);
  assert.match(peopleAccess, /if \(generation !== loadGeneration\.current\) return false/);
  assert.match(peopleAccess, /generation === loadGeneration\.current/);
  assert.match(peopleAccess, /People & Access could not load verified records/);
});

test("Stage 2 Technical Support case metadata meets the 12px readability floor on desktop and phone", () => {
  const css = read("src/role-styles/technical-support-stage2.css");
  const pixelFontSizes = [...css.matchAll(/font-size:\s*([\d.]+)px/g)].map((match) => Number(match[1]));
  assert.ok(pixelFontSizes.length >= 10, "technical case, summary and responsive text rules are present");
  assert.ok(pixelFontSizes.every((size) => size >= 12),
    `Technical Support contains unreadable CSS font sizes: ${pixelFontSizes.filter((size) => size < 12)}`);
  assert.match(css, /@media\(max-width:590px\)/);
  assert.match(css, /\.s2-support-summary small\{font-size:12px/);
});

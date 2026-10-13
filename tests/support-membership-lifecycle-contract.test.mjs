import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path,"utf8");
const migration = read("supabase/migrations/20261011193000_136_support_membership_end_reason.sql");
const revocationReasonRepair = read("supabase/migrations/20261012041000_139_support_revocation_end_reason.sql");
const predecessor = read("supabase/migrations/20261011183000_134_technical_support_authority_hardening.sql");
const sqlGate = read("supabase/tests/support_membership_end_reason_gate.sql");
const sqlRunner = read("scripts/ci/run-sql-security-gates.sh");
const component = read("src/components/SupportTeamMemberships.jsx");
const people = read("src/components/PeopleAccess.jsx");

test("forward 136 adds a separate history-backed end reason without deleting membership history",()=>{
  assert.match(migration,/ALTER TABLE public\.support_team_memberships ADD COLUMN end_reason text/);
  assert.match(migration,/char_length\(btrim\(coalesce\(NEW\.end_reason,''\)\)\)<8/);
  assert.match(migration,/coalesce\(NEW\.end_reason,NEW\.reason\)/);
  assert.match(revocationReasonRepair,/revoke_reason='Technical Support membership ended: '\|\|NEW\.end_reason/);
  assert.doesNotMatch(revocationReasonRepair,/revoke_reason='Technical Support membership ended: '\|\|NEW\.reason/);
  assert.match(migration,/NEW\.reason,NEW\.associated_unit_id/);
  assert.match(migration,/REVOKE ALL ON FUNCTION public\.support_membership_scope_guard\(\) FROM PUBLIC,anon,authenticated/);
  assert.doesNotMatch(migration,/UPDATE public\.profiles|DELETE FROM public\.support_team_memberships|DROP TABLE/i);
  assert.match(predecessor,/capability LIKE 'support\.%' AND revoked_at IS NULL/);
  assert.match(predecessor,/UPDATE public\.capability_grants/);
  assert.match(predecessor,/support_membership_events_immutable/);
});

test("People Administration UI uses only audited membership transitions",()=>{
  assert.match(people,/\["technical-support", "Technical Support"\]/);
  assert.match(people,/SupportTeamMemberships me=\{me\} people=\{snapshot.people\} units=\{snapshot.units\}/);
  assert.match(people,/if \(!canManage\) return/);
  assert.match(component,/\.from\("support_team_memberships"\)/);
  assert.match(component,/\.from\("support_membership_events"\)/);
  assert.match(component,/end_reason: endReason\.trim\(\)/);
  assert.match(component,/\.eq\("active", true\)/);
  assert.match(component,/No Support capability or business authority was granted/);
  assert.doesNotMatch(component,/\.from\("capability_grants"\)\.(?:insert|update|delete)/);
  assert.doesNotMatch(component,/\.from\("employment_records"\)/);
});

test("isolated SQL gate verifies distinct exit reason and support-power removal",()=>{
  assert.match(sqlRunner,/support_membership_end_reason_gate\.sql/);
  assert.match(sqlGate,/^BEGIN;/m);
  assert.match(sqlGate,/^ROLLBACK;/m);
  assert.match(sqlGate,/SET LOCAL ROLE authenticated;/);
  assert.match(sqlGate,/Membership ended without substantive end reason/);
  assert.match(sqlGate,/Joining\/end reason distinction or history attribution failed/);
  assert.match(sqlGate,/Membership end deactivated profile or retained privileged Support grants/);
  assert.match(sqlGate,/revoke_reason='Technical Support membership ended: Temporary assistance concluded and separately reviewed\.'/);
  assert.match(sqlGate,/Immutable Support transition history was overwritten/);
});

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const file = (path) => readFileSync(path, "utf8");
const admin = file("src/screens/AdminHome.jsx");
const adminView = file("src/experience-v2/admin-overview/AdminOverviewV2.jsx");
const access = file("src/components/PeopleAccess.jsx");
const auth = file("src/lib/supabase.js");
const help = file("src/screens/TechnicalHelp.jsx");
const support = file("src/screens/TechnicalSupport.jsx");

test("Administration only presents verified counts for its current identity", () => {
  assert.match(admin, /\[me\.id, me\.org_id\]/);
  assert.match(admin, /readGeneration\.current \+= 1/);
  assert.match(admin, /generation !== readGeneration\.current/);
  assert.match(admin, /loadedScope !== scopeKey/);
  assert.match(admin, /loading=\{scopedLoading\}/);
  assert.match(admin, /countRecordedSessionDays\(sessWeek, person\.id, now\)/);
  assert.match(admin, /work sessions opened on/);
  assert.doesNotMatch(admin, /present on /);
  assert.match(adminView, /label="Open work sessions"/);
  assert.match(adminView, /Not verified live presence/);
  assert.match(adminView, /Current meeting information could not be verified/);
});

test("People & Access never displays a previous account's roster after switching", () => {
  assert.match(access, /snapshotScope !== scopeKey/);
  assert.match(access, /const generation = \+\+loadGeneration\.current/);
  assert.match(access, /generation !== loadGeneration\.current/);
  assert.match(access, /setSnapshot\(null\)/);
  assert.match(access, /\[me\.id, me\.org_id, canManage\]/);
  assert.match(access, /rpc\("admin_set_work_lane_membership"/);
  assert.match(access, /alreadyHasResponsibility/);
  assert.match(access, /belongsToSelectedUnit/);
});

test("Invitation email delivery is never confused with a stored invitation", () => {
  assert.match(auth, /class InvitationDeliveryUnconfirmedError/);
  assert.match(auth, /this\.invitationRecorded = true/);
  assert.match(auth, /throw new InvitationDeliveryUnconfirmedError\("new"\)/);
  assert.match(auth, /throw new InvitationDeliveryUnconfirmedError\("resend"\)/);
  assert.match(access, /actionError\?\.invitationRecorded/);
  assert.match(access, /invitationEmailConflicts\(form\.email/);
  assert.match(access, /existingAccountEmail \|\| existingInvitationEmail/);
  assert.match(access, /Delivery is not yet independently confirmed/);
});

test("Reporters cannot inherit cases from another login or invent a success", () => {
  assert.match(help, /visibleCases = loadedScope === currentScope \? cases : \[\]/);
  assert.match(help, /scopedLoading = loading \|\| loadedScope !== currentScope/);
  assert.match(help, /generation !== readGeneration\.current/);
  assert.match(help, /\.eq\("reported_by", me\.id\)\.eq\("org_id", me\.org_id\)/);
  assert.match(help, /Your request could not be confirmed/);
  assert.doesNotMatch(help, /support_case_events/);
});

test("Technical Support cannot show stale authorisation or close access without business evidence", () => {
  assert.match(support, /scopedReady = ready && verifiedScope === currentScope/);
  assert.match(support, /\[me\.id, me\.org_id, canManage\]/);
  assert.match(support, /generation !== readGeneration\.current/);
  assert.match(support, /canRecordSupportOutcome\(currentCase, state\)/);
  assert.match(support, /\.eq\("updated_at", expectedUpdatedAt\)/);
  assert.match(support, /\.is\("assigned_to", null\)/);
  assert.match(support, /\.eq\("assigned_to", me\.id\)/);
  assert.match(support, /\.not\("state", "in", "\(resolved,closed\)"\)/);
  assert.doesNotMatch(support, /auth\.admin/);
});

test("expired invitations remain visible for authorised follow-up but revoked ones do not", () => {
  assert.match(admin, /\.from\("pending_invitations"\)/);
  assert.match(admin, /\.is\("resolved_at",null\)\.is\("revoked_at",null\)/);
  assert.doesNotMatch(admin, /\.gt\("expires_at"/);
  assert.match(adminView, /expiredInvitationCount/);
  assert.match(adminView, /Invitations to review/);
  assert.match(access, /Outstanding and expired invitations require follow-up/);
});

test("invitation entry is validated before the record-creating RPC", () => {
  assert.match(auth, /isPlausibleInvitationEmail\(cleanEmail\)/);
  assert.match(auth, /cleanName\.length < 2/);
  assert.match(access, /isPlausibleInvitationEmail\(form\.email\)/);
  assert.match(access, /existingAccountEmail \|\| existingInvitationEmail/);
});

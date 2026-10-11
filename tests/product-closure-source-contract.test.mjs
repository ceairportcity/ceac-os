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
const app = file("src/App.jsx");
const people = file("src/screens/People.jsx");

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

test("People and Access mutations are single-flight and identity-generation scoped", () => {
  assert.match(access, /const identityGeneration = useRef\(0\)/);
  assert.match(access, /const actionBusyRef = useRef\(false\)/);
  assert.match(access, /if \(actionBusyRef\.current \|\| busy \|\| !canManage \|\| snapshotScope !== scopeKey\) return false/);
  assert.match(access, /const identity = identityGeneration\.current/);
  assert.match(access, /const sameIdentity = \(\) => identity === identityGeneration\.current/);
  assert.match(access, /if \(!sameIdentity\(\)\) return true/);
  assert.match(access, /if \(sameIdentity\(\)\) \{\s*actionBusyRef\.current = false;\s*setBusy\(false\)/);
  assert.match(access, /return recorded \|\| Boolean\(actionError\?\.invitationRecorded\)/);
});

test("Technical Support case revisions and case history can recover without false success", () => {
  assert.match(support, /onRefresh=\{refreshCases\}/);
  assert.match(support, /onClick=\{onRefresh\}>Refresh case/);
  assert.match(support, /setHistory\(\[\]\)/);
  assert.match(support, /setHistoryError\(null\)/);
  assert.match(support, /if \(failure\) throw failure/);
  assert.match(support, /Case history could not be verified/);
  assert.match(support, /setHistoryRefreshToken\(\(n\) => n \+ 1\)/);
  assert.match(support, /historyRefreshToken\]/);
});

test("attendance decisions and reporter submissions are single-flight", () => {
  assert.match(admin, /const leaveActionBusyRef = useRef\(false\)/);
  assert.match(admin, /if \(busy \|\| scopedLoading \|\| loadError \|\| leaveActionBusyRef\.current\) return/);
  assert.match(admin, /leaveActionBusyRef\.current = true/);
  assert.match(admin, /leaveActionBusyRef\.current = false/);
  assert.match(help, /const submitBusyRef = useRef\(false\)/);
  assert.match(help, /if \(busy \|\| scopedLoading \|\| loadError \|\| submitBusyRef\.current\) return/);
  assert.match(help, /submitBusyRef\.current = true/);
  assert.match(help, /submitBusyRef\.current = false/);
});

test("all Administration direct reads have explicit organisation scope", () => {
  const queries = [...admin.matchAll(/\.from\("([a-z_]+)"\)\s*\.select\("[^"]*"\)/g)];
  const scoped = [...admin.matchAll(/\.from\("([a-z_]+)"\)\s*\.select\("[^"]*"\)\s*\.eq\("org_id",\s*me\.org_id\)/g)];
  assert.equal(queries.length, 24, "the expected Administration data-query inventory changed");
  assert.equal(scoped.length, queries.length, "a direct Administration query lacks current-organisation filtering");
  assert.match(admin, /from\("profiles"\)\.select\("id,full_name"\)\.eq\("org_id", me\.org_id\)/);
  assert.match(admin, /from\("work_sessions"\)\.select\("profile_id"\)\.eq\("org_id", me\.org_id\)/);
});

test("Administration invitation attention opens actual People and Access Invitations tab", () => {
  assert.match(app, /openPeopleAccess=\{openPeopleAccess\}/);
  assert.match(admin, /onOpenInvitations=\{\(\) => openPeopleAccess\?\.\(\{ mode: "invitations" \}\)\}/);
  assert.match(adminView, /action: onOpenInvitations/);
  assert.match(adminView, /pendingInvitations\.length && canManagePeople \? <AdminActionRow/);
  assert.match(adminView, /onClick=\{onOpenInvitations\}/);
  assert.match(people, /setViewMode\("access"\)/);
  assert.match(people, /initialMode=\{accessFocusMode\}/);
});

test("Administration never renders previous-account calendar or roster before role verification", () => {
  assert.match(admin, /const verifiedSnapshot = loadedScope === scopeKey && !loading && !loadError/);
  for (const key of ["units", "alerts", "blockers", "leaveQueue", "checks", "mine", "watch", "meetings", "employeeRoster", "pendingInvitations"]) {
    assert.ok(admin.includes(key + "={verifiedSnapshot ? " + key + " : []}"), key + " must not leak previous-account data");
  }
  assert.match(admin, /message=\{verifiedSnapshot \? msg : null\}/);
  assert.match(admin, /payrollReadiness=\{verifiedSnapshot \? payrollReadiness : null\}/);
});

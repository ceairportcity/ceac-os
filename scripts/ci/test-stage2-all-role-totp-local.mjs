// Real GoTrue TOTP provider + signed JWT + RLS/RPC integration on disposable Supabase.
// Run only after the isolated Staff authenticator browser acceptance has enrolled Staff.
// This file MUST NOT be pointed at hosted Supabase or run with a production service key.
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

assert.equal(process.env.SUPABASE_URL, "http://127.0.0.1:54321", "Only isolated loopback Supabase is permitted");
for (const name of ["SUPABASE_ACCESS_TOKEN", "SUPABASE_PROJECT_ID", "SUPABASE_DB_URL", "DATABASE_URL"]) {
  assert.ok(!process.env[name], "Unexpected remote database credential: " + name);
}
const { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, ROLE_FIXTURE_PASSWORD } = process.env;
assert.ok(SUPABASE_ANON_KEY && SUPABASE_SERVICE_ROLE_KEY && ROLE_FIXTURE_PASSWORD, "Missing disposable test fixtures");
assert.notEqual(SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY);
const edgeUrl = "http://127.0.0.1:54321/functions/v1/integration-runtime";
assert.equal(process.env.CEAC_LOCAL_EDGE_URL, edgeUrl,
  "The genuine local Edge endpoint must be started by isolated acceptance CI");
const orgId = "10000000-0000-4000-8000-000000000010";
const roleEmails = [
  ["Manager", "manager@ceac.local.test"],
  ["Second-unit Manager", "managerb@ceac.local.test"],
  ["Administration/HR", "admin@ceac.local.test"],
  ["Executive", "exec@ceac.local.test"],
  ["Other-unit Staff", "other@ceac.local.test"],
  ["Volunteer", "sameunit@ceac.local.test"],
];
const create = (key) => createClient(SUPABASE_URL, key, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});
const service = create(SUPABASE_SERVICE_ROLE_KEY);
const sessions = [];
let switched = false;
let portraitFixtureCreated = false;
let foreignPortraitFixtureCreated = false;
let revokedFixtureUserId = null;
let revokedFixtureInvitationId = null;
const portraitBucket = "ceac-profile-portraits";
const portraitObject = `${orgId}/31000000-0000-4000-8000-000000000001/51000000-0000-4000-8000-000000000099.webp`;
const foreignPortraitObject =
  "10000000-0000-4000-8000-000000000099/31000000-0000-4000-8000-000000000099/51000000-0000-4000-8000-000000000098.webp";

function fromBase32(secret) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let value = 0, bits = 0;
  const bytes = [];
  for (const char of secret.toUpperCase().replace(/\s|=/g, "")) {
    const digit = alphabet.indexOf(char);
    assert.ok(digit >= 0, "Invalid local test authenticator key");
    value = (value << 5) | digit;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((value >>> bits) & 255);
    }
  }
  return Buffer.from(bytes);
}
function codeFor(secret) {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30_000)));
  const hash = createHmac("sha1", fromBase32(secret)).update(counter).digest();
  const offset = hash[hash.length - 1] & 15;
  return String((hash.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).padStart(6, "0");
}
async function sessionLevel(client, label, expected) {
  const result = await client.auth.mfa.getAuthenticatorAssuranceLevel();
  if (result.error) throw result.error;
  assert.equal(result.data.currentLevel, expected, label + " must have " + expected);
  return result.data;
}
async function signIn(client, email) {
  const result = await client.auth.signInWithPassword({ email, password: ROLE_FIXTURE_PASSWORD });
  if (result.error) throw result.error;
  assert.ok(result.data.session?.access_token, "Real password session missing");
}
// Send real provider bearer tokens directly to the local Edge HTTP endpoint.
// The function uses its own Supabase Auth + policy checks, not a JS mock.
async function edgeStatus(client, action = "health.telegram") {
  let bearer = "";
  if (client) {
    const session = await client.auth.getSession();
    if (session.error) throw session.error;
    bearer = session.data.session?.access_token || "";
    assert.ok(bearer, "Local Edge probe requires a genuine user JWT");
  }
  const response = await fetch(edgeUrl, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      "Content-Type": "application/json",
      ...(bearer ? { Authorization: "Bearer " + bearer } : {}),
    },
    body: JSON.stringify({ action }),
  });
  return response.status;
}

async function orgIdentity(client, label) {
  const response = await client.rpc("app_org_id");
  if (response.error) throw new Error(label + " app_org_id failed: " + response.error.message);
  return response.data;
}

// Exercise PostgREST/RLS with the *actual* provider-issued session, not only
// a SECURITY DEFINER RPC. During the local cutover an AAL1 bearer must not
// read its own otherwise-authorised profile; verified AAL2 must retain it.
async function ownProfileRows(client, label) {
  const auth = await client.auth.getUser();
  if (auth.error) throw auth.error;
  const id = auth.data.user?.id;
  assert.ok(id, label + " Auth identity missing");
  const response = await client.from("profiles").select("id").eq("id", id);
  if (response.error) throw new Error(label + " profiles REST/RLS probe failed: " + response.error.message);
  return response.data;
}

try {
  const initial = await service.from("organisations")
    .select("universal_totp_required").eq("id", orgId).single();
  if (initial.error) throw initial.error;
  assert.equal(initial.data.universal_totp_required, false, "Local-only owner cutover must start OFF");

  for (const [label, email] of roleEmails) {
    const client = create(SUPABASE_ANON_KEY);
    sessions.push(client);
    await signIn(client, email);
    await sessionLevel(client, label + " fresh sign-in", "aal1");
    const enrolled = await client.auth.mfa.enroll({ factorType: "totp", friendlyName: "CEAC isolated acceptance" });
    if (enrolled.error) throw enrolled.error;
    const factorId = enrolled.data.id;
    const secret = enrolled.data.totp?.secret;
    assert.ok(factorId && secret, "Local-only TOTP enrollment was not available");
    const challenge = await client.auth.mfa.challenge({ factorId });
    if (challenge.error) throw challenge.error;
    const verified = await client.auth.mfa.verify({ factorId, challengeId: challenge.data.id, code: codeFor(secret) });
    if (verified.error) throw verified.error;
    await sessionLevel(client, label + " verified authenticator", "aal2");
    const claims = await client.auth.getClaims();
    if (claims.error) throw claims.error;
    assert.equal(claims.data.claims.aal, "aal2", label + " signed JWT must be AAL2");
    assert.ok(claims.data.claims.amr?.some((item) => item.method === "totp"), label + " must have signed TOTP AMR");
    const refreshed = await client.auth.refreshSession();
    if (refreshed.error) throw refreshed.error;
    await sessionLevel(client, label + " token refresh", "aal2");
  }

  // Turn on the universal policy ONLY in this disposable local organisation.
  // A real, provider-issued AAL2/TOTP JWT must restore the existing RPC scope.
  const enabled = await service.from("organisations")
    .update({ universal_totp_required: true }).eq("id", orgId).select("id").single();
  if (enabled.error) throw enabled.error;
  switched = true;
  for (let i = 0; i < sessions.length; i += 1) {
    const label = roleEmails[i][0];
    assert.equal(await orgIdentity(sessions[i], label + " AAL2"), orgId,
      label + " signed TOTP must restore only its own org authority");
    assert.equal((await ownProfileRows(sessions[i], label + " verified AAL2")).length, 1,
      label + " signed TOTP must restore its own protected REST profile read");
  }

  // Prove the real local Edge HTTP entry rejects malformed or oversized
  // unauthenticated JSON BEFORE the "worker" dispatcher can examine a key.
  // Pure source tests alone do not prove the deployed Deno HTTP behaviour.
  for (const [label, payload] of [
    ["non-object JSON", '["worker"]'],
    ["oversized worker payload", JSON.stringify({ action: "worker", data: "x".repeat(32 * 1024) })],
  ]) {
    const response = await fetch(edgeUrl, {
      method: "POST",
      headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" },
      body: payload,
    });
    assert.equal(response.status, 400,
      label + " must be rejected by the actual local Edge JSON guard, not worker authentication");
  }

  // Real Edge Function runtime, local disposable GoTrue tokens and service
  // capability decisions: a verified Admin reaches only the authorised
  // health lookup, whereas anonymous, fresh AAL1 and unprivileged AAL2 cannot.
  assert.equal(await edgeStatus(null), 401,
    "Anonymous calls must fail at the actual integration Edge function");
  assert.equal(await edgeStatus(sessions[2]), 404,
    "Verified TOTP/AAL2 Administration can reach the empty provider health lookup");
  assert.equal(await edgeStatus(sessions[0]), 403,
    "AAL2/TOTP does not confer integration.manage authority to a Manager");
  const freshAdmin = create(SUPABASE_ANON_KEY);
  sessions.push(freshAdmin);
  await signIn(freshAdmin, roleEmails[2][1]);
  await sessionLevel(freshAdmin, "fresh Admin Edge call", "aal1");
  assert.equal(await edgeStatus(freshAdmin), 403,
    "A password-only Admin bearer cannot invoke the privileged Edge action");

  // Exercise the ACTUAL Storage API with provider-signed sessions, not merely
  // SQL inspection. The fixture is a tiny synthetic private WebP written only
  // by a local disposable service client and deleted in finally.
  const fixtureBytes = Buffer.from("UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA", "base64");
  const uploaded = await service.storage.from(portraitBucket).upload(
    portraitObject, fixtureBytes, { contentType: "image/webp", upsert: false },
  );
  if (uploaded.error) throw new Error("Disposable private portrait fixture failed: " + uploaded.error.message);
  portraitFixtureCreated = true;
  const verifiedDownload = await sessions[0].storage.from(portraitBucket).download(portraitObject);
  if (verifiedDownload.error || !verifiedDownload.data) throw new Error(
    "Signed AAL2/TOTP Manager could not fetch the same-org private Storage fixture: " +
    (verifiedDownload.error?.message || "missing data"));
  assert.deepEqual(Buffer.from(await verifiedDownload.data.arrayBuffer()), fixtureBytes,
    "The authorised Storage API must return only the inserted fixture bytes");
  const verifiedLink = await sessions[0].storage.from(portraitBucket)
    .createSignedUrl(portraitObject, 60);
  assert.ok(!verifiedLink.error && verifiedLink.data?.signedUrl,
    "Verified AAL2/TOTP member must be allowed to create a brief own-org private URL");
  // A valid signed TOTP/AAL2 bearer still cannot access another organisation's
  // private object. Create a synthetic foreign-path fixture ONLY with the local
  // disposable service key; never copy any real staff image or use hosted APIs.
  const foreignUpload = await service.storage.from(portraitBucket).upload(
    foreignPortraitObject, fixtureBytes, { contentType: "image/webp", upsert: false },
  );
  if (foreignUpload.error) throw new Error("Foreign-org private test fixture failed: " + foreignUpload.error.message);
  foreignPortraitFixtureCreated = true;
  const foreignDownload = await sessions[0].storage.from(portraitBucket).download(foreignPortraitObject);
  assert.ok(foreignDownload.error && !foreignDownload.data,
    "Valid AAL2/TOTP session must not download a foreign-org portrait");
  const foreignLink = await sessions[0].storage.from(portraitBucket).createSignedUrl(foreignPortraitObject, 60);
  assert.ok(foreignLink.error && !foreignLink.data?.signedUrl,
    "Valid AAL2/TOTP session must not issue a signed foreign-org private URL");

  // A profile deactivation must be caused by a REAL signed-in authorised
  // Administration actor. A service-role update is correctly rejected by
  // close_profile_authority_on_deactivation() and must never be bypassed.
  // Use a one-time invite-only Staff identity so its revoked memberships and
  // permissions are not restored by merely switching active back to true.
  const revokedEmail = "revocation-probe@ceac.local.test";
  const invited = await service.from("pending_invitations").insert({
    org_id: orgId,
    email: revokedEmail,
    full_name: "Disposable Security Revocation",
    unit_id: "20000000-0000-4000-8000-000000000011",
    role: "staff",
    invited_by: null,
    expires_at: new Date(Date.now() + 3_600_000).toISOString(),
  }).select("id").single();
  if (invited.error) throw invited.error;
  revokedFixtureInvitationId = invited.data.id;
  const created = await service.auth.admin.createUser({
    email: revokedEmail, password: ROLE_FIXTURE_PASSWORD, email_confirm: true,
  });
  if (created.error) throw created.error;
  revokedFixtureUserId = created.data.user?.id;
  assert.ok(revokedFixtureUserId, "Disposable invite-only revocation identity missing");

  const revokedSession = create(SUPABASE_ANON_KEY);
  sessions.push(revokedSession);
  await signIn(revokedSession, revokedEmail);
  const initialFactor = await revokedSession.auth.mfa.enroll({
    factorType: "totp", friendlyName: "Disposable security revocation",
  });
  if (initialFactor.error) throw initialFactor.error;
  const firstChallenge = await revokedSession.auth.mfa.challenge({ factorId: initialFactor.data.id });
  if (firstChallenge.error) throw firstChallenge.error;
  const firstVerification = await revokedSession.auth.mfa.verify({
    factorId: initialFactor.data.id,
    challengeId: firstChallenge.data.id,
    code: codeFor(initialFactor.data.totp.secret),
  });
  if (firstVerification.error) throw firstVerification.error;
  await sessionLevel(revokedSession, "revocation actor before deactivation", "aal2");
  assert.equal(await orgIdentity(revokedSession, "active disposable actor"), orgId);
  assert.equal((await ownProfileRows(revokedSession, "active disposable actor")).length, 1);

  const deactivated = await sessions[2].from("profiles")
    .update({ active: false }).eq("id", revokedFixtureUserId);
  if (deactivated.error) throw deactivated.error;
  const inactive = await service.from("profiles")
    .select("active").eq("id", revokedFixtureUserId).single();
  if (inactive.error) throw inactive.error;
  assert.equal(inactive.data.active, false,
    "A real signed-in AAL2 Admin must be able to deactivate the disposable Staff account");
  assert.equal(await orgIdentity(revokedSession, "deactivated Staff with old AAL2"), null,
    "A former verified AAL2 bearer must lose organisation authority after deactivation");
  assert.deepEqual(await ownProfileRows(revokedSession, "deactivated Staff with old AAL2"), [],
    "Deactivated AAL2 bearer must not read even its own profile via REST");
  const deactivatedDownload = await revokedSession.storage.from(portraitBucket).download(portraitObject);
  assert.ok(deactivatedDownload.error && !deactivatedDownload.data,
    "Deactivated Staff must lose direct Storage even with an old valid AAL2 JWT");
  const deactivatedLink = await revokedSession.storage.from(portraitBucket).createSignedUrl(portraitObject, 60);
  assert.ok(deactivatedLink.error && !deactivatedLink.data?.signedUrl,
    "Deactivated Staff must not mint new signed Storage URLs");

  const anonymousDownload = await create(SUPABASE_ANON_KEY)
    .storage.from(portraitBucket).download(portraitObject);
  assert.ok(anonymousDownload.error && !anonymousDownload.data,
    "Anonymous session must not download private portrait from Storage");
  const anonymousLink = await create(SUPABASE_ANON_KEY).storage.from(portraitBucket)
    .createSignedUrl(portraitObject, 60);
  assert.ok(anonymousLink.error && !anonymousLink.data,
    "Anonymous user must not mint a signed private Storage URL");
  // A separate password login remains AAL1, even after prior verified sessions.
  // Staff was enrolled by the real browser ceremony immediately before this test.
  for (const [label, email] of [["Staff", "staff@ceac.local.test"], ...roleEmails]) {
    const newLogin = create(SUPABASE_ANON_KEY);
    sessions.push(newLogin);
    await signIn(newLogin, email);
    const assurance = await sessionLevel(newLogin, label + " new login", "aal1");
    assert.equal(assurance.nextLevel, "aal2", label + " must require another authenticator challenge");
    assert.equal(await orgIdentity(newLogin, label + " unverified login"), null,
      label + " AAL1 must not get existing SECURITY DEFINER org authority");
    assert.deepEqual(await ownProfileRows(newLogin, label + " unverified AAL1"), [],
      label + " fresh AAL1 login must not read even its own profile via REST/RLS");
    // Real Storage signed-download must be blocked before a fresh TOTP challenge.
    if (label === "Staff" || label === "Manager") {
      const deniedDownload = await newLogin.storage.from(portraitBucket).download(portraitObject);
      assert.ok(deniedDownload.error && !deniedDownload.data,
        label + " fresh AAL1 must be denied direct private Storage access");
      const deniedLink = await newLogin.storage.from(portraitBucket)
        .createSignedUrl(portraitObject, 60);
      assert.ok(deniedLink.error && !deniedLink.data,
        label + " fresh AAL1 must not mint a signed private Storage URL");
    }
  }

  // Real-provider P2 last-authority negative test. The isolated fixture has
  // exactly one holder of authority.manage; even an authenticated AAL2 Admin
  // must not be allowed to deactivate that last holder, including themselves.
  // Check the atomic rollback, not just an error message. All checks remain
  // against disposable local GoTrue/PostgREST, never hosted production.
  const soleAuthorityId = "31000000-0000-4000-8000-000000000003";
  const liveAuthority = await service.from("capability_grants")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .eq("capability", "authority.manage")
    .is("revoked_at", null);
  if (liveAuthority.error) throw liveAuthority.error;
  assert.equal(liveAuthority.count, 1,
    "Isolated fixture must have exactly one authority holder for the fail-closed check");
  const blockedSelfDeactivation = await sessions[2].from("profiles")
    .update({ active: false }).eq("id", soleAuthorityId);
  assert.ok(blockedSelfDeactivation.error,
    "A signed-in AAL2 administrator may not deactivate the organisation's last authority holder");
  assert.match(blockedSelfDeactivation.error.message, /last person who can manage authority/i,
    "Denial must come from the last-authority invariant, not an unrelated RLS or connectivity failure");
  const stillActive = await service.from("profiles")
    .select("active").eq("id", soleAuthorityId).single();
  if (stillActive.error) throw stillActive.error;
  assert.equal(stillActive.data.active, true,
    "Denied last-holder deactivation must leave the administrator active");
  const remainingAuthority = await service.from("capability_grants")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .eq("profile_id", soleAuthorityId)
    .eq("capability", "authority.manage")
    .is("revoked_at", null);
  if (remainingAuthority.error) throw remainingAuthority.error;
  assert.equal(remainingAuthority.count, 1,
    "Denied last-holder deactivation must atomically preserve authority.manage");
  assert.equal(await orgIdentity(sessions[2], "preserved last authority holder"), orgId);
  assert.equal(await edgeStatus(sessions[2]), 404,
    "Denied last-holder deactivation must not lock out verified integration Administration");

  // Disposable lost-factor recovery acceptance. A verified factor removal via
  // the provider ADMIN API must require service authority, invalidate existing
  // sessions, and NEVER make a password-only AAL1 session an authorised user.
  // The privileged provider operation below is a test fixture, NOT an
  // application's publicly callable recovery endpoint or a human approval.
  const recoverySubject = sessions[1]; // fixed second-unit Manager fixture
  const recoveryIdentity = await recoverySubject.auth.getUser();
  if (recoveryIdentity.error) throw recoveryIdentity.error;
  const recoveryUserId = recoveryIdentity.data.user?.id;
  assert.ok(recoveryUserId, "Local recovery test identity missing");
  const factorsBefore = await recoverySubject.auth.mfa.listFactors();
  if (factorsBefore.error) throw factorsBefore.error;
  const previousFactor = factorsBefore.data.totp?.find((item) =>
    item.factor_type === "totp" && item.status === "verified");
  assert.ok(previousFactor?.id, "Recovery test requires an existing verified authenticator");
  const publicDelete = await recoverySubject.auth.admin.mfa.deleteFactor({
    userId: recoveryUserId, id: previousFactor.id,
  });
  assert.ok(publicDelete.error, "Browser-authorised user may not call Auth Admin to remove MFA");

  const removed = await service.auth.admin.mfa.deleteFactor({
    userId: recoveryUserId, id: previousFactor.id,
  });
  if (removed.error) throw removed.error;

  const oldAccess = await recoverySubject.rpc("app_org_id");
  assert.ok(oldAccess.error || oldAccess.data == null,
    "Verified-factor revocation must revoke or deny the old AAL2 bearer");

  const replacementSession = create(SUPABASE_ANON_KEY);
  sessions.push(replacementSession);
  await signIn(replacementSession, roleEmails[1][1]);
  const afterRemoval = await sessionLevel(replacementSession, "Recovered Manager fresh login", "aal1");
  assert.equal(afterRemoval.nextLevel, "aal1",
    "A deleted TOTP factor cannot silently continue to demand its stale factor ID");
  assert.equal(await orgIdentity(replacementSession, "AAL1 after factor reset"), null);
  assert.deepEqual(await ownProfileRows(replacementSession, "AAL1 after factor reset"), []);

  const newFactor = await replacementSession.auth.mfa.enroll({
    factorType: "totp", friendlyName: "CEAC isolated recovered authenticator",
  });
  if (newFactor.error) throw newFactor.error;
  assert.ok(newFactor.data.id && newFactor.data.totp?.secret);
  const challenge = await replacementSession.auth.mfa.challenge({ factorId: newFactor.data.id });
  if (challenge.error) throw challenge.error;
  const recovered = await replacementSession.auth.mfa.verify({
    factorId: newFactor.data.id, challengeId: challenge.data.id,
    code: codeFor(newFactor.data.totp.secret),
  });
  if (recovered.error) throw recovered.error;
  await sessionLevel(replacementSession, "Recovered Manager newly verified authenticator", "aal2");
  assert.equal(await orgIdentity(replacementSession, "Recovered Manager AAL2"), orgId);
  assert.equal((await ownProfileRows(replacementSession, "Recovered Manager own profile")).length, 1);

  console.log("PASS local-only real provider TOTP, AAL2, refresh, last-authority lockdown prevention, RPC/REST/Storage cross-org + deactivation denial and admin-only recovery: Staff + 6 role fixtures.");
} finally {
  // Never reactivate a deactivated role fixture: the real trigger has
  // intentionally revoked grants and memberships. Delete only the disposable
  // invited identity and invitation; preserve all seven primary test actors.
  if (revokedFixtureUserId) {
    const deleted = await service.auth.admin.deleteUser(revokedFixtureUserId);
    if (deleted.error) throw new Error("Could not remove disposable revoked Auth user: " + deleted.error.message);
  }
  if (revokedFixtureInvitationId) {
    const removedInvite = await service.from("pending_invitations")
      .delete().eq("id", revokedFixtureInvitationId);
    if (removedInvite.error) throw new Error("Could not remove disposable revocation invitation: " + removedInvite.error.message);
  }
  if (foreignPortraitFixtureCreated) {
    const removedForeign = await service.storage.from(portraitBucket).remove([foreignPortraitObject]);
    if (removedForeign.error) throw new Error("Disposable foreign-org portrait cleanup failed: " + removedForeign.error.message);
  }
  if (portraitFixtureCreated) {
    const removedFixture = await service.storage.from(portraitBucket).remove([portraitObject]);
    if (removedFixture.error) throw new Error("Disposable private portrait fixture cleanup failed: " + removedFixture.error.message);
  }
  if (switched) {
    const reset = await service.from("organisations").update({ universal_totp_required: false }).eq("id", orgId);
    if (reset.error) throw new Error("Could not restore disposable local MFA flag: " + reset.error.message);
  }
  await Promise.all(sessions.map((client) => client.auth.signOut().catch(() => {})));
}

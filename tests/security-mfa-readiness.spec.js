import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { resolveMfaGate } from "../src/lib/mfaGate.js";
import { isPrivilegedIdentity } from "../src/lib/mfaPolicy.js";

const password = process.env.ROLE_FIXTURE_PASSWORD;

async function signIn(page, email, appClass) {
  await page.goto("/");
  await page.getByPlaceholder("Work email").fill(email);
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.locator(appClass)).toBeVisible({ timeout: 15000 });
  await page.goto("/?tab=account");
  await expect(page.getByRole("heading", { name: "Your account", exact: true })).toBeVisible({ timeout: 15000 });
  await expect(page.getByRole("heading", { name: "Two-step verification", exact: true })).toBeVisible({ timeout: 15000 });
}

test("S1 browser privilege scope includes managers, work-lane leads and active capability holders", async () => {
  expect(isPrivilegedIdentity({ is_admin: true })).toBe(true);
  expect(isPrivilegedIdentity({ is_exec: true })).toBe(true);
  expect(isPrivilegedIdentity({ role: "manager", memberships: [] })).toBe(true);
  expect(isPrivilegedIdentity({
    memberships: [{ role: "sub_team_lead", unit_id: "unit-a" }],
  })).toBe(true);
  expect(isPrivilegedIdentity({ led_sub_team_ids: ["lane-a"] })).toBe(true);
  expect(isPrivilegedIdentity({
    capability_grants: [{ capability: "people.manage", revoked_at: null }],
  })).toBe(true);
  expect(isPrivilegedIdentity({
    role: "staff",
    memberships: [{ role: "staff", unit_id: "unit-a" }],
    capability_grants: [],
  })).toBe(false);
});

test("S1 browser gate never silently bypasses a verified factor", async () => {
  expect(resolveMfaGate({
    assurance: { currentLevel: "aal1", nextLevel: "aal2" },
    factors: { totp: [{ id: "factor-1", status: "verified", factor_type: "totp" }] },
    me: { role: "staff" },
    privilegedMfaEnforced: false,
  }).state).toBe("challenge");

  expect(resolveMfaGate({
    assurance: { currentLevel: "aal1", nextLevel: "aal1" },
    factors: { totp: [{ id: "factor-1", status: "verified", factor_type: "totp" }] },
    me: { role: "manager" },
    privilegedMfaEnforced: false,
  }).state).toBe("challenge");

  expect(resolveMfaGate({
    assurance: { currentLevel: "aal1", nextLevel: "aal1" },
    factors: { totp: [] },
    me: { role: "manager" },
    privilegedMfaEnforced: true,
  }).state).toBe("enroll");

  expect(resolveMfaGate({
    assurance: {
      currentLevel: "aal2",
      nextLevel: "aal2",
      currentAuthenticationMethods: [{ method: "otp" }],
    },
    factors: { totp: [{ id: "factor-1", status: "verified", factor_type: "totp" }] },
    me: { role: "manager" },
    privilegedMfaEnforced: true,
  }).state).toBe("challenge");

  expect(resolveMfaGate({
    assurance: {
      currentLevel: "aal2",
      nextLevel: "aal2",
      currentAuthenticationMethods: [{ method: "totp" }],
    },
    factors: { totp: [{ id: "factor-1", status: "verified", factor_type: "totp" }] },
    me: { role: "manager" },
    privilegedMfaEnforced: true,
  }).state).toBe("allow");
});

test("S1 MFA implementation keeps TOTP management self-only and AAL2-protected", async () => {
  const settings = readFileSync("src/components/MfaSettings.jsx", "utf8");
  const challenge = readFileSync("src/screens/MfaChallenge.jsx", "utf8");
  const required = readFileSync("src/screens/MfaRequired.jsx", "utf8");
  const account = readFileSync("src/screens/AccountActivity.jsx", "utf8");
  const bootstrap = readFileSync("src/lib/supabase.js", "utf8");
  const gate = readFileSync("src/lib/mfaGate.js", "utf8");
  const policy = readFileSync("src/lib/mfaPolicy.js", "utf8");

  expect(account).toContain('import MfaSettings from "../components/MfaSettings";');
  expect(account).toContain("<MfaSettings me={me} />");

  expect(settings).toContain("supabase.auth.mfa.listFactors()");
  expect(settings).toContain("supabase.auth.mfa.getAuthenticatorAssuranceLevel()");
  expect(settings).toContain('factorType: "totp"');
  expect(settings).toContain("supabase.auth.mfa.challenge");
  expect(settings).toContain("supabase.auth.mfa.verify");
  expect(settings).toContain("supabase.auth.mfa.unenroll");
  expect(settings).toContain("Supabase requires an AAL2 session before a verified MFA method can be removed.");
  expect(settings).toContain("privileged_mfa_required");
  expect(settings).not.toContain("privileged_mfa_enforced");
  expect(settings).not.toContain("Other signed-in sessions were revoked");
  expect(settings).toContain("Add and verify a replacement before removing the only verification method on this privileged account.");

  expect(bootstrap).toContain("auth.user.email_confirmed_at");
  expect(bootstrap).toContain("Complete your email verification before opening CEAC.");
  expect(bootstrap).toContain('supabase.from("sub_teams")');
  expect(bootstrap).toContain('.eq("lead_id", auth.user.id)');
  expect(bootstrap).toContain('.eq("active", true)');
  expect(bootstrap).toContain("led_sub_team_ids:");

  expect(gate).toContain("assurance?.currentAuthenticationMethods");
  expect(policy).toContain("currentAuthenticationMethods");
  expect(policy).toContain('entry?.method === "totp"');
  expect(policy).toContain("privileged_totp_session_required");

  expect(challenge).toContain("CEAC will not silently bypass the second step.");
  expect(challenge).toContain('factor.factor_type === "totp"');
  expect(required).toContain("CEAC will not downgrade or bypass the security requirement.");

  for (const source of [settings, challenge, required]) {
    expect(source).not.toContain("service_role");
    expect(source).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(source).not.toContain("recovery_secret");
  }
});

test("S1 Account Security exposes non-mutating MFA readiness to ordinary staff", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await signIn(page, "staff@ceac.local.test", ".staff-app");

  await expect(page.getByText("Protection status", { exact: true })).toBeVisible();
  await expect(page.getByText("Not set up", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Add authenticator app", exact: true })).toBeVisible();
  await expect(page.getByText("Required before privileged go-live", { exact: true })).toHaveCount(0);

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await context.close();
});

test("S1 Account Security labels Admin MFA as a go-live requirement without forcing enrollment during test phase", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const page = await context.newPage();
  await signIn(page, "admin@ceac.local.test", ".office-app");

  await expect(page.getByText("Required before privileged go-live", { exact: true })).toBeVisible();
  await expect(page.getByText(/not being forced during the active test phase/i)).toBeVisible();
  await expect(page.getByRole("button", { name: "Add authenticator app", exact: true })).toBeVisible();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await context.close();
});

import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { decideMfaAccess, isPrivilegedIdentity } from "../src/lib/mfaPolicy.js";

const password = process.env.ROLE_FIXTURE_PASSWORD;

async function signInToAccount(page, email, appClass) {
  await page.goto("/");
  await page.getByPlaceholder("Work email").fill(email);
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.locator(appClass)).toBeVisible({ timeout: 15000 });
  await page.goto("/?tab=account");
  await expect(page.getByRole("heading", { name: "Your account", exact: true })).toBeVisible({ timeout: 15000 });
}

test("S1 browser privilege policy includes managers, work-lane leads and capability holders", () => {
  expect(isPrivilegedIdentity({ is_admin: true, capability_grants: [] })).toBe(true);
  expect(isPrivilegedIdentity({ is_exec: true, capability_grants: [] })).toBe(true);
  expect(isPrivilegedIdentity({ memberships: [{ role: "manager" }], capability_grants: [] })).toBe(true);
  expect(isPrivilegedIdentity({ role: "manager", capability_grants: [] })).toBe(true);
  expect(isPrivilegedIdentity({ led_sub_team_ids: ["lane-1"], capability_grants: [] })).toBe(true);
  expect(isPrivilegedIdentity({ capability_grants: [{ capability: "people.manage" }] })).toBe(true);
  expect(isPrivilegedIdentity({ memberships: [{ role: "staff" }], capability_grants: [] })).toBe(false);
});

test("S1 browser decision never silently bypasses an enrolled factor", () => {
  const totpFactors = { totp: [{ id: "totp-1", status: "verified", factor_type: "totp" }] };

  expect(decideMfaAccess({
    currentLevel: "aal1",
    nextLevel: "aal2",
    factors: totpFactors,
    privileged: false,
    enforcementEnabled: false,
  })).toMatchObject({ state: "challenge" });

  expect(decideMfaAccess({
    currentLevel: "aal1",
    nextLevel: "aal1",
    factors: {},
    privileged: true,
    enforcementEnabled: true,
  })).toMatchObject({ state: "enroll" });

  expect(decideMfaAccess({
    currentLevel: "aal1",
    nextLevel: "aal1",
    factors: {},
    privileged: true,
    enforcementEnabled: false,
  })).toMatchObject({ state: "allow" });

  expect(decideMfaAccess({
    currentLevel: "aal2",
    nextLevel: "aal2",
    factors: totpFactors,
    privileged: true,
    enforcementEnabled: true,
  })).toMatchObject({ state: "allow" });
});

test("S1 isolated MFA implementation stays self-only and uses Supabase Auth APIs", () => {
  const settings = readFileSync("src/components/MfaSettings.jsx", "utf8");
  const challenge = readFileSync("src/screens/MfaChallenge.jsx", "utf8");
  const required = readFileSync("src/screens/MfaRequired.jsx", "utf8");
  const account = readFileSync("src/screens/AccountActivity.jsx", "utf8");

  expect(account).toContain("<MfaSettings me={me} />");
  expect(settings).toContain('factorType: "totp"');
  expect(settings).toContain("supabase.auth.mfa.listFactors()");
  expect(settings).toContain("supabase.auth.mfa.getAuthenticatorAssuranceLevel()");
  expect(settings).toContain("supabase.auth.mfa.challenge");
  expect(settings).toContain("supabase.auth.mfa.verify");
  expect(settings).toContain("supabase.auth.mfa.unenroll");
  expect(settings).toContain('.from("sub_teams")');
  expect(settings).not.toContain('.from("organisations")');
  expect(settings).not.toContain("privileged_mfa_required");

  expect(challenge).toContain("supabase.auth.mfa.listFactors()");
  expect(challenge).toContain("supabase.auth.mfa.challenge");
  expect(challenge).toContain("supabase.auth.mfa.verify");
  expect(challenge).toContain('scope: "local"');

  expect(required).toContain("Your privileged workspace is not available yet.");
  expect(required).toContain('scope: "local"');

  for (const source of [settings, challenge, required]) {
    expect(source).not.toContain("service_role");
    expect(source).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
  }
});

test("S1 Account Security exposes authenticator setup to an ordinary staff account", async ({ browser }) => {
  test.skip(!password, "ROLE_FIXTURE_PASSWORD is required for role-fixture browser coverage.");
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await signInToAccount(page, "staff@ceac.local.test", ".staff-app");

  await expect(page.getByRole("heading", { name: "Two-step verification", exact: true })).toBeVisible();
  await expect(page.getByText("Protection status", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Add authenticator app", exact: true })).toBeVisible();
  await expect(page.getByText("Privileged account protection", { exact: true })).toHaveCount(0);

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await context.close();
});

test("S1 Account Security identifies an admin as privileged without forcing go-live enrollment", async ({ browser }) => {
  test.skip(!password, "ROLE_FIXTURE_PASSWORD is required for role-fixture browser coverage.");
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const page = await context.newPage();
  await signInToAccount(page, "admin@ceac.local.test", ".office-app");

  await expect(page.getByRole("heading", { name: "Two-step verification", exact: true })).toBeVisible();
  await expect(page.getByText("Privileged account protection", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Add authenticator app", exact: true })).toBeVisible();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await context.close();
});

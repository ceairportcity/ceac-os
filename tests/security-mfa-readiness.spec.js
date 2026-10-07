import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

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

test("S1 two-step verification implementation keeps enrollment, challenge and factor removal inside Supabase Auth", async () => {
  const settings = readFileSync("src/components/MfaSettings.jsx", "utf8");
  const challenge = readFileSync("src/screens/MfaChallenge.jsx", "utf8");

  expect(settings).toContain("supabase.auth.mfa.listFactors()");
  expect(settings).toContain("supabase.auth.mfa.getAuthenticatorAssuranceLevel()");
  expect(settings).toContain('factorType: "totp"');
  expect(settings).toContain("supabase.auth.mfa.challenge");
  expect(settings).toContain("supabase.auth.mfa.verify");
  expect(settings).toContain("supabase.auth.mfa.unenroll");
  expect(settings).toContain("pendingFactors");
  expect(settings).toContain("Remove unfinished setup");
  expect(settings).toContain("Add and verify a replacement before removing the only verification method on a privileged account.");

  expect(challenge).toContain("supabase.auth.mfa.listFactors()");
  expect(challenge).toContain("supabase.auth.mfa.challenge");
  expect(challenge).toContain("supabase.auth.mfa.verify");
  expect(challenge).toContain('scope: "local"');

  for (const source of [settings, challenge]) {
    expect(source).not.toContain("service_role");
    expect(source).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
  }
});

test("S1 Account Security exposes non-mutating MFA readiness to an ordinary staff account", async ({ browser }) => {
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

test("S1 Account Security labels privileged MFA as a go-live requirement without forcing enrollment during test phase", async ({ browser }) => {
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

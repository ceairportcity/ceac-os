// Opt-in browser security test. Never run against the hosted production database.
// Requires an intentionally TOTP-enabled disposable Supabase, the seven-role
// synthetic seed, and CEAC_LOCAL_TOTP_UI=1. No live user or production secret.
import { createHmac } from "node:crypto";
import { expect, test } from "@playwright/test";

function decodeBase32(secret) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = 0;
  let accumulator = 0;
  const bytes = [];
  for (const char of String(secret).toUpperCase().replace(/[^A-Z2-7]/g, "")) {
    const value = alphabet.indexOf(char);
    if (value < 0) throw new Error("Invalid synthetic TOTP secret");
    accumulator = (accumulator << 5) | value;
    bits += 5;
    if (bits >= 8) {
      bytes.push((accumulator >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

function currentCode(secret) {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const digest = createHmac("sha1", decodeBase32(secret)).update(counter).digest();
  const offset = digest[digest.length - 1] & 15;
  return String((digest.readUInt32BE(offset) & 0x7fffffff) % 1000000).padStart(6, "0");
}

async function signIn(page, email) {
  await page.goto("/");
  await expect(page.getByPlaceholder("Work email")).toBeVisible();
  await page.getByPlaceholder("Work email").fill(email);
  await page.getByPlaceholder("Password").fill(process.env.ROLE_FIXTURE_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.locator(".app")).toBeVisible({ timeout: 15000 });
  await page.goto("/?tab=account");
  await expect(page.getByRole("heading", { name: "Your account" })).toBeVisible({ timeout: 15000 });
}

test("self-only authenticator enrollment rejects a wrong code then grants AAL2", async ({ browser }) => {
  test.skip(process.env.CEAC_LOCAL_TOTP_UI !== "1", "Requires disposable TOTP-enabled Supabase");
  test.setTimeout(120000);
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    // Never execute against a non-local host even if someone sets the opt-in flag.
    const url = test.info().project.use.baseURL || "";
    expect(new URL(url).hostname).toBe("127.0.0.1");
    await signIn(page, "staff@ceac.local.test");
    await expect(page.getByText("No verified authenticator is registered for this account.")).toBeVisible();
    await page.getByRole("button", { name: "Set up authenticator" }).click();
    await expect(page.getByText("This setup is incomplete until you verify a code below.")).toBeVisible();
    await page.getByRole("button", { name: "Use a manual setup key" }).click();
    const secret = await page.locator(".ev2pf-mfa-enrollment code").textContent();
    expect(secret).toBeTruthy();
    const actual = currentCode(secret);
    const wrong = actual.slice(0, 5) + String((Number(actual[5]) + 1) % 10);
    const input = page.getByRole("textbox", { name: "Authenticator verification code" });
    await input.fill(wrong);
    await page.getByRole("button", { name: "Verify authenticator" }).click();
    await expect(page.locator(".ev2pf-account-mfa [role=alert]")).toBeVisible();
    // Recompute immediately: never depend on the code from the previous time window.
    await input.fill(currentCode(secret));
    await page.getByRole("button", { name: "Verify authenticator" }).click();
    await expect(page.getByText("This session has verified two-step access.")).toBeVisible({ timeout: 15000 });
    await expect(page.locator(".ev2pf-mfa-enrollment")).toHaveCount(0);

    await page.reload();
    await expect(page.getByText("This session has verified two-step access.")).toBeVisible({ timeout: 15000 });
  } finally {
    await context.close();
  }
});

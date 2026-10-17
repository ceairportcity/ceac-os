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

async function passwordSignIn(page, email) {
  await page.goto("/");
  await expect(page.getByPlaceholder("Work email")).toBeVisible();
  await page.getByPlaceholder("Work email").fill(email);
  await page.getByPlaceholder("Password").fill(process.env.ROLE_FIXTURE_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
}

// Every browser in this test must be isolated from hosted or third-party APIs.
async function localOnlyNetwork(page) {
  const blocked = [];
  await page.route("**/*", (route) => {
    const target = new URL(route.request().url());
    const local = target.protocol === "http:" && target.hostname === "127.0.0.1" &&
      (target.port === "5173" || target.port === "54321");
    const offlineFont = target.protocol === "https:" && target.hostname === "fonts.googleapis.com" &&
      target.pathname === "/css2" && route.request().resourceType() === "stylesheet" &&
      target.searchParams.has("family");
    if (offlineFont) return route.fulfill({
      status: 200, contentType: "text/css", body: "/* isolated CEAC local MFA font fixture */",
    });
    if (!local) {
      blocked.push(target.origin);
      return route.abort("blockedbyclient");
    }
    return route.continue();
  });
  return blocked;
}

test("universal Stage 2 gate enforces TOTP on initial and new-browser sign-in without repeated refresh challenges", async ({ browser }) => {
  test.skip(process.env.CEAC_LOCAL_TOTP_UI !== "1", "Requires disposable local TOTP-enabled Supabase");
  test.setTimeout(180000);
  const baseURL = test.info().project.use.baseURL || "";
  expect(new URL(baseURL).hostname).toBe("127.0.0.1");

  const first = await browser.newContext();
  const second = await browser.newContext();
  const page = await first.newPage();
  const nextPage = await second.newPage();
  try {
    const blockedFirst = await localOnlyNetwork(page);
    const blockedSecond = await localOnlyNetwork(nextPage);
    await passwordSignIn(page, "staff@ceac.local.test");
    await expect(page.getByRole("heading", { name: "Set up your authenticator" })).toBeVisible({timeout:15000});
    await expect(page.locator(".app")).toHaveCount(0);
    await page.getByRole("button", { name: "Set up authenticator" }).click();
    await expect(page.getByText("This setup is incomplete until you verify a code below.")).toBeVisible();
    await page.getByRole("button", { name: "Use a manual setup key" }).click();
    const secret = await page.locator(".ev2pf-mfa-enrollment code").textContent();
    expect(secret).toBeTruthy();

    const correct = currentCode(secret);
    const wrong = correct.slice(0,5) + String((Number(correct[5])+1)%10);
    const codeInput=page.getByRole("textbox",{name:"Authenticator verification code"});
    await codeInput.fill(wrong);
    await page.getByRole("button",{name:"Verify authenticator"}).click();
    await expect(page.locator(".ev2pf-account-mfa [role=alert]")).toBeVisible();
    await expect(page.locator(".app")).toHaveCount(0);

    await codeInput.fill(currentCode(secret));
    await page.getByRole("button",{name:"Verify authenticator"}).click();
    await expect(page.locator(".app")).toBeVisible({timeout:15000});

    await page.goto("/?tab=account");
    await expect(page.getByRole("heading",{name:"Your account"})).toBeVisible();
    await expect(page.getByText("This session has verified two-step access.")).toBeVisible();

    // Secure device-loss fallback: a signed AAL2 user can enroll a second
    // authenticator in advance. AAL1 cannot add a backup without step-up.
    await page.getByRole("button",{name:"Add backup authenticator"}).click();
    await page.getByRole("button",{name:"Use a manual setup key"}).click();
    const backupSecret=await page.locator(".ev2pf-mfa-enrollment code").textContent();
    expect(backupSecret).toBeTruthy();
    await page.getByRole("textbox",{name:"Authenticator verification code"}).fill(currentCode(backupSecret));
    await page.getByRole("button",{name:"Verify authenticator"}).click();
    await expect(page.getByText("This session has verified two-step access.")).toBeVisible();
    await expect(page.getByRole("button",{name:"Add backup authenticator"})).toHaveCount(0);

    // Ordinary reload reuses the verified AAL2 session; it must not request a
    // new code merely because the browser refreshed or the app navigated.
    await page.reload();
    await expect(page.locator(".app")).toBeVisible({timeout:15000});
    await expect(page.getByText("This session has verified two-step access.")).toBeVisible();
    await expect(page.getByRole("heading",{name:"Verify your authenticator"})).toHaveCount(0);

    // A separate browser does not inherit the existing device's verified AAL2.
    await passwordSignIn(nextPage, "staff@ceac.local.test");
    await expect(nextPage.getByRole("heading",{name:"Verify your authenticator"})).toBeVisible({timeout:15000});
    await expect(nextPage.locator(".app")).toHaveCount(0);
    // The independent backup factor works even without the primary device.
    await nextPage.getByRole("textbox",{name:"Authenticator verification code"}).fill(currentCode(backupSecret));
    await nextPage.getByRole("button",{name:"Verify authenticator"}).click();
    await expect(nextPage.locator(".app")).toBeVisible({timeout:15000});

    expect(blockedFirst,"First device attempted an external MFA request").toEqual([]);
    expect(blockedSecond,"Fresh second device attempted an external MFA request").toEqual([]);
  } finally {
    await second.close();
    await first.close();
  }
});

// Isolated unauthenticated browser smoke. NO production Supabase or credentials.
// This is NOT a substitute for authenticated role flows, RLS or visual Level C.
import { test, expect } from "@playwright/test";

for (const viewport of [
  { name: "laptop", width: 1366, height: 768 },
  { name: "phone", width: 390, height: 844 },
]) {
  test(`CEAC signed-out ${viewport.name} shell and recovery are usable without live APIs`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
    const page = await context.newPage();
    const outboundToProduction = [];
    page.on("request", (request) => {
      if (request.url().includes("efjljhftsesssumtshvp.supabase.co")) outboundToProduction.push(request.url());
    });
    await page.route("https://efjljhftsesssumtshvp.supabase.co/**", route => route.abort());
    await page.goto("http://127.0.0.1:5173/", { waitUntil: "domcontentloaded" });
    await expect(page.getByText("Welcome back")).toBeVisible({ timeout: 15000 });
    await expect(page.getByPlaceholder("Work email")).toBeVisible();
    await expect(page.getByPlaceholder("Password")).toHaveAttribute("type", "password");
    await expect(page.getByText("Account access is issued by CEAC Administration.")).toBeVisible();
    await page.getByRole("button", { name: "Forgot your password?" }).click();
    await expect(page.getByText("Reset your password")).toBeVisible();
    await expect(page.getByPlaceholder("Password")).toHaveCount(0);
    await page.getByRole("button", { name: "Back to sign in" }).click();
    await expect(page.getByText("Welcome back")).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `${viewport.name}: signed-out app must not overflow horizontally`).toBeLessThanOrEqual(1);
    expect(outboundToProduction).toEqual([]);
    await context.close();
  });
}

test("local CEAC webmanifest, PWA icons and app shell are present", async ({ page }) => {
  await page.route("https://efjljhftsesssumtshvp.supabase.co/**", route => route.abort());
  await page.goto("http://127.0.0.1:5173/", { waitUntil: "domcontentloaded" });
  const manifest = await page.evaluate(async () => {
    const r = await fetch("/manifest.webmanifest");
    if (!r.ok) throw new Error(`manifest status ${r.status}`);
    return r.json();
  });
  expect(manifest.name).toBe("CEAC OS");
  expect(manifest.icons).toEqual(expect.arrayContaining([
    expect.objectContaining({ sizes: "192x192" }),
    expect.objectContaining({ sizes: "512x512" }),
  ]));
  for (const icon of ["/ceac-icon-192.png", "/ceac-icon-512.png"]) {
    const image = await page.request.get("http://127.0.0.1:5173" + icon);
    expect(image.ok()).toBeTruthy();
    expect(image.headers()["content-type"]).toContain("image/png");
    expect((await image.body()).length).toBeGreaterThan(1000);
  }
});

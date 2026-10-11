import { expect, test } from "@playwright/test";

const password = process.env.ROLE_FIXTURE_PASSWORD;

for (const viewport of [
  { name: "desktop-1366", width: 1366, height: 768 },
  { name: "phone-390", width: 390, height: 844 },
]) {
  test(`premium Administration daily briefing at ${viewport.name}`, async ({ browser }) => {
    const context = await browser.newContext({ viewport:{ width:viewport.width, height:viewport.height } });
    const page = await context.newPage();
    await page.goto("/");
    await page.getByPlaceholder("Work email").fill("admin@ceac.local.test");
    await page.getByPlaceholder("Password").fill(password);
    await page.getByRole("button", { name:"Sign in" }).click();
    await expect(page.locator(".office-app")).toBeVisible({timeout:15000});
    await page.goto("/?tab=home");

    const hero = page.getByRole("banner", {name:"Administration daily briefing"});
    await expect(hero).toBeVisible({timeout:15000});
    await expect(hero.getByRole("heading", { name:/Good morning|Good afternoon|Good evening/ })).toBeVisible();
    await expect(hero.getByRole("complementary", { name:"Upcoming commitments" })).toBeVisible();
    await expect(hero.locator(".adminv2-mini-calendar")).toBeVisible();
    await expect(hero.getByRole("button", { name:"Next month" })).toBeVisible();
    await expect(hero.getByRole("link", {name:/Review your inbox/})).toBeVisible();
    await expect(page.locator(".adminv2-inbox")).toBeVisible({timeout:15000});
    await expect(page.getByRole("region", {name:"Next useful Administration step"})).toBeVisible();
    await expect(page.locator(".adminv2-focus-metrics")).toBeVisible();

    await page.screenshot({path:`test-artifacts/admin-premium-briefing-${viewport.name}.png`,fullPage:true});
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);

    await hero.getByRole("button", { name:"Next month" }).click();
    await hero.getByRole("button", { name:"Show current month" }).click();
    await hero.getByRole("link", { name:/Review your inbox/ }).click();
    await expect(page).toHaveURL(/#admin-operational-inbox/);
    await expect(page.locator("#admin-operational-inbox")).toBeVisible();
    await context.close();
  });
}

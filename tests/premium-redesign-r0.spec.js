import { test, expect } from "@playwright/test";

const rolePassword = process.env.ROLE_FIXTURE_PASSWORD;

async function openAs(browser, email, viewport = { width: 1440, height: 960 }) {
  const context = await browser.newContext({
    viewport,
    geolocation: { latitude: 5.6037, longitude: -0.1870 },
    permissions: ["geolocation"],
  });
  const page = await context.newPage();
  await page.goto("/");
  await page.getByPlaceholder("Work email").fill(email);
  await page.getByPlaceholder("Password").fill(rolePassword);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.locator(".app")).toBeVisible({ timeout: 15000 });
  return { context, page };
}

test.describe("Premium redesign R0 shell", () => {
  test("Staff desktop shell matches the locked role model", async ({ browser }) => {
    const { context, page } = await openAs(browser, "staff@ceac.local.test");
    await expect(page.locator(".ev2s-sidebar")).toBeVisible();
    await expect(page.locator(".ev2s-topbar")).toBeVisible();
    await expect(page.locator(".ev2s-brand").getByText("CEAC OS", { exact:true })).toBeVisible();
    for (const label of ["Today","Work","Team","Calendar","Messages","My Hub"]) {
      await expect(page.locator(".ev2s-sidebar").getByRole("button", { name:label, exact:true })).toBeVisible();
    }
    await expect(page.locator(".ev2s-destination-search").getByPlaceholder("Search CEAC…")).toBeVisible();
    await expect(page.getByRole("button", { name:"Create", exact:true })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    await page.screenshot({ path:"test-artifacts/redesign-r0-staff-desktop.png", fullPage:true });
    await context.close();
  });

  test("Manager desktop shell is manager-specific", async ({ browser }) => {
    const { context, page } = await openAs(browser, "manager@ceac.local.test");
    for (const label of ["Overview","Work","Team","Projects","Calendar","Finance","Reports","Messages","My Hub"]) {
      await expect(page.locator(".ev2s-sidebar").getByRole("button", { name:label, exact:true })).toBeVisible();
    }
    await expect(page.locator(".ev2s-sidebar").getByRole("button", { name:"Today", exact:true })).toHaveCount(0);
    await page.screenshot({ path:"test-artifacts/redesign-r0-manager-desktop.png", fullPage:true });
    await context.close();
  });

  test("Administration desktop shell hides architecture clutter", async ({ browser }) => {
    const { context, page } = await openAs(browser, "admin@ceac.local.test");
    for (const label of ["Overview","People & Access","Work","Time & Leave","Finance","Reports","Control Center"]) {
      await expect(page.locator(".ev2s-sidebar").getByRole("button", { name:label, exact:true })).toBeVisible();
    }
    for (const label of ["Events","Workflows","Authority","Employee lifecycle","Protected HR","Integrations"]) {
      await expect(page.locator(".ev2s-sidebar").getByRole("button", { name:label, exact:true })).toHaveCount(0);
    }
    await page.screenshot({ path:"test-artifacts/redesign-r0-admin-desktop.png", fullPage:true });
    await context.close();
  });

  test("Executive desktop shell is an executive product", async ({ browser }) => {
    const { context, page } = await openAs(browser, "exec@ceac.local.test");
    for (const label of ["Overview","Work","Priorities","Projects","Organisation","Finance","Reports"]) {
      await expect(page.locator(".ev2s-sidebar").getByRole("button", { name:label, exact:true })).toBeVisible();
    }
    await expect(page.locator(".ev2s-sidebar").getByRole("button", { name:"Employee lifecycle", exact:true })).toHaveCount(0);
    await page.screenshot({ path:"test-artifacts/redesign-r0-executive-desktop.png", fullPage:true });
    await context.close();
  });

  test("Staff mobile shell remains fluid and messaging stays in the approved More navigation", async ({ browser }) => {
    const { context, page } = await openAs(browser, "staff@ceac.local.test", { width:390, height:844 });
    await expect(page.locator(".ev2s-mobile-topbar")).toBeVisible();
    await expect(page.locator(".ev2s-mobile-nav")).toBeVisible();
    await page.locator(".ev2s-mobile-nav").getByRole("button", { name:"More", exact:true }).click();
    const more = page.getByRole("dialog", { name:"More" });
    await expect(more).toBeVisible();
    await expect(more.getByRole("button", { name:"Messages", exact:true })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    await page.screenshot({ path:"test-artifacts/redesign-r0-staff-mobile.png", fullPage:true });
    await context.close();
  });
});

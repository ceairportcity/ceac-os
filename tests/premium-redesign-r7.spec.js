import { test, expect } from "@playwright/test";

const password = process.env.ROLE_FIXTURE_PASSWORD;
const roles = [
  ["staff@ceac.local.test", ".staff-app", "Staff", ".staffv2"],
  ["manager@ceac.local.test", ".manager-app", "Manager", ".managerv2"],
  ["admin@ceac.local.test", ".office-app", "Administration", ".adminv2"],
  ["exec@ceac.local.test", ".executive-app", "Executive", ".executivev2"],
];

async function openRole(browser, email, appClass, readySelector, reducedMotion = "no-preference", viewport = { width: 1440, height: 960 }) {
  const context = await browser.newContext({ viewport, reducedMotion });
  const page = await context.newPage();
  await page.goto("/");
  await page.getByPlaceholder("Work email").fill(email);
  await page.getByPlaceholder("Password").fill(password);
  const started = Date.now();
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.locator(appClass)).toBeVisible({ timeout: 15000 });
  await expect(page.locator(readySelector).first()).toBeVisible({ timeout: 15000 });
  return { context, page, openMs: Date.now() - started };
}

test.describe("Premium redesign R7 closure", () => {
  for (const [email, appClass, label, readySelector] of roles) {
    test(`${label} shell matches the approved dashboard composition and opens fully`, async ({ browser }) => {
      const { context, page, openMs } = await openRole(browser, email, appClass, readySelector);
      expect(openMs).toBeLessThan(15000);

      await expect(page.locator(".ev2s-sidebar")).toBeVisible();
      await expect(page.locator(".ev2s-topbar")).toBeVisible();
      await expect(page.locator(".ev2s-sidebar-nav")).toBeVisible();
      await expect(page.locator(".fpg9-sidebar-quick")).toBeVisible();
      await expect(page.getByRole("button", { name: "Create", exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: "Open messages", exact: true })).toBeVisible();

      if (label === "Staff") {
        await expect(page.locator(".staffv2")).toBeVisible();
        await expect(page.locator(".staffv2-session")).toBeVisible();
        await expect(page.locator(".staffv2-focus-grid")).toBeVisible();
        await expect(page.locator(".staffv2-schedule-panel")).toBeVisible();
        await expect(page.locator(".reference-module-strip")).toHaveCount(0);
        await expect(page.locator(".staff-command-surface")).toHaveCount(0);
      } else if (label === "Manager") {
        await expect(page.locator(".managerv2")).toBeVisible();
        await expect(page.locator(".managerv2-main")).toBeVisible({ timeout: 15000 });
        await expect(page.locator(".fpg9-home-hero")).toBeVisible();
        await expect(page.locator(".fpg9-home-reference")).toBeVisible();
        await expect(page.locator(".fpg9-calendar-card")).toBeVisible();
        await expect(page.locator(".fpg9-home-queues")).toBeVisible();
        await expect(page.locator(".fpg9-module-strip")).toBeVisible();
        await expect(page.locator(".fpg9-workspace-previews")).toBeVisible();
        await expect(page.locator(".managerv2-decisions")).toHaveCount(0);
      } else if (label === "Administration") {
        await expect(page.locator(".adminv2")).toBeVisible();
        await expect(page.locator(".adminv2-main")).toBeVisible({ timeout: 15000 });
        await expect(page.locator(".adminv2-inbox")).toBeVisible();
        await expect(page.locator(".reference-module-strip")).toHaveCount(0);
        await expect(page.locator(".reference-calendar-card")).toHaveCount(0);
        await expect(page.locator(".admin-command-surface")).toHaveCount(0);
      } else {
        await expect(page.locator(".executivev2")).toBeVisible();
        await expect(page.locator(".executivev2-main")).toBeVisible({ timeout: 15000 });
        await expect(page.locator(".executivev2-attention")).toBeVisible();
        await expect(page.locator(".reference-module-strip")).toHaveCount(0);
        await expect(page.locator(".reference-calendar-card")).toHaveCount(0);
        await expect(page.locator(".executive-command-surface")).toHaveCount(0);
      }

      const unnamed = await page.evaluate(() => [...document.querySelectorAll("button,a,input,select,textarea")]
        .filter((el) => {
          const text = (el.textContent || "").trim();
          const aria = (el.getAttribute("aria-label") || "").trim();
          const labelled = (el.getAttribute("aria-labelledby") || "").trim();
          const title = (el.getAttribute("title") || "").trim();
          const placeholder = (el.getAttribute("placeholder") || "").trim();
          const alt = (el.getAttribute("alt") || "").trim();
          return !text && !aria && !labelled && !title && !placeholder && !alt;
        })
        .map((el) => el.outerHTML.slice(0, 180)));
      expect(unnamed, `Unnamed interactive controls: ${unnamed.join(" | ")}`).toEqual([]);

      await page.screenshot({ path: `test-artifacts/redesign-r7-${label.toLowerCase()}-desktop.png`, fullPage: true });
      await context.close();
    });
  }

  test("Staff mobile keeps the reference hierarchy without desktop chrome", async ({ browser }) => {
    const { context, page } = await openRole(browser, "staff@ceac.local.test", ".staff-app", ".staffv2", "no-preference", { width: 390, height: 844 });
    await expect(page.locator(".ev2s-sidebar")).toBeHidden();
    await expect(page.locator(".ev2s-topbar")).toBeHidden();
    await expect(page.locator(".ev2s-mobile-topbar")).toBeVisible();
    await expect(page.locator(".staffv2")).toBeVisible();
    await expect(page.locator(".staffv2-session")).toBeVisible();
    await expect(page.locator(".staffv2-focus-grid")).toBeVisible();
    await expect(page.locator(".staffv2-schedule-panel")).toBeHidden();
    await expect(page.locator(".staffv2-secondary-grid")).toBeHidden();
    await expect(page.locator(".reference-module-strip")).toHaveCount(0);
    const mobileNav = page.locator(".ev2s-mobile-nav");
    await expect(mobileNav).toBeVisible();
    await page.screenshot({ path: "test-artifacts/redesign-r7-staff-mobile.png", fullPage: true });

    await mobileNav.getByRole("button", { name: "More", exact: true }).click();
    const more = page.getByRole("dialog", { name: "More" });
    const calendar = more.getByRole("button", { name: "Calendar", exact: true });
    await expect(calendar).toBeVisible();
    await calendar.click();
    expect(new URL(page.url()).searchParams.get("tab")).toBe("staff-calendar");
    await context.close();
  });

  test("Command K opens Search CEAC", async ({ browser }) => {
    const { context, page } = await openRole(browser, "staff@ceac.local.test", ".staff-app", ".staffv2");
    await page.keyboard.press("Meta+K");
    await expect(page.getByRole("dialog", { name: "Search CEAC results" })).toBeVisible();
    await context.close();
  });

  test("Reduced-motion preference suppresses premium transitions", async ({ browser }) => {
    const { context, page } = await openRole(browser, "staff@ceac.local.test", ".staff-app", ".staffv2", "reduce");
    const duration = await page.getByRole("button", { name: "Create", exact: true }).evaluate((el) => getComputedStyle(el).transitionDuration);
    const values = duration.split(",").map((value) => parseFloat(value) || 0);
    expect(Math.max(...values)).toBeLessThanOrEqual(0.01);
    await context.close();
  });
});

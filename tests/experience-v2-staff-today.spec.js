import fs from "node:fs";
import { test, expect } from "@playwright/test";

const password = process.env.ROLE_FIXTURE_PASSWORD;

async function openStaff(browser, viewport) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  await page.goto("/");
  await page.getByPlaceholder("Work email").fill("staff@ceac.local.test");
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.locator(".staffv2")).toBeVisible({ timeout: 15000 });
  return { context, page };
}

test.describe.configure({ mode: "serial" });

test("Stage 5 Staff Today is isolated V2 presentation on preserved Home logic", async () => {
  for (const path of [
    "src/experience-v2/staff-today/StaffTodayV2.jsx",
    "src/experience-v2/staff-today/staff-today.css",
  ]) {
    expect(fs.existsSync(path), path).toBeTruthy();
  }

  const home = fs.readFileSync("src/screens/Home.jsx", "utf8");
  const view = fs.readFileSync("src/experience-v2/staff-today/StaffTodayV2.jsx", "utf8");
  const css = fs.readFileSync("src/experience-v2/staff-today/staff-today.css", "utf8");
  const main = fs.readFileSync("src/main.jsx", "utf8");
  const ministry = fs.readFileSync("src/components/MinistryNumbers.jsx", "utf8");

  expect(home).toContain('from "../experience-v2/staff-today/StaffTodayV2"');
  expect(home).toContain("startWork(me.org_id, me.id");
  expect(home).toContain('supabase.rpc("follow_up_work_review"');
  expect(home).toContain('supabase.rpc("follow_up_blocker"');
  expect(home).not.toContain("ReferenceModuleStrip");
  expect(home).not.toContain("DashboardCalendar");
  expect(home).toContain('import MinistryNumbers from "../components/MinistryNumbers"');
  expect(home).toContain('ministryRecord={<MinistryNumbers me={me} compact presentation="staffV2" />');

  expect(view).toContain('from "../components"');
  expect(view).toContain('from "../icons"');
  expect(view).toContain("ActionFocusCard");
  expect(view).toContain("DataPanel");
  expect(view).toContain("QueueRow");
  expect(view).not.toContain("components/bits");
  expect(view).not.toContain("ReferenceDashboard");
  expect(view).not.toContain('from "../../components/MinistryNumbers"');
  expect(view).toContain("ministryRecord");
  expect(view).not.toContain("<Icon ");
  expect(ministry).toContain('presentation === "staffV2"');
  expect(ministry).toContain("staffv2-ministry-panel");
  expect(ministry).toContain("V2DataPanel");

  expect((css.match(/!important\b/g) || []).length).toBe(0);
  expect(css).toContain(".staffv2");
  expect(css).not.toContain(".staff-app");
  expect(css).not.toContain(".premium-");
  expect(css).not.toContain(".home-panel");

  const shellCss = main.indexOf('import "./experience-v2/shell/shell.css";');
  const staffCss = main.indexOf('import "./experience-v2/staff-today/staff-today.css";');
  expect(shellCss).toBeGreaterThan(-1);
  expect(staffCss).toBeGreaterThan(shellCss);
});

for (const viewport of [
  { width: 320, height: 844, name: "320" },
  { width: 390, height: 844, name: "390" },
  { width: 1366, height: 768, name: "laptop" },
  { width: 1440, height: 900, name: "desktop" },
]) {
  test(`Stage 5 Staff Today composes cleanly at ${viewport.name}`, async ({ browser }) => {
    const { context, page } = await openStaff(browser, { width: viewport.width, height: viewport.height });

    await expect(page.getByRole("heading", { name: /Good (morning|afternoon|evening), Staff/ })).toBeVisible();
    await expect(page.locator(".staffv2-session")).toBeVisible();
    await expect(page.locator(".staffv2-focus-grid")).toBeVisible();
    await expect(page.getByText("Next up", { exact: true }).first()).toBeVisible();
    if (viewport.width <= 390) {
      await expect(page.locator(".staffv2-schedule-panel")).toBeHidden();
      await expect(page.locator(".staffv2-secondary-grid")).toBeHidden();
    } else {
      await expect(page.locator(".staffv2-schedule-panel")).toBeVisible();
      await expect(page.locator(".staffv2-secondary-grid")).toBeVisible();
    }
    await expect(page.locator(".reference-module-strip")).toHaveCount(0);
    await expect(page.locator(".staff-command-surface")).toHaveCount(0);

    const primaryTitle = await page.locator(".staffv2-focus-card .ev2c-focus-title").textContent();
    if (primaryTitle && primaryTitle !== "You're clear for now") {
      await expect(page.locator(".staffv2-coming").getByText(primaryTitle, { exact: true })).toHaveCount(0);
    }

    const sessionActions = page.locator(".staffv2-session").getByRole("button", { name: /^(Start work|End work|Review)$/ });
    await expect(sessionActions).toHaveCount(1);

    if (await page.locator(".staffv2-ministry-panel").count()) {
      await expect(page.locator(".staffv2-secondary-grid .staffv2-ministry-record")).toHaveCount(1);
    }

    if (viewport.width <= 390) {
      const sessionGeometry = await page.locator(".staffv2-session").evaluate((node) => {
        const rect = node.getBoundingClientRect();
        const actions = node.querySelector(".staffv2-session-actions");
        return {
          height: rect.height,
          actionWidth: actions?.getBoundingClientRect().width || 0,
          viewportWidth: window.innerWidth,
        };
      });
      expect(sessionGeometry.height).toBeLessThanOrEqual(96);
      expect(sessionGeometry.actionWidth).toBeLessThan(sessionGeometry.viewportWidth / 2);

      const mainGrid = page.locator(".staffv2-main-grid");
      const mainDisplay = await mainGrid.evaluate((node) => ({
        display: getComputedStyle(node).display,
        overflowX: getComputedStyle(node).overflowX,
      }));
      expect(mainDisplay.display).toBe("flex");
      expect(["auto", "scroll"]).toContain(mainDisplay.overflowX);
    }

    const overflow = await page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow).toBeLessThanOrEqual(1);

    await page.screenshot({
      path: `test-artifacts/redesign-r7-stage5-staff-${viewport.name}.png`,
      fullPage: true,
    });
    await context.close();
  });
}

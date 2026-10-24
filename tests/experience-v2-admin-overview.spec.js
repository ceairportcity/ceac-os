import fs from "node:fs";
import { test, expect } from "@playwright/test";

const password = process.env.ROLE_FIXTURE_PASSWORD;

async function openAdmin(browser, viewport) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  await page.goto("/");
  await page.getByPlaceholder("Work email").fill("admin@ceac.local.test");
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.locator(".office-app")).toBeVisible({ timeout: 15000 });
  await expect(page.locator(".adminv2")).toBeVisible({ timeout: 15000 });
  await expect(page.locator(".adminv2-main")).toBeVisible({ timeout: 15000 });
  return { context, page };
}

test.describe.configure({ mode: "serial" });

test("Stage 7 Administration Overview is isolated V2 presentation on preserved Administration authority", async () => {
  for (const path of [
    "src/experience-v2/admin-overview/AdminOverviewV2.jsx",
    "src/experience-v2/admin-overview/admin-overview.css",
  ]) {
    expect(fs.existsSync(path), path).toBeTruthy();
  }

  const home = fs.readFileSync("src/screens/AdminHome.jsx", "utf8");
  const view = fs.readFileSync("src/experience-v2/admin-overview/AdminOverviewV2.jsx", "utf8");
  const css = fs.readFileSync("src/experience-v2/admin-overview/admin-overview.css", "utf8");
  const main = fs.readFileSync("src/main.jsx", "utf8");

  expect(home).toContain('from "../experience-v2/admin-overview/AdminOverviewV2"');
  expect(home).not.toContain('inviteByEmail');
  expect(home).toContain('supabase.rpc("workforce_leave_action"');
  expect(home).toContain('required_capability');
  expect(home).toContain('rpc("admin_employee_roster_summary")');
  expect(home).toContain('rpc("payroll_readiness_summary")');
  expect(home).not.toContain("ReferenceFocusPanel");
  expect(home).not.toContain("DashboardCalendar");
  expect(home).not.toContain("ReferenceModuleStrip");
  expect(home).not.toContain('from "../components/primitives"');

  expect(view).toContain('from "../components"');
  expect(view).toContain('from "../icons"');
  expect(view).toContain("Needs Administration");
  expect(view).toContain('title="Employee records"');
  expect(view).toContain('title="Today and leave context"');
  expect(view).toContain('title="Payroll readiness"');
  expect(view).toContain('title="Finance & reporting"');
  expect(view).toContain('title="Control Center"');
  expect(view).toContain("Invitations to review");
  expect(view).not.toContain("onInviteUnit");
  expect(view).toContain("No work session is not an absence");
  expect(view).toContain("signals for review, not conclusions about performance");
  expect(view).not.toContain("ReferenceDashboard");
  expect(view).not.toContain("components/primitives");

  expect((css.match(/!important\b/g) || []).length).toBe(0);
  expect(css).toContain(".adminv2");
  expect(css).not.toContain(".office-app");
  expect(css).not.toContain(".premium-");
  expect(css).not.toContain(".admin-home-section");

  const managerView = fs.readFileSync("src/experience-v2/manager-overview/ManagerOverviewV2.jsx", "utf8");
  const adminCss = main.indexOf('import "./experience-v2/admin-overview/admin-overview.css";');
  expect(managerView).toContain('import "./manager-overview.css";');
  expect(main).not.toContain('import "./experience-v2/manager-overview/manager-overview.css";');
  expect(adminCss).toBeGreaterThan(-1);
});

for (const viewport of [
  { width: 320, height: 844, name: "320" },
  { width: 390, height: 844, name: "390" },
  { width: 1366, height: 768, name: "laptop" },
  { width: 1440, height: 900, name: "desktop" },
]) {
  test(`Stage 7 Administration Overview composes cleanly at ${viewport.name}`, async ({ browser }) => {
    const { context, page } = await openAdmin(browser, { width: viewport.width, height: viewport.height });

    await expect(page.locator(".adminv2-hero-title h1")).toContainText(/Good morning|Good afternoon|Good evening/);
    await expect(page.locator(".adminv2-context")).toContainText("Administration & HR");
    await expect(page.locator(".adminv2-inbox")).toBeVisible();
    await page.locator(".adminv2-more-context > summary").click();
    await expect(page.locator(".adminv2-people")).toBeVisible();
    await expect(page.locator(".adminv2-reporting")).toBeVisible();
    await expect(page.locator(".adminv2-pulse")).toBeVisible();
    await expect(page.locator(".adminv2-workforce")).toBeVisible();
    await expect(page.locator(".adminv2-payroll")).toBeVisible();
    await expect(page.locator(".adminv2-delivery")).toBeVisible();
    await expect(page.locator(".admin-command-surface")).toHaveCount(0);
    await expect(page.locator(".reference-calendar-card")).toHaveCount(0);
    await expect(page.locator(".reference-module-strip")).toHaveCount(0);

    const overflow = await page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow).toBeLessThanOrEqual(1);

    if (viewport.width <= 599) {
      const compactHeights = await page.locator(".adminv2 .ev2c-button-compact:visible").evaluateAll((buttons) =>
        buttons.map((button) => button.getBoundingClientRect().height)
      );
      for (const height of compactHeights) expect(height).toBeGreaterThanOrEqual(44);

      // A single reachable mobile inbox shortcut replaces the hidden desktop
      // hero controls; do not show duplicate, cramped primary actions.
      await expect(page.locator(".adminv2-intro-actions")).toBeHidden();
      await expect(page.locator(".adminv2-mobile-actions .adminv2-hero-link")).toBeVisible();
      await expect(page.locator(".adminv2-mobile-actions")).toBeVisible();

      const inboxBox = await page.locator(".adminv2-inbox").boundingBox();
      const shortcutsBox = await page.locator(".adminv2-mobile-actions").boundingBox();
      const peopleBox = await page.locator(".adminv2-people").boundingBox();
      expect(inboxBox?.y || 0).toBeLessThan(shortcutsBox?.y || 0);
      expect(shortcutsBox?.y || 0).toBeLessThan(peopleBox?.y || 0);

      const contextGrids = page.locator(".adminv2-context-grid, .adminv2-support-grid");
      const mobileLayouts = await contextGrids.evaluateAll((nodes) => nodes.map((node) => ({
        display: getComputedStyle(node).display,
        columns: getComputedStyle(node).gridTemplateColumns,
        overflow: node.scrollWidth - node.clientWidth,
      })));
      for (const layout of mobileLayouts) {
        expect(layout.display).toBe("grid");
        expect(layout.columns.split(" ").filter(Boolean)).toHaveLength(1);
        expect(layout.overflow).toBeLessThanOrEqual(1);
      }
    }

    await page.screenshot({
      path: `test-artifacts/redesign-r7-stage7-admin-${viewport.name}.png`,
      fullPage: true,
    });
    await context.close();
  });
}


test("HR daily workforce workspace routes into actual employee and permission management",async({browser})=>{
 const {context,page}=await openAdmin(browser,{width:1366,height:768});
 const workspace=page.getByRole("region",{name:"Today's workforce start locations"});
 await expect(workspace).toBeVisible();
 await expect(workspace.getByRole("searchbox",{name:"Search daily workforce"})).toBeVisible();
 await workspace.getByRole("button",{name:"People & Access"}).click();
 await expect(page.locator(".ev2-people-page.ev2-people-admin")).toBeVisible({timeout:15000});
 await page.getByRole("tablist",{name:"People views"}).getByRole("tab",{name:/^Access(?: administration)?$/}).click();
 await expect(page.getByRole("tablist",{name:"People views"}).getByRole("tab",{name:/^Access(?: administration)?$/})).toHaveAttribute("aria-selected","true");
 await context.close();
});

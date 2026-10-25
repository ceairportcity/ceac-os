import fs from "node:fs";
import { test, expect } from "@playwright/test";

const control = fs.readFileSync(new URL("../src/screens/ControlCenter.jsx", import.meta.url), "utf8");
const units = fs.readFileSync(new URL("../src/screens/Units.jsx", import.meta.url), "utf8");
const app = fs.readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");

test("Control Center shows real setup needs and keeps independent daily work discoverable", () => {
  for (const label of ["Departments & reporting","Attendance & locations","Leave rules","Access permissions","Organisation rules","Alerts & reminders","Connected apps","Activity history"]) expect(control).toContain(label);
  for (const table of ["office_locations","units","unit_memberships","leave_policy_versions","integration_connectors"]) expect(control).toContain(`from("${table}")`);
  expect(control).not.toContain("healthScore");
  expect(control).not.toContain("admin_employee_roster_summary");
  expect(control).toContain("control-related-work");
  expect(app).not.toContain("ControlCenterTrail");
});

test("Phase 5D centralises employee invitation and transfer work in People & Access", () => {
  expect(units).toContain("Manage people & access");
  expect(units).toContain("one authoritative people workflow");
  expect(units).not.toContain("inviteByEmail");
  expect(units).not.toContain("admin_update_employment");
  expect(units).not.toContain("openStaffSheet");
  expect(app).toContain("function openPeopleAccess(intent = {})");
  expect(app).toContain("openPeopleAccess={openPeopleAccess}");
});


const password = process.env.ROLE_FIXTURE_PASSWORD;

async function openAdminControlCenter(browser, viewport) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  await page.goto("/");
  await page.getByPlaceholder("Work email").fill("admin@ceac.local.test");
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.locator(".office-app")).toBeVisible({ timeout: 15000 });
  // A rendered shell is not proof its Auth session persisted across a direct
  // route load. Check the real existing local session, without signing in a
  // second client or bypassing role access.
  await expect.poll(async () => page.evaluate(async () => {
    const { supabase } = await import("/src/lib/supabase.js");
    const { data, error } = await supabase.auth.getSession();
    return !error && Boolean(data?.session?.access_token);
  }), { timeout: 15000 }).toBe(true);
  await page.goto("/?tab=settings");
  await expect(page.locator(".office-app")).toBeVisible({ timeout: 15000 });
  await expect(page.locator(".ev2-control-center")).toBeVisible({ timeout: 15000 });
  return { context, page };
}

for (const viewport of [
  { name: "phone-390", width: 390, height: 844 },
  { name: "laptop-1366", width: 1366, height: 768 },
]) {
  test(`Phase 5E Control Center composes at ${viewport.name}`, async ({ browser }) => {
    const { context, page } = await openAdminControlCenter(browser, { width: viewport.width, height: viewport.height });

    await expect(page.getByRole("heading", { name: "Control Center", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Organisation", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Workplace", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "System", exact: true })).toBeVisible();
    await expect(page.locator(".ev2-control-center").getByRole("button", { name: "People & Access", exact: true })).toBeVisible();

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);

    await page.screenshot({
      path: `test-artifacts/phase5-control-center-${viewport.name}.png`,
      fullPage: true,
    });
    await context.close();
  });
}

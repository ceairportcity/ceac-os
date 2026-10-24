import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

const password = process.env.ROLE_FIXTURE_PASSWORD;

async function signInAdmin(browser, viewport) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  await page.goto("/");
  await page.getByPlaceholder("Work email").fill("admin@ceac.local.test");
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.locator(".office-app")).toBeVisible({ timeout: 15000 });
  return { context, page };
}

test("Phase 5 keeps Administration monitoring, People & Access and configuration responsibilities distinct", () => {
  const overview = readFileSync("src/experience-v2/admin-overview/AdminOverviewV2.jsx", "utf8");
  const people = readFileSync("src/screens/People.jsx", "utf8");
  const access = readFileSync("src/components/PeopleAccess.jsx", "utf8");
  const control = readFileSync("src/screens/ControlCenter.jsx", "utf8");
  const units = readFileSync("src/screens/Units.jsx", "utf8");
  const signedSecurityBaseline = readFileSync("supabase/migrations/20261007075418_privileged_mfa_aal2_enforcement.sql", "utf8");

  expect(overview).toContain("Needs Administration");
  expect(overview).toContain("Invitations to review");
  expect(overview).toContain("Durable configuration");
  expect(overview).not.toContain("onInviteUnit");
  expect(people).toContain('["access","Access"]');
  expect(access).toContain('rpc("admin_record_unit_responsibility"');
  expect(access).toContain('rpc("admin_set_work_lane_membership"');
  expect(access).toContain('rpc("admin_access_invitations")');
  expect(access).toContain("resendStaffInvitation");
  expect(access).toContain('rpc("admin_revoke_staff_invitation"');
  expect(control).toContain("Organisation & people");
  expect(units).not.toContain("inviteByEmail");
  expect(units).not.toContain("admin_update_employment");
  expect(signedSecurityBaseline).toContain("privileged_mfa_required");
  expect(signedSecurityBaseline).toContain("app_privileged_aal_allowed");
});

for (const viewport of [
  { name: "phone-390", width: 390, height: 844 },
  { name: "desktop-1366", width: 1366, height: 768 },
]) {
  test(`Phase 5 People & Access is usable at ${viewport.name}`, async ({ browser }) => {
    const { context, page } = await signInAdmin(browser, { width: viewport.width, height: viewport.height });
    // Enter through the authorised Administration action after capability resolution.
    // This verifies the actual user path rather than a direct reload before permissions settle.
    const openPeople = page.getByRole("button", { name: /^(?:Open )?People & Access$/ }).first();
    await expect(openPeople).toBeVisible({ timeout: 15000 });
    await openPeople.click();
    await expect(page.locator(".ev2-people-admin")).toBeVisible({ timeout: 15000 });

    await page.getByRole("tablist", { name: "People views" }).getByRole("tab", { name: /^Access(?: administration)?$/ }).click();
    await expect(page.locator(".phase5-people-access")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Access administration", exact: true })).toBeVisible();
    for (const tab of ["Invite","Responsibilities","Invitations"]) {
      await expect(page.locator(".phase5-people-access").getByRole("tab", { name: new RegExp(tab) })).toBeVisible();
    }
    await expect(page.getByLabel("Invitation unit", { exact: true })).toBeVisible();

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);

    const tabs = page.locator(".phase5-access-tabs button:visible");
    for (let index = 0; index < await tabs.count(); index += 1) {
      const box = await tabs.nth(index).boundingBox();
      expect(box?.height || 0).toBeGreaterThanOrEqual(44);
    }

    await page.screenshot({
      path: `test-artifacts/phase5-people-access-${viewport.name}.png`,
      fullPage: true,
    });
    await context.close();
  });
}

test("Phase 5 person access opens the same employee in controlled offboarding", async ({ browser }) => {
  test.setTimeout(90_000);
  const { context, page } = await signInAdmin(browser, { width: 390, height: 844 });
  // Enter through the authorised Administration action after capability resolution.
  // This verifies the actual user path rather than a direct reload before permissions settle.
  const openPeople = page.getByRole("button", { name: /^(?:Open )?People & Access$/ }).first();
  await expect(openPeople).toBeVisible({ timeout: 15000 });
  await openPeople.click();
  await expect(page.locator(".ev2-people-admin")).toBeVisible({ timeout: 15000 });

  const row = page.locator(".fpg-people-roster-row").filter({ hasText: "Staff Fixture" }).first();
  await expect(row).toBeVisible();
  await row.click();
  // Directory and employee detail both have an "Access" tab. A slow
  // authenticated employee-detail read must not let the test click the
  // directory tab while the selected employee is still loading.
  const employeeSections = page.getByRole("tablist", { name: "Employee record sections" });
  await expect(employeeSections).toBeVisible({ timeout: 15000 });
  const accessTab = employeeSections.getByRole("tab", { name: "Access", exact: true });
  await accessTab.click();
  await expect(accessTab).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("heading", { name: "Access & responsibilities", exact: true })).toBeVisible();
  const offboard = page.getByRole("button", { name: "Offboard / deactivate access", exact: true });
  await expect(offboard).toBeVisible({ timeout: 15000 });
  await expect(offboard).toBeEnabled();
  await offboard.click();

  await expect(page.getByRole("heading", { name: "Employee lifecycle", exact: true })).toBeVisible({ timeout: 15000 });
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("Start lifecycle case", { exact: true }).first()).toBeVisible();
  await expect(dialog.getByLabel("Lifecycle employee", { exact: true }).locator("option:checked")).toHaveText(/Staff Fixture/);
  await expect(dialog.getByLabel("Lifecycle type", { exact: true })).toHaveValue("offboarding");

  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);

  await page.screenshot({
    path: "test-artifacts/phase5-offboarding-handoff-phone-390.png",
    fullPage: true,
  });
  await context.close();
});

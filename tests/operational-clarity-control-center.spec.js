import fs from "node:fs";
import { test, expect } from "@playwright/test";

const control = fs.readFileSync(new URL("../src/screens/ControlCenter.jsx", import.meta.url), "utf8");
const units = fs.readFileSync(new URL("../src/screens/Units.jsx", import.meta.url), "utf8");
const app = fs.readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");

test("OCR5E Control Center is state-derived and never invents a numeric health score", () => {
  for (const status of ["Ready","Needs attention","Partly configured","Not configured","Awaiting policy"]) {
    expect(control).toContain(status);
  }

  for (const domain of [
    "Organisation",
    "People & access",
    "Work & operations",
    "Time & Leave",
    "Payroll & Finance",
    "Security & governance",
    "Integrations",
    "Audit & records",
  ]) {
    expect(domain === "Payroll & Finance" ? control.includes('title:canPayroll ? "Payroll & Finance" : "Finance"') : control.includes(`title:"${domain}"`)).toBeTruthy();
  }

  expect(control).toContain('supabase.rpc("admin_employee_roster_summary")');
  expect(control).toContain('supabase.rpc("payroll_readiness_summary")');
  expect(control).toContain('from("leave_policy_versions")');
  expect(control).toContain('from("integration_connectors")');
  expect(control).toContain('from("workflow_run_steps")');
  expect(control).toContain('from("platform_audit_events")');
  // Roster-only identity is not an error; only genuinely unresolved identity,
  // missing job/unit/type or incomplete configuration may need attention.
  expect(control).toContain('person.identity_state==="needs_review"');
  expect(control).toContain('person.employment_type==="not_recorded"');
  expect(control).toContain('peopleGaps.some((person)=>person.identity_state==="needs_review")');
  expect(control).toContain("No active leave policy is recorded. Review the rules before assigning entitlements.");
  expect(control).toContain('actions:[{label:"Workforce",onClick:()=>go("attendance")}]');
  expect(control).toContain("This is not a numeric health score.");
  expect(control).not.toContain("healthScore");
  expect(control).not.toContain("managed elsewhere");
  expect(control).toContain("Organisation & people");
  expect(control).toContain("Operational configuration");
  expect(control).toContain("Security, integrations & records");
  expect(control).not.toContain('{label:"People",onClick:()=>go("people")}');
});

test("OCR5E Control Center deep-links to authoritative configuration surfaces", () => {
  for (const route of [
    "office-settings","units","people","protected-hr","workflows","attendance",
    "payroll","finance","authority","policies","integrations","audit","events",
  ]) {
    expect(control).toContain(`go("${route}")`);
  }
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
    await expect(page.getByRole("heading", { name: "Organisation & people", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Operational configuration", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Security, integrations & records", exact: true })).toBeVisible();
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

import { mkdirSync, readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

const password = process.env.ROLE_FIXTURE_PASSWORD;

async function openManager(browser, viewport) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  await page.goto("/");
  await page.getByPlaceholder("Work email").fill("manager@ceac.local.test");
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.locator(".manager-app")).toBeVisible({ timeout: 15000 });
  await page.goto("/?tab=team");
  await expect(page.locator(".ev2-people-manager")).toBeVisible({ timeout: 15000 });
  return { context, page };
}

test("Phase 6A volunteer operating model keeps engagement separate from authority", () => {
  const migration = readFileSync("supabase/migrations/20261007090000_119_phase6_volunteer_operating_model.sql", "utf8");
  const navigation = readFileSync("src/experience-v2/shell/navigation.js", "utf8");
  const team = readFileSync("src/screens/Team.jsx", "utf8");
  const person = readFileSync("src/screens/PersonDetail.jsx", "utf8");
  const payroll = readFileSync("src/screens/AdminPayroll.jsx", "utf8");
  const me = readFileSync("src/screens/Me.jsx", "utf8");

  expect(migration).toContain("engagement_type in ('staff','volunteer')");
  expect(migration).toContain("employment_type<>'volunteer'");
  expect(migration).toContain("employment_records_volunteer_unit_manager_check");
  expect(migration).toContain("volunteer_working_pattern_versions");
  expect(migration).toContain("volunteer_change_recommendations");
  expect(migration).toContain("volunteer_engagement_notices");
  expect(navigation).not.toMatch(/label:\s*["']Volunteer["']/);
  expect(team).toContain('title="People & volunteers"');
  expect(team).toContain('sheet === "volunteer"');
  expect(person).toContain('title="Volunteer profile"');
  expect(person).toContain("Send recommendation to Administration");
  expect(payroll).toContain("Volunteers excluded");
  expect(me).toContain('title="Volunteer engagement"');
});

for (const viewport of [
  { name: "phone-390", width: 390, height: 844 },
  { name: "desktop-1366", width: 1366, height: 900 },
]) {
  test(`Phase 6A Manager People and Volunteer Profile compose at ${viewport.name}`, async ({ browser }) => {
    const { context, page } = await openManager(browser, viewport);
    mkdirSync("test-artifacts", { recursive: true });

    await expect(page.getByRole("heading", { name: "Team", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "+ Add volunteer", exact: true })).toBeVisible();
    await expect(page.getByRole("tab", { name: /Volunteers/ })).toBeVisible();

    await page.getByRole("tab", { name: /Volunteers/ }).click();
    await expect(page.getByText("Same Unit Fixture", { exact: true }).first()).toBeVisible();
    await page.screenshot({ path: `test-artifacts/phase6-reference-05-people-volunteers-${viewport.name}.png`, fullPage: true });

    await page.getByRole("button", { name: "+ Add volunteer", exact: true }).click();
    await expect(page.getByText("Add volunteer", { exact: true }).first()).toBeVisible();
    for (const label of ["No attendance tracking","Event-based","Specific days","Custom schedule"]) {
      await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
    }
    await page.screenshot({ path: `test-artifacts/phase6-reference-06-add-volunteer-${viewport.name}.png`, fullPage: true });
    await page.getByText("Specific days", { exact: true }).first().click();
    await page.screenshot({ path: `test-artifacts/phase6-reference-07-working-pattern-${viewport.name}.png`, fullPage: true });
    await page.getByRole("button", { name: "Cancel", exact: true }).click();

    const volunteer = page.locator(".ev2p-evidence-person").filter({ hasText: "Same Unit Fixture" }).first();
    await expect(volunteer).toBeVisible();
    await volunteer.locator(".ev2p-evidence-person-main").click();
    await expect(page.getByRole("heading", { name: "Same Unit Fixture", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Volunteer profile", exact: true })).toBeVisible();
    await expect(page.getByText("No attendance tracking", { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Recommend formal change", exact: true })).toBeVisible();

    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    await page.screenshot({ path: `test-artifacts/phase6-reference-08-volunteer-profile-${viewport.name}.png`, fullPage: true });
    await page.screenshot({ path: `test-artifacts/phase6a-volunteer-profile-${viewport.name}.png`, fullPage: true });
    await context.close();
  });
}

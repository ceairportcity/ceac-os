import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

const password = process.env.ROLE_FIXTURE_PASSWORD;

async function openStaffWorkforce(browser, viewport) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  await page.goto("/");
  await page.getByPlaceholder("Work email").fill("staff@ceac.local.test");
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.locator(".staff-app")).toBeVisible({ timeout: 15000 });
  await page.goto("/?tab=attendance");
  await expect(page.locator(".ev2-workforce-staff")).toBeVisible({ timeout: 15000 });
  await expect(page.getByRole("heading", { name: "Workforce", exact: true })).toBeVisible();
  return { context, page };
}

test("Stage 10 Family D2 preserves Stage 9 Workforce authority while establishing V2 Staff presentation", async () => {
  const shared = readFileSync("src/experience-v2/workforce-family/WorkforceFamilyV2.jsx", "utf8");
  const css = readFileSync("src/experience-v2/workforce-family/workforce-family.css", "utf8");
  const workforce = readFileSync("src/screens/Workforce.jsx", "utf8");
  const main = readFileSync("src/main.jsx", "utf8");

  for (const symbol of [
    "WorkforcePageHeader",
    "WorkforceTabs",
    "WorkforceTodayCard",
    "WorkforceFactGrid",
    "WorkforceSection",
    "WorkforceRecordRow",
    "WorkforceEmpty",
  ]) {
    expect(shared).toContain(`export function ${symbol}`);
  }

  for (const table of [
    "employment_records",
    "work_sessions",
    "leave_requests",
    "leave_request_events",
    "workforce_day_types",
    "workforce_schedule_versions",
    "attendance_corrections",
    "leave_policy_versions",
    "leave_policy_rules",
  ]) {
    expect(workforce).toContain(`from("${table}")`);
  }

  for (const rpc of [
    "workforce_record_day_type",
    "workforce_record_schedule",
    "workforce_leave_action",
    "workforce_record_leave_policy",
  ]) {
    expect(workforce).toContain(rpc);
  }

  expect(workforce).toContain('caps.includes("workforce.manage")');
  expect(workforce).toContain('caps.includes("attendance.correct")');
  expect(workforce).toContain('import AttendanceCorrectionWorkflow from "../components/AttendanceCorrectionWorkflow"');
  expect(workforce).toContain('<AttendanceCorrectionWorkflow me={me} />');
  expect(workforce).not.toContain('supabase.rpc("workforce_record_attendance_correction"');
  expect(workforce).toContain("No session recorded");
  expect(workforce).toContain("not an absence judgement");
  expect(workforce).toContain("ev2-workforce-staff");
  expect(css).toContain(".ev2-workforce-page");
  expect(css).not.toContain("!important");
  expect(main).toContain('import "./experience-v2/workforce-family/workforce-family.css";');
});

for (const viewport of [
  { name: "phone-320", width: 320, height: 844 },
  { name: "phone-360", width: 360, height: 800 },
  { name: "phone-375", width: 375, height: 812 },
  { name: "phone-390", width: 390, height: 844 },
  { name: "phone-414", width: 414, height: 896 },
  { name: "phone-430", width: 430, height: 932 },
  { name: "intermediate-900", width: 900, height: 900 },
  { name: "laptop-1366", width: 1366, height: 768 },
  { name: "desktop-1440", width: 1440, height: 900 },
]) {
  test(`Stage 10 Family D2 Staff Workforce composes at ${viewport.name}`, async ({ browser }) => {
    const { context, page } = await openStaffWorkforce(browser, { width: viewport.width, height: viewport.height });

    await expect(page.getByRole("tab", { name: "Today", exact: true })).toBeVisible();
    await expect(page.getByRole("tab", { name: "My week", exact: true })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Leave", exact: true })).toBeVisible();

    const ownCard = page.locator(".workforce-person").first();
    await expect(ownCard).toBeVisible();
    await expect(ownCard).toContainText("Staff Fixture");
    await expect(page.locator(".ev2-workforce-staff")).not.toContainText("Manager Fixture");

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `Staff Workforce overflowed ${viewport.width}px viewport`).toBeLessThanOrEqual(1);

    const tabHeights = await page.locator(".ev2wf-tabs button").evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().height));
    expect(Math.min(...tabHeights)).toBeGreaterThanOrEqual(44);

    const smallest = await page.locator(".ev2-workforce-staff").evaluate((root) => {
      const values = [...root.querySelectorAll("*")]
        .filter((node) => {
          const style = getComputedStyle(node);
          const rect = node.getBoundingClientRect();
          return style.visibility !== "hidden" && style.display !== "none" && rect.width > 0 && rect.height > 0 && (node.textContent || "").trim();
        })
        .map((node) => parseFloat(getComputedStyle(node).fontSize))
        .filter((value) => Number.isFinite(value));
      return Math.min(...values);
    });
    expect(smallest).toBeGreaterThanOrEqual(12);

    await page.screenshot({
      path: `test-artifacts/redesign-r7-stage10d2-staff-workforce-${viewport.name}.png`,
      fullPage: true,
    });

    await context.close();
  });
}

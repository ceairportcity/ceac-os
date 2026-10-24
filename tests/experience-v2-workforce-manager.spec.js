import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

const password = process.env.ROLE_FIXTURE_PASSWORD;

async function openManagerWorkforce(browser, viewport) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  await page.goto("/");
  await page.getByPlaceholder("Work email").fill("manager@ceac.local.test");
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.locator(".manager-app")).toBeVisible({ timeout: 15000 });
  await page.goto("/?tab=attendance");
  await expect(page.locator(".ev2-workforce-manager")).toBeVisible({ timeout: 15000 });
  await expect(page.getByRole("heading", { name: "Workforce", exact: true })).toBeVisible();
  return { context, page };
}

test("Stage 10 Family D3 preserves Manager Workforce authority while establishing V2 team context", async () => {
  const shared = readFileSync("src/experience-v2/workforce-family/WorkforceFamilyV2.jsx", "utf8");
  const css = readFileSync("src/experience-v2/workforce-family/workforce-family.css", "utf8");
  const workforce = readFileSync("src/screens/Workforce.jsx", "utf8");

  expect(shared).toContain("export function WorkforceDecisionRow");
  expect(workforce).toContain('const isManagerView=!me.is_admin && !me.is_exec && isManager');
  expect(workforce).toContain('caps.includes("workforce.manage")');
  expect(workforce).toContain('caps.includes("attendance.correct")');
  expect(workforce).toContain('leaveAction(l.id,"manager_approved")');
  expect(workforce).toContain('Manager approval → Administration final approval');
  expect(workforce).toContain('Confirmed leave process');
  expect(workforce).toContain('The 24-day yearly allowance comprises 15 annual-leave days and one shared nine-day sick/study allowance');
  expect(workforce).not.toContain('onClick={()=>leaveAction(l.id,"escalated")}');
  expect(workforce).toContain("Manager role alone does not grant this authority.");
  expect(workforce).toContain("never converted into an automatic absence or performance judgement");
  expect(css).toContain(".ev2-workforce-manager");
  expect(css).not.toContain("!important");
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
  test(`Stage 10 Family D3 Manager Workforce composes at ${viewport.name}`, async ({ browser }) => {
    const { context, page } = await openManagerWorkforce(browser, { width: viewport.width, height: viewport.height });

    await expect(page.getByRole("tab", { name: "Today", exact: true })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Leave", exact: true })).toBeVisible();
    await page.locator(".timeleave-policy > summary").click();
    await expect(page.getByText("The 24-day yearly allowance comprises 15 annual-leave days and one shared nine-day sick/study allowance", { exact: false }).first()).toBeVisible();
    await expect(page.getByRole("tab", { name: "Corrections", exact: true })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Schedules & policy", exact: true })).toHaveCount(0);

    await expect(page.locator(".ev2-workforce-manager")).toContainText("Staff Fixture");
    await expect(page.locator(".ev2-workforce-manager")).not.toContainText("Other Unit Fixture");

    await page.getByRole("tab", { name: "Corrections", exact: true }).click();
    await expect(page.getByRole("button", { name: "Record correction", exact: true })).toHaveCount(0);

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `Manager Workforce overflowed ${viewport.width}px viewport`).toBeLessThanOrEqual(1);

    const tabHeights = await page.locator(".ev2wf-tabs button").evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().height));
    expect(Math.min(...tabHeights)).toBeGreaterThanOrEqual(44);

    const smallest = await page.locator(".ev2-workforce-manager").evaluate((root) => {
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

    await page.getByRole("tab", { name: "Today", exact: true }).click();
    await page.screenshot({
      path: `test-artifacts/redesign-r7-stage10d3-manager-workforce-${viewport.name}.png`,
      fullPage: true,
    });

    await context.close();
  });
}

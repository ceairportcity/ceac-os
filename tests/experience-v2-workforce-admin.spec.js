import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

const password = process.env.ROLE_FIXTURE_PASSWORD;

async function openAdminWorkforce(browser, viewport) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  await page.goto("/");
  await page.getByPlaceholder("Work email").fill("admin@ceac.local.test");
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.locator(".office-app")).toBeVisible({ timeout: 15000 });
  await page.goto("/?tab=attendance");
  await expect(page.locator(".ev2-workforce-admin")).toBeVisible({ timeout: 15000 });
  await expect(page.getByRole("heading", { name: "Time & Leave", exact: true })).toBeVisible();
  return { context, page };
}

test("Stage 10 Family D4 preserves Administration Workforce authority and factual contracts", async () => {
  const family = readFileSync("src/experience-v2/workforce-family/WorkforceFamilyV2.jsx", "utf8");
  const css = readFileSync("src/experience-v2/workforce-family/workforce-family.css", "utf8");
  const workforce = readFileSync("src/screens/Workforce.jsx", "utf8");
  const literalCss = readFileSync("src/final-product/fpg7-people-workforce.css", "utf8");

  expect(family).toContain('className = ""');
  expect(workforce).toContain("const isAdminView=Boolean(me.is_admin)");
  expect(workforce).toContain('caps.includes("workforce.manage")');
  expect(workforce).toContain('caps.includes("attendance.correct")');
  expect(workforce).toContain("Original work-session rows are not rewritten");
  expect(workforce).toContain("Only an explicitly complete confirmed policy may be activated.");
  expect(workforce).toContain("will not calculate entitlement, accrual, carry-over or remaining balance");
  expect(workforce).toContain('leaveAction(row.id,"approval_reversed")');
  expect(css).toContain(".ev2-workforce-admin");
  expect(css).toContain("/* VF4C — Administration Workforce operational console.");
  expect(css).toContain(".ev2-workforce-admin .ev2wf-tabs");
  expect(css).toContain(".ev2-workforce-admin .ev2wf-row-state");
  expect(css).not.toContain("!important");
  expect(literalCss).toContain(".pp-split-workspace{display:grid;grid-template-columns:290px minmax(0,1fr)");
  expect(literalCss).toContain(".fpg-absence-day.is-today");
  expect(literalCss).not.toContain("!important");
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
  test(`Stage 10 Family D4 Administration Workforce composes at ${viewport.name}`, async ({ browser }) => {
    const { context, page } = await openAdminWorkforce(browser, { width: viewport.width, height: viewport.height });

    await expect(page.getByRole("tab", { name: "Overview", exact: true })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Leave requests", exact: true })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Corrections", exact: true })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Schedules & policy", exact: true })).toBeVisible();

    await expect(page.locator(".ev2-workforce-admin")).toContainText("Staff Fixture");
    await expect(page.locator(".ev2-workforce-admin")).toContainText("Other Unit Fixture");

    await page.getByRole("tab", { name: "Corrections", exact: true }).click();
    await expect(page.getByRole("button", { name: "Record correction", exact: true })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Missed check-in and attendance corrections" })).toBeVisible();
    await expect(page.getByText(/manager approves the correction; HR audits approved corrections afterward/i)).toBeVisible();

    await page.getByRole("tab", { name: "Schedules & policy", exact: true }).click();
    await expect(page.getByRole("button", { name: "Add day type", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Configure leave policy", exact: true })).toBeVisible();

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `Administration Workforce overflowed ${viewport.width}px viewport`).toBeLessThanOrEqual(1);

    const tabHeights = await page.locator(".ev2wf-tabs button").evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().height));
    expect(Math.min(...tabHeights)).toBeGreaterThanOrEqual(44);

    const smallest = await page.locator(".ev2-workforce-admin").evaluate((root) => {
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

    await page.getByRole("tab", { name: "Overview", exact: true }).click();
    const rootBox = await page.locator(".ev2-workforce-admin").boundingBox();
    const stateBoxes = await page.locator(".ev2-workforce-admin .ev2wf-row-state:visible").evaluateAll((nodes) =>
      nodes.map((node) => {
        const rect = node.getBoundingClientRect();
        return { left: rect.left, right: rect.right };
      })
    );
    for (const box of stateBoxes) {
      expect(box.left).toBeGreaterThanOrEqual((rootBox?.x || 0) - 1);
      expect(box.right).toBeLessThanOrEqual((rootBox?.x || 0) + (rootBox?.width || viewport.width) + 1);
    }

    await page.screenshot({
      path: `test-artifacts/redesign-r7-stage10d4-admin-workforce-${viewport.name}.png`,
      fullPage: true,
    });

    if (viewport.name === "phone-390" || viewport.name === "laptop-1366") {
      await page.getByRole("tab", { name: "Leave requests", exact: true }).click();
      await page.screenshot({
        path: `test-artifacts/vf4c-admin-workforce-leave-${viewport.name}.png`,
        fullPage: true,
      });
      await page.getByRole("tab", { name: "Calendar", exact: true }).click();
      const calendarRail = page.locator(".fpg-absence-board");
      await expect(calendarRail).toBeVisible();
      await expect(calendarRail.locator(".fpg-absence-day")).toHaveCount(14);
      await expect(calendarRail.locator(".fpg-absence-day.is-today")).toHaveCount(1);
      await expect(calendarRail.locator(".fpg-absence-person").first()).toBeVisible();
      const calendarGrid = calendarRail.locator(".fpg-absence-grid");
      const gridLayout = await calendarGrid.evaluate((node) => ({
        display: getComputedStyle(node).display,
        columns: getComputedStyle(node).gridTemplateColumns,
      }));
      expect(gridLayout.display).toBe("grid");
      expect(gridLayout.columns.split(" ").filter(Boolean)).toHaveLength(15);
      if (viewport.name === "phone-390") {
        const scroll = calendarRail.locator(".fpg-absence-scroll");
        const scrollLayout = await scroll.evaluate((node) => ({
          overflowX: getComputedStyle(node).overflowX,
          scrollWidth: node.scrollWidth,
          clientWidth: node.clientWidth,
        }));
        expect(["auto","scroll"]).toContain(scrollLayout.overflowX);
        expect(scrollLayout.scrollWidth).toBeGreaterThan(scrollLayout.clientWidth + 20);
      }
      if (viewport.name === "laptop-1366") {
        const dayBoxes = await calendarRail.locator(".fpg-absence-day").evaluateAll((nodes) =>
          nodes.slice(0, 2).map((node) => {
            const rect = node.getBoundingClientRect();
            return { left: rect.left, top: rect.top };
          })
        );
        expect(Math.abs(dayBoxes[0].top - dayBoxes[1].top)).toBeLessThanOrEqual(2);
        expect(dayBoxes[1].left).toBeGreaterThan(dayBoxes[0].left);
      }
      await page.screenshot({
        path: `test-artifacts/vf4c-admin-workforce-calendar-${viewport.name}.png`,
        fullPage: true,
      });
    }

    await context.close();
  });
}

test("Administration does not turn failed work-session reads into zero attendance", async ({ browser }) => {
  const context=await browser.newContext({viewport:{width:390,height:844}});
  const page=await context.newPage();
  try {
    await page.goto("/");
    await page.getByPlaceholder("Work email").fill("admin@ceac.local.test");
    await page.getByPlaceholder("Password").fill(password);
    await page.getByRole("button",{name:"Sign in"}).click();
    await expect(page.locator(".office-app")).toBeVisible({timeout:15000});
    // App bootstrap also reads this person's own currently-open work session.
    // Only fail the Workforce multi-employee evidence request; otherwise this
    // test blocks app sign-in before the Workforce error state can render.
    await page.route("**/rest/v1/work_sessions*",async route=>{
      const fields = new URL(route.request().url()).searchParams.get("select") || "";
      if (fields.includes("end_location_status") && fields.includes("profile_id")) {
        await route.fulfill({
          status:503,contentType:"application/json",
          body:JSON.stringify({message:"synthetic session evidence unavailable"}),
        });
      } else {
        await route.continue();
      }
    });
    await page.goto("/?tab=attendance");
    await expect(page.locator(".ev2-workforce-admin")).toBeVisible({timeout:15000});
    // The approved compact Today queue is now source-strict. If its session
    // dataset fails, withholding ALL employee classifications is safer than
    // rendering old per-person badges that could imply no session or absence.
    const evidenceGate = page.getByRole("alert").filter({
      hasText:"A required roster, schedule, day-type or session source is unavailable.",
    });
    await expect(evidenceGate).toBeVisible({timeout:20000});
    await expect(evidenceGate).toContainText("No employee is marked absent, unconfigured or started on incomplete evidence.");
    await expect(page.locator(".ev2wf-today-review-list")).toHaveCount(0);
    await expect(page.locator(".ev2wf-today-review-summary")).toHaveCount(0);
    await expect(page.getByRole("button",{name:"Retry Workforce data"})).toBeVisible();
  } finally {await context.close();}
});

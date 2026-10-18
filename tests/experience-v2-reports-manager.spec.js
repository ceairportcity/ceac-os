import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

const password = process.env.ROLE_FIXTURE_PASSWORD;

async function openManagerReports(browser, viewport) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  await page.goto("/");
  await page.getByPlaceholder("Work email").fill("manager@ceac.local.test");
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.locator(".manager-app")).toBeVisible({ timeout: 15000 });
  await page.goto("/?tab=manager-reports");
  await expect(page.locator(".ev2-reporting-manager")).toBeVisible({ timeout: 15000 });
  await expect(page.getByRole("heading", { name: "Reports", exact: true })).toBeVisible();
  return { context, page };
}

test("Stage 10 Family F2 preserves Manager report authority, frozen evidence and correction versioning", async () => {
  const family = readFileSync("src/experience-v2/reporting-family/ReportingFamilyV2.jsx", "utf8");
  const css = readFileSync("src/experience-v2/reporting-family/reporting-family.css", "utf8");
  const manager = readFileSync("src/screens/ManagerReports.jsx", "utf8");

  for (const symbol of [
    "ReportingPageHeader",
    "ReportingTabs",
    "ReportingSection",
    "ReportingEvidenceGrid",
    "ReportingEvidenceCard",
    "ReportingRecordRow",
    "ReportingEmpty",
    "ReportingFootnote",
  ]) {
    expect(family).toContain(`export function ${symbol}`);
  }

  expect(manager).toContain('supabase.rpc("save_report_draft"');
  expect(manager).toContain('supabase.rpc("save_and_submit_report"');
  expect(manager).toContain('supabase.rpc("correct_report"');
  expect(manager).toContain('supabase.from("report_evidence_refs")');
  expect(manager).toContain("Submitted reports use frozen figures and evidence links");
  expect(manager).toContain("Later activity does not rewrite them");
  expect(manager).toContain("Reporting coverage and work-session context are factual records, not performance scores");
  expect(manager).toContain("ev2-reporting-manager");
  expect(manager).toContain("const [loadFailed, setLoadFailed]");
  expect(manager).toContain('title="Report evidence could not be loaded"');
  expect(manager).not.toContain("confirm_report");
  expect(manager).not.toContain(".delete(");
  expect(css).toContain(".ev2-reporting-page");
  expect(css).toContain(".ev2rep-frozen-state");
  expect(css).not.toContain("!important");
});

test("Stage 10 Family F2 keeps a failed report read distinct from zero evidence", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto("/");
  await page.getByPlaceholder("Work email").fill("manager@ceac.local.test");
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.locator(".manager-app")).toBeVisible({ timeout: 15000 });

  await page.route("**/rest/v1/report_periods*", async (route) => {
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ message: "fixture report read failed" }),
    });
  });

  await page.goto("/?tab=manager-reports");
  await expect(page.locator(".ev2-reporting-manager")).toBeVisible({ timeout: 15000 });
  await expect(page.getByText("Report evidence could not be loaded", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Try again", exact: true })).toBeVisible();
  await expect(page.locator(".ev2rep-evidence")).toHaveCount(0);
  await expect(page.getByText("Live preview", { exact: true })).toHaveCount(0);
  await context.close();
});

test("Stage 10 Family F2 keeps no-period Manager reporting as an explicit live preview", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto("/");
  await page.getByPlaceholder("Work email").fill("manager@ceac.local.test");
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.locator(".manager-app")).toBeVisible({ timeout: 15000 });

  await page.route("**/rest/v1/report_periods*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([]),
    });
  });

  await page.goto("/?tab=manager-reports");
  await expect(page.getByText("Live preview only", { exact: true })).toBeVisible();
  await expect(page.getByText("Live preview", { exact: true }).last()).toBeVisible();
  await expect(page.getByRole("button", { name: "Save draft", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Submit report", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Open a reporting period", exact: true })).toHaveCount(0);
  await context.close();
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
  test(`Stage 10 Family F2 Manager Reports composes at ${viewport.name}`, async ({ browser }) => {
    const { context, page } = await openManagerReports(browser, { width: viewport.width, height: viewport.height });

    const tabs = page.locator(".ev2rep-tabs");
    for (const label of ["Weekly", "Monthly", "Project"]) {
      await expect(tabs.getByRole("button", { name: label, exact: true })).toBeVisible();
    }

    await expect(page.getByRole("button", { name: "Open a reporting period", exact: true })).toHaveCount(0);
    await expect(page.getByText("Recurring numbers", { exact: true })).toBeVisible();
    await expect(page.getByText(/performance scores/i).last()).toBeVisible();

    const tabHeights = await tabs.locator("button").evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().height));
    expect(Math.min(...tabHeights)).toBeGreaterThanOrEqual(44);

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `Manager Reports overflowed ${viewport.width}px viewport`).toBeLessThanOrEqual(1);

    const smallest = await page.locator(".ev2-reporting-manager").evaluate((root) => {
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

    await page.screenshot({ path: `test-artifacts/redesign-r7-stage10f2-manager-reports-${viewport.name}.png`, fullPage: true });
    await context.close();
  });
}

test("Stage 2 Manager reporting fails closed when period work sessions cannot be loaded", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  try {
    await page.goto("/");
    await page.getByPlaceholder("Work email").fill("manager@ceac.local.test");
    await page.getByPlaceholder("Password").fill(password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.locator(".manager-app")).toBeVisible({ timeout: 15000 });
    // Scope this simulated outage to the Manager report's period dataset.
    // The router's own per-user openSession read shares this endpoint, and
    // must remain available so the report page can render its failure state.
    let failedPeriodRead = false;
    await page.route("**/rest/v1/work_sessions*", async (route) => {
      const fields = new URL(route.request().url()).searchParams.get("select") || "";
      if (fields.includes("end_reason") && fields.includes("profile_id")) {
        failedPeriodRead = true;
        await route.fulfill({
          status: 500, contentType: "application/json",
          body: JSON.stringify({ message: "synthetic period work-session read failed" }),
        });
      } else {
        await route.continue();
      }
    });
    await page.goto("/?tab=manager-reports");
    await expect.poll(() => failedPeriodRead, { timeout: 20000 }).toBe(true);
    await expect(page.getByText("Report evidence could not be loaded", { exact: true })).toBeVisible({ timeout: 20000 });
    await expect(page.locator(".ev2rep-evidence")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Submit report", exact: true })).toHaveCount(0);
  } finally { await context.close(); }
});

test("Manager period attendance includes the Manager and respects tenant scope", () => {
  const manager = readFileSync("src/screens/ManagerReports.jsx", "utf8");
  expect(manager).toContain('setMemberIds([...new Set([me.id,');
  expect(manager).toContain('.eq("org_id", me.org_id)');
  expect(manager).toContain('.in("profile_id", memberIds)');
  // The original browser regression must still fail if the session evidence
  // request returns an error; do not substitute mock counts or hide the test.
});

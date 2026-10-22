import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

const password = process.env.ROLE_FIXTURE_PASSWORD;

async function openExecutiveReports(browser, viewport) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  await page.goto("/");
  await page.getByPlaceholder("Work email").fill("exec@ceac.local.test");
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.locator(".executive-app")).toBeVisible({ timeout: 15000 });
  await page.goto("/?tab=exec-reports");
  await expect(page.locator(".ev2-reporting-executive")).toBeVisible({ timeout: 15000 });
  await expect(page.getByRole("heading", { name: "Reports", exact: true })).toBeVisible();
  return { context, page };
}

test("Stage 10 Family F4 keeps Executive Reports read-only and factual", async () => {
  const css = readFileSync("src/experience-v2/reporting-family/reporting-family.css", "utf8");
  const executive = readFileSync("src/screens/ExecutiveReports.jsx", "utf8");

  expect(executive).toContain('supabase.from("report_periods")');
  expect(executive).toContain('supabase.from("reports")');
  expect(executive).toContain('supabase.from("units")');
  expect(executive).toContain('.eq("scope", "unit")');
  expect(executive).toContain("coverage is not a performance score");
  expect(executive).toContain("Executive Reports is read-only");
  expect(executive).toContain("ev2-reporting-executive");
  expect(executive).not.toContain(".insert(");
  expect(executive).not.toContain(".update(");
  expect(executive).not.toContain(".delete(");
  expect(executive).not.toContain("save_report");
  expect(executive).not.toContain("correct_report");
  expect(executive).not.toContain("Open reporting period");
  expect(css).not.toContain("!important");
});

test("Stage 10 Family F4 keeps a failed Executive reporting read distinct from zero coverage", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto("/");
  await page.getByPlaceholder("Work email").fill("exec@ceac.local.test");
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.locator(".executive-app")).toBeVisible({ timeout: 15000 });

  await page.route("**/rest/v1/report_periods*", async (route) => {
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ message: "fixture executive reporting read failed" }),
    });
  });

  await page.goto("/?tab=exec-reports");
  await expect(page.getByText("Reporting context could not be loaded", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Try again", exact: true })).toBeVisible();
  await expect(page.getByText("0 of", { exact: false })).toHaveCount(0);
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
  test(`Stage 10 Family F4 Executive Reports composes at ${viewport.name}`, async ({ browser }) => {
    const { context, page } = await openExecutiveReports(browser, { width: viewport.width, height: viewport.height });

    await expect(page.getByText(/Administration controls periods and report configuration/i).first()).toBeVisible();
    await expect(page.getByText(/not a performance score/i).first()).toBeVisible();

    await expect(page.getByRole("button", { name: "Open reporting period", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Close period|Reopen period|Submit|Save|Correct/i })).toHaveCount(0);

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `Executive Reports overflowed ${viewport.width}px viewport`).toBeLessThanOrEqual(1);

    const smallest = await page.locator(".ev2-reporting-executive").evaluate((root) => {
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

    await page.screenshot({ path: `test-artifacts/redesign-r7-stage10f4-executive-reports-${viewport.name}.png`, fullPage: true });
    await context.close();
  });
}


test("VF5C Executive Reports is coverage-first with factual named filing status", async ({ browser }) => {
  for (const viewport of [
    { name: "phone-390", width: 390, height: 844 },
    { name: "laptop-1366", width: 1366, height: 768 },
  ]) {
    const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
    const page = await context.newPage();
    await page.goto("/");
    await page.getByPlaceholder("Work email").fill("exec@ceac.local.test");
    await page.getByPlaceholder("Password").fill(password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.locator(".executive-app")).toBeVisible({ timeout: 15000 });

    const periodId = "00000000-0000-4000-8000-000000000701";
    const units = [
      { id: "00000000-0000-4000-8000-000000000702", name: "Media" },
      { id: "00000000-0000-4000-8000-000000000703", name: "Technical" },
      { id: "00000000-0000-4000-8000-000000000704", name: "First Timers" },
    ];
    await page.route("**/rest/v1/report_periods*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: { "access-control-expose-headers": "content-range", "content-range": "0-0/1" },
        body: JSON.stringify([{
          id: periodId,
          label: "September 2026",
          status: "open",
          starts_on: "2026-09-01",
          ends_on: "2026-09-30",
        }]),
      });
    });
    await page.route("**/rest/v1/units*", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json",
        headers: { "access-control-expose-headers": "content-range", "content-range": "0-2/3" }, body: JSON.stringify(units) });
    });
    await page.route("**/rest/v1/reports*", async (route) => {
      const issued = new URL(route.request().url()).searchParams.get("select")?.includes("narrative");
      const rows = issued
        ? [{ id: "00000000-0000-4000-8000-000000000711", unit_id: units[0].id, status: "submitted",
             version: 2, submitted_at: "2026-10-01T08:30:00Z", narrative: "Recorded service", challenges: "None" }]
        : [
            { unit_id: units[0].id, status: "submitted", version: 2, submitted_at: "2026-10-01T08:30:00Z" },
            { unit_id: units[1].id, status: "draft", version: 1, submitted_at: null },
          ];
      await route.fulfill({
        status: 200, contentType: "application/json",
        headers: { "access-control-expose-headers": "content-range",
          "content-range": issued ? "0-0/1" : "0-1/2" },
        body: JSON.stringify(rows),
      });
    });
    // Fully model the exact-count supporting sources required for factual
    // totals; partial/missing responses must still fail the separate denial test.
    for (const table of ["objectives","project_milestones","report_targets","report_evidence_refs","work_decisions"]) {
      await page.route("**/rest/v1/" + table + "*", route => route.fulfill({
        status: 200, contentType: "application/json",
        headers: { "access-control-expose-headers": "content-range", "content-range": "*/0" },
        body: "[]",
      }));
    }

    await page.goto("/?tab=exec-reports");
    await expect(page.locator(".ev2-reporting-executive")).toBeVisible({ timeout: 15000 });
    await expect(page.getByText("September 2026", { exact: true })).toBeVisible();
    await expect(page.getByText("1", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("submitted units", { exact: true })).toBeVisible();
    await expect(page.getByText("drafts", { exact: true })).toBeVisible();
    await expect(page.getByText("waiting", { exact: true })).toBeVisible();
    // Issued reporting units must appear in the actual unit-status register;
    // their names may legitimately appear again in the Executive evidence brief.
    const unitRows = page.locator(".ev2-reporting-executive .ev2rep-row");
    for (const unitName of ["Media", "Technical", "First Timers"]) {
      await expect(unitRows.getByText(unitName, { exact: true })).toBeVisible();
    }
    await expect(page.getByText("Filed", { exact: true })).toBeVisible();
    await expect(page.getByText("Started", { exact: true })).toBeVisible();
    await expect(page.getByText("Waiting", { exact: true })).toBeVisible();

    const brief = page.locator(".ev2rep-executive-brief");
    const layout = await brief.evaluate((node) => ({
      display: getComputedStyle(node).display,
      columns: getComputedStyle(node).gridTemplateColumns,
    }));
    expect(layout.display).toBe("grid");
    if (viewport.width >= 961) {
      expect(layout.columns.split(" ").filter(Boolean)).toHaveLength(2);
    } else {
      expect(layout.columns.split(" ").filter(Boolean)).toHaveLength(1);
    }

    if (viewport.width <= 760) {
      const evidence = page.locator(".ev2rep-evidence-grid");
      const rail = await evidence.evaluate((node) => ({
        display: getComputedStyle(node).display,
        scrollWidth: node.scrollWidth,
        clientWidth: node.clientWidth,
      }));
      expect(rail.display).toBe("flex");
      expect(rail.scrollWidth).toBeGreaterThan(rail.clientWidth);
    }

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);

    await page.screenshot({
      path: `test-artifacts/vf5c-executive-reports-${viewport.name}.png`,
      fullPage: true,
    });
    await context.close();
  }
});

test("Executive Reports refuses partially returned unit rows instead of inventing missing coverage", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto("/");
  await page.getByPlaceholder("Work email").fill("exec@ceac.local.test");
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.locator(".executive-app")).toBeVisible({ timeout: 15000 });
  await page.route("**/rest/v1/report_periods*", route => route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({ id: "00000000-0000-4000-8000-000000000701", label: "September 2026", status: "open",
      starts_on: "2026-09-01", ends_on: "2026-09-30" }),
  }));
  await page.route("**/rest/v1/units*", route => route.fulfill({
    status: 200, contentType: "application/json",
    headers: { "access-control-expose-headers": "content-range", "content-range": "0-1/3" },
    body: JSON.stringify([{ id: "00000000-0000-4000-8000-000000000702", name: "Media" },
      { id: "00000000-0000-4000-8000-000000000703", name: "Technical" }]),
  }));
  await page.goto("/?tab=exec-reports");
  await expect(page.getByText("Reporting context could not be loaded", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Try again", exact: true })).toBeVisible();
  await expect(page.getByText("0 of", { exact: false })).toHaveCount(0);
  await context.close();
});

test("Executive issued-outcome brief hides incomplete history rather than counting a partial result", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto("/");
  await page.getByPlaceholder("Work email").fill("exec@ceac.local.test");
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.locator(".executive-app")).toBeVisible({ timeout: 15000 });
  const periodId = "00000000-0000-4000-8000-000000000701";
  await page.route("**/rest/v1/report_periods*", route => route.fulfill({
    status: 200, contentType: "application/json",
    headers: { "access-control-expose-headers": "content-range", "content-range": "0-0/1" },
    body: JSON.stringify([{ id: periodId, label: "September 2026", status: "open",
      starts_on: "2026-09-01", ends_on: "2026-09-30" }]),
  }));
  await page.route("**/rest/v1/units*", route => route.fulfill({
    status: 200, contentType: "application/json", headers: { "access-control-expose-headers": "content-range", "content-range": "0-0/1" },
    body: JSON.stringify([{ id: "00000000-0000-4000-8000-000000000702", name: "Media" }]),
  }));
  await page.route("**/rest/v1/reports*", route => {
    const details = new URL(route.request().url()).searchParams.get("select")?.includes("narrative");
    const row = { unit_id: "00000000-0000-4000-8000-000000000702",
      status: "submitted", version: 1, submitted_at: "2026-09-30T14:00:00Z" };
    return route.fulfill({ status: 200, contentType: "application/json",
      headers: { "access-control-expose-headers": "content-range", "content-range": details ? "0-0/2" : "0-0/1" },
      body: JSON.stringify([details ? { id: "00000000-0000-4000-8000-000000000711", ...row, narrative: "Verified service", challenges: "None" } : row]),
    });
  });
  for (const table of ["objectives", "project_milestones"]) {
    await page.route("**/rest/v1/" + table + "*", route => route.fulfill({
      status: 200, contentType: "application/json", headers: { "access-control-expose-headers": "content-range", "content-range": "*/0" }, body: "[]",
    }));
  }
  await page.goto("/?tab=exec-reports");
  await expect(page.locator(".ev2-reporting-executive")).toBeVisible();
  await expect(page.getByText("submitted units", { exact: true })).toBeVisible();
  await expect(page.getByText("Detailed outcome records could not be verified. No achievement figures have been inferred.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Print / Save PDF" })).toBeDisabled();
  await context.close();
});

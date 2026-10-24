import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

const password = process.env.ROLE_FIXTURE_PASSWORD;

for (const width of [320, 1440]) {
  test(`A6/A7 operational archive preserves reports and reconciles duplicates at ${width}px`, async ({ browser }) => {
    const { context, page } = await openAdminReports(browser, { width, height: 900 });
    const records = [
      { record_table: "work_items", record_id: "aa610010-0000-4000-8000-000000000001", label: "Owner-confirmed test task", status: "not_started", archived: false, event_no: 0, fingerprint: "original-task", retained_reports: [] },
      { record_table: "report_periods", record_id: "aa610100-0000-4000-8000-000000000001", label: "Canonical synthetic month", status: "open", archived: false, event_no: 0, fingerprint: "original-period", retained_reports: [] },
      { record_table: "report_periods", record_id: "aa610100-0000-4000-8000-000000000002", label: "Duplicate synthetic month", status: "closed", archived: false, event_no: 0, fingerprint: "original-duplicate", retained_reports: [] },
      { record_table: "report_periods", record_id: "aa610100-0000-4000-8000-000000000003", label: "Demo synthetic report month", status: "open", archived: true, event_no: 1, fingerprint: "original-report-period", retained_reports: [{ id: "retained-synthetic-report", scope: "unit", status: "submitted", version: 1, narrative: "Original demonstration report remains intact." }] },
    ];
    records.push({record_table:"learning_courses",record_id:"aa620002-0000-4000-8000-000000000001",label:"Demo synthetic course",status:"published",archived:false,event_no:0,fingerprint:"course-and-original-history",retained_reports:[]});
    const calls = [];
    await page.route("**/rest/v1/rpc/admin_operational_archive_records", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(records) }));
    await page.route("**/rest/v1/rpc/admin_apply_operational_archive", (route) => {
      const payload = route.request().postDataJSON(); calls.push(payload);
      for (const change of payload.p_changes) Object.assign(records.find((row) => row.record_id === change.record_id), { archived: change.archived, canonical_period_id: change.canonical_period_id, event_no: records.find((row) => row.record_id === change.record_id).event_no + 1 });
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(payload.p_changes.length) });
    });
    await page.getByRole("button", { name: "Review demo work & reporting archives", exact: true }).click();
    const panel = page.getByRole("region", { name: "Operational archive review" });
    await panel.getByRole("checkbox", { name: /Owner-confirmed test task/ }).check();
    await panel.getByLabel("Reason for this change (required)").fill("Owner confirmed this is demonstration work.");
    await panel.getByRole("button", { name: "Archive selected demo records", exact: true }).click();
    await expect(panel.getByRole("checkbox", { name: /Owner-confirmed test task.*Archived demo/ })).toBeVisible();
    await panel.getByRole("checkbox", { name: /Owner-confirmed test task/ }).check();
    await panel.getByLabel("Reason for this change (required)").fill("Restore the synthetic task after review.");
    await panel.getByRole("button", { name: "Restore selected records", exact: true }).click();
    await expect(panel.getByRole("checkbox", { name: /Owner-confirmed test task.*Included in live records/ })).toBeVisible();
    await panel.getByRole("checkbox", { name: /Duplicate synthetic month/ }).check();
    await panel.getByLabel("Canonical period for duplicate reconciliation").selectOption(records[1].record_id);
    await panel.getByLabel("Reason for this change (required)").fill("Retain the existing canonical reporting month.");
    await panel.getByRole("button", { name: "Reconcile duplicate period", exact: true }).click();
    await expect(panel.getByRole("checkbox", { name: /Duplicate synthetic month.*Reconciled duplicate/ })).toBeVisible();
    await panel.getByText("1 retained report(s)", { exact: true }).click();
    await expect(panel.getByText("Original demonstration report remains intact.", { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    await panel.getByRole("checkbox", {name:/Demo synthetic course.*Course.*Included in live records/}).check();
    await panel.getByLabel("Reason for this change (required)").fill("Archive synthetic course with original learning history retained.");
    await panel.getByRole("button", {name:"Archive selected demo records",exact:true}).click();
    await expect(panel.getByRole("checkbox", {name:/Demo synthetic course.*Course.*Archived demo/})).toBeVisible();
    await panel.getByRole("checkbox", {name:/Demo synthetic course/}).check();
    await panel.getByLabel("Reason for this change (required)").fill("Restore the original synthetic learning course and its history.");
    await panel.getByRole("button", {name:"Restore selected records",exact:true}).click();
    await expect(panel.getByRole("checkbox", {name:/Demo synthetic course.*Included in live records/})).toBeVisible();
    expect(calls.map((call) => call.p_changes[0].archived)).toEqual([true, false, true, true, false]);
    expect(calls[3].p_changes[0].fingerprint).toBe("course-and-original-history");
    expect(calls[2].p_changes[0].canonical_period_id).toBe(records[1].record_id);
    expect(calls.every((call) => !("status" in call.p_changes[0]) && !("narrative" in call.p_changes[0]))).toBe(true);
    await context.close();
  });
}

async function openAdminReports(browser, viewport) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  await page.goto("/");
  await page.getByPlaceholder("Work email").fill("admin@ceac.local.test");
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.locator(".office-app")).toBeVisible({ timeout: 15000 });
  await page.goto("/?tab=reporting");
  await expect(page.locator(".ev2-reporting-admin")).toBeVisible({ timeout: 15000 });
  await expect(page.getByRole("heading", { name: "Reports", exact: true })).toBeVisible();
  return { context, page };
}

test("Stage 10 Family F3 preserves Administration reporting authority and truthful coverage semantics", async () => {
  const family = readFileSync("src/experience-v2/reporting-family/ReportingFamilyV2.jsx", "utf8");
  const css = readFileSync("src/experience-v2/reporting-family/reporting-family.css", "utf8");
  const reports = readFileSync("src/screens/Reports.jsx", "utf8");

  for (const symbol of ["ReportingPageHeader", "ReportingSection", "ReportingEvidenceGrid", "ReportingEvidenceCard", "ReportingRecordRow", "ReportingEmpty", "ReportingFootnote"]) {
    expect(family).toContain(`export function ${symbol}`);
  }

  expect(reports).toContain('supabase.from("report_periods").insert');
  expect(reports).toContain('supabase.from("report_periods").update');
  expect(reports).toContain('supabase.from("reports").select');
  expect(reports).toContain('scope === "unit"');
  expect(reports).toContain("not a performance score");
  expect(reports).toContain("ev2-reporting-admin");
  expect(reports).toContain("Reporting records could not be loaded");
  expect(reports).not.toContain("<Chart");
  expect(reports).not.toContain('kind="donut"');
  expect(reports).not.toContain(".delete(");
  expect(reports).not.toContain('scope: "person"');
  expect(css).toContain(".ev2-reporting-admin");
  expect(css).not.toContain("!important");
});

test("Stage 10 Family F3 keeps a failed Administration reporting read distinct from zero coverage", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto("/");
  await page.getByPlaceholder("Work email").fill("admin@ceac.local.test");
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.locator(".office-app")).toBeVisible({ timeout: 15000 });

  await page.route("**/rest/v1/report_periods*", async (route) => {
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ message: "fixture reporting read failed" }),
    });
  });

  await page.goto("/?tab=reporting");
  await expect(page.getByText("Reporting records could not be loaded", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Try again", exact: true })).toBeVisible();
  await expect(page.getByText("No reporting periods recorded", { exact: true })).toHaveCount(0);
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
  test(`Stage 10 Family F3 Administration Reports composes at ${viewport.name}`, async ({ browser }) => {
    const { context, page } = await openAdminReports(browser, { width: viewport.width, height: viewport.height });

    const openPeriod = page.getByRole("button", { name: "Open reporting period", exact: true });
    await expect(openPeriod).toBeVisible();
    const buttonBox = await openPeriod.boundingBox();
    expect(buttonBox?.height || 0).toBeGreaterThanOrEqual(44);

    await expect(page.getByText(/not a performance score/i).last()).toBeVisible();

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `Administration Reports overflowed ${viewport.width}px viewport`).toBeLessThanOrEqual(1);

    const smallest = await page.locator(".ev2-reporting-admin").evaluate((root) => {
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

    await page.screenshot({ path: `test-artifacts/redesign-r7-stage10f3-admin-reports-${viewport.name}.png`, fullPage: true });
    await context.close();
  });
}

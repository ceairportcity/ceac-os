import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

const password = process.env.ROLE_FIXTURE_PASSWORD;

async function openExecutiveFinance(browser, viewport) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  await page.goto("/");
  await page.getByPlaceholder("Work email").fill("exec@ceac.local.test");
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.locator(".executive-app")).toBeVisible({ timeout: 15000 });
  await page.goto("/?tab=exec-finance");
  await expect(page.locator(".ev2-finance-executive")).toBeVisible({ timeout: 15000 });
  await expect(page.getByRole("heading", { name: "Finance", exact: true })).toBeVisible();
  return { context, page };
}

test("Stage 10 Family E4 preserves Executive finance authority and factual semantics", async () => {
  const family = readFileSync("src/experience-v2/finance-family/FinanceFamilyV2.jsx", "utf8");
  const css = readFileSync("src/experience-v2/finance-family/finance-family.css", "utf8");
  const executive = readFileSync("src/screens/ExecutiveFinance.jsx", "utf8");

  for (const symbol of ["FinancePageHeader", "FinanceSection", "FinanceCurrencyCard", "FinanceRecordRow", "FinanceEmpty", "FinanceFootnote"]) {
    expect(family).toContain(`export function ${symbol}`);
  }

  expect(executive).toContain('supabase.from("finance_requests")');
  expect(executive).toContain('supabase.from("spend_lines")');
  expect(executive).toContain('supabase.from("budgets")');
  expect(executive).toContain('authority="exec"');
  expect(executive).not.toContain("canFulfil");
  expect(executive).not.toContain(".insert(");
  expect(executive).not.toContain(".update(");
  expect(executive).not.toContain(".delete(");
  expect(executive).toContain('"Not recorded"');
  expect(executive).toContain("Requests remain distinct from actual spend");
  expect(executive).toContain("recorded spend is not a bank balance");
  expect(executive).toContain("ev2-finance-executive");
  expect(executive).not.toContain("exec-bars");
  expect(executive).not.toContain("premium-exec-page");
  expect(css).toContain(".ev2-finance-executive");
  expect(css).not.toContain("!important");
});

test("Stage 10 Family E4 keeps missing Executive budget distinct from recorded zero", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto("/");
  await page.getByPlaceholder("Work email").fill("exec@ceac.local.test");
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.locator(".executive-app")).toBeVisible({ timeout: 15000 });

  await page.route("**/rest/v1/budgets*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([]),
    });
  });
  await page.route("**/rest/v1/spend_lines*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([{
        id: "00000000-0000-4000-8000-000000000001",
        amount_minor: 2500,
        currency: "GHS",
        unit_id: "00000000-0000-4000-8000-000000000002",
        units: { name: "Fixture Unit" },
        spent_on: "2026-09-28",
        reverses_id: null,
      }]),
    });
  });

  await page.goto("/?tab=exec-finance");
  await expect(page.locator(".ev2-finance-executive")).toBeVisible({ timeout: 15000 });
  const position = page.getByText("Financial context by currency", { exact: true }).locator("..").locator("..");
  await expect(page.getByText("Not recorded", { exact: true }).first()).toBeVisible();
  await expect(position).toBeVisible();
  await context.close();
});

test("Stage 10 Family E4 keeps failed Executive context distinct from financial figures", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto("/");
  await page.getByPlaceholder("Work email").fill("exec@ceac.local.test");
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.locator(".executive-app")).toBeVisible({ timeout: 15000 });

  await page.route("**/rest/v1/budgets*", async (route) => {
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ message: "fixture executive finance read failed" }),
    });
  });

  await page.goto("/?tab=exec-finance");
  await expect(page.getByText("Financial context could not be loaded", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Try again", exact: true })).toBeVisible();
  await expect(page.getByText("Financial context by currency", { exact: true })).toHaveCount(0);
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
  test(`Stage 10 Family E4 Executive Finance composes at ${viewport.name}`, async ({ browser }) => {
    const { context, page } = await openExecutiveFinance(browser, { width: viewport.width, height: viewport.height });

    await expect(page.getByText("Requests needing Group Pastor", { exact: true })).toBeVisible();
    await expect(page.getByText(/Each currency stays separate/i).first()).toBeVisible();
    await expect(page.getByText(/not a bank balance/i).last()).toBeVisible();
    await expect(page.getByText("Recorded spend by unit", { exact: true })).toBeVisible();

    const fulfilButtons = page.getByRole("button", { name: "Record as spent", exact: true });
    await expect(fulfilButtons).toHaveCount(0);

    const authorityButtons = page.locator(".ev2fin-authority button:visible");
    const authorityCount = await authorityButtons.count();
    for (let i = 0; i < authorityCount; i += 1) {
      const box = await authorityButtons.nth(i).boundingBox();
      expect(box?.height || 0).toBeGreaterThanOrEqual(44);
    }

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `Executive Finance overflowed ${viewport.width}px viewport`).toBeLessThanOrEqual(1);

    const smallest = await page.locator(".ev2-finance-executive").evaluate((root) => {
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

    await page.screenshot({ path: `test-artifacts/redesign-r7-stage10e4-executive-finance-${viewport.name}.png`, fullPage: true });
    await context.close();
  });
}


test("VF5C Executive Finance is decision-first with currency-safe populated context", async ({ browser }) => {
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

    const requestId = "00000000-0000-4000-8000-000000000601";
    await page.route("**/rest/v1/finance_requests*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([{
          id: requestId,
          org_id: "00000000-0000-4000-8000-000000000600",
          unit_id: "00000000-0000-4000-8000-000000000602",
          project_id: null,
          requested_by: "00000000-0000-4000-8000-000000000603",
          title: "Outreach transport",
          justification: "Recorded request for ministry transport.",
          amount_minor: 185000,
          currency: "GHS",
          needed_by: "2026-10-10",
          state: "submitted",
          created_at: "2026-10-01T08:00:00Z",
          decided_at: null,
          fulfilled_spend_id: null,
          units: { name: "Outreach" },
        }]),
      });
    });
    await page.route("**/rest/v1/finance_request_decisions*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([{
          id: "00000000-0000-4000-8000-000000000604",
          request_id: requestId,
          stage: 1,
          authority: "finance",
          decision: "approved",
          note: "Finance review recorded.",
          decided_at: "2026-10-01T09:00:00Z",
        }]),
      });
    });
    await page.route("**/rest/v1/finance_approval_rules*", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([]) });
    });
    await page.route("**/rest/v1/budgets*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          { id: "00000000-0000-4000-8000-000000000605", amount_minor: 5000000, currency: "GHS", unit_id: null, project_id: null, units: null },
          { id: "00000000-0000-4000-8000-000000000606", amount_minor: 250000, currency: "USD", unit_id: null, project_id: null, units: null },
        ]),
      });
    });
    await page.route("**/rest/v1/spend_lines*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          { id: "00000000-0000-4000-8000-000000000607", amount_minor: 1250000, currency: "GHS", unit_id: "00000000-0000-4000-8000-000000000602", units: { name: "Outreach" }, spent_on: "2026-09-30", reverses_id: null },
          { id: "00000000-0000-4000-8000-000000000608", amount_minor: 45000, currency: "USD", unit_id: "00000000-0000-4000-8000-000000000609", units: { name: "Media" }, spent_on: "2026-09-29", reverses_id: null },
        ]),
      });
    });

    await page.goto("/?tab=exec-finance");
    await expect(page.locator(".ev2-finance-executive")).toBeVisible({ timeout: 15000 });
    await expect(page.getByText("Requests needing Group Pastor", { exact: true })).toBeVisible();
    await expect(page.getByText("Outreach transport", { exact: true })).toBeVisible();
    await expect(page.getByText("GHS", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("USD", { exact: true }).first()).toBeVisible();
    await expect(page.getByText(/GHS 12,500.00 recorded spend/)).toBeVisible();
    await expect(page.getByText(/USD 450.00 recorded spend/)).toBeVisible();
    await expect(page.getByText(/No currency conversion/).first()).toBeVisible();

    const brief = page.locator(".ev2fin-executive-brief");
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

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);

    await page.screenshot({
      path: `test-artifacts/vf5c-executive-finance-${viewport.name}.png`,
      fullPage: true,
    });
    await context.close();
  }
});

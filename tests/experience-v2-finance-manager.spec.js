import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

const password = process.env.ROLE_FIXTURE_PASSWORD;

async function openManagerFinance(browser, viewport, email = "manager@ceac.local.test") {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  await page.goto("/");
  await page.getByPlaceholder("Work email").fill(email);
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.locator(".manager-app")).toBeVisible({ timeout: 15000 });
  await page.goto("/?tab=manager-finance");
  await expect(page.locator(".ev2-finance-manager")).toBeVisible({ timeout: 15000 });
  await expect(page.getByRole("heading", { name: "Finance", exact: true })).toBeVisible();
  return { context, page };
}

test("Stage 10 Family E2 preserves Manager finance authority while establishing V2 presentation", async () => {
  const family = readFileSync("src/experience-v2/finance-family/FinanceFamilyV2.jsx", "utf8");
  const css = readFileSync("src/experience-v2/finance-family/finance-family.css", "utf8");
  const manager = readFileSync("src/screens/ManagerFinance.jsx", "utf8");
  const main = readFileSync("src/main.jsx", "utf8");

  for (const symbol of ["FinancePageHeader", "FinanceSection", "FinanceCurrencyCard", "FinanceRecordRow", "FinanceFootnote"]) {
    expect(family).toContain(`export function ${symbol}`);
  }

  expect(manager).toContain('supabase.from("spend_lines")');
  expect(manager).toContain('supabase.from("finance_requests")');
  expect(manager).toContain('supabase.rpc("unit_budget_position"');
  expect(manager).toContain('supabase.rpc("unit_operating_position"');
  expect(manager).toContain('authority="finance" canFulfil');
  expect(manager).toContain("Managers can add spending only for their own unit");
  expect(manager).toContain("It is not a bank balance.");
  expect(manager).toContain("ev2-finance-manager");
  expect(manager).not.toContain('icon="money"');
  expect(manager).not.toContain(".update(");
  expect(manager).not.toContain(".delete(");
  expect(css).toContain(".ev2-finance-page");
  expect(css).not.toContain("!important");
  expect(main).toContain('import "./experience-v2/finance-family/finance-family.css";');
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
  test(`Stage 10 Family E2 Manager Finance composes at ${viewport.name}`, async ({ browser }) => {
    const { context, page } = await openManagerFinance(browser, { width: viewport.width, height: viewport.height });

    const request = page.getByRole("button", { name: "Request funds", exact: true });
    const expense = page.getByRole("button", { name: "Record expense", exact: true });
    await expect(request).toBeVisible();
    await expect(expense).toBeVisible();
    await expect(page.getByText(/Money in means confirmed transfers received by this unit/i)).toBeVisible();
    await expect(page.getByText("Requests needing Finance", { exact: true })).toHaveCount(0);

    for (const control of [request, expense]) {
      const box = await control.boundingBox();
      // Ignore floating-point subtraction noise from the route translation,
      // while retaining the full 44 CSS-pixel touch floor.
      expect(Math.round((box?.height || 0) * 1000) / 1000).toBeGreaterThanOrEqual(44);
    }

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `Manager Finance overflowed ${viewport.width}px viewport`).toBeLessThanOrEqual(1);

    const smallest = await page.locator(".ev2-finance-manager").evaluate((root) => {
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

    await page.screenshot({ path: `test-artifacts/redesign-r7-stage10e2-manager-finance-${viewport.name}.png`, fullPage: true });
    await context.close();
  });
}

test("Stage 10 Family E2 retains explicit Finance-handler authority without granting it to ordinary Managers", async ({ browser }) => {
  const { context, page } = await openManagerFinance(browser, { width: 390, height: 844 }, "managerb@ceac.local.test");
  await expect(page.getByText("Requests needing Finance", { exact: true })).toBeVisible();
  await expect(page.getByText(/approved, not yet recorded as spend/i)).toBeVisible();
  await expect(page.getByText(/not a bank balance/i).last()).toBeVisible();
  await context.close();
});

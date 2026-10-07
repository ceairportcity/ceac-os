import fs from "node:fs";
import { test, expect } from "@playwright/test";
import { getMobilePrimaryNavigation } from "../src/experience-v2/shell/navigation.js";

const password = process.env.ROLE_FIXTURE_PASSWORD;
const reference = "docs/design/executive-redesign/CEAC_EXECUTIVE_PANEL_APPROVED_REFERENCE.webp";
const contract = "docs/design/executive-redesign/CEAC_EXECUTIVE_PANEL_VISUAL_PRODUCT_LOCK_2026-10-07.md";

async function signIn(page, viewport = { width: 1440, height: 900 }) {
  await page.setViewportSize(viewport);
  await page.goto("/");
  await page.getByPlaceholder("Work email").fill("exec@ceac.local.test");
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.locator(".executive-app")).toBeVisible({ timeout: 15000 });
}

test.describe.configure({ mode: "serial" });

test("Executive redesign is bound to the literal owner-approved reference", () => {
  expect(fs.existsSync(reference), reference).toBeTruthy();
  expect(fs.existsSync(contract), contract).toBeTruthy();

  const lock = fs.readFileSync(contract, "utf8");
  const css = fs.readFileSync("src/experience-v2/executive-overview/executive-redesign.css", "utf8");
  const overview = fs.readFileSync("src/experience-v2/executive-overview/ExecutiveOverviewV2.jsx", "utf8");
  const legacy = fs.readFileSync("src/premium-executive.css", "utf8");

  expect(lock).toContain("literal implementation authority");
  expect(lock).toContain("No compromise");
  expect(lock).toContain("not an interpretation");
  expect(overview).toContain("Executive Dashboard");
  expect(overview).toContain("Volunteers");
  expect(overview).toContain("Ministry Objectives");
  expect(overview).toContain("Upcoming Meetings");
  expect(overview).toContain("Reports / Actions");
  expect(css).toContain(".executive-app .ev2s-sidebar");
  expect(css).toContain(".executive-app .ev2-project-delivery.is-executive");
  expect(css).toContain(".executive-app .ev2cal-admin-page");
  expect(css).toContain(".executive-app .fpg-payroll");
  expect((legacy.match(/!important\b/g) || []).length).toBe(0);

  const primary = getMobilePrimaryNavigation({
    isExec: true,
    isAdmin: false,
    isManager: false,
    me: { capabilities: ["payroll.approve"] },
  });
  expect(primary.map((item) => item.label)).toEqual(["Overview", "Work", "Ministry"]);
});

test("Executive Overview reproduces the locked desktop composition", async ({ page }) => {
  await signIn(page);
  await expect(page.getByText("Executive Dashboard", { exact: true })).toBeVisible();
  await expect(page.locator(".executivev2-hero h2")).toContainText("Good morning");
  await expect(page.locator(".executivev2-kpi")).toHaveCount(4);
  await expect(page.locator(".executivev2-reference-grid > .executivev2-reference-panel")).toHaveCount(3);
  await expect(page.locator(".executivev2-lower-grid > .executivev2-reference-panel")).toHaveCount(2);
  await expect(page.getByText("Needs your attention", { exact: true })).toBeVisible();
  await expect(page.getByText("Ministry direction", { exact: true })).toBeVisible();
  await expect(page.getByText("Organisational overview", { exact: true })).toBeVisible();
  await expect(page.getByText("Recent activity", { exact: true })).toBeVisible();
  await expect(page.getByText("Upcoming meetings", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: "test-artifacts/executive-redesign-reference-overview-desktop-1440.png", fullPage: true });
});

test("Executive Overview reproduces the locked phone composition", async ({ page }) => {
  await signIn(page, { width: 390, height: 844 });
  const nav = page.locator(".ev2s-mobile-nav");
  await expect(nav.getByRole("button")).toHaveCount(4);
  await expect(nav.locator("button span")).toHaveText(["Overview", "Work", "Ministry", "More"]);
  await expect(page.locator(".executivev2-kpi")).toHaveCount(4);
  const columns = await page.locator(".executivev2-kpis").evaluate((node) => getComputedStyle(node).gridTemplateColumns.split(" ").length);
  expect(columns).toBe(2);
  await expect(page.locator(".executivev2-attention")).toBeVisible();
  await expect(page.locator(".executivev2-direction")).toBeHidden();
  await expect(page.locator(".executivev2-organisation")).toBeHidden();
  await expect(page.locator(".executivev2-activity")).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: "test-artifacts/executive-redesign-reference-overview-phone-390.png", fullPage: true });
});

const destinations = [
  ["work", ".ev2-work-executive", "Work"],
  ["strategy", ".ev2-executive-ministry", "Ministry"],
  ["delivery", ".ev2-project-delivery.is-executive", "Portfolio"],
  ["exec-organisation", ".ev2-exec-organisation", "Organisation"],
  ["exec-calendar", ".ev2cal-admin-page", "Calendar"],
  ["exec-finance", ".ev2-finance-executive", "Finance"],
  ["payroll", ".fpg-payroll", "Payroll"],
  ["exec-reports", ".ev2-reporting-executive", "Reports"],
];

for (const [tab, selector, label] of destinations) {
  test(`Executive ${label} keeps the unified redesign on desktop and phone`, async ({ browser }) => {
    for (const viewport of [
      { width: 1440, height: 900, name: "desktop" },
      { width: 390, height: 844, name: "phone" },
    ]) {
      const context = await browser.newContext({ viewport });
      const page = await context.newPage();
      await page.goto("/");
      await page.getByPlaceholder("Work email").fill("exec@ceac.local.test");
      await page.getByPlaceholder("Password").fill(password);
      await page.getByRole("button", { name: "Sign in" }).click();
      await expect(page.locator(".executive-app")).toBeVisible({ timeout: 15000 });
      await page.goto(`/?tab=${tab}`);
      await expect(page.locator(selector)).toBeVisible({ timeout: 15000 });
      await expect(page.getByRole("heading", { name: label, exact: true }).first()).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
      await page.screenshot({ path: `test-artifacts/executive-redesign-${tab}-${viewport.name}.png`, fullPage: true });
      await context.close();
    }
  });
}

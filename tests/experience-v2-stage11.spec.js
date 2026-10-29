import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

const password = process.env.ROLE_FIXTURE_PASSWORD;

async function login(browser, email, app, viewport) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  await page.goto("/");
  await page.getByPlaceholder("Work email").fill(email);
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.locator(app)).toBeVisible({ timeout: 15000 });
  return { context, page };
}

test("Stage 11B establishes isolated V2 calendar and data visualisation families", async () => {
  const calendar = readFileSync("src/experience-v2/calendar/CalendarFamilyV2.jsx", "utf8");
  const calendarCss = readFileSync("src/experience-v2/calendar/calendar.css", "utf8");
  const dataViz = readFileSync("src/experience-v2/data-viz/DataVizV2.jsx", "utf8");
  const dataVizCss = readFileSync("src/experience-v2/data-viz/data-viz.css", "utf8");
  const main = readFileSync("src/main.jsx", "utf8");
  const executive = readFileSync("src/experience-v2/executive-overview/ExecutiveOverviewV2.jsx", "utf8");

  for (const symbol of [
    "CalendarPageHeader",
    "CalendarViewTabs",
    "CalendarPeriodControls",
    "CalendarFilters",
    "CalendarMonthGrid",
    "CalendarAgenda",
    "CalendarTimeline",
  ]) {
    expect(calendar).toContain(`export function ${symbol}`);
  }

  expect(calendar).toContain('from "../components"');
  expect(calendar).toContain('from "../icons"');
  expect(calendar).not.toContain("lucide-react");
  expect(calendar).not.toContain("components/primitives/Icon");
  expect(calendarCss).not.toContain("!important");

  expect(dataViz).toContain("export function DataVizChart");
  expect(dataViz).toContain('kind === "donut"');
  expect(dataViz).toContain('kind === "line"');
  expect(dataViz).toContain('kind === "pairedBar"');
  expect(dataViz).toContain("<TableShell");
  expect(dataViz).toContain('view === "chart" ? "Table" : "Chart"');
  expect(dataViz).toContain("tabIndex: 0");
  expect(dataViz).not.toContain("lucide-react");
  expect(dataViz).not.toContain("components/primitives");
  expect(dataVizCss).not.toContain("!important");

  // Calendar styling is loaded alongside the lazy calendar route instead of
  // every sign-in screen. Keep the stylesheet and its no-!important contract.
  expect(main).not.toContain('import "./experience-v2/calendar/calendar.css";');
  expect(calendar).toContain('import "./calendar.css";');
  expect(main).toContain('import "./experience-v2/data-viz/data-viz.css";');
  expect(executive).toContain('from "./strategyProgress.js"');
  expect(executive).toContain("const progress = strategyProgress(row)");
  expect(executive).not.toContain("function MiniTrend");
  expect(executive).not.toContain('className="executivev2-trend"');
});

for (const viewport of [
  { name: "phone-320", width: 320, height: 844 },
  { name: "phone-390", width: 390, height: 844 },
  { name: "laptop-1366", width: 1366, height: 768 },
  { name: "desktop-1440", width: 1440, height: 900 },
]) {
  test(`Stage 11B protected calendar/data-viz proof composes at ${viewport.name}`, async ({ browser }) => {
    const { context, page } = await login(browser, "admin@ceac.local.test", ".office-app", viewport);
    await page.goto("/?tab=primitives");

    const proof = page.locator(".ev2-stage11-proof");
    await expect(page.getByRole("heading", { name: "Calendar context and factual visualisation", exact: true })).toBeVisible();
    await expect(proof).toBeVisible();
    await expect(proof.getByLabel("Reference September 2026 calendar")).toBeVisible();
    await expect(proof.getByText("Reference recorded movement", { exact: true })).toBeVisible();

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `Stage 11B proof overflowed ${viewport.width}px viewport`).toBeLessThanOrEqual(1);

    await page.screenshot({
      path: `test-artifacts/redesign-r7-stage11b-foundation-${viewport.name}.png`,
      fullPage: true,
    });
    await context.close();
  });
}

test("Stage 11B calendar proof exposes selected-date context without hiding factual items", async ({ browser }) => {
  const { context, page } = await login(browser, "admin@ceac.local.test", ".office-app", { width: 390, height: 844 });
  await page.goto("/?tab=primitives");

  const proof = page.locator(".ev2-stage11-proof");
  await proof.getByRole("button", { name: /Friday 11 September 2026/ }).click();
  await expect(proof.getByRole("heading", { name: /^Friday,? 11 September$/ })).toBeVisible();
  await expect(proof.locator(".ev2cal-agenda").getByText("Reference leave", { exact: true })).toBeVisible();

  await context.close();
});

test("Stage 11B chart proof keeps chart and table equivalent and keyboard reachable", async ({ browser }) => {
  const { context, page } = await login(browser, "admin@ceac.local.test", ".office-app", { width: 1366, height: 768 });
  await page.goto("/?tab=primitives");

  const chart = page.locator(".ev2-stage11-proof .ev2dv-chart");
  await expect(chart).toBeVisible();
  const firstMark = chart.locator(".ev2dv-mark").first();
  await firstMark.focus();
  await expect(firstMark).toBeFocused();

  await chart.getByRole("button", { name: /Show Reference recorded movement as table/ }).click();
  await expect(chart.getByRole("table")).toBeVisible();
  await expect(chart.getByText("19", { exact: true })).toBeVisible();

  await chart.getByRole("button", { name: /Show Reference recorded movement as chart/ }).click();
  await expect(chart.getByRole("img", { name: "Reference recorded movement" })).toBeVisible();

  await context.close();
});

test("Stage 11B Executive activity remains attributable and does not invent movement when evidence is absent", async ({ browser }) => {
  const { context, page } = await login(browser, "exec@ceac.local.test", ".executive-app", { width: 1366, height: 768 });
  await page.goto("/?tab=home");
  await expect(page.locator(".executivev2-hero h2")).toContainText(/Good morning|Good afternoon|Good evening/);

  // Owner-approved Executive Overview renders attributable significant updates, not a
  // synthetic movement score or an empty chart. If no authorised records
  // exist, the explicit evidence-empty state must be visible.
  const activity = page.locator(".executivev2-activity");
  await expect(activity).toBeVisible();
  await expect(activity.getByRole("heading", { name: "Significant updates" })).toBeVisible();
  const records = activity.locator(".executivev2-activity-item");
  const empty = activity.getByText("No recent attributable activity is visible.", { exact: true });
  await expect.poll(async () =>
    (await records.count()) > 0 || await empty.isVisible()
  ).toBe(true);
  if (await records.count()) {
    await expect(activity.locator(".executivev2-activity-context")).toBeVisible();
  } else {
    await expect(empty).toBeVisible();
    await expect(activity.locator(".ev2dv-chart")).toHaveCount(0);
  }

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await page.screenshot({ path: "test-artifacts/redesign-r7-stage11b-executive-laptop-1366.png", fullPage: true });

  await context.close();
});

import fs from "node:fs";
import { test, expect } from "@playwright/test";

const password = process.env.ROLE_FIXTURE_PASSWORD;

async function openExecutive(browser, viewport) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  await page.goto("/");
  await page.getByPlaceholder("Work email").fill("exec@ceac.local.test");
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.locator(".executive-app")).toBeVisible({ timeout: 15000 });
  await expect(page.locator(".executivev2")).toBeVisible({ timeout: 15000 });
  await expect(page.locator(".executivev2-main")).toBeVisible({ timeout: 15000 });
  return { context, page };
}

test.describe.configure({ mode: "serial" });

test("Stage 8 Executive Overview is isolated V2 presentation on preserved Executive authority", async () => {
  for (const path of [
    "src/experience-v2/executive-overview/ExecutiveOverviewV2.jsx",
    "src/experience-v2/executive-overview/executive-overview.css",
  ]) expect(fs.existsSync(path), path).toBeTruthy();

  const home = fs.readFileSync("src/screens/ExecutiveHome.jsx", "utf8");
  const view = fs.readFileSync("src/experience-v2/executive-overview/ExecutiveOverviewV2.jsx", "utf8");
  const css = fs.readFileSync("src/experience-v2/executive-overview/executive-overview.css", "utf8");

  expect(home).toContain('from "../experience-v2/executive-overview/ExecutiveOverviewV2"');
  expect(home).toContain('supabase.from("recurring_operations")');
  expect(home).toContain('supabase.from("operation_occurrences")');
  expect(home).toContain('supabase.from("meeting_sessions")');
  expect(home).toContain('scheduleMeeting?.({ scope:"organisation", organisation:true })');
  expect(home).not.toContain("DashboardCalendar");
  expect(home).not.toContain("ReferenceModuleStrip");
  expect(home).not.toContain('from "../components/primitives"');

  expect(view).toContain('from "../components"');
  expect(view).toContain('from "../icons"');
  expect(view).toContain("Needs your attention");
  expect(view).toContain("Good morning");
  expect(view).toContain("Significant updates");
  expect(home).toContain('.in("verb", EXECUTIVE_EXCEPTION_VERBS)');
  expect(view).toContain('label="Employed staff"');
  expect(view).toContain('label="Volunteers"');
  expect(view).toContain("This area only shows CEAC records your account is authorised to see.");
  expect(view).not.toContain("ReferenceDashboard");
  expect(view).not.toContain("components/primitives");

  expect((css.match(/!important\b/g) || []).length).toBe(0);
  expect(css).toContain(".executivev2");
  expect(css).not.toContain(".executive-app");
  expect(css).not.toContain(".premium-");
  expect(css).not.toContain(".executive-command-surface");

  expect(view).toContain('import "./executive-overview.css";');
  const main = fs.readFileSync("src/main.jsx", "utf8");
  expect(main).toContain('import "./experience-v2/admin-overview/admin-overview.css";');
  expect(main).not.toContain('import "./experience-v2/executive-overview/executive-overview.css";');
});

for (const viewport of [
  { width: 320, height: 844, name: "320" },
  { width: 390, height: 844, name: "390" },
  { width: 1366, height: 768, name: "laptop" },
  { width: 1440, height: 900, name: "desktop" },
]) {
  test(`Stage 8 Executive Overview composes cleanly at ${viewport.name}`, async ({ browser }) => {
    const { context, page } = await openExecutive(browser, { width: viewport.width, height: viewport.height });

    await expect(page.locator(".executivev2-hero h2")).toContainText(/Good (morning|afternoon|evening), Executive Fixture/);
    // Desktop/laptop: variable scenic photography must not obscure the date.
    // Do not alter the approved image rotation or mock the user's clock.
    if (viewport.width >= 1025) {
      const dateStyle = await page.locator(".executivev2-hero time").evaluate((node) => {
        const style = getComputedStyle(node);
        return { background: style.backgroundColor, color: style.color, display: style.display };
      });
      expect(dateStyle.display).not.toBe("none");
      const background = (dateStyle.background.match(/[0-9.]+/g) || []).map(Number);
      expect(background.slice(0, 3)).toEqual([255, 255, 255]);
      expect(background[3]).toBeGreaterThanOrEqual(0.9);
      expect(dateStyle.color).toBe("rgb(20, 43, 72)");
    }
    await expect(page.locator(".executivev2-kpis")).toBeVisible();
    // Functional Start/End Work must remain unobstructed by KPI cards.
    const sessionBox = await page.locator(".executivev2 > .s2-own-work-session").boundingBox();
    const kpiBox = await page.locator(".executivev2-kpis").boundingBox();
    expect(sessionBox, "Executive attendance card must render").toBeTruthy();
    expect(kpiBox, "Executive KPI row must render").toBeTruthy();
    expect(kpiBox.y, "KPI cards must begin below employee attendance").toBeGreaterThanOrEqual(
      sessionBox.y + sessionBox.height - 1,
    );
    await expect(page.locator(".executivev2-attention")).toBeVisible();
    if (viewport.width > 720) {
      await expect(page.locator(".executivev2-direction")).toBeVisible();
      await expect(page.locator(".executivev2-organisation")).toBeVisible();
      await expect(page.locator(".executivev2-activity")).toBeVisible();
    }
    await expect(page.locator(".executivev2-meetings")).toBeVisible();
    const order = await page.locator(".executivev2-main > *").evaluateAll((nodes) => nodes.map((node) => node.className));
    expect(order[0]).toContain("executivev2-kpis");
    expect(order[1]).toContain("executivev2-reference-grid");
    expect(order[2]).toContain("executivev2-lower-grid");
    await expect(page.locator(".executive-command-surface")).toHaveCount(0);
    await expect(page.locator(".reference-calendar-card")).toHaveCount(0);
    await expect(page.locator(".reference-module-strip")).toHaveCount(0);

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);

    if (viewport.width <= 599) {
      const actionHeights = await page.locator(".executivev2 button:visible").evaluateAll((buttons) =>
        buttons.map((button) => button.getBoundingClientRect().height)
      );
      for (const height of actionHeights) expect(height).toBeGreaterThanOrEqual(44);
    }

    await page.screenshot({
      path: `test-artifacts/redesign-r7-stage8-executive-${viewport.name}.png`,
      fullPage: true,
    });
    await context.close();
  });
}


test("VF5A Executive briefing keeps the approved compact mockup hierarchy on mobile", async ({ browser }) => {
  const { context, page } = await openExecutive(browser, { width: 390, height: 844 });

  await expect(page.locator(".executivev2-hero h2")).toContainText(/Good (morning|afternoon|evening), Executive Fixture/);
  const kpis = page.locator(".executivev2-kpis");
  await expect(kpis).toBeVisible();
  await expect(kpis.locator(".executivev2-kpi")).toHaveCount(4);

  const attention = page.locator(".executivev2-attention");
  await expect(attention).toBeVisible();
  await expect(page.locator(".executivev2-direction")).toBeHidden();
  await expect(page.locator(".executivev2-organisation")).toBeHidden();
  await expect(page.locator(".executivev2-activity")).toBeHidden();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);

  const kpiColumns = await kpis.evaluate((node) => getComputedStyle(node).gridTemplateColumns.split(" ").length);
  expect(kpiColumns).toBe(2);

  await page.screenshot({
    path: "test-artifacts/vf5a-executive-reference-mobile-390.png",
    fullPage: true,
  });
  await context.close();
});

test("VF5B Executive Work and Ministry keep leadership records factual and role-specific", async () => {
  const work = fs.readFileSync("src/screens/ExecutiveWork.jsx", "utf8");
  const strategy = fs.readFileSync("src/screens/Strategy.jsx", "utf8");
  const css = fs.readFileSync("src/experience-v2/executive-overview/executive-surfaces.css", "utf8");
  const main = fs.readFileSync("src/main.jsx", "utf8");

  expect(work).toContain('eq("assigned_by", me.id)');
  expect(work).toContain('rpc("my_work_attention_queue")');
  expect(work).toContain("ev2-work-executive");
  expect(strategy).toContain('supabase.from("strategy_nodes")');
  expect(strategy).toContain('supabase.from("strategy_delivery_links")');
  expect(strategy).toContain("Descriptive objective — no percentage is generated.");
  expect(strategy).toContain("ev2-executive-ministry");
  expect(strategy).toContain("ev2ex-ministry-direction");
  expect(strategy).toContain("ev2ex-unit-objective");
  expect(css).toContain("/* VF5B — Executive Work / Ministry */");
  expect((css.match(/!important\\b/g) || []).length).toBe(0);

  const workCss = main.indexOf('import "./experience-v2/work-family/work-family.css";');
  const executiveSurfaceCss = main.indexOf('import "./experience-v2/executive-overview/executive-surfaces.css";');
  expect(workCss).toBeGreaterThan(-1);
  expect(executiveSurfaceCss).toBeGreaterThan(workCss);
});

for (const viewport of [
  { width: 390, height: 844, name: "phone-390" },
  { width: 1366, height: 768, name: "laptop-1366" },
]) {
  test(`VF5B Executive Work and Ministry compose as leadership surfaces at ${viewport.name}`, async ({ browser }) => {
    const { context, page } = await openExecutive(browser, { width: viewport.width, height: viewport.height });

    await page.goto("/?tab=work");
    await expect(page.locator(".ev2-work-executive")).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole("heading", { name: "Work", exact: true })).toBeVisible();
    const executiveTabs = page.getByRole("tablist", { name: "Executive work views" });
    await expect(executiveTabs).toBeVisible();
    await expect(executiveTabs.getByRole("tab", { name: /Given out/ })).toBeVisible();
    await expect(executiveTabs.getByRole("tab", { name: /For review/ })).toBeVisible();
    await expect(executiveTabs.getByRole("tab", { name: /My work/ })).toBeVisible();
    let overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    await page.screenshot({
      path: `test-artifacts/vf5b-executive-work-${viewport.name}.png`,
      fullPage: true,
    });

    const ids = {
      direction: "00000000-0000-4000-8000-000000000501",
      ministry: "00000000-0000-4000-8000-000000000502",
      unitObjective: "00000000-0000-4000-8000-000000000503",
      unit: "00000000-0000-4000-8000-000000000504",
      project: "00000000-0000-4000-8000-000000000505",
      link: "00000000-0000-4000-8000-000000000506",
    };
    await page.route("**/rest/v1/strategy_nodes*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            id: ids.direction,
            node_type: "ministry_direction",
            parent_id: null,
            unit_id: null,
            name: "Deepen ministry care and follow-up",
            statement: "Strengthen the ministry's follow-up discipline while keeping outcomes attributable to recorded work.",
            measurement_kind: "descriptive",
            measure_label: null,
            target_value: null,
            target_unit: null,
            current_value: null,
            starts_on: "2026-01-01",
            target_on: "2026-12-31",
            status: "active",
          },
          {
            id: ids.ministry,
            node_type: "ministry_objective",
            parent_id: ids.direction,
            unit_id: null,
            name: "Improve first-timer follow-up coverage",
            statement: "Create a consistent recorded follow-up path across ministry units.",
            measurement_kind: "descriptive",
            measure_label: null,
            target_value: null,
            target_unit: null,
            current_value: null,
            starts_on: "2026-07-01",
            target_on: "2026-12-31",
            status: "active",
          },
          {
            id: ids.unitObjective,
            node_type: "unit_objective",
            parent_id: ids.ministry,
            unit_id: ids.unit,
            name: "Complete recorded visitor follow-ups",
            statement: "Record completed first-timer follow-ups handled by the unit.",
            measurement_kind: "numeric",
            measure_label: "Recorded follow-ups",
            target_value: 600,
            target_unit: "people",
            current_value: 420,
            starts_on: "2026-07-01",
            target_on: "2026-12-31",
            status: "active",
          },
        ]),
      });
    });
    await page.route("**/rest/v1/strategy_delivery_links*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([{
          id: ids.link,
          org_id: "00000000-0000-4000-8000-000000000500",
          strategy_node_id: ids.unitObjective,
          project_id: ids.project,
          status: "active",
          change_reason: "Links the current follow-up delivery project.",
        }]),
      });
    });
    await page.route("**/rest/v1/projects*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([{
          id: ids.project,
          name: "First Timers follow-up system",
          lead_unit_id: ids.unit,
          status: "active",
        }]),
      });
    });
    await page.route("**/rest/v1/units*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([{
          id: ids.unit,
          name: "First Timers",
          code: "FT",
          active: true,
        }]),
      });
    });

    await page.goto("/?tab=strategy");
    await expect(page.locator(".ev2-executive-ministry")).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole("heading", { name: "Ministry direction & outcomes", exact: true })).toBeVisible();
    await expect(page.getByText("Ministry objectives", { exact: true })).toBeVisible();
    await expect(page.getByText("Ministry Direction · active", { exact: true })).toBeVisible();
    await expect(page.getByText("Ministry Objective · active", { exact: true })).toBeVisible();
    await expect(page.getByText("First Timers · Complete recorded visitor follow-ups", { exact: true })).toBeVisible();
    await expect(page.getByText(/current 420 people · target 600 people/i)).toBeVisible();
    await expect(page.getByText("First Timers follow-up system", { exact: true })).toBeVisible();
    overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);

    if (viewport.width <= 599) {
      const actionHeights = await page.locator(".ev2-executive-ministry .btn:visible").evaluateAll((buttons) =>
        buttons.map((button) => button.getBoundingClientRect().height)
      );
      for (const height of actionHeights) expect(height).toBeGreaterThanOrEqual(44);
    }

    await page.screenshot({
      path: `test-artifacts/vf5b-executive-ministry-${viewport.name}.png`,
      fullPage: true,
    });

    await context.close();
  });
}

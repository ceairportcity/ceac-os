import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

const password = process.env.ROLE_FIXTURE_PASSWORD;

const roles = [
  {
    key: "staff",
    email: "staff@ceac.local.test",
    app: ".staff-app",
    failPattern: "**/rest/v1/work_items*",
    loadingLabel: "Loading Today",
    errorTitle: "Today could not finish loading",
  },
  {
    key: "manager",
    email: "manager@ceac.local.test",
    app: ".manager-app",
    failPattern: "**/rest/v1/work_requests*",
    loadingLabel: "Loading Manager Overview",
    errorTitle: "Manager Overview could not finish loading",
  },
  {
    key: "administration",
    email: "admin@ceac.local.test",
    app: ".office-app",
    failPattern: "**/rest/v1/project_closes*",
    loadingLabel: "Loading Administration Overview",
    errorTitle: "Administration could not finish loading",
  },
  {
    key: "executive",
    email: "exec@ceac.local.test",
    app: ".executive-app",
    failPattern: "**/rest/v1/recurring_operations*",
    loadingLabel: "Loading Executive Overview",
    errorTitle: "Executive Overview could not finish loading",
  },
];

async function signIn(page, role) {
  await page.goto("/");
  await page.getByPlaceholder("Work email").fill(role.email);
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.locator(role.app)).toBeVisible({ timeout: 15000 });
  await page.evaluate(() => document.fonts.ready);
}

function emptyJson(route) {
  return route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify([]),
  });
}

test("VF9D shared product states stay explicit, truthful and recoverable", async () => {
  const app = readFileSync("src/App.jsx", "utf8");
  const interactions = readFileSync("src/experience-v2/components/Interactions.jsx", "utf8");
  const staff = readFileSync("src/experience-v2/staff-today/StaffTodayV2.jsx", "utf8");
  const manager = readFileSync("src/experience-v2/manager-overview/ManagerOverviewV2.jsx", "utf8");
  const administration = readFileSync("src/experience-v2/admin-overview/AdminOverviewV2.jsx", "utf8");
  const executive = readFileSync("src/experience-v2/executive-overview/ExecutiveOverviewV2.jsx", "utf8");
  const integrations = readFileSync("src/screens/AdminIntegrations.jsx", "utf8");
  const controlCenter = readFileSync("src/screens/ControlCenter.jsx", "utf8");

  expect(app).toContain("function RouteFallback()");
  expect(app).toContain('role="status"');
  expect(app).toContain('aria-live="polite"');
  expect(app).toContain('aria-busy="true"');

  for (const mapping of [
    'empty: "folder"',
    'error: "error"',
    'configuration: "settings"',
    'success: "checkCircle"',
    'info: "info"',
  ]) {
    expect(interactions).toContain(mapping);
  }
  expect(interactions).toContain('role={state === "error" ? "alert" : undefined}');
  expect(interactions).toContain('aria-live={state === "error" ? "assertive" : undefined}');
  expect(interactions).toContain('aria-atomic={state === "error" ? "true" : undefined}');

  for (const [source, label, title] of [
    [staff, "Loading Today", "Today could not finish loading"],
    [manager, "Loading Manager Overview", "Manager Overview could not finish loading"],
    [administration, "Loading Administration Overview", "Administration could not finish loading"],
    [executive, "Loading Executive Overview", "Executive Overview could not finish loading"],
  ]) {
    const loadingLine = source.split("\n").find((line) => line.includes(`aria-label="${label}"`)) || "";
    expect(loadingLine, label).toContain('role="status"');
    expect(loadingLine, label).toContain('aria-live="polite"');
    expect(loadingLine, label).toContain('aria-busy="true"');
    expect(source).toContain(`title="${title}"`);
    expect(source).toContain('actionLabel="Try again"');
  }

  expect(controlCenter).toContain('missing:"Not configured"');
  expect(integrations).toContain('state="configuration"');
  expect(integrations).toContain('title="No provider adapters are enabled"');
  expect(integrations).toContain('state="empty" title="No connection history yet"');
  expect(integrations).toContain('state="empty" title="No delivery attempts yet"');
});

test("VF9D role overview failures remain errors rather than fake empty data", async ({ browser }) => {
  test.setTimeout(180000);

  for (const role of roles) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    await signIn(page, role);

    await page.route(role.failPattern, async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ message: `VF9D fixture ${role.key} read failed` }),
      });
    });

    await page.goto("/?tab=home");
    const errorTitle = page.getByText(role.errorTitle, { exact: true });
    await expect(errorTitle).toBeVisible({ timeout: 15000 });
    const state = errorTitle.locator("xpath=ancestor::*[contains(@class,'ev2c-state-error')][1]");
    await expect(state).toHaveAttribute("role", "alert");
    await expect(state).toHaveAttribute("aria-live", "assertive");
    await expect(state.getByRole("button", { name: "Try again", exact: true })).toBeVisible();

    const overflow = await page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow, `${role.key} error-state overflow`).toBeLessThanOrEqual(1);

    await page.screenshot({
      path: `test-artifacts/vf9d-${role.key}-error-phone-390.png`,
      fullPage: true,
    });

    await context.close();
  }
});

for (const viewport of [
  { name: "phone-390", width: 390, height: 844 },
  { name: "laptop-1366", width: 1366, height: 768 },
]) {
  test(`VF9D Connected Apps distinguishes loading, configuration and empty history at ${viewport.name}`, async ({ browser }) => {
    test.setTimeout(120000);

    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
    });
    const page = await context.newPage();
    await signIn(page, roles[2]);

    await page.route("**/rest/v1/integration_provider_definitions*", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 6000));
      await emptyJson(route);
    });

    for (const table of [
      "integration_connectors",
      "integration_subscriptions",
      "platform_event_definitions",
      "integration_outbox",
      "integration_delivery_attempts",
      "integration_connection_events",
    ]) {
      await page.route(`**/rest/v1/${table}*`, emptyJson);
    }

    await page.goto("/?tab=integrations");
    const loading = page.locator('[aria-label="Loading Connected Apps"]');
    await expect(loading).toBeVisible({ timeout: 15000 });
    await expect(loading).toHaveAttribute("aria-busy", "true");
    await page.screenshot({
      path: `test-artifacts/vf9d-connected-apps-loading-${viewport.name}.png`,
      fullPage: true,
    });

    await expect(page.getByText("No provider adapters are enabled", { exact: true })).toBeVisible({ timeout: 15000 });
    const configuration = page.locator(".ev2c-state-configuration").filter({
      hasText: "No provider adapters are enabled",
    });
    await expect(configuration).toBeVisible();

    await page.getByRole("button", { name: "Advanced diagnostics", exact: true }).click();
    await expect(page.getByText("No connection history yet", { exact: true })).toBeVisible();
    await expect(page.getByText("No delivery attempts yet", { exact: true })).toBeVisible();

    const overflow = await page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow, `Connected Apps ${viewport.name} state overflow`).toBeLessThanOrEqual(1);

    await page.screenshot({
      path: `test-artifacts/vf9d-connected-apps-empty-configuration-${viewport.name}.png`,
      fullPage: true,
    });

    await context.close();
  });
}

// VF9D exact-head Level B checkpoint.

// VF10B final exact-head Level B release checkpoint.

// VF10B retry after documentation whitespace correction.

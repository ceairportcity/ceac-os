import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

const password = process.env.ROLE_FIXTURE_PASSWORD;

const roles = [
  { key: "staff", email: "staff@ceac.local.test", app: ".staff-app", primary: "Start work" },
  { key: "manager", email: "manager@ceac.local.test", app: ".manager-app", primary: "Give out work" },
  { key: "administration", email: "admin@ceac.local.test", app: ".office-app", primary: "Control Center" },
  { key: "executive", email: "exec@ceac.local.test", app: ".executive-app", primary: "Schedule meeting" },
];

async function signIn(page, role) {
  await page.goto("/");
  await page.getByPlaceholder("Work email").fill(role.email);
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.locator(role.app)).toBeVisible({ timeout: 15000 });
  await page.evaluate(() => document.fonts.ready);
}

function hexToRgb(hex) {
  const value = hex.replace("#", "");
  return [0, 2, 4].map((offset) => Number.parseInt(value.slice(offset, offset + 2), 16) / 255);
}

function luminance(hex) {
  const [r, g, b] = hexToRgb(hex).map((value) =>
    value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(foreground, background) {
  const a = luminance(foreground);
  const b = luminance(background);
  const light = Math.max(a, b);
  const dark = Math.min(a, b);
  return (light + 0.05) / (dark + 0.05);
}

function token(source, name) {
  const match = source.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`));
  if (!match) throw new Error(`Missing colour token --${name}`);
  return match[1];
}

test("VF9A accessibility semantics and accepted colour tokens remain explicit", async () => {
  const interactions = readFileSync("src/experience-v2/components/Interactions.jsx", "utf8");
  const staff = readFileSync("src/experience-v2/staff-today/StaffTodayV2.jsx", "utf8");
  const manager = readFileSync("src/experience-v2/manager-overview/ManagerOverviewV2.jsx", "utf8");
  const admin = readFileSync("src/experience-v2/admin-overview/AdminOverviewV2.jsx", "utf8");
  const executive = readFileSync("src/experience-v2/executive-overview/ExecutiveOverviewV2.jsx", "utf8");
  const foundation = readFileSync("src/experience-v2.css", "utf8");
  const shell = readFileSync("src/experience-v2/shell/shell.css", "utf8");
  const dataViz = readFileSync("src/experience-v2/data-viz/data-viz.css", "utf8");

  expect(interactions).toContain('role={state === "error" ? "alert" : undefined}');
  expect(interactions).toContain('aria-live={state === "error" ? "assertive" : undefined}');
  expect(interactions).toContain('aria-atomic={state === "error" ? "true" : undefined}');

  for (const [source, label] of [
    [staff, "Loading Today"],
    [manager, "Loading Manager Overview"],
    [admin, "Loading Administration Overview"],
    [executive, "Loading Executive Overview"],
  ]) {
    const loadingLine = source.split("\n").find((line) => line.includes(`aria-label="${label}"`)) || "";
    expect(loadingLine, label).toContain('role="status"');
    expect(loadingLine, label).toContain('aria-live="polite"');
    expect(loadingLine, label).toContain('aria-busy="true"');
  }

  expect(shell).toContain(":focus-visible");
  expect(foundation).toContain("--ev2-control-min: 2.75rem");
  expect(dataViz).not.toMatch(/font-size:\\s*(?:[0-9](?:\\.[0-9]+)?|1[01](?:\\.[0-9]+)?)px/);
  expect(dataViz).toContain("min-height: var(--ev2-control-min);");
  expect(foundation).toContain("@media (prefers-reduced-motion: reduce)");
  expect(foundation).toContain("--ev2-duration-fast: 0ms");

  const pairs = [
    ["ev2-text", "ev2-bg"],
    ["ev2-text-secondary", "ev2-bg"],
    ["ev2-text-tertiary", "ev2-surface"],
    ["ev2-action", "ev2-surface"],
    ["ev2-success", "ev2-success-soft"],
    ["ev2-warning", "ev2-warning-soft"],
    ["ev2-danger", "ev2-danger-soft"],
  ];

  for (const [foreground, background] of pairs) {
    expect(
      contrast(token(foundation, foreground), token(foundation, background)),
      `${foreground} on ${background}`
    ).toBeGreaterThanOrEqual(4.5);
  }
});

for (const role of roles) {
  test(`VF9A ${role.key} reflows at 320px and keeps primary touch targets reachable`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 320, height: 844 } });
    const page = await context.newPage();
    await signIn(page, role);

    await expect(page.locator(".ev2s-mobile-topbar")).toBeVisible();
    await expect(page.locator(".ev2s-mobile-nav")).toBeVisible();

    const geometry = await page.evaluate(() => ({
      htmlOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      bodyOverflow: document.body.scrollWidth - document.body.clientWidth,
    }));
    expect(geometry.htmlOverflow).toBeLessThanOrEqual(1);
    expect(geometry.bodyOverflow).toBeLessThanOrEqual(1);

    const navButtons = page.locator(".ev2s-mobile-nav button");
    expect(await navButtons.count()).toBe(role.key === "executive" ? 4 : 5);
    const navHeights = await navButtons.evaluateAll((nodes) =>
      nodes.map((node) => node.getBoundingClientRect().height)
    );
    expect(Math.min(...navHeights)).toBeGreaterThanOrEqual(44);

    const primary = role.key === "manager"
      ? page.locator(".fpg9-mobile-shortcuts").getByRole("button", { name: "Work", exact: true })
      : page.getByRole("button", { name: role.primary, exact: true }).first();
    await expect(primary).toBeVisible();
    const primaryBox = await primary.boundingBox();
    expect(primaryBox?.height || 0, `${role.key} primary touch target`).toBeGreaterThanOrEqual(44);

    await page.screenshot({
      path: `test-artifacts/vf9a-${role.key}-reflow-phone-320.png`,
      fullPage: true,
    });
    await context.close();
  });
}

test("VF9A keyboard navigation exposes a visible focus indicator in the desktop command layer", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const page = await context.newPage();
  await signIn(page, roles[1]);

  await page.locator("body").click({ position: { x: 800, y: 700 } });

  let foundVisibleIndicator = false;
  let focusableCount = 0;

  for (let index = 0; index < 14; index += 1) {
    await page.keyboard.press("Tab");
    const state = await page.evaluate(() => {
      const active = document.activeElement;
      if (!active || active === document.body) return { focusable: false, visible: false, indicator: false };
      const rect = active.getBoundingClientRect();
      const visible = rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.right > 0 &&
        rect.top < window.innerHeight && rect.left < window.innerWidth;
      const nodes = [active, active.parentElement, active.parentElement?.parentElement].filter(Boolean);
      const indicator = nodes.some((node) => {
        const style = getComputedStyle(node);
        const outline = parseFloat(style.outlineWidth) > 0 && style.outlineStyle !== "none";
        const shadow = style.boxShadow && style.boxShadow !== "none";
        return outline || shadow;
      });
      return { focusable: true, visible, indicator };
    });

    if (state.focusable && state.visible) focusableCount += 1;
    if (state.indicator) {
      foundVisibleIndicator = true;
      break;
    }
  }

  expect(focusableCount).toBeGreaterThan(0);
  expect(foundVisibleIndicator).toBe(true);

  await page.screenshot({
    path: "test-artifacts/vf9a-manager-focus-laptop-1366.png",
    fullPage: false,
  });
  await context.close();
});

import fs from "node:fs";
import { test, expect } from "@playwright/test";
import { getShellNavigation, groupDestinations } from "../src/experience-v2/shell/navigation.js";

const password = process.env.ROLE_FIXTURE_PASSWORD;

const roles = [
  {
    key: "staff",
    email: "staff@ceac.local.test",
    app: ".staff-app",
    context: { isAdmin: false, isExec: false, isManager: false, me: { capabilities: [] } },
    destinations: [
      ["home", "Today"],
      ["work", "Work"],
      ["team", "Team"],
      ["attendance", "Time & Leave"],
      ["staff-calendar", "Calendar"],
      ["messages", "Messages"],
      ["me", "My Hub"],
      ["account", "Your account"],
      ["technical-help", "Get technical help"],
    ],
    primary: [
      ["home", "Today"],
      ["work", "Work"],
      ["team", "Team"],
      ["me", "My Hub"],
    ],
    secondary: [
      ["attendance", "Time & Leave"],
      ["staff-calendar", "Calendar"],
      ["messages", "Messages"],
      ["account", "Your account"],
      ["technical-help", "Get technical help"],
    ],
  },
  {
    key: "manager",
    email: "manager@ceac.local.test",
    app: ".manager-app",
    context: { isAdmin: false, isExec: false, isManager: true, me: { capabilities: [] } },
    destinations: [
      ["home", "Overview"],
      ["work", "Work"],
      ["team", "Team"],
      ["projects", "Projects"],
      ["attendance", "Time & Leave"],
      ["calendar", "Calendar"],
      ["manager-finance", "Finance"],
      ["manager-reports", "Reports"],
      ["messages", "Messages"],
      ["me", "My Hub"],
      ["account", "Your account"],
      ["technical-help", "Get technical help"],
    ],
    primary: [
      ["home", "Overview"],
      ["work", "Work"],
      ["team", "Team"],
      ["projects", "Projects"],
    ],
    secondary: [
      ["attendance", "Time & Leave"],
      ["calendar", "Calendar"],
      ["manager-finance", "Finance"],
      ["manager-reports", "Reports"],
      ["messages", "Messages"],
      ["me", "My Hub"],
      ["account", "Your account"],
      ["technical-help", "Get technical help"],
    ],
  },
  {
    key: "admin",
    email: "admin@ceac.local.test",
    app: ".office-app",
    context: {
      isAdmin: true,
      isExec: false,
      isManager: false,
      me: { capabilities: ["people.manage", "payroll.prepare", "performance.admin", "learning.manage", "compliance.manage"], capability_grants: ["performance.admin", "learning.manage", "compliance.manage"].map(capability=>({capability,scope_unit_id:null})) },
    },
    destinations: [
      ["home", "Overview"],
      ["people", "People & Access"],
      ["work", "Work"],
      ["admin-projects", "Projects"],
      ["attendance", "Time & Leave"],
      ["admin-calendar", "Calendar"],
      ["finance", "Finance"],
      ["payroll", "Payroll"],
      ["reporting", "Reports"],
      ["performance", "Reviews & Development"],
      ["learning", "Learning"],
      ["settings", "Control Center"],
      ["messages", "Messages"],
      ["me", "My Hub"],
      ["account", "Your account"],
      ["technical-help", "Get technical help"],
    ],
    primary: [
      ["home", "Overview"],
      ["people", "People & Access"],
      ["attendance", "Time & Leave"],
      ["finance", "Finance"],
    ],
    secondary: [
      ["work", "Work"],
      ["admin-projects", "Projects"],
      ["admin-calendar", "Calendar"],
      ["payroll", "Payroll"],
      ["reporting", "Reports"],
      ["performance", "Reviews & Development"],
      ["learning", "Learning"],
      ["settings", "Control Center"],
      ["messages", "Messages"],
      ["me", "My Hub"],
      ["account", "Your account"],
      ["technical-help", "Get technical help"],
    ],
  },
  {
    key: "executive",
    email: "exec@ceac.local.test",
    app: ".executive-app",
    context: { isAdmin: false, isExec: true, isManager: false, me: { capabilities: ["payroll.approve"] } },
    destinations: [
      ["home", "Overview"],
      ["work", "Work"],
      ["strategy", "Ministry"],
      ["delivery", "Portfolio"],
      ["exec-organisation", "Organisation"],
      ["exec-calendar", "Calendar"],
      ["exec-finance", "Finance"],
      ["payroll", "Payroll"],
      ["exec-reports", "Reports"],
      ["messages", "Messages"],
      ["me", "My Hub"],
      ["account", "Account"],
      ["technical-help", "Get technical help"],
    ],
    primary: [
      ["home", "Overview"],
      ["work", "Work"],
      ["strategy", "Ministry"],
    ],
    secondary: [
      ["delivery", "Portfolio"],
      ["exec-organisation", "Organisation"],
      ["exec-calendar", "Calendar"],
      ["exec-finance", "Finance"],
      ["payroll", "Payroll"],
      ["exec-reports", "Reports"],
      ["messages", "Messages"],
      ["me", "My Hub"],
      ["account", "Account"],
      ["technical-help", "Get technical help"],
    ],
  },
];

test.describe.configure({ mode: "serial" });

async function signIn(page, role) {
  await page.goto("/");
  await page.getByPlaceholder("Work email").fill(role.email);
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.locator(role.app)).toBeVisible({ timeout: 15000 });
}

async function expectRoute(page, key) {
  await expect(page.locator(key === "messages" ? ".msg-workspace" : ".body").first()).toBeVisible({ timeout: 15000 });
  const url = new URL(page.url());
  if (key === "home") {
    expect(url.searchParams.has("tab")).toBe(false);
  } else {
    expect(url.searchParams.get("tab")).toBe(key);
  }
}

test("Stage 4D approved destination model matches the runtime route contract", async () => {
  const app = fs.readFileSync("src/App.jsx", "utf8");

  for (const role of roles) {
    const actual = getShellNavigation(role.context).map((item) => [item.key, item.label]);
    expect(actual, role.key + " raw navigation").toEqual(role.destinations);
    // The sidebar consumes grouped navigation, not just the raw model.
    const groups = groupDestinations(getShellNavigation(role.context));
    const grouped = groups.flatMap((group) => group.items.map((item) => [item.key, item.label]));
    expect(grouped, role.key + " rendered order").toEqual(role.destinations);
    const expectedSections = {
      staff: ["workspace", "planning", "communication", "account"],
      manager: ["workspace", "planning", "insight", "communication", "account"],
      admin: ["workspace", "planning", "insight", "system", "communication", "account"],
      executive: ["workspace", "planning", "insight", "communication", "account"],
    };
    expect(groups.map((group) => group.key), role.key + " section order").toEqual(expectedSections[role.key]);

    for (const [key] of role.destinations) {
      if (key === "me") continue;
      expect(app, `${role.key} route ${key}`).toContain(`tab === "${key}"`);
    }
  }

  expect(app).toContain("return <MeScreen");
  expect(app).toContain('tab === "primitives" && isAdmin');
  for (const role of roles) {
    expect(role.destinations.map(([, label]) => label)).not.toContain("Primitives");
  }
});

test("Stage 4D every authorised desktop destination is reachable for all four roles", async ({ browser }) => {
  test.setTimeout(240000);

  for (const role of roles) {
    const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    const page = await context.newPage();
    await signIn(page, role);

    const sidebar = page.locator(".ev2s-sidebar");
    const nav = sidebar.locator(".ev2s-sidebar-nav");
    await expect(sidebar).toBeVisible();

    const labels = await nav.locator("button span").allTextContents();
    expect(labels.map((label) => label.trim()), role.key).toEqual(
      role.destinations.map(([, label]) => label)
    );

    for (const [key, label] of role.destinations) {
      const button = nav.getByRole("button", { name: label, exact: true });
      await expect(button).toBeVisible();
      await button.click();
      await expect(button).toHaveAttribute("aria-current", "page");
      await expectRoute(page, key);

      const overflow = await page.evaluate(() =>
        document.documentElement.scrollWidth - document.documentElement.clientWidth
      );
      expect(overflow, `${role.key} / ${label} desktop overflow`).toBeLessThanOrEqual(1);
    }

    await nav.getByRole("button", { name: role.destinations[0][1], exact: true }).click();
    await expectRoute(page, "home");
    await page.screenshot({
      path: `test-artifacts/redesign-r7-stage4d-${role.key}-desktop-nav.png`,
      fullPage: true,
    });
    await context.close();
  }
});

test("Stage 4D mobile primary and More destinations remain reachable and role-specific", async ({ browser }) => {
  test.setTimeout(240000);

  for (const role of roles) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    await signIn(page, role);

    const mobileNav = page.locator(".ev2s-mobile-nav");
    await expect(mobileNav).toBeVisible();
    await expect(mobileNav.getByRole("button")).toHaveCount(role.key === "executive" ? 4 : 5);

    const visiblePrimary = await mobileNav.locator("button span").allTextContents();
    expect(visiblePrimary.map((label) => label.trim()), role.key).toEqual([
      ...role.primary.map(([, label]) => label),
      "More",
    ]);

    for (const [key, label] of role.primary) {
      const button = mobileNav.locator("button").filter({ hasText: label });
      await expect(button).toHaveCount(1);
      await button.click();
      await expectRoute(page, key);
      await expect(button).toHaveAttribute("aria-current", "page");
    }

    const more = mobileNav.getByRole("button", { name: "More", exact: true });
    await more.click();
    let drawer = page.getByRole("dialog", { name: "More" });
    await expect(drawer).toBeVisible();

    const secondaryLabels = await drawer.locator(".ev2s-more-group button span").allTextContents();
    expect(secondaryLabels.map((label) => label.trim()), role.key).toEqual(
      [...role.secondary.map(([, label]) => label), "CEAC Guide"]
    );

    await page.screenshot({
      path: `test-artifacts/redesign-r7-stage4d-${role.key}-mobile-more.png`,
      fullPage: false,
    });

    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden();
    await expect(more).toBeFocused();

    for (const [key, label] of role.secondary) {
      await more.click();
      drawer = page.getByRole("dialog", { name: "More" });
      await expect(drawer).toBeVisible();

      const destination = drawer.getByRole("button", { name: label, exact: true });
      await expect(destination).toBeVisible();
      await destination.click();
      await expect(drawer).toBeHidden();
      await expectRoute(page, key);
      await expect(more).toHaveClass(/is-active/);

      const overflow = await page.evaluate(() =>
        document.documentElement.scrollWidth - document.documentElement.clientWidth
      );
      expect(overflow, `${role.key} / ${label} mobile overflow`).toBeLessThanOrEqual(1);
    }

    await context.close();
  }
});

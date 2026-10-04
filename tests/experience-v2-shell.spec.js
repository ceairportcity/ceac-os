import fs from "node:fs";
import { test, expect } from "@playwright/test";

const password = process.env.ROLE_FIXTURE_PASSWORD;

test.describe.configure({ mode: "serial" });

test("Stage 4B shell is isolated, tokenized and wired through App", async () => {
  for (const path of [
    "src/experience-v2/shell/navigation.js",
    "src/experience-v2/shell/ShellV2.jsx",
    "src/experience-v2/shell/shell.css",
    "src/experience-v2/shell/index.js",
  ]) {
    expect(fs.existsSync(path), path).toBeTruthy();
  }

  const shell = fs.readFileSync("src/experience-v2/shell/ShellV2.jsx", "utf8");
  const navigation = fs.readFileSync("src/experience-v2/shell/navigation.js", "utf8");
  const css = fs.readFileSync("src/experience-v2/shell/shell.css", "utf8");
  const app = fs.readFileSync("src/App.jsx", "utf8");
  const main = fs.readFileSync("src/main.jsx", "utf8");

  expect(shell).toContain('from "../icons"');
  expect(shell).toContain("Drawer");
  expect(shell).toContain("PopoverMenu");
  expect(shell).toContain("getShellQuickActions");
  expect(shell).toContain("ev2s-sidebar-main");
  expect(shell).not.toContain("function createMenuItems");
  expect(shell).not.toContain("components/primitives/Icon");
  expect(shell).not.toContain("components/PremiumShell");

  expect(navigation).toContain('capability: "people.manage"');
  expect(navigation).toContain("const ROLE_QUICK_ACTIONS");
  expect(navigation).toContain("export function getShellQuickActions");
  expect(navigation).not.toContain('key: "primitives"');

  expect((css.match(/!important\b/g) || []).length).toBe(0);
  for (const forbidden of [
    ".staff-app",
    ".manager-app",
    ".office-app",
    ".executive-app",
    ".premium-side",
    ".premium-topbar",
    ".premium-tabs",
  ]) {
    expect(css.includes(forbidden), forbidden).toBeFalsy();
  }
  expect(css).toContain("var(--ev2-shell)");
  expect(css).toContain("var(--ev2-action)");
  expect(css).toContain("var(--ev2-control-min)");

  expect(app).toContain('from "./experience-v2/shell"');
  expect(app).not.toContain('from "./components/PremiumShell"');
  expect(app).not.toContain('className="app-workspace"');
  expect(app).not.toContain('className="mobile-unit-switch"');
  expect(app).toContain("onCreateWork={(isManager || isExec)");

  const componentCss = main.indexOf('import "./experience-v2/components/components.css";');
  const shellCss = main.indexOf('import "./experience-v2/shell/shell.css";');
  expect(componentCss).toBeGreaterThan(-1);
  expect(shellCss).toBeGreaterThan(componentCss);
});

async function signIn(page, email) {
  await page.goto("/");
  await page.getByPlaceholder("Work email").fill(email);
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.locator(".app")).toBeVisible({ timeout: 15000 });
}

test("Stage 4B desktop shell exposes only authorised production destinations", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await signIn(page, "admin@ceac.local.test");

  const sidebar = page.locator(".ev2s-sidebar");
  await expect(sidebar).toBeVisible();
  await expect(sidebar.getByRole("button", { name: "Overview", exact: true })).toBeVisible();
  await expect(sidebar.getByRole("button", { name: "People", exact: true })).toBeVisible();
  await expect(sidebar.getByRole("button", { name: "Time & Leave", exact: true })).toBeVisible();
  await expect(sidebar.getByRole("button", { name: "Control Center", exact: true })).toBeVisible();
  await expect(sidebar.getByRole("button", { name: "Primitives", exact: true })).toHaveCount(0);
  await expect(page.getByPlaceholder("Find a destination…")).toBeVisible();

  const geometry = await page.evaluate(() => {
    const nav = document.querySelector(".ev2s-sidebar-nav");
    return {
      documentOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      sidebarOverflow: document.querySelector(".ev2s-sidebar")?.scrollWidth - document.querySelector(".ev2s-sidebar")?.clientWidth,
      navOverflowY: nav ? getComputedStyle(nav).overflowY : "",
    };
  });

  expect(geometry.documentOverflow).toBeLessThanOrEqual(1);
  expect(geometry.sidebarOverflow).toBeLessThanOrEqual(1);
  expect(["auto", "scroll"]).toContain(geometry.navOverflowY);
});

test("Manager shell exposes Time & Leave as a first-class destination", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await signIn(page, "manager@ceac.local.test");

  const sidebar = page.locator(".ev2s-sidebar");
  const timeLeave = sidebar.getByRole("button", { name: "Time & Leave", exact: true });
  await expect(timeLeave).toBeVisible();
  await timeLeave.click();
  await expect(page.locator(".ev2-workforce-manager")).toBeVisible({ timeout: 15000 });
  await expect(page.getByText("Manager approval → Administration final approval", { exact: false }).first()).toBeVisible();
});

test("Stage 4B create menu exposes only role-authorised shortcuts", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await signIn(page, "staff@ceac.local.test");

  const create = page.getByRole("button", { name: "Create", exact: true });
  await expect(create).toBeVisible();
  await create.click();

  const menu = page.getByRole("menu");
  await expect(menu).toBeVisible();
  await expect(menu.getByRole("menuitem", { name: "New work", exact: true })).toHaveCount(0);
  await expect(menu.getByRole("menuitem", { name: "Meeting", exact: true })).toBeVisible();
  await expect(menu.getByRole("menuitem", { name: "Message room", exact: true })).toBeVisible();
});

test("OCR2 Executive Create exposes authorised leadership actions", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await signIn(page, "exec@ceac.local.test");

  const create = page.getByRole("button", { name: "Create", exact: true });
  await create.click();
  let menu = page.getByRole("menu");
  await expect(menu.getByRole("menuitem", { name: "Give out work", exact: true })).toBeVisible();
  await expect(menu.getByRole("menuitem", { name: "Ministry objective", exact: true })).toBeVisible();
  await expect(menu.getByRole("menuitem", { name: "Announcement", exact: true })).toBeVisible();
  await expect(menu.getByRole("menuitem", { name: "Meeting", exact: true })).toBeVisible();
  await expect(menu.getByRole("menuitem", { name: "Message room", exact: true })).toBeVisible();
  await expect(menu.getByRole("menuitem", { name: "Project", exact: true })).toHaveCount(0);

  await menu.getByRole("menuitem", { name: "Ministry objective", exact: true }).click();
  let dialog = page.getByRole("dialog", { name: "New ministry objective" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("Strategy parent direction")).toBeVisible();
  await dialog.getByRole("button", { name: "Close", exact: true }).click();

  await create.click();
  menu = page.getByRole("menu");
  await menu.getByRole("menuitem", { name: "Announcement", exact: true }).click();
  dialog = page.getByRole("dialog", { name: "New announcement" });
  await expect(dialog).toBeVisible();
});

test("Stage 4B mobile shell keeps five controls and uses the shared More drawer", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page, "staff@ceac.local.test");

  await expect(page.locator(".ev2s-mobile-topbar")).toBeVisible();
  const mobileNav = page.locator(".ev2s-mobile-nav");
  await expect(mobileNav).toBeVisible();
  await expect(mobileNav.getByRole("button")).toHaveCount(5);

  await mobileNav.getByRole("button", { name: "More", exact: true }).click();
  const drawer = page.getByRole("dialog", { name: "More" });
  await expect(drawer).toBeVisible();
  await expect(drawer.getByRole("button", { name: "Calendar", exact: true })).toBeVisible();
  await expect(drawer.getByRole("button", { name: "Time & Leave", exact: true })).toBeVisible();
  await expect(drawer.getByRole("button", { name: "Messages", exact: true })).toBeVisible();
  await expect(drawer.getByRole("button", { name: "Your account", exact: true })).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(drawer).toBeHidden();
  await expect(mobileNav.getByRole("button", { name: "More", exact: true })).toBeFocused();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  expect(overflow).toBeLessThanOrEqual(1);
});

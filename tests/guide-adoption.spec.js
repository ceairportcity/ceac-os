import fs from "node:fs";
import { test, expect } from "@playwright/test";

const password = process.env.ROLE_FIXTURE_PASSWORD;

async function signIn(page, email) {
  await page.goto("/");
  await page.getByPlaceholder("Work email").fill(email);
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.locator(".app")).toBeVisible({ timeout: 15000 });
}

test.describe.configure({ mode: "serial" });

test("CEAC Guide is static, versioned and does not create a data client", async () => {
  const content = fs.readFileSync("src/guide/guideContent.js", "utf8");
  const screen = fs.readFileSync("src/screens/Guide.jsx", "utf8");

  expect(content).toContain('CEAC_GUIDE_VERSION = "2026.10.23"');
  expect(content).toContain("24 working days per leave year");
  expect(content).toContain("Technical Support should diagnose");
  expect(screen).not.toContain("supabase");
  expect(content).not.toContain("supabase.from");
  expect(content).not.toContain("localStorage");
  expect(screen).toContain("ceac-guide-progress:");
  expect(screen).toContain("GUIDE_PROGRESS_TTL_MS");
  expect(screen).not.toContain("sessionStorage");
});

test("desktop Guide sits above the profile and supports role-aware search", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await signIn(page, "staff@ceac.local.test");

  const guide = page.getByRole("button", { name: "CEAC Guide", exact: true });
  const profile = page.locator(".ev2s-sidebar-profile");
  await expect(guide).toBeVisible();
  await expect(profile).toBeVisible();

  const order = await page.evaluate(() => {
    const guideNode = document.querySelector(".ev2s-sidebar-guide");
    const profileNode = document.querySelector(".ev2s-sidebar-profile");
    return {
      guideBottom: guideNode?.getBoundingClientRect().bottom || 0,
      profileTop: profileNode?.getBoundingClientRect().top || 0,
    };
  });
  expect(order.guideBottom).toBeLessThanOrEqual(order.profileTop + 1);

  await guide.click();
  await expect(page.getByRole("heading", { name: "Help that matches your work" })).toBeVisible();
  await expect(page.getByText("CEAC Guide · Staff", { exact: true })).toBeVisible();

  const search = page.getByPlaceholder("Search the CEAC Guide…");
  await search.fill("annual leave");
  await expect(page.getByRole("button", { name: /Time & Leave/ }).first()).toBeVisible();
  await expect(page.getByText("24 working days per leave year", { exact: false })).toBeVisible();

  await search.fill("People & Access");
  await expect(page.getByText("No guide topic matches that search.", { exact: false })).toBeVisible();
});

test("contextual help prioritises the page the user came from", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await signIn(page, "staff@ceac.local.test");

  await page.locator(".ev2s-sidebar").getByRole("button", { name: "Time & Leave", exact: true }).click();
  await expect(page.locator(".ev2-workforce-staff")).toBeVisible({ timeout: 15000 });
  await page.getByRole("button", { name: "Help for this page", exact: true }).click();

  await expect(page.getByText("Help for Time & Leave.", { exact: false })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Time & Leave", exact: true })).toBeVisible();
});

test("Administration Guide exposes People & Access guidance", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await signIn(page, "admin@ceac.local.test");

  await page.getByRole("button", { name: "CEAC Guide", exact: true }).click();
  await page.getByPlaceholder("Search the CEAC Guide…").fill("People & Access");
  await expect(page.getByRole("button", { name: /People & Access/ }).first()).toBeVisible();
  await expect(page.getByText("One person, one account", { exact: true })).toBeVisible();
});

test("mobile Guide is available under More without widening the viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page, "staff@ceac.local.test");

  await page.locator(".ev2s-mobile-nav").getByRole("button", { name: "More", exact: true }).click();
  const drawer = page.getByRole("dialog", { name: "More" });
  await expect(drawer.getByRole("button", { name: "CEAC Guide", exact: true })).toBeVisible();
  await drawer.getByRole("button", { name: "CEAC Guide", exact: true }).click();

  await expect(page.getByRole("heading", { name: "Help that matches your work" })).toBeVisible();
  const overflow = await page.evaluate(() => ({
    document: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    body: document.body.scrollWidth - document.body.clientWidth,
  }));
  expect(overflow.document).toBeLessThanOrEqual(1);
  expect(overflow.body).toBeLessThanOrEqual(1);
});

test("Getting Started progress resumes and can be dismissed without storing business data", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await signIn(page, "staff@ceac.local.test");

  await page.getByRole("button", { name: "CEAC Guide", exact: true }).click();
  const checklist = page.getByRole("region", { name: "Getting Started checklist" });
  await expect(checklist).toBeVisible();

  const first = checklist.locator('input[type="checkbox"]').first();
  await first.check();
  await expect(checklist.getByText("1 of 6 complete", { exact: true })).toBeVisible();

  const stored = await page.evaluate(() => {
    const key = Object.keys(localStorage).find((item) => item.startsWith("ceac-guide-progress:"));
    return key ? JSON.parse(localStorage.getItem(key)) : null;
  });
  expect(stored?.completed?.length).toBe(1);
  expect(stored?.version).toBe("2026.10.07");
  expect(stored?.expiresAt).toBeGreaterThan(Date.now());
  expect(Object.keys(stored || {}).sort()).toEqual(["completed","dismissed","expiresAt","role","version"].sort());

  await checklist.getByRole("button", { name: "Dismiss", exact: true }).click();
  await expect(page.getByText("Getting Started is hidden.", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText("Getting Started is hidden.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Show checklist", exact: true }).click();
  await expect(page.getByRole("region", { name: "Getting Started checklist" })).toBeVisible();
});

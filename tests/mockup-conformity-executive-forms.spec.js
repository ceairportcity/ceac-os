import { test, expect } from "@playwright/test";

const password = process.env.ROLE_FIXTURE_PASSWORD;

async function signInExecutive(page) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.getByPlaceholder("Work email").fill("exec@ceac.local.test");
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.locator(".executive-app")).toBeVisible({ timeout: 15000 });
}

// The owner-approved Executive shell has no global Create button. The three
// locked narrow composers remain available at their authorised destinations.
async function openCreate(page, label) {
  const routes = {
    "Give out work": ["work", "Give out work"],
    "Ministry objective": ["strategy", "New Ministry Objective"],
    Announcement: ["announcements", "New announcement"],
  };
  const route = routes[label];
  if (!route) throw new Error("No approved Executive destination for " + label);
  await page.goto("/?tab=" + route[0]);
  await expect(page.locator(".executive-app")).toBeVisible();
  await page.getByRole("button", { name: route[1], exact: true }).first().click();
  if (label === "Give out work") await page.getByRole("combobox", { name: "Assignment department" }).selectOption("20000000-0000-4000-8000-000000000011");
}

test.describe.configure({ mode: "serial" });

test("owner mockup: Executive Overview uses compact briefing composition", async ({ page }) => {
  await signInExecutive(page);
  await expect(page.locator(".executivev2-hero h2")).toContainText(/Good (morning|afternoon|evening), Executive Fixture/);
  await expect(page.locator(".executivev2-kpis .executivev2-kpi")).toHaveCount(4);
  await expect(page.locator(".executivev2-attention")).toBeVisible();
  await expect(page.locator(".executivev2-direction")).toBeVisible();
  await expect(page.locator(".executivev2-organisation")).toBeVisible();
  await expect(page.locator(".executivev2-activity")).toBeVisible();
  await expect(page.locator(".executivev2-meetings")).toBeVisible();

  await expect(page.getByText("Executive Dashboard", { exact: true })).toBeVisible();
  await expect(page.getByText("Volunteers", { exact: true })).toBeVisible();
  await expect(page.getByText("Ministry Objectives", { exact: true })).toBeVisible();
  await expect(page.getByText("Upcoming Meetings", { exact: true })).toBeVisible();
  await expect(page.getByText("Reports / Actions", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);

  await page.screenshot({ path: "test-artifacts/mockup-conformity-executive-home-1440.png", fullPage: true });
});

test("owner mockup: Give out work is a narrow progressive composer", async ({ page }) => {
  await signInExecutive(page);
  await openCreate(page, "Give out work");
  const dialog = page.getByRole("dialog", { name: "Give out work" });
  await expect(dialog).toBeVisible();
  const primary = dialog.locator('.ev2c-overlay-footer .btn').first();
  expect(await primary.evaluate(node => getComputedStyle(node).backgroundColor)).toBe('rgb(113, 72, 232)');
  expect(await primary.evaluate(node => getComputedStyle(node).backgroundImage)).toBe('none');
  await expect(dialog.locator(".reference-kind-row")).toBeVisible();
  await expect(dialog.getByText("What needs doing *", { exact: true })).toBeVisible();
  await expect(dialog.getByText("Assignee *", { exact: true })).toBeVisible();
  await expect(dialog.getByText("Due date *", { exact: true })).toBeVisible();
  await expect(dialog.getByText("Project", { exact: true })).toBeVisible();
  await expect(dialog.getByText("Team", { exact: true })).toBeVisible();
  await expect(dialog.getByText("Why this matters *", { exact: true })).toBeVisible();
  await expect(dialog.getByText("Attachments", { exact: true })).toBeVisible();
  await expect(dialog.getByText("Subtasks", { exact: true })).toBeVisible();
  await expect(dialog.getByText(/Instructions/)).toBeVisible();
  await expect(dialog.getByText(/Finished result/)).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Give it out", exact: true })).toBeVisible();

  const box = await dialog.boundingBox();
  expect(box?.width || 0).toBeGreaterThanOrEqual(340);
  expect(box?.width || 9999).toBeLessThanOrEqual(390);

  await page.screenshot({ path: "test-artifacts/mockup-conformity-give-out-work-1440.png", fullPage: true });
});

test("owner mockup: Ministry objective is compact and hierarchy-first", async ({ page }) => {
  await signInExecutive(page);
  await openCreate(page, "Ministry objective");
  const dialog = page.getByRole("dialog", { name: "New ministry objective" });
  await expect(dialog).toBeVisible();
  const primary = dialog.locator('.ev2c-overlay-footer .btn').first();
  expect(await primary.evaluate(node => getComputedStyle(node).backgroundColor)).toBe('rgb(113, 72, 232)');
  expect(await primary.evaluate(node => getComputedStyle(node).backgroundImage)).toBe('none');
  await expect(dialog.getByText("Objective name *", { exact: true })).toBeVisible();
  await expect(dialog.getByText("Statement *", { exact: true })).toBeVisible();
  await expect(dialog.getByText("Measurement *", { exact: true })).toBeVisible();
  await expect(dialog.getByText("Starts on", { exact: true })).toBeVisible();
  await expect(dialog.getByText("Target date", { exact: true })).toBeVisible();
  await expect(dialog.getByText("Status", { exact: true })).toBeVisible();
  await expect(dialog.getByText(/Ministry direction/)).toBeVisible();
  await expect(dialog.getByText(/Reason \/ context/)).toBeVisible();

  const box = await dialog.boundingBox();
  expect(box?.width || 0).toBeGreaterThanOrEqual(340);
  expect(box?.width || 9999).toBeLessThanOrEqual(390);

  await page.screenshot({ path: "test-artifacts/mockup-conformity-ministry-objective-1440.png", fullPage: true });
});

test("owner mockup: Announcement uses audience pills and progressive options", async ({ page }) => {
  await signInExecutive(page);
  await openCreate(page, "Announcement");
  const dialog = page.getByRole("dialog", { name: "New announcement" });
  await expect(dialog).toBeVisible();
  const primary = dialog.locator('.ev2c-overlay-footer .btn').first();
  expect(await primary.evaluate(node => getComputedStyle(node).backgroundColor)).toBe('rgb(113, 72, 232)');
  expect(await primary.evaluate(node => getComputedStyle(node).backgroundImage)).toBe('none');
  await expect(dialog.getByText("Title *", { exact: true })).toBeVisible();
  await expect(dialog.getByText("Audience *", { exact: true })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Everyone", exact: true })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Select departments", exact: true })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Select roles", exact: true })).toBeVisible();
  await expect(dialog.getByText("Message *", { exact: true })).toBeVisible();
  await expect(dialog.getByText("Attachments", { exact: true })).toBeVisible();
  await expect(dialog.getByText("Available until (optional)", { exact: true })).toBeVisible();
  await expect(dialog.getByText("More options", { exact: true })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Save draft", exact: true })).toBeVisible();

  const box = await dialog.boundingBox();
  expect(box?.width || 0).toBeGreaterThanOrEqual(340);
  expect(box?.width || 9999).toBeLessThanOrEqual(390);

  await page.screenshot({ path: "test-artifacts/mockup-conformity-announcement-1440.png", fullPage: true });
});

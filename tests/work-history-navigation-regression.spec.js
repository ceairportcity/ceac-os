import { expect, test } from "@playwright/test";

// Regression for the exact Staff failure in the PR #34 full application run.
// A slow authorised work-history read must not erase the destination heading
// after navigation. These scenarios run in isolated browser contexts; they
// do not write employee data, relax assertions or invent returned history.
const password = process.env.ROLE_FIXTURE_PASSWORD;

async function openStaffHistory(browser, viewport, intercept) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  await page.goto("/");
  await page.getByPlaceholder("Work email").fill("staff@ceac.local.test");
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.locator(".staff-app")).toBeVisible({ timeout: 15000 });
  await page.goto("/?tab=me");
  await expect(page.getByRole("heading", { name: "My Hub", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "My work history", exact: true })).toBeVisible();
  await intercept(page);
  return { context, page };
}

for (const viewport of [
  { name: "phone", width: 390, height: 844 },
  { name: "desktop", width: 1366, height: 768 },
]) {
  test(`Staff Work History keeps its heading while an authorised read is still pending — ${viewport.name}`, async ({ browser }) => {
    let beginRequest;
    let releaseRequest;
    const requestStarted = new Promise((resolve) => { beginRequest = resolve; });
    const release = new Promise((resolve) => { releaseRequest = resolve; });
    const { context, page } = await openStaffHistory(browser, viewport, async (target) => {
      await target.route("**/rest/v1/work_items*", async (route) => {
        beginRequest();
        await release;
        await route.continue();
      });
    });
    try {
      await page.getByRole("button", { name: "My work history", exact: true }).click();
      await requestStarted;
      await expect(page).toHaveURL(/\?tab=record(?:&|$)/);
      await expect(page.getByRole("heading", { name: "My work history", exact: true })).toBeVisible();
      await expect(page.locator(".ev2-personal-record")).toBeVisible();
      await expect(page.getByRole("status", { name: "" }).filter({ hasText: "Loading your history" })).toBeVisible();
      releaseRequest();
      await expect(page.getByLabel("History month")).toBeVisible({ timeout: 15000 });
      await expect(page.getByLabel("History year")).toBeVisible();
    } finally {
      releaseRequest?.();
      await context.close();
    }
  });

  test(`Staff Work History retains its route and heading on a failed authorised read — ${viewport.name}`, async ({ browser }) => {
    const { context, page } = await openStaffHistory(browser, viewport, async (target) => {
      await target.route("**/rest/v1/work_items*", (route) => route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ code: "fixture_unavailable", message: "Temporary fixture outage" }),
      }));
    });
    try {
      await page.getByRole("button", { name: "My work history", exact: true }).click();
      await expect(page).toHaveURL(/\?tab=record(?:&|$)/);
      await expect(page.getByRole("heading", { name: "My work history", exact: true })).toBeVisible();
      await expect(page.getByRole("alert").filter({ hasText: "Could not load your record" })).toBeVisible({ timeout: 15000 });
      await expect(page.locator(".ev2-personal-record")).toBeVisible();
    } finally {
      await context.close();
    }
  });
}

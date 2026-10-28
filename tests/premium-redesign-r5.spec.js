import { test, expect } from "@playwright/test";

const password = process.env.ROLE_FIXTURE_PASSWORD;

async function openAs(browser, email, viewport = { width: 1440, height: 960 }) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  await page.goto("/");
  await page.getByPlaceholder("Work email").fill(email);
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.locator(".app")).toBeVisible({ timeout: 15000 });
  return { context, page };
}

test.describe("Premium redesign R5 Communication", () => {
  test("Manager can jump from Create straight into the current Unit Room", async ({ browser }) => {
    const { context, page } = await openAs(browser, "manager@ceac.local.test");
    await page.getByRole("button", { name: "Create", exact: true }).click();
    await page.getByRole("menuitem", { name: "Message room", exact: true }).click();
    await expect(page.locator(".room-screen")).toBeVisible();
    await expect(page.locator(".room-composer")).toBeVisible();
    await expect(page.getByText(/Work communication only/i)).toBeVisible();
    await page.screenshot({ path: "test-artifacts/redesign-r5-quick-room.png", fullPage: true });
    await context.close();
  });

  test("Messages remains contextual and does not introduce unrestricted DMs", async ({ browser }) => {
    const { context, page } = await openAs(browser, "staff@ceac.local.test");
    await page.locator(".ev2s-sidebar").getByRole("button", { name: "Messages", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Messages", exact: true })).toBeVisible();
    for (const label of ["Rooms", "Memos"]) {
      await expect(page.getByRole("navigation", {name:"Messages sections"}).getByRole("button", { name: label, exact: true })).toBeVisible();
    }
    await expect(page.getByRole("button", {name:"Direct Messages",exact:true})).toHaveCount(0);
    await expect(page.getByRole("searchbox", {name:"Search Rooms"})).toBeVisible();
    await page.screenshot({ path: "test-artifacts/redesign-r5-messages.png", fullPage: true });
    await context.close();
  });

  test("Meeting composer visibly offers Google Meet, Zoom and Other link", async ({ browser }) => {
    const { context, page } = await openAs(browser, "manager@ceac.local.test");
    await page.getByRole("button", { name: "Create", exact: true }).click();
    await page.getByRole("menuitem", { name: "Meeting", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Schedule meeting" });
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('option[value="google_meet"]')).toHaveText("Google Meet");
    await expect(dialog.locator('option[value="zoom"]')).toHaveText("Zoom");
    await expect(dialog.locator('option[value="external"]')).toHaveText("Other meeting link");
    await page.screenshot({ path: "test-artifacts/redesign-r5-meeting-providers.png", fullPage: true });
    await context.close();
  });
});

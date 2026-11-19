import { test, expect } from "@playwright/test";

const fixture = "/tests/fixtures/weekly-work-plan.html";

test("Executive tasks fit the available iPad pane and remember where Pastor left off", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto(fixture + "?view=project");
  await page.getByRole("tab", { name: /Tasks\s*1/ }).click();
  const pane = page.getByRole("region", { name: "Project tasks" });
  await expect(pane.getByText("Media Lead", { exact: false })).toBeVisible();
  await expect(pane.getByText("In progress", { exact: true })).toBeVisible();
  await expect(page.getByText("Other projects", { exact: true })).toBeHidden();
  expect(await pane.evaluate(node => node.scrollWidth)).toBeLessThanOrEqual(await pane.evaluate(node => node.clientWidth));
  await pane.getByRole("searchbox").fill("testimonies");
  await pane.getByRole("button", { name: /Film Jesus Sunday/ }).click();
  await page.getByRole("button", { name: "Back to project" }).click();
  await expect(pane.getByRole("searchbox")).toHaveValue("testimonies");
  await expect(pane.getByRole("button", { name: /Film Jesus Sunday/ })).toBeFocused();
  await pane.getByRole("button", { name: "Assign task" }).click();
  await expect(page.getByText("Assignment opened")).toBeVisible();
  await page.setViewportSize({ width: 1366, height: 1024 });
  await expect(page.getByText("Other projects", { exact: true })).toBeVisible();
});

test("A lead can add, complete, undo, link and share planned work", async ({ page }) => {
  await page.setViewportSize({ width: 820, height: 1180 });
  await page.goto(fixture);
  await page.getByRole("link", { name: /Media & Technical/ }).click();
  await page.getByRole("button", { name: "Add quick item" }).click();
  await page.getByRole("textbox", { name: "Item", exact: true }).fill("Confirm shoot location");
  await page.getByRole("button", { name: "Save item" }).click();
  await page.getByRole("button", { name: "Complete Confirm shoot location" }).click();
  await expect(page.getByRole("button", { name: "Undo completion for Confirm shoot location" })).toBeVisible();
  await page.getByRole("button", { name: "Undo completion for Confirm shoot location" }).click();
  await page.getByRole("combobox", { name: "Existing work" }).selectOption({ label: "Film Jesus Sunday testimonies" });
  await page.getByRole("button", { name: "Link work" }).click();
  await page.getByRole("button", { name: "Film Jesus Sunday testimonies" }).click();
  await expect(page.getByText("Linked work opened")).toBeVisible();
  await expect(page.getByRole("button", { name: /Complete Film Jesus Sunday/ })).toHaveCount(0);
  await page.getByRole("button", { name: "Share with Group Pastor" }).click();
  await expect(page.getByText("Plan shared with the Group Pastor. The memo has been sent.")).toBeVisible();
});

test("Pastor sees requests for a decision and can respond in the plan", async ({ page }) => {
  await page.goto(fixture + "?role=executive");
  const heading = page.getByRole("heading", { name: "Needs your attention" });
  await expect(heading).toBeVisible();
  await page.getByRole("link", { name: /Approve equipment request/ }).click();
  await page.getByRole("button", { name: "Respond" }).click();
  await page.getByRole("textbox", { name: "Decision response" }).fill("Go ahead.");
  await page.getByRole("button", { name: "Send response" }).click();
  await expect(page.getByText("Go ahead.", { exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: "Add quick item" })).toHaveCount(0);
});

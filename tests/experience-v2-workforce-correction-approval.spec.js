import { expect, test } from "@playwright/test";

/**
 * Browser-level authority acceptance for the approved Stage 1 release:
 * an employee requests; the assigned manager decides; HR audits independently.
 * No direct Admin/Manager session rewriting or retroactive permission shortcuts.
 */
const password = process.env.ROLE_FIXTURE_PASSWORD;

async function asRole(browser, email, app) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  await page.goto("/");
  await page.getByPlaceholder("Work email").fill(email);
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.locator(app)).toBeVisible({ timeout: 20000 });
  await page.goto("/?tab=attendance");
  await expect(page.locator(app)).toBeVisible({ timeout: 20000 });
  await page.getByRole("tab", { name: "Corrections", exact: true }).click();
  const workflow = page.locator(".ev2wf-correction-workflow");
  await expect(workflow.getByRole("heading", { name: "Missed check-in and attendance corrections" })).toBeVisible();
  await expect(workflow.getByRole("button", { name: "Request manager review" })).toBeVisible();
  return { context, page, workflow };
}

test("Staff correction request → Manager decision → HR audit preserves the original session", async ({ browser }) => {
  test.setTimeout(120000);
  const reason = "Browser acceptance context " + crypto.randomUUID();
  const contexts = [];
  try {
    const staff = await asRole(browser, "staff@ceac.local.test", ".staff-app");
    contexts.push(staff.context);
    await staff.workflow.getByLabel("Correction work date").fill(new Date().toISOString().slice(0,10));
    await staff.workflow.getByLabel("Correction context").fill("Missing check-in while assigned to an authorised duty session; retain original evidence.");
    await staff.workflow.getByLabel("Correction reason").fill(reason);
    await staff.workflow.getByRole("button", { name: "Request manager review" }).click();
    await expect(staff.workflow.getByText(/Attendance correction requested for your manager to review/i)).toBeVisible();
    await expect(staff.workflow.locator(".admin-evidence-row").filter({ hasText: reason })).toContainText("pending");

    const manager = await asRole(browser, "manager@ceac.local.test", ".manager-app");
    contexts.push(manager.context);
    const managerRow = manager.workflow.locator(".admin-evidence-row").filter({ hasText: reason });
    await expect(managerRow).toBeVisible();
    await managerRow.locator("textarea").fill("Manager verified the evidence and approves the historical factual note.");
    await managerRow.getByRole("button", { name: "Approve correction" }).click();
    await expect(manager.workflow.getByText(/Manager correction approved/i)).toBeVisible();

    const hr = await asRole(browser, "admin@ceac.local.test", ".office-app");
    contexts.push(hr.context);
    const hrRow = hr.workflow.locator(".admin-evidence-row").filter({ hasText: reason });
    await expect(hrRow).toBeVisible();
    await hrRow.getByLabel(/HR audit outcome/).selectOption("confirmed");
    await hrRow.locator("textarea").fill("Independent HR confirmation; original attendance record remains intact.");
    await hrRow.getByRole("button", { name: "Record HR audit" }).click();
    await expect(hr.workflow.getByText(/HR audit recorded/i)).toBeVisible();

    await staff.page.reload();
    await staff.page.getByRole("tab", { name: "Corrections", exact: true }).click();
    await expect(staff.page.locator(".ev2wf-correction-workflow .admin-evidence-row").filter({ hasText: reason })).toContainText("HR audit recorded");
    await expect(staff.page.getByRole("button", { name: "Reverse correction", exact: true })).toHaveCount(0);
  } finally {
    await Promise.all(contexts.map((context) => context.close()));
  }
});

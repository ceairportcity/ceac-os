import { test, expect } from "@playwright/test";

const rolePassword = process.env.ROLE_FIXTURE_PASSWORD;

async function openAs(browser, email) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  await page.goto("/");
  await page.getByPlaceholder("Work email").fill(email);
  await page.getByPlaceholder("Password").fill(rolePassword);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.locator(".ev2s-sidebar")).toBeVisible({ timeout: 15000 });
  return { context, page };
}

test("Staff navigation stays focused on the employee workspace", async ({ browser }) => {
  const { context, page } = await openAs(browser, "staff@ceac.local.test");
  const nav = page.locator(".ev2s-sidebar-nav");
  for (const label of ["Today","Work","Team","Time & Leave","Calendar","Messages","My Hub"]) {
    await expect(nav.getByRole("button", { name:label, exact:true })).toBeVisible();
  }
  for (const label of ["Units","People","Finance","Reports","Control Center","Audit","Authority","Events","Workflows","Integrations","Employee lifecycle","Delivery","Workload","Performance & development","Compliance"]) {
    await expect(nav.getByRole("button", { name:label, exact:true })).toHaveCount(0);
  }
  await context.close();
});

test("Manager gets a team command centre, not Administration authoring", async ({ browser }) => {
  const { context, page } = await openAs(browser, "manager@ceac.local.test");
  const nav = page.locator(".ev2s-sidebar-nav");
  for (const label of ["Overview","Work","Team","Projects","Time & Leave","Calendar","Finance","Reports","Messages","My Hub"]) {
    await expect(nav.getByRole("button", { name:label, exact:true })).toBeVisible();
  }
  for (const label of ["People","Control Center","Audit","Authority","Events","Workflows","Integrations","Employee lifecycle","Protected HR"]) {
    await expect(nav.getByRole("button", { name:label, exact:true })).toHaveCount(0);
  }
  await context.close();
});

test("Administration exposes operations, not internal architecture modules", async ({ browser }) => {
  const { context, page } = await openAs(browser, "admin@ceac.local.test");
  const nav = page.locator(".ev2s-sidebar-nav");
  for (const label of ["Overview","People & Access","Work","Time & Leave","Finance","Reports","Reviews & Development","Learning","Control Center","Messages"]) {
    await expect(nav.getByRole("button", { name:label, exact:true })).toBeVisible();
  }
  for (const label of ["Compliance","Employee lifecycle","Protected HR","Audit","Authority","Events","Workflows","System rules","Integrations","Delivery","Workload","Performance & development","Assets & devices"]) {
    await expect(nav.getByRole("button", { name:label, exact:true })).toHaveCount(0);
  }
  await context.close();
});

test("Group Pastor has an executive navigation boundary", async ({ browser }) => {
  const { context, page } = await openAs(browser, "exec@ceac.local.test");
  const nav = page.locator(".ev2s-sidebar-nav");
  for (const label of ["Overview","Work","Ministry","Projects","Organisation","Finance","Reports","Messages"]) {
    await expect(nav.getByRole("button", { name:label, exact:true })).toBeVisible();
  }
  for (const label of ["Portfolio","People","Time & Leave","Control Center","Audit","Authority","Events","Workflows","Integrations","Employee lifecycle","Protected HR","Learning","Assets","Compliance"]) {
    await expect(nav.getByRole("button", { name:label, exact:true })).toHaveCount(0);
  }
  await context.close();
});

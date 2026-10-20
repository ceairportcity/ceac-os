import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// One-shot isolated Stage 2 acceptance against the seeded localhost Supabase.
// Never run this spec against production or external Auth/Storage.
const password = process.env.ROLE_FIXTURE_PASSWORD;
const root = "http://127.0.0.1:5173";
const org = "10000000-0000-4000-8000-000000000010";
const managerB = "31000000-0000-4000-8000-000000000007";
const admin = "31000000-0000-4000-8000-000000000003";
const unitB = "20000000-0000-4000-8000-000000000012";

function assertLocalEnvironment() {
  const url = new URL(process.env.SUPABASE_URL || "");
  if (url.hostname !== "127.0.0.1" || !["54321"].includes(url.port) || !process.env.SUPABASE_SERVICE_ROLE_KEY)
    throw new Error("Stage 2 browser test requires a disposable localhost Supabase and service-role fixture.");
}

async function endDisposableSupportMembership(service, membershipId) {
  const ended = await service.from("support_team_memberships").update({
    active: false, ended_at: new Date().toISOString(), ended_by: admin,
    end_reason: "Disposable browser role fixture completed",
  }).eq("id", membershipId).eq("active", true);
  expect(ended.error, ended.error?.message).toBeNull();
}

async function openAs(browser, email, viewport = { width: 1440, height: 900 }) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  // Stops all attempts to reach production, external photography, analytics or remote APIs.
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname !== "127.0.0.1" || !["5173", "54321"].includes(url.port))
      return route.abort("blockedbyclient");
    return route.continue();
  });
  await page.goto(root + "/");
  await page.getByPlaceholder("Work email").fill(email);
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.locator(viewport.width < 760 ? ".ev2s-mobile-topbar" : ".ev2s-sidebar")).toBeVisible({ timeout: 20000 });
  return { context, page };
}


async function assertSupportMobileHelpDesk(page, actor) {
  // Mobile Technical Support is a different view of the SAME RLS-authorised
  // cases, never a second case engine or a role-authority bypass.
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await expect(page.locator(".ceac-support-page .s2-support-split")).toBeVisible();
    const navButtons = page.locator(".ceac-support-nav button:visible");
    const heights = await navButtons.evaluateAll((nodes) =>
      nodes.map((node) => node.getBoundingClientRect().height));
    expect(heights.length, actor + " Support navigation actions").toBeGreaterThan(0);
    expect(Math.min(...heights), actor + " Support navigation touch height at " + width).toBeGreaterThanOrEqual(44);
    const overflow = await page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, actor + " Support Help Desk horizontal overflow at " + width).toBeLessThanOrEqual(1);
    await page.screenshot({
      path: `test-artifacts/stage2-technical-support-${actor}-phone-${width}.png`,
      fullPage: true,
    });
  }
}

test("manager projects preserve one integrated workspace with real photo and task data", async ({ browser }) => {
  assertLocalEnvironment();
  const { context, page } = await openAs(browser, "manager@ceac.local.test", { width: 1536, height: 1024 });
  try {
    await page.goto(root + "/?tab=projects");
    await expect(page.locator(".ev2-project-manager")).toBeVisible();
    await page.locator(".ev2p-row:visible").first().click();
    const workspace = page.locator(".manager-projects.s2-owner-approved-projects");
    await expect(workspace).toBeVisible({ timeout: 20000 });
    await expect(workspace.locator(".s2-project-metrics .s2-project-stat-card")).toHaveCount(4);
    await expect(workspace.locator(".s2-project-panel", { hasText: "Project team" })).toBeVisible();
    await expect(workspace.getByText("Departments involved")).toBeVisible();
    await expect(workspace.getByText("Project tasks", { exact: true })).toBeVisible();
    await expect(workspace.locator(".s2-project-aside")).toBeVisible();
    const summary = await workspace.locator('.s2-project-metrics').boundingBox();
    const inspector = await workspace.locator('.s2-project-aside').boundingBox();
    const main = await workspace.locator('.s2-project-content').boundingBox();
    expect(Math.abs(summary.y - inspector.y), 'Project inspector aligns with the summary cards').toBeLessThanOrEqual(2);
    expect(summary.x + summary.width, 'Summary cards remain inside the main project column').toBeLessThanOrEqual(main.x + main.width + 1);
    expect(summary.x + summary.width, 'Project summary and inspector do not overlap').toBeLessThan(inspector.x);
    await expect(workspace.locator(".fpg-project-tree")).toBeHidden();
    await expect(workspace.locator(".fpg-project-facts")).toBeHidden();
    const img = workspace.locator(".s2-scenic-photo img");
    await expect(img).toBeVisible();
    await expect.poll(async () => img.evaluate((el) => el.complete && el.naturalWidth > 100)).toBe(true);
    expect(await img.getAttribute("src")).toMatch(/^\/assets\/ceac-landscapes\/scene-\d{2}\.webp$/);
    await page.screenshot({ path: "test-artifacts/stage2-approved-manager-project-desktop.png", fullPage: true });
  } finally { await context.close(); }
});

for (const width of [390, 320]) {
  test(`manager Projects fits ${width}px without document horizontal overflow`, async ({ browser }) => {
    assertLocalEnvironment();
    const { context, page } = await openAs(browser, "manager@ceac.local.test", { width, height: 844 });
    try {
      await page.goto(root + "/?tab=projects");
      await expect(page.locator(".ev2-project-manager")).toBeVisible();
      await page.locator(".ev2p-row:visible").first().click();
      await expect(page.locator(".s2-owner-approved-projects .s2-project-layout")).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `horizontal overflow at ${width}px`).toBeLessThanOrEqual(1);
      await expect(page.locator(".s2-project-table-scroll")).toBeVisible();
      await page.screenshot({ path: `test-artifacts/stage2-approved-manager-project-${width}.png`, fullPage: true });
    } finally { await context.close(); }
  });
}

test("Administration shares the approved Projects design without editing rights", async ({ browser }) => {
  assertLocalEnvironment();
  const { context, page } = await openAs(browser, "admin@ceac.local.test");
  try {
    await page.goto(root + "/?tab=admin-projects");
    await expect(page.locator(".ev2-project-admin")).toBeVisible();
    await page.getByRole("button", { name: "Open project", exact: true }).first().click();
    await expect(page.locator(".s2-project-reader .s2-project-layout")).toBeVisible();
    await expect(page.locator(".s2-project-reader .s2-project-primary")).toHaveCount(0);
    await expect(page.locator(".s2-project-reader").getByRole("button", { name: "+ Add task" })).toHaveCount(0);
    await page.screenshot({ path: "test-artifacts/stage2-approved-admin-project.png", fullPage: true });
  } finally { await context.close(); }
});

test("Executive portfolio opens read-only project collaboration, not manager authoring", async ({ browser }) => {
  assertLocalEnvironment();
  const { context, page } = await openAs(browser, "exec@ceac.local.test");
  try {
    await page.goto(root + "/?tab=delivery");
    await expect(page.locator(".ev2-project-delivery")).toBeVisible();
    await page.getByRole("button", { name: "Open project", exact: true }).first().click();
    await expect(page.locator(".s2-project-reader .s2-project-layout")).toBeVisible();
    await expect(page.locator(".s2-project-reader .s2-project-table-scroll")).toBeVisible();
    await expect(page.locator(".s2-project-reader").getByRole("button", { name: "+ Add task" })).toHaveCount(0);
    await page.screenshot({ path: "test-artifacts/stage2-approved-executive-project.png", fullPage: true });
  } finally { await context.close(); }
});

test("all four role Overviews load a locally stored licensed landscape", async ({ browser }) => {
  assertLocalEnvironment();
  for (const email of [
    "staff@ceac.local.test", "manager@ceac.local.test",
    "admin@ceac.local.test", "exec@ceac.local.test",
  ]) {
    const { context, page } = await openAs(browser, email);
    try {
      const image = page.locator(".s2-landscape-hero .s2-scenic-photo img").first();
      await expect(image).toBeVisible({ timeout: 20000 });
      await expect.poll(async () => image.evaluate((img) => img.complete && img.naturalWidth > 100)).toBe(true);
      expect(await image.getAttribute("src")).toMatch(/^\/assets\/ceac-landscapes\/scene-\d{2}\.webp$/);
    } finally { await context.close(); }
  }
});

test("Technical Support manager receives premium support workflow without HR/Finance authority", async ({ browser }) => {
  assertLocalEnvironment();
  const service = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
  const membership = await service.from("support_team_memberships").insert({
    org_id: org, profile_id: managerB, role: "lead", added_by: admin,
    reason: "Stage 2 local Technical Support visual acceptance", associated_unit_id: unitB,
  }).select("id").single();
  expect(membership.error, membership.error?.message).toBeNull();
  const capability = await service.from("capability_grants").insert({
    org_id: org, profile_id: managerB, capability: "support.case.manage",
    granted_by: admin, grant_reason: "Stage 2 local Support acceptance",
  });
  expect(capability.error, capability.error?.message).toBeNull();
  const { context, page } = await openAs(browser, "managerb@ceac.local.test");
  try {
    await page.goto(root + "/?tab=technical-support");
    await expect(page.locator(".ceac-support-page")).toBeVisible({ timeout: 20000 });
    await expect(page.getByRole("heading", { name: "Technical Support" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Technical Support workspaces" })).toBeVisible();
    await expect(page.locator(".s2-support-summary")).toBeVisible();
    await page.getByRole("button", { name: "Help Desk", exact: true }).click();
    await expect(page.locator(".s2-support-split")).toBeVisible();
    await page.screenshot({ path: "test-artifacts/stage2-technical-support-manager.png", fullPage: true });
    await assertSupportMobileHelpDesk(page, "manager");
  } finally {
    await context.close();
    await endDisposableSupportMembership(service, membership.data.id);
  }
});

test("Technical Support staff sees their permitted case workflow, not manager/HR authority", async ({ browser }) => {
  assertLocalEnvironment();
  const staffId = "31000000-0000-4000-8000-000000000001";
  const unitA = "20000000-0000-4000-8000-000000000011";
  const service = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } });
  const membership = await service.from("support_team_memberships").insert({
    org_id: org, profile_id: staffId, role: "member", added_by: admin,
    reason: "Stage 2 disposable staff Support visual acceptance", associated_unit_id: unitA,
  }).select("id").single();
  expect(membership.error, membership.error?.message).toBeNull();
  const grant = await service.from("capability_grants").insert({
    org_id: org, profile_id: staffId, capability: "support.case.manage",
    granted_by: admin, grant_reason: "Stage 2 disposable Support staff acceptance",
  });
  expect(grant.error, grant.error?.message).toBeNull();
  const { context, page } = await openAs(browser, "staff@ceac.local.test");
  try {
    await page.goto(root + "/?tab=technical-support");
    await expect(page.locator(".ceac-support-page")).toBeVisible({ timeout: 20000 });
    await expect(page.locator(".s2-support-heading .s2-scenic-photo img")).toBeVisible();
    const nav = page.locator(".ev2s-sidebar-nav");
    await expect(nav.getByRole("button", { name: "People & Access", exact:true })).toHaveCount(0);
    await expect(nav.getByRole("button", { name: "Finance", exact:true })).toHaveCount(0);
    await page.getByRole("button", { name: "Help Desk", exact:true }).click();
    await expect(page.locator(".s2-support-split")).toBeVisible();
    await page.screenshot({ path: "test-artifacts/stage2-technical-support-staff.png", fullPage: true });
    await assertSupportMobileHelpDesk(page, "staff");
  } finally {
    await context.close();
    await endDisposableSupportMembership(service, membership.data.id);
  }
});

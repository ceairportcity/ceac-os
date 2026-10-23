import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const rolePassword = process.env.ROLE_FIXTURE_PASSWORD;
const hasFixtureEnvironment = Boolean(
  rolePassword && process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
);
const service = hasFixtureEnvironment ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
}) : null;

test.skip(!hasFixtureEnvironment, "requires the isolated Supabase role-fixture environment");

const orgId = "10000000-0000-4000-8000-000000000010";
const unitId = "20000000-0000-4000-8000-000000000011";
const staffId = "31000000-0000-4000-8000-000000000001";
const managerId = "31000000-0000-4000-8000-000000000002";
const adminId = "31000000-0000-4000-8000-000000000003";
const executiveId = "31000000-0000-4000-8000-000000000004";
const ids = {
  newWork: "27000000-0000-4000-8000-000000000411",
  returnedWork: "27000000-0000-4000-8000-000000000412",
  managerReview: "27000000-0000-4000-8000-000000000413",
  executiveReview: "27000000-0000-4000-8000-000000000414",
  managerSubmission: "28000000-0000-4000-8000-000000000413",
  executiveSubmission: "28000000-0000-4000-8000-000000000414",
  announcement: "29000000-0000-4000-8000-000000000411",
  audience: "29000000-0000-4000-8000-000000000412",
};

test.describe.configure({ mode: "serial" });

async function requireSuccess(promise, label) {
  const result = await promise;
  expect(result.error, `${label}: ${result.error?.message || "unknown error"}`).toBeNull();
  return result.data;
}

async function openAs(browser, email, viewport = { width: 1280, height: 900 }) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  await page.goto("/?tab=messages");
  await page.getByPlaceholder("Work email").fill(email);
  await page.getByPlaceholder("Password").fill(rolePassword);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.locator(".app")).toBeVisible({ timeout: 15_000 });
  await expect(page.locator(".route-fallback")).toHaveCount(0, { timeout: 15_000 });
  await expect(page.getByRole("heading", { name: "Messages", exact: true })).toBeVisible();
  return { context, page };
}

test.beforeAll(async () => {
  const now = Date.now();
  await requireSuccess(service.from("work_items").upsert([
    {
      id: ids.newWork, org_id: orgId, ref: "P4-UI-NEW-411", kind: "task", unit_id: unitId,
      assignee_id: staffId, assigned_by: managerId, title: "Phase 4 visible new assignment",
      origin: "assigned", visibility: "unit", status: "not_started",
      created_at: new Date(now - 4 * 3600000).toISOString(), last_movement_at: new Date(now - 4 * 3600000).toISOString(),
    },
    {
      id: ids.returnedWork, org_id: orgId, ref: "P4-UI-RETURN-412", kind: "task", unit_id: unitId,
      assignee_id: staffId, assigned_by: managerId, title: "Phase 4 visible returned work",
      origin: "assigned", visibility: "unit", status: "returned",
      created_at: new Date(now - 3 * 86400000).toISOString(), last_movement_at: new Date(now - 3 * 3600000).toISOString(),
    },
    {
      id: ids.managerReview, org_id: orgId, ref: "P4-UI-REVIEW-413", kind: "task", unit_id: unitId,
      assignee_id: staffId, assigned_by: managerId, title: "Phase 4 Manager review required",
      origin: "assigned", visibility: "unit", status: "in_review",
      created_at: new Date(now - 2 * 86400000).toISOString(), last_movement_at: new Date(now - 2 * 3600000).toISOString(),
    },
    {
      id: ids.executiveReview, org_id: orgId, ref: "P4-UI-UPWARD-414", kind: "task", unit_id: unitId,
      assignee_id: managerId, assigned_by: executiveId, title: "Phase 4 Executive review required",
      origin: "assigned_by_exec", visibility: "unit", status: "in_review",
      created_at: new Date(now - 2 * 86400000).toISOString(), last_movement_at: new Date(now - 90 * 60000).toISOString(),
    },
  ], { onConflict: "id" }), "Phase 4 work fixtures");

  await requireSuccess(service.from("submissions").upsert([
    {
      id: ids.managerSubmission, org_id: orgId, work_item_id: ids.managerReview, profile_id: staffId,
      note: "Ready for the Manager", submitted_at: new Date(now - 2 * 3600000).toISOString(),
    },
    {
      id: ids.executiveSubmission, org_id: orgId, work_item_id: ids.executiveReview, profile_id: managerId,
      note: "Ready for the Executive", submitted_at: new Date(now - 90 * 60000).toISOString(),
    },
  ], { onConflict: "id" }), "Phase 4 submission fixtures");

  await requireSuccess(service.from("announcements").upsert({
    id: ids.announcement,
    org_id: orgId,
    author_id: adminId,
    title: "Phase 4 policy update",
    body: "This known fixture proves that unread communication remains separate from work action state.",
    priority: "important",
    status: "published",
    requires_acknowledgement: true,
    published_at: new Date(now - 30 * 60000).toISOString(),
  }, { onConflict: "id" }), "Phase 4 announcement fixture");
  await requireSuccess(service.from("announcement_audiences").upsert({
    id: ids.audience,
    announcement_id: ids.announcement,
    audience_type: "organisation",
  }, { onConflict: "id" }), "Phase 4 announcement audience");
  await requireSuccess(service.from("announcement_receipts").delete()
    .eq("announcement_id", ids.announcement), "Phase 4 unread fixture reset");
});

test("Staff sees independent work actions and unread updates without read-through mutation", async ({ browser }) => {
  const receiptBefore = await requireSuccess(service.from("announcement_receipts")
    .select("id")
    .eq("announcement_id", ids.announcement)
    .eq("profile_id", staffId), "Receipt before opening work");
  expect(receiptBefore).toHaveLength(0);

  const { context, page } = await openAs(browser, "staff@ceac.local.test");
  await expect(page.getByText("Needs action", { exact: true })).toBeVisible();
  const newAction = page.getByRole("button", { name: /P4-UI-NEW-411.*New assignment/ });
  const returnedAction = page.getByRole("button", { name: /P4-UI-RETURN-412.*Correction required/ });
  await expect(newAction.getByText("P4-UI-NEW-411 · Phase 4 visible new assignment", { exact: true })).toBeVisible();
  await expect(newAction.getByText("New assignment", { exact: true })).toBeVisible();
  await expect(returnedAction.getByText("P4-UI-RETURN-412 · Phase 4 visible returned work", { exact: true })).toBeVisible();
  await expect(returnedAction.getByText("Correction required", { exact: true })).toBeVisible();
  await expect(page.getByText("Phase 4 policy update", { exact: true })).toBeVisible();
  await expect(page.getByText(/Unread means not opened.*independent of the Needs action queue/i)).toBeVisible();

  await newAction.click();
  await expect(page.locator(".ev2-work-detail")).toBeVisible();
  const workAfter = await requireSuccess(service.from("work_items").select("status").eq("id", ids.newWork).single(), "Work after open");
  expect(workAfter.status).toBe("not_started");
  const receiptAfter = await requireSuccess(service.from("announcement_receipts")
    .select("id")
    .eq("announcement_id", ids.announcement)
    .eq("profile_id", staffId), "Receipt after opening work");
  expect(receiptAfter).toHaveLength(0);

  await page.goto("/?tab=messages");
  await expect(page.getByRole("heading", { name: "Messages", exact: true })).toBeVisible();
  await page.getByRole("button", { name: /Phase 4 policy update.*Unread/ }).click();
  await expect(page.getByRole("heading", { name: "Announcements", exact: true })).toBeVisible();
  await page.getByRole("button", { name: /New · Phase 4 policy update/ }).click();
  await expect(page.getByText("This known fixture proves that unread communication remains separate from work action state.", { exact: true })).toBeVisible();
  const receiptAfterAnnouncement = await requireSuccess(service.from("announcement_receipts")
    .select("read_at,acknowledged_at")
    .eq("announcement_id", ids.announcement)
    .eq("profile_id", staffId)
    .single(), "Receipt after opening announcement");
  expect(receiptAfterAnnouncement.read_at).toBeTruthy();
  expect(receiptAfterAnnouncement.acknowledged_at).toBeNull();
  const workAfterAnnouncement = await requireSuccess(service.from("work_items")
    .select("id,status")
    .in("id", [ids.newWork, ids.returnedWork, ids.managerReview]), "Work after opening announcement");
  expect(Object.fromEntries(workAfterAnnouncement.map((row) => [row.id, row.status]))).toEqual({
    [ids.newWork]: "not_started",
    [ids.returnedWork]: "returned",
    [ids.managerReview]: "in_review",
  });
  await context.close();
});

test("Manager review action and Work queue use the same per-item authority", async ({ browser }) => {
  const { context, page } = await openAs(browser, "manager@ceac.local.test");
  await expect(page.getByText("P4-UI-REVIEW-413 · Phase 4 Manager review required", { exact: true })).toBeVisible();
  await expect(page.getByText("P4-UI-UPWARD-414 · Phase 4 Executive review required", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: /P4-UI-REVIEW-413.*Review required/ }).click();
  await expect(page.getByText("Review submitted work", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Approve", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Return for correction", exact: true })).toBeVisible();

  await page.goto("/?tab=work");
  await expect(page.locator(".route-fallback")).toHaveCount(0, { timeout: 15_000 });
  await page.getByRole("tab", { name: /For review/ }).click();
  await expect(page.getByText("Phase 4 Manager review required", { exact: true })).toBeVisible();
  await expect(page.getByText("Phase 4 Executive review required", { exact: true })).toHaveCount(0);
  await context.close();
});

test("Executive and Administration action queues reflect their server authority", async ({ browser }) => {
  {
    const { context, page } = await openAs(browser, "exec@ceac.local.test");
    await expect(page.getByText("P4-UI-UPWARD-414 · Phase 4 Executive review required", { exact: true })).toBeVisible();
    await expect(page.getByText("P4-UI-REVIEW-413 · Phase 4 Manager review required", { exact: true })).toHaveCount(0);
    await context.close();
  }

  {
    const { context, page } = await openAs(browser, "admin@ceac.local.test", { width: 390, height: 844 });
    await expect(page.getByText("P4-UI-REVIEW-413 · Phase 4 Manager review required", { exact: true })).toBeVisible();
    await expect(page.getByText("P4-UI-UPWARD-414 · Phase 4 Executive review required", { exact: true })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    await page.screenshot({ path: "test-artifacts/phase4-notification-work-state-mobile.png", fullPage: true });
    await context.close();
  }
});

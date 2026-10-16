import { test, expect } from "@playwright/test";

const BASE = "http://127.0.0.1:5173";

async function auth(browser, email) {
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const page = await context.newPage();
  await page.route("**/*", (route) => {
    const target = new URL(route.request().url());
    if (target.hostname !== "127.0.0.1" || !["5173","54321"].includes(target.port))
      return route.abort("blockedbyclient");
    return route.continue();
  });
  await page.goto(BASE);
  await page.getByPlaceholder("Work email").fill(email);
  await page.getByPlaceholder("Password").fill(process.env.ROLE_FIXTURE_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.locator(".ev2s-sidebar")).toBeVisible({timeout:20000});
  return { page, context };
}

test("weekly assigned routine is created once and appears on staff's future Work dates", async ({ browser }) => {
  if (new URL(process.env.SUPABASE_URL || "").hostname !== "127.0.0.1")
    throw new Error("Never run recurring Work browser test outside disposable local Supabase.");

  const today = new Date();
  const daysToSaturday = (6 - today.getUTCDay() + 7) % 7;
  today.setUTCDate(today.getUTCDate() + daysToSaturday);
  const nextSaturday = today.toISOString().slice(0,10);
  const afterSaturday = new Date(nextSaturday+"T12:00:00Z");
  afterSaturday.setUTCDate(afterSaturday.getUTCDate()+7);
  const followingSaturday = afterSaturday.toISOString().slice(0,10);

  const manager = await auth(browser,"manager@ceac.local.test");
  const title = "Saturday venue inspection " + nextSaturday;
  try {
    await manager.page.goto(BASE + "/?tab=work");
    await expect(manager.page.locator(".ev2-work-manager")).toBeVisible();
    await manager.page.getByRole("button", { name: "Give out work", exact:true }).first().click();
    await expect(manager.page.locator(".ev2-work-assignment")).toBeVisible();
    await manager.page.getByRole("checkbox", { name: "Repeat this responsibility" }).check();
    const form = manager.page.locator(".assign-screen.is-routine");
    await expect(form).toBeVisible();
    await form.getByPlaceholder("What repeats?").fill(title);
    await form.getByRole("combobox",{name:"Repeat frequency"}).selectOption("weekly");
    await form.getByRole("combobox",{name:"Repeat weekday"}).selectOption("6");
    await form.locator("input[type=date]").first().fill(nextSaturday);
    await form.locator(".side-col select.field").first().selectOption({ label:"Staff Fixture" });
    await manager.page.getByRole("button", {name:"Create routine",exact:true}).click();
    await expect(manager.page.getByRole("heading",{name:"Work sent"})).toBeVisible({timeout:20000});
  } finally { await manager.context.close(); }

  // Verify that the manager really created one authoritative routine for Staff,
  // rather than allowing a blank successful UI to hide a missing assignment.
  const service = (await import("@supabase/supabase-js")).createClient(
    process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken:false, persistSession:false } }
  );
  const created = await service.from("work_items")
    .select("id,title,kind,status,visibility,assignee_id,unit_id").eq("title",title);
  expect(created.error, created.error?.message).toBeNull();
  expect(created.data?.length,"manager did not create exactly one Work master").toBe(1);
  const actualWork = created.data[0];
  expect(actualWork.kind).toBe("routine");
  expect(actualWork.assignee_id).toBe("31000000-0000-4000-8000-000000000001");
  const recurring = await service.from("recurring_operations")
    .select("id,name,work_item_id,active,paused_at,schedule_kind,starts_on,weekdays")
    .eq("work_item_id",actualWork.id);
  expect(recurring.error, recurring.error?.message).toBeNull();
  expect(recurring.data?.length,"routine master missing").toBe(1);
  expect(recurring.data[0].schedule_kind).toBe("weekly");
  expect(recurring.data[0].weekdays).toEqual([6]);
  expect(recurring.data[0].starts_on).toBe(nextSaturday);

  const staff = await auth(browser,"staff@ceac.local.test");
  try {
    await staff.page.goto(BASE + "/?tab=work");
    const scheduled = staff.page.getByRole("region",{name:"My scheduled recurring work"});
    await expect(scheduled).toBeVisible({timeout:20000});
    const visible = await scheduled.innerText();
    expect(visible, "Staff routine projection did not contain created master (including possible RLS/error feedback)").toContain(title);
    const ownRoutine = scheduled.locator(".s2-assigned-routine-list > button").filter({hasText:title});
    await expect(ownRoutine).toHaveCount(2);
    await expect(ownRoutine.locator(`time[datetime="${nextSaturday}"]`)).toBeVisible();
    await expect(ownRoutine.locator(`time[datetime="${followingSaturday}"]`)).toBeVisible();
    await expect(scheduled.getByText("Scheduled", {exact:true}).first()).toBeVisible();
    await staff.page.screenshot({path:"test-artifacts/stage2-recurring-staff-weekly-work.png",fullPage:true});
  } finally { await staff.context.close(); }
});

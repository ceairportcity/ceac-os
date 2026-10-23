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
  const title = "Saturday venue inspection " + nextSaturday + " " + Date.now();
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
    // The region mounts with a loading notice before the RLS-backed reads
    // finish. Await the named real occurrence rather than reading the shell.
    const ownRoutine = scheduled.locator(".s2-assigned-routine-list > button").filter({hasText:title});
    await expect(ownRoutine.first(), "Staff routine projection did not contain created master").toBeVisible({timeout:20000});
    // The staff preview includes the current Saturday and the next 14 days,
    // inclusive. When a routine starts ON Saturday, that valid window contains
    // three Saturdays (today, +7, +14), not two. Check each scheduled DATE
    // exactly once; counting only two would reject a correct projection.
    const expectedDates = [nextSaturday, followingSaturday];
    if (daysToSaturday === 0) {
      const thirdSaturday = new Date(followingSaturday + "T12:00:00Z");
      thirdSaturday.setUTCDate(thirdSaturday.getUTCDate() + 7);
      expectedDates.push(thirdSaturday.toISOString().slice(0, 10));
    }
    await expect(ownRoutine).toHaveCount(expectedDates.length);
    for (const date of expectedDates) {
      await expect(ownRoutine.locator(`time[datetime="${date}"]`)).toHaveCount(1);
    }
    const projectedDates = await ownRoutine.locator("time").evaluateAll(
      (nodes) => nodes.map((node) => node.getAttribute("datetime"))
    );
    expect(projectedDates, "one occurrence per day, no duplicate Work item").toEqual(expectedDates);
    await expect(scheduled.getByText("Scheduled", {exact:true}).first()).toBeVisible();
    // A normal authenticated manager changes FUTURE dates; the first Saturday
    // remains due. Service-role writes must not fabricate schedule history.
    const managerClient = (await import("@supabase/supabase-js")).createClient(
      process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY,
      { auth: { autoRefreshToken:false, persistSession:false } }
    );
    const signIn = await managerClient.auth.signInWithPassword({
      email: "manager@ceac.local.test", password: process.env.ROLE_FIXTURE_PASSWORD,
    });
    expect(signIn.error, signIn.error?.message).toBeNull();
    const sunday = new Date(nextSaturday+"T12:00:00Z");
    sunday.setUTCDate(sunday.getUTCDate()+1);
    const firstSunday = sunday.toISOString().slice(0,10);
    try {
      const changed = await managerClient.rpc("change_routine_schedule", {
        p_work_item_id: actualWork.id, p_effective_from: firstSunday,
        p_schedule_kind: "weekly", p_weekdays: [7],
      });
      expect(changed.error, changed.error?.message).toBeNull();
      expect(changed.data).toBe(2);
      await staff.page.reload();
      const changedRows = staff.page.getByRole("region",{name:"My scheduled recurring work"})
        .locator(".s2-assigned-routine-list > button").filter({hasText:title});
      await expect(changedRows.locator(`time[datetime="${firstSunday}"]`)).toHaveCount(1,{timeout:20000});
      await expect(changedRows.locator(`time[datetime="${nextSaturday}"]`)).toHaveCount(1);
      await expect(changedRows.locator(`time[datetime="${followingSaturday}"]`)).toHaveCount(0);
    } finally { await managerClient.auth.signOut(); }
    await staff.page.screenshot({path:"test-artifacts/stage2-recurring-staff-weekly-work.png",fullPage:true});
  } finally { await staff.context.close(); }
});


test("a pause keeps earlier missed Work dates visible to Staff and their Manager", async ({ browser }) => {
  if (process.env.SUPABASE_URL !== "http://127.0.0.1:54321")
    throw new Error("Pause history browser fixture must remain local.");
  const { createClient } = await import("@supabase/supabase-js");
  const client=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_ANON_KEY,
    {auth:{persistSession:false,autoRefreshToken:false}});
  const today=new Date().toISOString().slice(0,10);
  const date=(offset)=>{const d=new Date(today+"T12:00:00Z");d.setUTCDate(d.getUTCDate()+offset);return d.toISOString().slice(0,10);};
  const title="Pause preserves real missed history "+Date.now();
  const signed=await client.auth.signInWithPassword({email:"staff@ceac.local.test",password:process.env.ROLE_FIXTURE_PASSWORD});
  expect(signed.error).toBeNull();
  const created=await client.rpc("create_typed_work",{
    p_kind:"routine",p_unit_id:"20000000-0000-4000-8000-000000000011",
    p_title:title,p_assignee_id:signed.data.user.id,p_expected_outcome:"Check the venue",
    p_details:{origin:"self_created",schedule_kind:"daily",starts_on:date(-3),steps:["Inspect venue"]},
  });
  expect(created.error,created.error?.message).toBeNull();
  expect((await client.rpc("record_routine_occurrence",{p_work_item_id:created.data,p_occurred_on:date(-3),p_note:"Actual earlier inspection"})).error).toBeNull();
  expect((await client.rpc("set_routine_paused",{p_work_item_id:created.data,p_paused:true,p_reason:"Venue temporarily unavailable"})).error).toBeNull();
  const staff=await auth(browser,"staff@ceac.local.test");
  try {
    await staff.page.goto(BASE+"/?tab=work");
    const rows=staff.page.getByRole("region",{name:"My scheduled recurring work"})
      .locator(".s2-assigned-routine-list > button").filter({hasText:title});
    await expect(rows).toHaveCount(2);
    for(const offset of [-2,-1]) await expect(rows.locator('time[datetime="'+date(offset)+'"]')).toHaveCount(1);
    await expect(rows.getByText("Not recorded",{exact:true})).toHaveCount(2);
    const manager=await auth(browser,"manager@ceac.local.test");
    try {
      await manager.page.goto(BASE+"/?tab=work");
      await manager.page.getByRole("tab",{name:"Routines",exact:true}).click();
      const managerRows=manager.page.getByRole("region",{name:"Routine occurrence calendar"}).locator("tbody tr").filter({hasText:title});
      await expect(managerRows).toHaveCount(3);
      await expect(managerRows.getByText("Recorded",{exact:true})).toHaveCount(1);
      await expect(managerRows.getByText("Not recorded",{exact:true})).toHaveCount(2);
      await expect(managerRows.locator('time[datetime="'+today+'"]')).toHaveCount(0);
    } finally {await manager.context.close();}
    expect((await client.rpc("set_routine_paused",{p_work_item_id:created.data,p_paused:false,p_reason:"Venue available again"})).error).toBeNull();
    await staff.page.reload();
    await expect(rows).toHaveCount(5);
    for(const offset of [-2,-1,0,1,2]) await expect(rows.locator('time[datetime="'+date(offset)+'"]')).toHaveCount(1);
    await staff.page.screenshot({path:"test-artifacts/stage2-recurring-pause-history.png",fullPage:true});
  } finally {await staff.context.close();await client.auth.signOut();}
});

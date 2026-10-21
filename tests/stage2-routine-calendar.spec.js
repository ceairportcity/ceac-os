import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

async function signIn(browser,email,width) {
 const context=await browser.newContext({viewport:{width,height:900}});
 const page=await context.newPage();
 await page.route("**/*",route=>{
  const url=new URL(route.request().url());
  return url.hostname==="127.0.0.1"&&["5173","54321"].includes(url.port)?route.continue():route.abort("blockedbyclient");
 });
 await page.goto("/");
 await page.getByPlaceholder("Work email").fill(email);
 await page.getByPlaceholder("Password").fill(process.env.ROLE_FIXTURE_PASSWORD);
 await page.getByRole("button",{name:"Sign in to CEAC OS",exact:true}).click();
 await expect(page.locator(".ev2s-workspace")).toBeVisible();
 return {page,context};
}

test("real organisational routine dates appear in Staff and Unit Calendar without private task copies or inferred approval",async({browser})=>{
 expect(process.env.SUPABASE_URL).toBe("http://127.0.0.1:54321");
 const options={auth:{persistSession:false,autoRefreshToken:false}};
 const manager=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_ANON_KEY,options);
 const staff=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_ANON_KEY,options);
 const today=new Date().toISOString().slice(0,10);
 const title="Calendar venue check "+Date.now();
 const colleagueTitle="Colleague calendar check "+Date.now();
 const contexts=[];
 try {
  expect((await manager.auth.signInWithPassword({email:"manager@ceac.local.test",password:process.env.ROLE_FIXTURE_PASSWORD})).error).toBeNull();
  expect((await staff.auth.signInWithPassword({email:"staff@ceac.local.test",password:process.env.ROLE_FIXTURE_PASSWORD})).error).toBeNull();
  const create=async(assignee,name)=>{
   const result=await manager.rpc("create_typed_work",{
    p_kind:"routine",p_unit_id:"20000000-0000-4000-8000-000000000011",p_title:name,
    p_assignee_id:assignee,p_expected_outcome:"Inspect the venue",
    p_details:{schedule_kind:"daily",starts_on:today,interval_count:2,timezone:"Africa/Accra",due_time:"23:00",occurrence_limit:3,steps:["Inspect venue"]},
   });
   expect(result.error,result.error?.message).toBeNull();return result.data;
  };
  const id=await create("31000000-0000-4000-8000-000000000001",title);
  await create("31000000-0000-4000-8000-000000000006",colleagueTitle);
  const before=await staff.from("work_items").select("status").eq("id",id).single();
  expect(before.error).toBeNull();
  const own=await signIn(browser,"staff@ceac.local.test",390);contexts.push(own.context);
  await own.page.goto("/?tab=staff-calendar");
  const schedule=own.page.locator(".phase6-day-schedule-view");
  const row=schedule.locator(".phase6-schedule-row").filter({hasText:title});
  await expect(row).toBeVisible();
  await expect(own.page.getByText("Routine dates unavailable",{exact:true})).toHaveCount(0);
  await expect(row).toContainText("Routine");
  await expect(own.page.locator(".ev2cal-staff-page")).not.toContainText(colleagueTitle);
  expect((await staff.rpc("record_routine_occurrence",{p_work_item_id:id,p_occurred_on:today,p_note:"Actual calendar inspection"})).error).toBeNull();
  await own.page.reload();
  await expect(own.page.locator(".phase6-schedule-row").filter({hasText:title})).toContainText("Outcome recorded");
  const privateCopies=await staff.from("personal_day_tasks").select("id",{count:"exact",head:true}).eq("linked_work_item_id",id);
  expect(privateCopies.error).toBeNull();expect(privateCopies.count).toBe(0);
  expect(await own.page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  await own.page.screenshot({path:"test-artifacts/routine-calendar-staff-phone.png",fullPage:true});
  // The chosen Calendar date must open that exact routine occurrence in Work,
  // and an independently linked future date must survive refresh.
  await own.page.locator(".phase6-schedule-row").filter({hasText:title}).first().getByRole("button").click();
  await expect(own.page).toHaveURL(new RegExp("item="+id+".*routineDate="+today));
  const editor=own.page.getByRole("region",{name:"Progress for a routine date"});
  await expect(editor.getByLabel("Scheduled date")).toHaveValue(today);
  const future=new Date(today+"T00:00:00Z");
  future.setUTCDate(future.getUTCDate()+2);
  const target=future.toISOString().slice(0,10);
  await own.page.goto("/?tab=staff-calendar&item="+id+"&routineDate="+target);
  await expect(own.page.getByRole("region",{name:"Progress for a routine date"}).getByLabel("Scheduled date")).toHaveValue(target);
  await expect(own.page.getByRole("region",{name:"Progress for a routine date"})).not.toContainText("This date is not scheduled");

  const unit=await signIn(browser,"manager@ceac.local.test",1366);contexts.push(unit.context);
  await unit.page.goto("/?tab=calendar");
  const agenda=unit.page.locator(".ev2cal-side-stack .ev2cal-agenda");
  await expect(agenda).toContainText(title);
  await expect(agenda).toContainText(colleagueTitle);
  await expect(agenda).toContainText("Outcome recorded");
  await expect(unit.page.getByText("Routine dates unavailable",{exact:true})).toHaveCount(0);
  const after=await staff.from("work_items").select("status").eq("id",id).single();
  expect(after.error).toBeNull();expect(after.data.status).toBe(before.data.status);
  await unit.page.screenshot({path:"test-artifacts/routine-calendar-manager-unit.png",fullPage:true});
 } finally {
  await manager.auth.signOut();await staff.auth.signOut();
  for(const context of contexts)await context.close();
 }
});

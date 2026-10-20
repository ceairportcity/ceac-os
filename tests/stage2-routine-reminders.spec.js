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

test("an opted-in routine is delivered once through CEAC Messages and clears only on real recorded proof",async({browser})=>{
 expect(process.env.SUPABASE_URL).toBe("http://127.0.0.1:54321");
 const options={auth:{persistSession:false,autoRefreshToken:false}};
 const staff=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_ANON_KEY,options);
 const admin=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_ANON_KEY,options);
 const colleague=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_ANON_KEY,options);
 const worker=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,options);
 const today=new Date().toISOString().slice(0,10);
 const title="Reminder venue check "+Date.now();
 let context;
 try {
  for(const [client,actor] of [[staff,"staff"],[admin,"admin"],[colleague,"sameunit"]])
   expect((await client.auth.signInWithPassword({email:actor+"@ceac.local.test",password:process.env.ROLE_FIXTURE_PASSWORD})).error).toBeNull();
  const day=await admin.rpc("workforce_record_day_type",{
   p_id:null,p_name:"Reminder browser workday "+Date.now(),p_description:"Synthetic reminder delivery fixture",
   p_session_expected:true,p_leave_overlay_allowed:true,p_active:true,
  });expect(day.error,day.error?.message).toBeNull();
  const keys=["mon","tue","wed","thu","fri","sat","sun"];
  const pattern=await admin.rpc("workforce_record_pattern",{
   p_profile_id:"31000000-0000-4000-8000-000000000001",p_unit_id:"20000000-0000-4000-8000-000000000011",
   p_effective_from:today,p_effective_to:today,p_day_map:Object.fromEntries(keys.map(key=>[key,day.data])),
   p_clock_map:Object.fromEntries(keys.map(key=>[key,{start:"00:00",end:"24:00"}])),
   p_reason:"Synthetic authorised reminder-browser pattern",p_supersedes_id:null,
  });expect(pattern.error,pattern.error?.message).toBeNull();
  const own=await signIn(browser,"staff@ceac.local.test",390);context=own.context;
  await own.page.goto("/?tab=work");
  await own.page.getByRole("button",{name:"Add my work",exact:true}).click();
  await own.page.getByPlaceholder("What are you doing?").fill(title);
  await own.page.getByPlaceholder("What should be true when this is finished?").fill("Inspect the venue");
  await own.page.getByPlaceholder("What must be done?").fill("Inspect entrances");
  await own.page.getByRole("checkbox",{name:"Repeat this responsibility"}).check();
  await own.page.getByRole("combobox",{name:"Repeat frequency"}).selectOption("daily");
  await own.page.getByLabel("Repeat starts",{exact:true}).fill(today);
  await expect(own.page.getByLabel("Routine reminder",{exact:true})).toHaveValue("");
  await own.page.getByLabel("Routine reminder",{exact:true}).selectOption("15");
  await own.page.getByLabel("Occurrence due time",{exact:true}).fill(new Date().toISOString().slice(11,16));
  await own.page.getByRole("button",{name:"Add to my work",exact:true}).click();
  await expect(own.page.locator(".s2-register-row").filter({hasText:title})).toBeVisible();
  const work=await staff.from("work_items").select("id,status").eq("title",title).single();
  expect(work.error).toBeNull();
  const routine=await staff.from("recurring_operations").select("reminder_minutes_before").eq("work_item_id",work.data.id).single();
  expect(routine.error).toBeNull();expect(routine.data.reminder_minutes_before).toBe(15);
  for(let index=0;index<3;index++)expect((await worker.rpc("app_heartbeat")).error).toBeNull();
  const deliveries=await staff.from("routine_reminder_deliveries").select("id,scheduled_on").eq("work_item_id",work.data.id);
  expect(deliveries.error).toBeNull();expect(deliveries.data).toHaveLength(1);
  const foreign=await colleague.from("routine_reminder_deliveries").select("id").eq("work_item_id",work.data.id);
  expect(foreign.error).toBeNull();expect(foreign.data).toEqual([]);
  await own.page.goto("/?tab=messages");
  const row=own.page.locator(".inbox-page button").filter({hasText:title});
  await expect(row).toContainText("Routine due");
  await expect(row).not.toContainText("New assignment");
  expect(await own.page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  await own.page.screenshot({path:"test-artifacts/routine-reminder-staff-phone.png",fullPage:true});
  expect((await staff.rpc("record_routine_occurrence",{p_work_item_id:work.data.id,p_occurred_on:today,p_note:"Actual venue inspection"})).error).toBeNull();
  await own.page.reload();
  await expect(own.page.locator(".inbox-page button").filter({hasText:title})).toHaveCount(0);
  const after=await staff.from("work_items").select("status").eq("id",work.data.id).single();
  expect(after.error).toBeNull();expect(after.data.status).toBe(work.data.status);
  const receipt=await staff.from("routine_reminder_deliveries").select("id").eq("work_item_id",work.data.id);
  expect(receipt.error).toBeNull();expect(receipt.data).toHaveLength(1);
 } finally {
  for(const client of [staff,admin,colleague])await client.auth.signOut();
  await context?.close();
 }
});

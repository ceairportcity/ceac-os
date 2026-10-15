import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const password=process.env.ROLE_FIXTURE_PASSWORD;
const newClient=()=>createClient(process.env.SUPABASE_URL,process.env.SUPABASE_ANON_KEY,{
  auth:{ persistSession:false,autoRefreshToken:false,detectSessionInUrl:false },
});

test("private repeated tasks: real browser create, owner CRUD, overdue and cross-user privacy",async({browser})=>{
  test.setTimeout(120000);
  const staffApi=newClient(),otherApi=newClient(),unique="My private recurrence "+crypto.randomUUID();
  const staff=await staffApi.auth.signInWithPassword({email:"staff@ceac.local.test",password});
  const other=await otherApi.auth.signInWithPassword({email:"sameunit@ceac.local.test",password});
  expect(staff.error).toBeNull();expect(other.error).toBeNull();
  const orgId="10000000-0000-4000-8000-000000000010";
  const profileId=staff.data.user.id;
  const context=await browser.newContext({viewport:{width:390,height:844}});
  const page=await context.newPage();
  let seriesId=null;
  const today=new Intl.DateTimeFormat("en-CA",{
    timeZone:"Africa/Accra",year:"numeric",month:"2-digit",day:"2-digit",
  }).format(new Date());
  const dateOf=(delta)=>{
    const d=new Date(`${today}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate()+delta);
    return d.toISOString().slice(0,10);
  };
  try{
    await page.goto("/");
    await page.getByPlaceholder("Work email").fill("staff@ceac.local.test");
    await page.getByPlaceholder("Password").fill(password);
    await page.getByRole("button",{name:"Sign in"}).click();
    await expect(page.locator(".staff-app")).toBeVisible({timeout:20000});
    await page.goto("/?tab=staff-calendar");
    await expect(page.locator(".phase6-calendar-page")).toBeVisible({timeout:20000});
    await page.getByRole("tab",{name:"Tasks",exact:true}).click();
    const repeat=page.getByRole("region",{name:"Private recurring tasks"});
    await expect(repeat.getByRole("button",{name:"New repetition"})).toBeVisible();
    await repeat.getByRole("button",{name:"New repetition"}).click();
    await repeat.getByLabel("Recurring task title").fill(unique);
    await repeat.getByLabel("Recurring task starts").fill(dateOf(-2));
    await repeat.getByLabel("Recurring task frequency").selectOption("daily");
    await repeat.getByLabel("Recurring task ending").selectOption("after_count");
    await repeat.getByLabel("Recurring task occurrence count").fill("4");
    await repeat.getByRole("button",{name:"Start repetition"}).click();
    await expect(repeat.getByText(unique,{exact:true})).toBeVisible({timeout:15000});
    const recorded=await staffApi.from("personal_task_series").select("id")
      .eq("org_id",orgId).eq("profile_id",profileId).eq("title",unique).single();
    expect(recorded.error).toBeNull();
    seriesId=recorded.data.id;
    const occurrence=await staffApi.from("personal_day_tasks")
      .select("id,plan_date,completed_at,dismissed_at")
      .eq("series_id",seriesId).order("plan_date");
    expect(occurrence.error).toBeNull();
    expect(occurrence.data).toHaveLength(4);
    expect(occurrence.data.filter(x=>x.plan_date<today&&x.completed_at===null)).toHaveLength(2);
    const wrongOwner=await otherApi.from("personal_task_series")
      .select("id").eq("id",seriesId);
    expect(wrongOwner.error).toBeNull();
    expect(wrongOwner.data).toEqual([]);
    const wrongTasks=await otherApi.from("personal_day_tasks")
      .select("id").eq("series_id",seriesId);
    expect(wrongTasks.error).toBeNull();
    expect(wrongTasks.data).toEqual([]);
    await expect(page.getByRole("region",{name:"Overdue private tasks"}))
      .toContainText(unique);
    const card=repeat.locator(".phase6-private-task-card").filter({hasText:unique});
    await card.getByRole("button",{name:"Edit details"}).click();
    await repeat.getByLabel("Recurring task title").fill(unique+" updated");
    await repeat.getByRole("button",{name:"Save details"}).click();
    await expect(repeat.getByText(unique+" updated",{exact:true})).toBeVisible();
    const before=await staffApi.from("personal_day_tasks")
      .select("title,completed_at").eq("series_id",seriesId);
    expect(before.data.every(x=>x.title===unique)).toBe(true);
    page.once("dialog",dialog=>dialog.accept());
    await repeat.locator(".phase6-private-task-card").filter({hasText:unique+" updated"})
      .getByRole("button",{name:"Delete repetition"}).click();
    await expect(repeat.getByText(unique+" updated",{exact:true})).toHaveCount(0);
    const removed=await staffApi.from("personal_task_series").select("id").eq("id",seriesId);
    expect(removed.data).toEqual([]);
    const past=await staffApi.from("personal_day_tasks").select("id")
      .eq("title",unique).lt("plan_date",today);
    expect(past.error).toBeNull();
    expect(past.data).toHaveLength(2);
  }finally{
    await context.close();
    if(seriesId){
      // Cleanup remains strictly within the disposable local fixture database.
      await staffApi.from("personal_day_tasks").delete().eq("profile_id",profileId)
        .eq("title",unique);
      await staffApi.from("personal_task_series").delete().eq("id",seriesId);
    }
    await staffApi.auth.signOut({scope:"local"});
    await otherApi.auth.signOut({scope:"local"});
  }
});

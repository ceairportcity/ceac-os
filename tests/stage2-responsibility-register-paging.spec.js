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

test("long Work registers keep every record searchable and the selected responsibility connected across pages",async({browser})=>{
 expect(process.env.SUPABASE_URL).toBe("http://127.0.0.1:54321");
 const client=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
 const prefix="Paged venue "+Date.now();
 let context;
 try {
  const auth=await client.auth.signInWithPassword({email:"staff@ceac.local.test",password:process.env.ROLE_FIXTURE_PASSWORD});
  expect(auth.error).toBeNull();
  for(let index=0;index<12;index++){
   const result=await client.rpc("create_typed_work",{
    p_kind:"routine",p_unit_id:"20000000-0000-4000-8000-000000000011",
    p_title:prefix+" "+String(index).padStart(2,"0"),p_assignee_id:auth.data.user.id,p_expected_outcome:"Confirm venue readiness",
    p_details:{origin:"self_created",schedule_kind:"daily",starts_on:new Date().toISOString().slice(0,10),steps:["Inspect venue"]},
   });expect(result.error,result.error?.message).toBeNull();
  }
  const own=await signIn(browser,"staff@ceac.local.test",390);context=own.context;
  await own.page.goto("/?tab=work");
  const search=own.page.getByRole("searchbox",{name:"Find a responsibility",exact:true});
  await search.fill(prefix);
  const register=own.page.getByRole("region",{name:"Responsibility register",exact:true});
  const pager=own.page.getByRole("navigation",{name:"Responsibility pages",exact:true});
  await expect(register.locator(".s2-register-row")).toHaveCount(10);
  await expect(pager).toContainText("Page 1 of 2");
  await expect(pager.getByRole("button",{name:"Previous responsibility page"})).toBeDisabled();
  const firstTitles=await register.locator(".s2-register-row strong").allTextContents();
  await pager.getByRole("button",{name:"Next responsibility page"}).click();
  await expect(register.locator(".s2-register-row")).toHaveCount(2);
  await expect(pager).toContainText("Page 2 of 2");
  await expect(pager.getByRole("button",{name:"Next responsibility page"})).toBeDisabled();
  const lastTitles=await register.locator(".s2-register-row strong").allTextContents();
  expect(new Set([...firstTitles,...lastTitles]).size).toBe(12);
  const selected=register.locator(".s2-register-row").filter({hasText:lastTitles[1]});
  await selected.locator("th button").click();
  await expect(own.page.getByRole("complementary",{name:"Selected responsibility"}).getByRole("heading",{name:lastTitles[1],exact:true})).toBeVisible();
  await search.fill(firstTitles[0]);
  await expect(register.locator(".s2-register-row")).toHaveCount(1);
  await expect(register).toContainText(firstTitles[0]);
  await expect(pager).toHaveCount(0);
  await search.fill(prefix);
  await expect(register.locator(".s2-register-row")).toHaveCount(10);
  expect(await own.page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  await own.page.screenshot({path:"test-artifacts/responsibility-register-paging-phone.png",fullPage:true});
 } finally {
  await client.auth.signOut();await context?.close();
 }
});

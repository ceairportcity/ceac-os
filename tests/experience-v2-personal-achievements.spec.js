import {test, expect} from "@playwright/test";

const password=process.env.ROLE_FIXTURE_PASSWORD;

test("P6 personal achievements fails closed on an incomplete own-work read, with no false totals or printable report",async({browser})=>{
 const context=await browser.newContext({viewport:{width:390,height:844},timezoneId:"America/Los_Angeles"});
 const page=await context.newPage();
 try{
   await page.goto("/");
   await page.getByPlaceholder("Work email").fill("staff@ceac.local.test");
   await page.getByPlaceholder("Password").fill(password);
   await page.getByRole("button",{name:"Sign in"}).click();
   await expect(page.locator(".staff-app")).toBeVisible({timeout:15000});
   let intercepted=false;
   await page.route("**/rest/v1/work_items*",async route=>{
     const selected=new URL(route.request().url()).searchParams.get("select")||"";
     if(selected.includes("reschedule_count")&&selected.includes("original_due_at")){
       intercepted=true;
       await route.fulfill({status:500,contentType:"application/json",body:JSON.stringify({message:"synthetic own-work source unavailable"})});
     }else await route.continue();
   });
   await page.goto("/?tab=achievements");
   await expect(page.locator(".s2-achievement")).toBeVisible({timeout:15000});
   await expect.poll(()=>intercepted,{timeout:15000}).toBe(true);
   await expect(page.getByRole("alert")).toContainText("Report source records could not be verified");
   await expect(page.locator(".s2-achievement-metrics")).toHaveCount(0);
   await expect(page.getByRole("button",{name:"Print / Save as PDF"})).toBeDisabled();
   await expect(page.getByRole("button",{name:"Retry records"})).toBeVisible();
 }finally{await context.close();}
});

import {test,expect} from "@playwright/test";

const fixturePassword=process.env.ROLE_FIXTURE_PASSWORD;
async function adminPage(browser,viewport={width:1366,height:768}){
 const context=await browser.newContext({viewport});
 const page=await context.newPage();
 await page.goto("/");
 expect(["localhost","127.0.0.1"]).toContain(new URL(page.url()).hostname);
 return {page,context};
}
async function authenticate(page){
 await page.getByPlaceholder("Work email").fill("admin@ceac.local.test");
 await page.getByPlaceholder("Password").fill(fixturePassword);
 await page.getByRole("button",{name:"Sign in"}).click();
 await expect(page.locator(".office-app")).toBeVisible({timeout:15000});
}
test("HR employee opens the actual person's permissions in the existing Authority workspace",async({browser})=>{
 const {page,context}=await adminPage(browser);
 await authenticate(page);
 await page.goto("/?tab=people");
 const staff=page.locator(".fpg-people-roster-row").filter({has:page.getByText("Staff Fixture",{exact:true})});
 await expect(staff).toBeVisible();
 await staff.click();
 const employee=page.locator(".ev2-admin-person-workspace");
 await expect(employee).toBeVisible();
 await employee.getByRole("tab",{name:"Access",exact:true}).click();
 const manage=page.getByRole("button",{name:"Manage permissions",exact:true});
 await expect(manage).toBeVisible();
 await manage.click();
 await expect(page).toHaveURL(/tab=authority/);
 await expect(page.getByRole("heading",{name:"Authority",exact:true})).toBeVisible();
 await expect(page.getByLabel("Authority person")).toHaveValue("31000000-0000-4000-8000-000000000001");
 await expect(page.getByText("Staff Fixture",{exact:true}).first()).toBeVisible();
 await page.goto("/?tab=settings");
 await expect(page.getByRole("button",{name:"Manage permissions",exact:true})).toBeVisible();
 await expect(page.getByRole("button",{name:"Authority",exact:true})).toHaveCount(0);
 await page.getByRole("button",{name:"Manage permissions",exact:true}).click();
 await expect(page.getByLabel("Authority person")).toHaveValue("31000000-0000-4000-8000-000000000003");
 await context.close();
});

for(const viewport of [{width:390,height:844},{width:1366,height:768}]){
 test(`Admin Overview street map is opt-in and never sends employee identities (${viewport.width}px)`,async({browser})=>{
  const {page,context}=await adminPage(browser,viewport);
  const start=new Date().toISOString();
  let requestedTiles=0;
  await page.route("**/rest/v1/work_sessions?*",async route=>{
   const select=new URL(route.request().url()).searchParams.get("select")||"";
   if(route.request().method()==="GET"&&select.includes("location_accuracy_m")){
    await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify([{
      id:"51000000-0000-4000-8000-000000000101",
      profile_id:"31000000-0000-4000-8000-000000000001",
      started_at:start,ended_at:null,place:"office",
      lat:5.6037,lng:-0.1870,location_captured_at:start,location_accuracy_m:12
    }])});
   }else await route.continue();
  });
  await page.route("https://tile.openstreetmap.org/**",async route=>{
   requestedTiles++;
   const png=Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jR5sAAAAASUVORK5CYII=","base64");
   await route.fulfill({status:200,contentType:"image/png",body:png});
  });
  await authenticate(page);
  const street=page.getByRole("region",{name:"Recorded workforce work-start street map"});
  await expect(street).toBeVisible({timeout:15000});
  await expect(street.getByText(/visible map area, the CEAC site origin and your IP address/)).toBeVisible();
  expect(requestedTiles).toBe(0);
  const enable=street.getByRole("button",{name:"Enable street map"});
  await expect(enable).toBeEnabled({timeout:15000});
  await enable.click();
  await expect(street.getByRole("button",{name:/View recorded work start for Staff Fixture/})).toBeVisible();
  await expect.poll(()=>requestedTiles,{timeout:15000}).toBeGreaterThan(0);
  await expect(street.getByText(/© OpenStreetMap contributors/)).toBeVisible();
  await street.getByRole("button",{name:"Hide street map"}).click();
  await expect(street.getByRole("button",{name:"Enable street map"})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  await context.close();
 });
}

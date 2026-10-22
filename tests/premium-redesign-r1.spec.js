import { test, expect } from "@playwright/test";
const rolePassword=process.env.ROLE_FIXTURE_PASSWORD;
async function openStaff(browser,viewport={width:1440,height:960}){
  const context=await browser.newContext({viewport});
  const page=await context.newPage();
  await page.goto("/");
  await page.getByPlaceholder("Work email").fill("staff@ceac.local.test");
  await page.getByPlaceholder("Password").fill(rolePassword);
  await page.getByRole("button",{name:"Sign in"}).click();
  await expect(page.locator(".staff-app")).toBeVisible({timeout:15000});
  return {context,page};
}
async function side(page,label){await page.locator(".ev2s-sidebar").getByRole("button",{name:label,exact:true}).click();await expect(page.locator(".body")).toBeVisible();}

test.describe("Premium redesign R1 Staff",()=>{
  test("Staff Today is calm, action-first and visually coherent",async({browser})=>{
    const {context,page}=await openStaff(browser);
    await expect(page.getByRole("heading",{name:/Good (morning|afternoon|evening), Staff/})).toBeVisible();
    await expect(page.locator(".staffv2")).toBeVisible();
    await expect(page.locator(".staffv2-session")).toBeVisible();
    await expect(page.locator(".staffv2-focus-grid")).toBeVisible();
    await expect(page.getByText("Next up",{exact:true}).first()).toBeVisible();
    await page.screenshot({path:"test-artifacts/redesign-r1-staff-today.png",fullPage:true});
    await context.close();
  });
  test("Staff Work uses plain human categories",async({browser})=>{
    const {context,page}=await openStaff(browser);
    await side(page,"Work");
    await expect(page.getByRole("heading",{name:"Work",exact:true})).toBeVisible();
    for(const label of ["Assigned","Agreed","Private"]) await expect(page.getByRole("tab",{name:label,exact:true})).toBeVisible();
    await page.screenshot({path:"test-artifacts/redesign-r1-staff-work.png",fullPage:true});
    await context.close();
  });
  test("Staff Team makes the Room obvious without DMs",async({browser})=>{
    const {context,page}=await openStaff(browser);
    await side(page,"Team");
    await expect(page.locator(".ev2-people-page.ev2-people-staff")).toBeVisible();
    await expect(page.getByRole("heading",{name:"Team",exact:true})).toBeVisible();
    await expect(page.getByRole("button",{name:/Unit Room/})).toBeVisible();
    await expect(page.getByText("People",{exact:true}).first()).toBeVisible();
    await expect(page.getByText(/Direct message/i)).toHaveCount(0);
    await page.screenshot({path:"test-artifacts/redesign-r1-staff-team.png",fullPage:true});
    await context.close();
  });
  test("Staff Calendar combines work meetings ministry and leave",async({browser})=>{
    const {context,page}=await openStaff(browser);
    await side(page,"Calendar");
    await expect(page.getByRole("heading",{name:"Calendar",exact:true})).toBeVisible();
    await expect(page.getByLabel("Personal month calendar")).toBeVisible();
    for(const label of ["All","Meetings","Work","Ministry","Leave"]) await expect(page.getByRole("tab",{name:label,exact:true})).toBeVisible();
    await page.screenshot({path:"test-artifacts/redesign-r1-staff-calendar.png",fullPage:true});
    await context.close();
  });
  test("Staff Messages is a global inbox",async({browser})=>{
    const {context,page}=await openStaff(browser);
    await side(page,"Messages");
    await expect(page.getByRole("heading",{name:"Messages",exact:true})).toBeVisible();
    for(const label of ["All","Rooms","Mentions","Work","Announcements"]) await expect(page.getByRole("tab",{name:label,exact:true})).toBeVisible();
    await page.screenshot({path:"test-artifacts/redesign-r1-staff-messages.png",fullPage:true});
    await context.close();
  });
  test("My Hub absorbs employee self-service architecture",async({browser})=>{
    const {context,page}=await openStaff(browser);
    await side(page,"My Hub");
    await expect(page.getByRole("heading",{name:"My Hub",exact:true})).toBeVisible();
    for(const label of ["Work history","Development","Time & leave","Learning","Equipment","Policies & requirements"]) await expect(page.getByText(label,{exact:true})).toBeVisible();
    await page.screenshot({path:"test-artifacts/redesign-r1-staff-hub.png",fullPage:true});
    await context.close();
  });
  test("Staff mobile keeps Today Work Team and My Hub primary with Messages in More",async({browser})=>{
    const {context,page}=await openStaff(browser,{width:390,height:844});
    for(const label of ["Home","Work","Team","Me"]) await expect(page.locator(".ev2s-mobile-nav").getByRole("button",{name:label,exact:true})).toBeVisible();
    await page.locator(".ev2s-mobile-nav").getByRole("button",{name:"More",exact:true}).click();
    const more=page.getByRole("dialog",{name:"More"});
    await expect(more).toBeVisible();
    await expect(more.getByRole("button",{name:"Messages",exact:true})).toBeVisible();
    await more.getByRole("button",{name:"Close",exact:true}).click();
    await page.locator(".ev2s-mobile-nav").getByRole("button",{name:"Me",exact:true}).click();
    await expect(page.getByRole("heading",{name:"My Hub",exact:true})).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    await page.screenshot({path:"test-artifacts/redesign-r1-staff-mobile-hub.png",fullPage:true});
    await context.close();
  });
});

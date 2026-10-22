import { test, expect } from "@playwright/test";

const rolePassword = process.env.ROLE_FIXTURE_PASSWORD;
async function openAs(browser, viewport={width:1440,height:960}) {
  const context=await browser.newContext({viewport,geolocation:{latitude:5.6037,longitude:-0.1870},permissions:["geolocation"]});
  const page=await context.newPage();
  await page.goto("/");
  await page.getByPlaceholder("Work email").fill("manager@ceac.local.test");
  await page.getByPlaceholder("Password").fill(rolePassword);
  await page.getByRole("button",{name:"Sign in"}).click();
  await expect(page.locator(".manager-app")).toBeVisible({timeout:15000});
  return {context,page};
}
test.describe("Premium redesign R2 Manager",()=>{
  test("Manager Overview is a command centre",async({browser})=>{
    const {context,page}=await openAs(browser);
    await expect(page.locator(".managerv2")).toBeVisible();
    await expect(page.locator(".managerv2-main")).toBeVisible({timeout:15000});
    await expect(page.locator(".fpg9-home-reference")).toBeVisible();
    await expect(page.locator(".fpg9-workspace-previews")).toBeVisible();
    await expect(page.locator(".managerv2-decisions")).toHaveCount(0);
    await expect(page.getByRole("button",{name:"Give out work",exact:true})).toBeVisible();
    await expect(page.locator(".reference-module-strip")).toHaveCount(0);
    await page.screenshot({path:"test-artifacts/redesign-r2-manager-overview.png",fullPage:true});
    await context.close();
  });
  test("Manager Work exposes delegation views",async({browser})=>{
    const {context,page}=await openAs(browser);
    await page.locator(".ev2s-sidebar").getByRole("button",{name:"Work",exact:true}).click();
    await expect(page.getByRole("heading",{name:"Work",exact:true})).toBeVisible();
    for (const label of ["Given out","For review","Team work","My work"]) {
      await expect(page.getByRole("tab",{name:new RegExp(label)})).toBeVisible();
    }
    await page.screenshot({path:"test-artifacts/redesign-r2-manager-work.png",fullPage:true});
    await context.close();
  });
  test("Manager Team and person remain contextual",async({browser})=>{
    const {context,page}=await openAs(browser);
    await page.locator(".ev2s-sidebar").getByRole("button",{name:"Team",exact:true}).click();
    await expect(page.getByRole("heading",{name:"Team",exact:true})).toBeVisible();
    await expect(page.getByRole("button",{name:/Open room/})).toBeVisible();
    await expect(page.getByText("People & volunteers",{exact:true}).first()).toBeVisible();
    const person=page.locator(".ev2p-evidence-person").filter({hasText:"Staff Fixture"}).first();
    if(await person.count()) {
      await person.locator(".ev2p-evidence-person-main").click();
      await expect(page.locator(".manager-person-detail")).toBeVisible();
    }
    await page.screenshot({path:"test-artifacts/redesign-r2-manager-team.png",fullPage:true});
    await context.close();
  });
  test("Manager mobile remains within viewport",async({browser})=>{
    const {context,page}=await openAs(browser,{width:390,height:844});
    await expect(page.locator(".ev2s-mobile-nav")).toBeVisible();
    await expect(page.locator(".managerv2-main")).toBeVisible({timeout:15000});
    await expect(page.locator(".fpg9-mobile-shortcuts")).toBeVisible();
    await expect(page.locator(".fpg9-attention-card")).toBeVisible();
    await expect(page.locator(".managerv2-decisions")).toHaveCount(0);
    await expect(page.locator(".reference-module-strip")).toHaveCount(0);
    const geometry=await page.evaluate(()=>({
      overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,
      height:document.documentElement.scrollHeight,
    }));
    expect(geometry.overflow).toBeLessThanOrEqual(1);
    expect(geometry.height).toBeLessThanOrEqual(1300);
    await page.screenshot({path:"test-artifacts/redesign-r2-manager-mobile.png",fullPage:true});
    await context.close();
  });
});

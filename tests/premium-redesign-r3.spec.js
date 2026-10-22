import { test, expect } from "@playwright/test";

const password=process.env.ROLE_FIXTURE_PASSWORD;
async function openAdmin(browser,viewport={width:1440,height:960}){
  const context=await browser.newContext({viewport,geolocation:{latitude:5.6037,longitude:-0.1870},permissions:["geolocation"]});
  const page=await context.newPage();
  await page.goto("/");
  await page.getByPlaceholder("Work email").fill("admin@ceac.local.test");
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button",{name:"Sign in"}).click();
  await expect(page.locator(".office-app")).toBeVisible({timeout:15000});
  return {context,page};
}
test.describe("Premium redesign R3 Administration",()=>{
  test("Overview is an organisation operations console",async({browser})=>{
    const {context,page}=await openAdmin(browser);
    await expect(page.locator(".adminv2")).toBeVisible();
    await expect(page.locator(".adminv2-main")).toBeVisible({timeout:15000});
    await expect(page.locator(".adminv2-inbox")).toBeVisible();
    await expect(page.getByText("Needs Administration",{exact:true})).toBeVisible();
    await expect(page.locator(".admin-command-surface")).toHaveCount(0);
    await expect(page.locator(".reference-module-strip")).toHaveCount(0);
    await page.screenshot({path:"test-artifacts/redesign-r3-admin-overview.png",fullPage:true});
    await context.close();
  });
  test("Admin Work exposes delegated, review and organisation views",async({browser})=>{
    const {context,page}=await openAdmin(browser);
    await page.goto("/?tab=work");
    await expect(page.locator(".admin-work")).toBeVisible();
    await expect(page.getByRole("heading",{name:"Work",exact:true})).toBeVisible();
    for(const label of ["Given out","For review","Organisation","Mine"]) await expect(page.getByRole("tab",{name:new RegExp(label)})).toBeVisible();
    await page.screenshot({path:"test-artifacts/redesign-r3-admin-work.png",fullPage:true});
    await context.close();
  });
  test("People & Access remains the flagship employee workspace",async({browser})=>{
    const {context,page}=await openAdmin(browser);
    await page.locator(".ev2s-sidebar").getByRole("button",{name:"People & Access",exact:true}).click();
    await expect(page.getByRole("heading",{name:"People & Access",exact:true})).toBeVisible();
    await expect(page.getByPlaceholder("Name, email, job title or unit")).toBeVisible();
    await page.screenshot({path:"test-artifacts/redesign-r3-admin-people.png",fullPage:true});
    await context.close();
  });
  test("Finance connects actual spend to Expenses",async({browser})=>{
    const {context,page}=await openAdmin(browser);
    await page.locator(".ev2s-sidebar").getByRole("button",{name:"Finance",exact:true}).click();
    await page.getByRole("button",{name:"Money out",exact:true}).click();
    await expect(page.getByRole("button",{name:"Open Expenses",exact:true})).toBeVisible();
    await page.getByRole("button",{name:"Open Expenses",exact:true}).click();
    await expect(page.getByRole("heading",{name:"Expenses",exact:true})).toBeVisible();
    await page.screenshot({path:"test-artifacts/redesign-r3-admin-expenses.png",fullPage:true});
    await context.close();
  });
  test("Control Center hides technical architecture behind human labels",async({browser})=>{
    const {context,page}=await openAdmin(browser);
    await page.locator(".ev2s-sidebar").getByRole("button",{name:"Control Center",exact:true}).click();
    await expect(page.getByRole("heading",{name:"Control Center",exact:true})).toBeVisible();
    await expect(page.getByText("Connected Apps",{exact:true})).toBeVisible();
    await expect(page.getByRole("heading",{name:"Security, integrations & records",exact:true})).toBeVisible();
    await expect(page.getByText("System events",{exact:true})).toBeVisible();
    await expect(page.getByRole("heading",{name:"Organisation & people",exact:true})).toBeVisible();
    await expect(page.getByRole("heading",{name:"Operational configuration",exact:true})).toBeVisible();
    await page.screenshot({path:"test-artifacts/redesign-r3-admin-control-center.png",fullPage:true});
    await context.close();
  });
  test("VF4D Units is an operating ledger rather than summary cards",async({browser})=>{
    const {context,page}=await openAdmin(browser,{width:1366,height:768});
    await page.goto("/?tab=units");
    await expect(page.getByRole("heading",{name:"Units",exact:true})).toBeVisible();
    const list=page.locator(".admin-unit-list");
    await expect(list).toBeVisible();
    const rows=page.locator(".admin-unit-card");
    expect(await rows.count()).toBeGreaterThan(1);
    const firstTwo=await rows.evaluateAll((nodes)=>nodes.slice(0,2).map((node)=>{
      const rect=node.getBoundingClientRect();
      return {left:rect.left,top:rect.top,width:rect.width};
    }));
    expect(Math.abs(firstTwo[0].left-firstTwo[1].left)).toBeLessThanOrEqual(2);
    expect(firstTwo[1].top).toBeGreaterThan(firstTwo[0].top);
    expect(Math.abs(firstTwo[0].width-firstTwo[1].width)).toBeLessThanOrEqual(2);
    await page.screenshot({path:"test-artifacts/vf4d-admin-units-laptop.png",fullPage:true});
    await context.close();
  });

  test("VF4D Control Center is a state-derived governance command centre",async({browser})=>{
    for(const viewport of [
      {name:"laptop",width:1366,height:768},
      {name:"phone",width:390,height:844},
    ]){
      const {context,page}=await openAdmin(browser,{width:viewport.width,height:viewport.height});
      await page.goto("/?tab=settings");
      await expect(page.getByRole("heading",{name:"Control Center",exact:true})).toBeVisible();
      await expect(page.getByText("Manage departments, people, policies and system access.",{exact:true})).toBeVisible();
      for(const label of [
        "Organisation & people",
        "Operational configuration",
        "Security, integrations & records",
      ]) await expect(page.getByRole("heading",{name:label,exact:true})).toBeVisible();
      for(const label of [
        "Organisation",
        "People & access",
        "Work & operations",
        "Time & Leave",
        "Payroll & Finance",
        "Security & governance",
        "Integrations",
        "Audit & records",
      ]) await expect(page.locator(".ev2-control-center .ev2-control-card").getByText(label,{exact:true}).first()).toBeVisible();
      await expect(page.getByText(/not a numeric health score/i)).toBeVisible();
      await expect(page.locator(".ev2-control-center .phase5-control-group")).toHaveCount(3);
      const domainCards=page.locator(".ev2-control-center .ev2-control-card");
      await expect(domainCards).toHaveCount(8);
      const cardGeometry=await domainCards.evaluateAll((nodes)=>nodes.map((node)=>{
        const card=node.getBoundingClientRect();
        const body=node.querySelector(".ev2c-data-panel-body")?.getBoundingClientRect();
        return {cardWidth:card.width,bodyWidth:body?.width||0};
      }));
      for(const geometry of cardGeometry){
        expect(geometry.bodyWidth).toBeGreaterThan(geometry.cardWidth*.75);
      }
      expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
      await page.screenshot({path:`test-artifacts/vf4d-admin-control-center-${viewport.name}.png`,fullPage:true});
      await context.close();
    }
  });

  test("VF4D Organisation settings uses one configuration workspace",async({browser})=>{
    const {context,page}=await openAdmin(browser,{width:1366,height:768});
    await page.goto("/?tab=office-settings");
    await expect(page.getByRole("heading",{name:"Organisation settings",exact:true})).toBeVisible();
    const grid=page.locator(".ev2-office-settings .office-settings-grid");
    await expect(grid).toBeVisible();
    const sections=grid.locator(":scope > .office-settings-card");
    // Organisation Settings is loaded asynchronously after the route appears.
    // Keep the accepted minimum of four real configuration cards, but wait
    // for their actual rendered state instead of sampling the DOM too early.
    await expect.poll(() => sections.count(), { timeout: 15000 }).toBeGreaterThanOrEqual(4);
    const shadows=await sections.evaluateAll((nodes)=>nodes.map((node)=>getComputedStyle(node).boxShadow));
    for(const shadow of shadows) expect(shadow).toBe("none");
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    await page.screenshot({path:"test-artifacts/vf4d-admin-organisation-settings-laptop.png",fullPage:true});
    await context.close();
  });

  test("Administration mobile stays within the viewport",async({browser})=>{
    const {context,page}=await openAdmin(browser,{width:390,height:844});
    await expect(page.locator(".ev2s-mobile-nav")).toBeVisible();
    await expect(page.locator(".adminv2-main")).toBeVisible({timeout:15000});
    await expect(page.locator(".adminv2-inbox")).toBeVisible();
    await expect(page.locator(".reference-module-strip")).toHaveCount(0);
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    await page.screenshot({path:"test-artifacts/redesign-r3-admin-mobile.png",fullPage:true});
    await context.close();
  });
});

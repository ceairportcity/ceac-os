import {test,expect} from "@playwright/test";

async function fixture(page,scope="Organisation"){
 await page.addInitScript({path:"tests/fixtures/google-maps-stub.js"});
 await page.route("**/*",async route=>{
  const url=new URL(route.request().url());
  if(!["localhost","127.0.0.1"].includes(url.hostname))return route.abort();
  if(url.pathname.endsWith("/rest/v1/rpc/workforce_map_day")){
   const day=JSON.parse(route.request().postData()||"{}").p_date;
   const roster=[
    {id:"employee-a",profile_id:"person-a",full_name:"Ama Fixture",units:["Operations"]},
    {id:"employee-b",profile_id:"person-b",full_name:"Kojo Fixture",units:["Administration"]},
    {id:"employee-c",profile_id:"person-c",full_name:"Esi Fixture",units:[]},
    {id:"employee-d",profile_id:"person-d",full_name:"Yaw Fixture",units:["Facilities, Logistics and Procurement"]}
   ];
   const sessions=[
    {id:"session-a",profile_id:"person-a",started_at:day+"T08:00:00Z",ended_at:day+"T09:00:00Z",place:"elsewhere",lat:5.61,lng:-0.19},
    {id:"session-b",profile_id:"person-a",started_at:day+"T10:00:00Z",ended_at:null,place:"office",lat:5.60,lng:-0.18,location_accuracy_m:35},
    {id:"session-c",profile_id:"person-b",started_at:day+"T09:00:00Z",ended_at:null,place:"office",lat:5.60,lng:-0.18},
    {id:"session-d",profile_id:"person-c",started_at:day+"T09:10:00Z",ended_at:null,place:"elsewhere",lat:null,lng:null}
   ];
   return route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({
    date:day,as_of:new Date().toISOString(),roster,sessions,operationalProfiles:[],
    roster_count:roster.length,session_count:sessions.length
   })});
  }
  if(url.pathname.includes("/rest/v1/"))return route.fulfill({status:200,contentType:"application/json",body:"null"});
  return route.continue();
 });
 await page.goto(`/tests/fixtures/hr-overview-review.html?scope=${scope}`);
 await expect(page.locator(".adminv2-main")).toBeVisible();
 return ()=>page.evaluate(()=>window.syntheticMaps||0);
}
for(const width of [1440,820,390,320]){
 test(`approved HR hierarchy, default map and responsive controls at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:1100});
  const mapCount=await fixture(page);
  const inbox=page.locator(".ceac-day"),map=page.locator(".workstart-workspace");
  expect((await inbox.boundingBox()).y).toBeLessThan((await map.boundingBox()).y);
  await expect(page.getByRole("complementary",{name:"Upcoming commitments"})).toBeVisible();
  await expect(page.getByRole("region",{name:"Selected work start"})).toHaveCount(0);
  await map.scrollIntoViewIfNeeded();
  await expect.poll(mapCount).toBeGreaterThan(0);
  await page.evaluate(()=>window.scrollTo(0,0));
  await page.screenshot({path:`test-artifacts/hr-approved-overview-${width}.png`,fullPage:true});
  const amaPin=page.getByRole("button",{name:"View recorded work start for Ama Fixture",exact:true});
  const kojoPin=page.getByRole("button",{name:"View recorded work start for Kojo Fixture",exact:true});
  await expect(amaPin.locator(".ceac-map-avatar")).toHaveText("AF");
  await expect(kojoPin.locator(".ceac-map-avatar")).toHaveText("KF");
  await amaPin.click();
  const popup=page.getByRole("region",{name:"Selected work start"});
  await expect(popup).toContainText("Ama Fixture");
  await expect(popup).toContainText("Latest start: 10:00");
  await page.evaluate(()=>window.scrollTo(0,0));
  await page.screenshot({path:`test-artifacts/hr-approved-overview-selected-${width}.png`,fullPage:true});
  await kojoPin.click();await expect(popup).toContainText("Kojo Fixture");
  await popup.getByRole("button",{name:"Close selected work start"}).click();await expect(popup).toHaveCount(0);await expect(kojoPin).toBeFocused();
  await expect.poll(mapCount).toBeGreaterThan(0);
  await expect(map.locator(".workstart-accessible-list")).toHaveCount(0);
  await expect(map.getByRole("region",{name:"Recorded staff attendance details"})).toBeVisible();
  await expect(map.locator(".workforce-attendance-metric")).toHaveCount(0);
  // The compact roster is always available; the map keeps the location summary.
  await expect(map.locator(".workforce-attendance-list").getByRole("button",{name:/Esi Fixture/})).toBeVisible();
  await expect(page.getByRole("button",{name:/View recorded work start for Esi/})).toHaveCount(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  await page.evaluate(()=>window.scrollTo(0,0));
  await page.screenshot({path:`test-artifacts/hr-approved-overview-unavailable-${width}.png`,fullPage:true});
  // A missing session remains factual and may be inspected without a duplicate filter dashboard.
  // Missing sessions are intentionally separate from the default recorded-start view.
  await map.getByRole("combobox",{name:"Filter daily workforce",exact:true}).selectOption("noSession");
  const noSession=map.locator(".workforce-attendance-list").getByRole("button",{name:/Yaw Fixture/});
  await noSession.click();
  await expect(map.locator(".workstart-unmapped-detail")).toHaveCount(1);
  await expect(map.locator(".workstart-unmapped-detail")).toContainText("No session recorded");
  await expect(map.locator(".workstart-unmapped-detail")).not.toContainText("Session ended");
  await map.getByRole("button",{name:"Close details",exact:true}).click();
  await expect(noSession).toBeFocused();
  // The selected person remains reachable in the compact attendance roster.
  await expect(noSession).toBeVisible();
  await page.locator(".adminv2-more-context > summary").click();
  await expect(page.locator(".adminv2-reporting")).toBeVisible();
  await expect(page.locator(".adminv2-delivery")).toBeVisible();
 });
}
for(const scope of ["My","Team","Organisation"]){
 test(`calendar selection, pending/approved separation and request detail for ${scope}`,async({page})=>{
  await fixture(page,scope);
  await page.locator('.ceac-day').getByRole("button",{name:/Ama Fixture.*annual leave/}).first().click();
  const planner=page.getByRole("region",{name:scope+" leave calendar",exact:true});
  await expect(planner).toBeVisible();
  if(scope==='Organisation')await planner.getByRole('button',{name:'Back to requests',exact:true}).click();
  const today=new Date().toISOString().slice(0,10);
  await planner.getByRole("button",{name:today+" · 1 approved · 1 requested",exact:true}).click();
  const inspector=planner.getByRole("complementary",{name:"Leave selection and decisions"});
  await inspector.getByRole("button",{name:/Ama Fixture annual/}).first().click();
  await expect(inspector).toContainText("Waiting for Manager approval");
  await expect(inspector.getByRole("button",{name:/Admin approve|Decline/})).toHaveCount(0);
  await planner.getByRole("button",{name:"Next leave month"}).click();
  await planner.getByRole("button",{name:"Today",exact:true}).click();
  await page.setViewportSize({width:390,height:844});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  await page.screenshot({path:`test-artifacts/timeleave-approved-${scope}-390.png`,fullPage:true});
 });
}

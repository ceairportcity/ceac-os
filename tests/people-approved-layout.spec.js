import {test,expect} from "@playwright/test";
const org="00000000-0000-4000-8000-000000000002";
const unit="00000000-0000-4000-8000-000000000003";
const employees=["Ama Mensima","Kojo Antwi","Esi Danso"].map((full_name,i)=>({id:`00000000-0000-4000-8000-00000000001${i}`,full_name,profile_id:null,org_id:org,employment_status:"active",employment_type:"permanent",job_title:"Administration Officer",identity_state:"roster_only",units:[{unit_id:unit,unit_name:"Administration & HR",is_primary:true}]}));
// This exercises the real People component with synthetic responses; it does not certify server authority.
for(const width of [1440,1366,390,320])test(`approved People list/detail navigation at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:960});
 const errors=[];page.on("pageerror",e=>errors.push(e.message));
 await page.route("**/rest/v1/**",async route=>{
  const req=route.request(),u=new URL(req.url());let data=[];
  if(req.method()==="OPTIONS"){await route.fulfill({status:200,headers:{"access-control-allow-origin":"*","access-control-allow-headers":"*","access-control-allow-methods":"GET,POST,OPTIONS"}});return;}
  const name=u.pathname.split("/").pop();
  const body=req.postDataJSON();
  if(name==="admin_employee_roster_summary")data=employees;
  else if(name==="admin_employee_roster_detail"){const employee=employees.find(e=>e.id===body.p_employee_id);data={employee,units:employee.units};}
  else if(name==="employee_roster"){const id=u.searchParams.get("id")?.replace("eq.","");data={...employees.find(e=>e.id===id),hr_contact_email:null,hr_contact_phone:null,hr_started_on:null};}
  else if(name==="units")data=[{id:unit,name:"Administration & HR"}];
  else if(name==="leave_policy_versions")data=[{id:"policy",confirmed_at:"2026-01-01",effective_from:"2026-01-01",effective_to:null}];
  else if(name==="leave_policy_rules")data=[{policy_version_id:"policy",leave_kind:"annual",complete:true,entitlement_amount:24,accrual_rate:6}];
  await route.fulfill({status:200,contentType:"application/json",headers:{"access-control-allow-origin":"*","access-control-expose-headers":"content-range"},body:JSON.stringify(data)});
 });
 await page.goto("/tests/fixtures/people-layout.html");
 const rail=page.getByRole("complementary",{name:"Employee directory"});
 await expect(rail).toBeVisible();
 await expect(rail.getByLabel("Show",{exact:true})).toHaveValue("all");
 await expect(rail.getByRole("button",{name:/Ama Mensima/})).toContainText("Roster only");
 await rail.getByRole("button",{name:/Ama Mensima/}).click();
 await expect(page.getByRole("heading",{name:"Ama Mensima",exact:true})).toBeVisible();
 await expect(rail)[width>900?"toBeVisible":"toBeHidden"]();
 const pane=page.getByRole("region",{name:"Selected employee record"});
 for(const label of ["Overview","Access","Employment","Work","Time & Leave","Development","Learning","Equipment","Documents","History"]){
  const tab=pane.getByRole("tab",{name:label,exact:true});await tab.click();await expect(tab).toHaveAttribute("aria-selected","true");
 }
 await pane.getByRole("tab",{name:"Overview",exact:true}).click();
 const actions=page.getByRole("group",{name:"Employee record actions"});
 for(const name of ["Edit employee record","Assign / transfer department","Work schedule","Documents","Invite account"])await expect(actions.getByRole("button",{name,exact:true})).toBeVisible();
 if(width>900){
  const l=await rail.boundingBox(),r=await pane.boundingBox();expect(l.x+l.width).toBeLessThanOrEqual(r.x+1);
  await rail.getByRole("button",{name:/Kojo Antwi/}).click();await expect(page.getByRole("heading",{name:"Kojo Antwi",exact:true})).toBeVisible();
 }else{await page.getByRole("button",{name:"← All people"}).click();await expect(rail).toBeVisible();}
 const views=page.getByRole("tablist",{name:"People views"});
 await views.getByRole("tab",{name:"Organisation",exact:true}).click();await expect(page.getByText("Recorded unit membership and role context only. Job titles never create authority.")).toBeVisible();
 await views.getByRole("tab",{name:"Needs attention",exact:true}).click();await expect(page.getByText("Units without a recorded head",{exact:true})).toBeVisible();
 await views.getByRole("tab",{name:/^Access(?: administration)?$/}).click();
 await expect(page.locator(".phase5-people-access")).toBeVisible();
 await views.getByRole("tab",{name:"Directory",exact:true}).click();await expect(rail).toBeVisible();
 await rail.getByRole("button",{name:/Ama Mensima/}).click();await expect(page.getByRole("heading",{name:"Ama Mensima",exact:true})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
 expect(errors).toEqual([]);
 await page.screenshot({path:`test-artifacts/people-approved-layout-${width}.png`,fullPage:true});
});

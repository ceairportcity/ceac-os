import {test,expect} from '@playwright/test';
// Synthetic API responses verify presentation and browser interaction only.
// Real Auth/RLS/save persistence remains covered by the local-database release gate.
async function mockSettings(page,{unavailableCodes=false,failedSave=false}={}) {
 let office={id:'synthetic-office',name:'CEAC main office',lat:5.6,lng:-0.2,radius_meters:100,is_primary:true,set_at:'2026-10-25T06:00:00Z'};
 const alert={name:'quiet_days',label:'active work has not moved for',value:7,unit_label:'days'};
 await page.route('**/rest/v1/**',async route=>{
  const request=route.request();const url=new URL(request.url());const table=url.pathname.split('/').pop();
  if(unavailableCodes&&table==='attendance_integrity_status')return route.fulfill({status:404,json:{code:'PGRST202',message:'Could not find the function attendance_integrity_status'}});
  let data=[];
  if(table==='office_locations'){
   if(request.method()==='PATCH'){
    if(failedSave)return route.fulfill({status:403,json:{message:'Save refused by fixture'}});
    office={...office,...request.postDataJSON()};
   }
   data=request.headers().accept?.includes('object')?office:[office];
  }else if(table==='units')data=[{id:'synthetic-unit',name:'Administration'}];
  else if(table==='unit_memberships')data=[{unit_id:'synthetic-unit',profile_id:'synthetic-admin'}];
  else if(table==='leave_policy_versions')data=null;
  else if(table==='thresholds'){
   if(request.method()==='PATCH')Object.assign(alert,request.postDataJSON());
   data=request.headers().accept?.includes('object')?alert:[alert];
  }else if(table==='attendance_integrity_status')data={};
  await route.fulfill({status:200,json:data});
 });
 await page.route('https://www.google.com/maps**',route=>route.abort());
}
for(const width of [320,390,430,1366])test(`approved settings journey renders and returns at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:900});await mockSettings(page);
 await page.goto('/tests/fixtures/control-center-design.html');
 const hub=page.locator('.control-center');
 await expect(hub.getByRole('heading',{name:'Control Center',exact:true})).toBeVisible();
 await expect(hub.locator('.control-setting-row')).toHaveCount(9);
 expect(await hub.evaluate(node=>getComputedStyle(node).backgroundColor)).toBe('rgb(255, 255, 255)');
 expect(await hub.locator('header').evaluate(node=>getComputedStyle(node).backgroundImage)).toBe('none');
 await expect(page.locator('.control-center-trail')).toHaveCount(0);
 await page.screenshot({path:`test-artifacts/control-center-approved-${width}.png`,fullPage:true});
 await hub.getByLabel('Find a setting').fill('office');
 await expect(hub.locator('.control-setting-row')).toHaveCount(1);
 await hub.getByRole('button',{name:/^Attendance & locations/}).click();
 await expect(page.getByRole('heading',{name:'Attendance & locations',exact:true})).toBeVisible();
 await expect(page.locator('.control-setting-row')).toHaveCount(3);
 await page.getByRole('button',{name:/^Office location/}).click();
 await expect(page.getByLabel('Office name',{exact:true})).toHaveValue('CEAC main office');
 await expect(page.getByLabel('Check-in area',{exact:true})).toHaveValue('100');
 await page.screenshot({path:`test-artifacts/office-location-approved-${width}.png`,fullPage:true});
 await page.getByRole('button',{name:'Back to Attendance & locations',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Attendance & locations',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Back to Control Center',exact:true}).click();
 await expect(hub).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
 await hub.getByRole('button',{name:'People & Access',exact:true}).click();
 await expect(page.getByRole('heading',{name:'People & Access',exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:/Back to Control Center/})).toHaveCount(0);
});
test('focused office save verifies returned data and keeps a failed save visible',async({page})=>{
 await mockSettings(page);await page.goto('/tests/fixtures/control-center-design.html?tab=office-settings&setting=office');
 await page.getByLabel('Office name',{exact:true}).fill('Updated fixture office');
 await page.getByRole('button',{name:'Save changes',exact:true}).click();
 await expect(page.getByText('Office location saved',{exact:true})).toBeVisible();
 await page.reload();await expect(page.getByLabel('Office name',{exact:true})).toHaveValue('Updated fixture office');
});
test('save denial does not report success',async({page})=>{
 await mockSettings(page,{failedSave:true});await page.goto('/tests/fixtures/control-center-design.html?tab=office-settings&setting=office');
 await page.getByLabel('Office name',{exact:true}).fill('Rejected fixture change');
 await page.getByRole('button',{name:'Save changes',exact:true}).click();
 await expect(page.getByText('Office location was not saved',{exact:true})).toBeVisible();
 await expect(page.getByText('Office location saved',{exact:true})).toHaveCount(0);
});
test('unassigned settings and undeployed code issuer stay unavailable',async({page})=>{
 await mockSettings(page,{unavailableCodes:true});await page.goto('/tests/fixtures/control-center-design.html?access=limited');
 await expect(page.getByLabel('Find a setting')).toBeVisible();
 for(const name of ['Access permissions','Connected apps','Activity history'])await expect(page.locator('.control-setting-row').filter({hasText:name})).toHaveCount(0);
 await page.goto('/tests/fixtures/control-center-design.html?tab=office-settings&setting=codes');
 await expect(page.getByText('Check-in codes unavailable',{exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:/Issue code/})).toHaveCount(0);
});
test('mobile header reserves a simulated safe area without doubling staff padding',async({page})=>{
 await page.setViewportSize({width:390,height:844});await mockSettings(page);
 await page.goto('/tests/fixtures/control-center-design.html');
 await expect(page.locator('.ev2s-mobile-topbar')).toBeVisible();
 await page.locator('.app').evaluate(node=>node.className='app staff-app');
 const bodyPadding = await page.locator('.app .body').evaluate(node=>parseFloat(getComputedStyle(node).paddingTop));
 await page.addStyleTag({content:':root{--ceac-safe-area-top:47px}'});
 expect(await page.locator('.ev2s-mobile-topbar').evaluate(node=>parseFloat(getComputedStyle(node).paddingTop))).toBe(47);
 const row=await page.locator('.ev2s-mobile-toprow').boundingBox();expect(row.y).toBeGreaterThanOrEqual(47);
 expect(await page.locator('.app .body').evaluate(node=>parseFloat(getComputedStyle(node).paddingTop))).toBe(bodyPadding);
});

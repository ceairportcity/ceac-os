import {test,expect} from '@playwright/test';
const date=new Date().toISOString().slice(0,10);
async function fixture(page,{failCases=false,failOffice=false,asAdmin=false,hiddenProfile=false}={}){
 let tiles=0;
 await page.route('**/*',async route=>{
  const url=new URL(route.request().url());
  if(url.hostname==='tile.openstreetmap.org'){
   tiles++;return route.fulfill({status:200,contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jR5sAAAAASUVORK5CYII=','base64')});
  }
  if(url.pathname.includes('/rest/v1/')){
   const name=url.pathname.split('/').at(-1);
   if(name==='compliance_attendance_case_register'&&failCases)return route.fulfill({status:503,contentType:'application/json',body:'{"message":"Unavailable"}'});
   if(name==='office_locations'){
    expect(url.searchParams.get('org_id')).toBe('eq.synthetic-org');
    expect(url.searchParams.get('is_primary')).toBe('eq.true');
    return route.fulfill({status:failOffice?503:200,contentType:'application/json',body:JSON.stringify(failOffice?{message:'Unavailable'}:{name:'Saved CEAC office',lat:'5.61',lng:'-0.19',is_primary:true})});
   }
   const data={
    compliance_attendance_case_register:[{id:'case-a',employee_name:'Employee A',category:'missing_evidence',work_date:date,status:'open',events:[]}],
    attendance_day_evidence:[{employee_id:'employee-a',profile_id:'person-a',name:'Employee A',unit_id:'unit-a',expected_today:true,expected_start:'09:00',expected_end:'17:00',sessions:[],approved_leave:[],notices:[]}],
    compliance_evidence_versions:[{id:'evidence-a',state:'submitted',created_at:date,profile:{full_name:'Employee B'},requirement:{title:'Safety evidence'},evidence_reference:'Synthetic reference'}],
    compliance_exception_versions:[{id:'exception-a',state:'requested',created_at:date,profile:{full_name:'Employee C'},requirement:{title:'Temporary policy exception'}}],
    profiles:[{id:'person-a',full_name:'Employee A',active:true}],units:[{id:'unit-a',name:'Operations',active:true}],
   }[name]||[];
   if(hiddenProfile&&['compliance_evidence_versions','compliance_exception_versions'].includes(name)){
    for(const row of data){row.profile_id='person-a';row.profile=null;}
   }
   return route.fulfill({status:200,headers:{'content-type':'application/json','access-control-allow-origin':'*','access-control-expose-headers':'content-range','content-range':data.length?`0-${data.length-1}/${data.length}`:'*/0'},body:JSON.stringify(data)});
  }
  if(!['localhost','127.0.0.1'].includes(url.hostname))return route.abort();
  return route.continue();
 });
 await page.goto('/tests/fixtures/compliance-workbench.html'+(asAdmin?'?role=admin':''));
 await expect(page.getByRole('heading',{name:'Compliance',exact:true})).toBeVisible();
 if(!asAdmin)await expect(page.getByRole('heading',{name:'Your review desk'})).toBeVisible();
 return ()=>tiles;
}
for(const width of [1440,820,390,320])test(`Compliance approved review-first layout and connected actions at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:1100});await fixture(page);
 const desk=page.locator('.cp-desk'),attendance=page.locator('.cp-attendance'),map=page.locator('.workstart-workspace');
 await expect(desk.locator('.cp-item')).toHaveCount(3);
 expect((await desk.boundingBox()).y).toBeLessThan((await attendance.boundingBox()).y);
 expect((await attendance.boundingBox()).y).toBeLessThan((await map.boundingBox()).y);
 await expect(page.locator('.compliance-overview-facts')).toHaveCount(0);
 const tabs=page.getByRole('tablist',{name:'Compliance sections'});
 const sizes=await tabs.getByRole('tab').evaluateAll(nodes=>nodes.map(node=>({width:node.getBoundingClientRect().width,content:node.scrollWidth})));
 for(const size of sizes)expect(size.content).toBeLessThanOrEqual(size.width+1);
 await expect(page.locator('.cp-attendance')).toContainText('No session recorded');
 await expect(page.getByRole('region',{name:'Selected work start'})).toHaveCount(0);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
 await page.screenshot({path:`test-artifacts/compliance-approved-${width}.png`,fullPage:true});
 await page.getByRole('combobox',{name:'Filter Compliance review items'}).selectOption('evidence');
 await expect(desk.locator('.cp-item')).toHaveCount(1);
 await page.getByRole('button',{name:'Review evidence for Employee B',exact:true}).click();
 await expect(page.getByRole('dialog')).toBeVisible();
});
test('review targets the recorded case and observation creation opens existing form',async({page})=>{
 await fixture(page);
 await page.getByRole('button',{name:'Review attendance case for Employee A',exact:true}).click();
 await expect(page.getByRole('article',{name:'Selected attendance observation'})).toContainText('Employee A');
 await page.getByRole('tab',{name:'Overview',exact:true}).click();
 await page.getByRole('button',{name:'Record observation',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Record an attendance observation'})).toBeVisible();
});
test('exception review and policy links use their existing record workflows',async({page})=>{
 await fixture(page);
 await page.getByRole('button',{name:'Review exception request for Employee C',exact:true}).click();
 await expect(page.getByRole('dialog')).toBeVisible();
 await expect(page.getByRole('dialog')).toContainText('Temporary policy exception');
});
test('failed case read stays explicit while verified evidence remains reviewable',async({page})=>{
 await fixture(page,{failCases:true});
 await expect(page.getByRole('alert')).toContainText('Attendance cases unavailable');
 await expect(page.getByRole('button',{name:'Review evidence for Employee B',exact:true})).toBeVisible();
 await expect(page.locator('.cp-empty')).toHaveCount(0);
});

for(const width of [1440,390,320])test(`empty Compliance map defaults to saved office and remains usable at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:1100});const tileCount=await fixture(page);
 const map=page.getByRole('region',{name:'Recorded workforce work-start street map'});
 await map.scrollIntoViewIfNeeded();
 await expect.poll(tileCount).toBeGreaterThan(0);
 await expect(map.getByRole('img',{name:/CEAC main office · Saved CEAC office/})).toBeVisible();
 await expect(map.getByRole('button',{name:/View recorded work start|shared work-start/})).toHaveCount(0);
 await expect(map).toContainText('No recorded start GPS');
 await expect(page.getByRole('button',{name:/Open authorised work/})).toHaveCount(0);
 await map.getByRole('button',{name:'Zoom in on street map'}).click();
 await map.getByRole('button',{name:'Fit staff start locations'}).click();
 await expect(map.locator('.ceac-office-reference')).toHaveCSS('background-color','rgb(20, 73, 153)');
 await page.evaluate(()=>window.scrollTo(0,0));
 await page.screenshot({path:`test-artifacts/compliance-office-map-${width}.png`,fullPage:true});
 await map.getByRole('button',{name:'Hide street map'}).click();
 const enable=map.getByRole('button',{name:'Enable street map'});
 await expect(enable).toBeEnabled();await enable.click();
 await expect(map.getByRole('img',{name:/CEAC main office/})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});
test('office read failure is explicit without blocking default map or exposing a fake office',async({page})=>{
 const tileCount=await fixture(page,{failOffice:true});
 const map=page.getByRole('region',{name:'Recorded workforce work-start street map'});
 await map.scrollIntoViewIfNeeded();await expect.poll(tileCount).toBeGreaterThan(0);
 await expect(page.getByRole('status')).toContainText('saved office reference could not be loaded');
 await expect(map.getByRole('img',{name:/CEAC main office/})).toHaveCount(0);
});

test('HR direct-link access remains personal even with its legacy organisation-wide Compliance grant',async({page})=>{
 await fixture(page,{asAdmin:true});
 await expect(page.getByRole('heading',{name:'Your review desk'})).toHaveCount(0);
 await expect(page.getByRole('tab',{name:'Overview',exact:true})).toHaveCount(0);
 await expect(page.getByRole('tab',{name:'Attendance cases',exact:true})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Record observation',exact:true})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Publish policy',exact:true})).toHaveCount(0);
 await expect(page.getByRole('region',{name:'Recorded workforce work-start street map'})).toHaveCount(0);
 await expect(page.getByText('My compliance',{exact:true})).toBeVisible();
 await expect(page.getByRole('tab',{name:'Policies',exact:true})).toBeVisible();
});

test('Compliance uses already-authorised names for cross-department evidence and exception reviews',async({page})=>{
 await fixture(page,{hiddenProfile:true});
 await page.getByRole('button',{name:'Review evidence for Employee A',exact:true}).click();
 await expect(page.getByRole('dialog')).toContainText('Employee A');
 await page.getByRole('button',{name:'Close dialog',exact:true}).click();
 await page.getByRole('tab',{name:'Evidence',exact:true}).click();
 const row=page.locator('.row').filter({hasText:'Safety evidence'}).filter({hasText:'Employee A'});
 await row.getByRole('button',{name:'Review evidence',exact:true}).click();
 await expect(page.getByRole('dialog')).toContainText('Employee A');
});

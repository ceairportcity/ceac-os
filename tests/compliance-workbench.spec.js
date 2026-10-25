import {test,expect} from '@playwright/test';
const date=new Date().toISOString().slice(0,10);
async function fixture(page,{failCases=false}={}){
 await page.route('**/*',async route=>{
  const url=new URL(route.request().url());
  if(url.pathname.includes('/rest/v1/')){
   const name=url.pathname.split('/').at(-1);
   if(name==='compliance_attendance_case_register'&&failCases)return route.fulfill({status:503,contentType:'application/json',body:'{"message":"Unavailable"}'});
   const data={
    compliance_attendance_case_register:[{id:'case-a',employee_name:'Employee A',category:'missing_evidence',work_date:date,status:'open',events:[]}],
    attendance_day_evidence:[{employee_id:'employee-a',profile_id:'person-a',name:'Employee A',unit_id:'unit-a',expected_today:true,expected_start:'09:00',expected_end:'17:00',sessions:[],approved_leave:[],notices:[]}],
    compliance_evidence_versions:[{id:'evidence-a',state:'submitted',created_at:date,profile:{full_name:'Employee B'},requirement:{title:'Safety evidence'},evidence_reference:'Synthetic reference'}],
    compliance_exception_versions:[{id:'exception-a',state:'requested',created_at:date,profile:{full_name:'Employee C'},requirement:{title:'Temporary policy exception'}}],
    profiles:[{id:'person-a',full_name:'Employee A',active:true}],units:[{id:'unit-a',name:'Operations',active:true}],
   }[name]||[];
   return route.fulfill({status:200,headers:{'content-type':'application/json','access-control-allow-origin':'*','access-control-expose-headers':'content-range','content-range':data.length?`0-${data.length-1}/${data.length}`:'*/0'},body:JSON.stringify(data)});
  }
  if(!['localhost','127.0.0.1'].includes(url.hostname))return route.abort();
  return route.continue();
 });
 await page.goto('/tests/fixtures/compliance-workbench.html');
 await expect(page.getByRole('heading',{name:'Your review desk'})).toBeVisible();
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

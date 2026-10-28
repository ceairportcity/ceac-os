import {test,expect} from '@playwright/test';
const today=new Date().toISOString().slice(0,10);
async function sources(page,{failed=false}={}){
 await page.route('**/*',route=>{
  const req=route.request(),u=new URL(req.url());
  if(!u.pathname.includes('/rest/v1/'))return ['127.0.0.1','localhost'].includes(u.hostname)?route.continue():route.abort();
  const name=u.pathname.split('/').pop();
  const roster=[{id:'employee-a',profile_id:'person-a',full_name:'Ama Fixture',units:[{name:'Operations'}]},{id:'employee-b',profile_id:null,full_name:'Kojo Roster',units:[{name:'Operations'}]}];
  if(failed&&name==='work_sessions')return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'Synthetic sessions unavailable'})});
  const data={employment_records:[{profile_id:'person-a',unit_id:'unit',profiles:{full_name:'Ama Fixture',active:true},units:{name:'Operations'}}],admin_employee_roster_summary:roster,work_sessions:[{id:'session',profile_id:'person-a',started_at:today+'T10:04:00Z',ended_at:null,place:'elsewhere'}],leave_requests:[{id:'pending',profile_id:'person-a',kind:'annual',days:1,start_date:today,end_date:today,status:'pending',profiles:{full_name:'Ama Fixture'}},{id:'approved',profile_id:'person-a',kind:'study',days:1,start_date:today,end_date:today,status:'approved',profiles:{full_name:'Ama Fixture'}}],workforce_day_types:[{id:'office',name:'Office day',session_expected:true}],workforce_schedule_versions:[{id:'schedule',profile_id:'person-a',employee_id:'employee-a',effective_from:'2026-01-01',day_map:Object.fromEntries(['mon','tue','wed','thu','fri','sat','sun'].map(x=>[x,'office'])),expected_start:'10:00',expected_end:'17:00'}],leave_policy_versions:[{id:'policy',state:'active',name:'Recorded policy'}],my_sessions:[{session_id:'session',device:'Firefox/ on Linux',last_seen:today+'T10:00Z',signed_in_at:today+'T09:00Z',is_current:true}],my_account_activity:[{action:'account.password_updated',at:today+'T10:00Z',by_me:true}]};
  return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data[name]||[])});
 });
}
for(const width of [390,1440]){
 test(`Time & Leave approved workspace and connected review at ${width}`,async({page})=>{
  await page.setViewportSize({width,height:1000});await sources(page);
  await page.goto('/tests/fixtures/control-center-design.html?tab=attendance');
  await expect(page.getByRole('heading',{name:'Time & Leave',exact:true})).toBeVisible();
  const tabs=page.getByRole('tablist',{name:'Administration workforce sections'}),summary=page.getByLabel('Time and leave summary');
  await expect(summary).toBeVisible();expect((await tabs.boundingBox()).y).toBeLessThan((await summary.boundingBox()).y);
  await expect(summary).toContainText('Schedules need attention');await expect(summary.locator('strong')).toHaveText(['1','1','1']);
  await expect(page.getByRole('heading',{name:'Team availability',exact:true})).toBeVisible();
  const register=page.getByRole('table',{name:'Recorded work sessions today'});await expect(register).toContainText('Ama Fixture');await expect(register).toContainText('Kojo Roster');
  await expect(page.getByText('No CEAC login account',{exact:true})).toBeVisible();
  expect(await register.locator('small').evaluateAll(nodes=>nodes.every(node=>parseFloat(getComputedStyle(node).fontSize)>=12))).toBe(true);
  await expect(page.getByLabel('Attendance evidence date')).not.toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  await page.screenshot({path:`test-artifacts/timeleave-repaired-${width}.png`,fullPage:true});
  await page.getByRole('button',{name:'Review requests · 1',exact:true}).click();
  await expect(page.getByRole('tab',{name:'Leave requests',exact:true})).toHaveAttribute('aria-selected','true');
  const planner=page.getByRole('region',{name:'Organisation leave calendar'});
  await planner.getByRole('button',{name:/Ama Fixture annual/}).last().click();
  await expect(planner).toContainText('Waiting for Manager approval');await expect(planner.getByRole('button',{name:'Admin approve',exact:true})).toHaveCount(0);
  await page.getByRole('tab',{name:'Overview',exact:true}).click();
  await register.getByRole('button',{name:'Inspect sessions',exact:true}).click();
  await expect(page.getByRole('tab',{name:'Work sessions',exact:true})).toHaveAttribute('aria-selected','true');
  await expect(page.locator('.workforce-session-row')).toContainText('Ama Fixture');
 });
 test(`account security separates devices and activity at ${width}`,async({page})=>{
  await page.setViewportSize({width,height:1000});await sources(page);
  await page.goto('/tests/fixtures/hr-overview-review.html?audit=screen&screen=account');
  await expect(page.getByRole('heading',{name:'Your account',exact:true})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Recent activity',exact:true})).not.toBeVisible();
  await page.getByRole('tab',{name:'Sessions',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Signed in devices',exact:true})).toBeVisible();
  await expect(page.getByText('Firefox on Linux',{exact:true})).toBeVisible();
  await page.getByRole('tab',{name:'Account activity',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Recent activity',exact:true})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Signed in devices',exact:true})).not.toBeVisible();
  await page.screenshot({path:`test-artifacts/account-repaired-${width}.png`,fullPage:true});
 });
}
test('failed session read withholds summary and roster classifications',async({page})=>{
 await sources(page,{failed:true});await page.goto('/tests/fixtures/control-center-design.html?tab=attendance');
 await expect(page.getByRole('button',{name:'Retry Workforce data',exact:true})).toBeVisible();
 await expect(page.getByRole('table',{name:'Recorded work sessions today'})).toHaveCount(0);
 await expect(page.getByLabel('Time and leave summary')).toHaveCount(0);
 await expect(page.getByText(/No employee is marked absent/)).toBeVisible();
});

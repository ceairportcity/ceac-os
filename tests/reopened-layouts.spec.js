import {test,expect} from '@playwright/test';
const fixture='/tests/fixtures/hr-overview-review.html?audit=screen&screen=';
async function api(page,data={}){
 await page.route('**/*',route=>{
  const url=new URL(route.request().url());
  if(!url.pathname.includes('/rest/v1/'))return ['localhost','127.0.0.1'].includes(url.hostname)?route.continue():route.abort();
  const name=url.pathname.split('/').pop();
  const rows=data[name]||[];
  return route.fulfill({status:200,contentType:'application/json',headers:{'content-range':`0-0/${Array.isArray(rows)?rows.length:1}`,'access-control-expose-headers':'content-range'},body:JSON.stringify(rows)});
 });
}
for(const width of [390,1440]){
 test(`recurrence fields stay in their own rows inside a narrow day panel at ${width}`,async({page})=>{
  await page.setViewportSize({width,height:1000});await api(page);
  await page.goto('/tests/fixtures/owner-corrections.html?screen=recurrence&actor=admin');
  await page.getByRole('button',{name:'New repetition',exact:true}).click();
  const title=page.getByLabel('Recurring task title',{exact:true});await title.fill('Private recurring task');
  const controls=page.locator('.phase6-private-task-compose>label');
  const boxes=await controls.evaluateAll(nodes=>nodes.map(node=>{const r=node.getBoundingClientRect();return {top:r.top,bottom:r.bottom,left:r.left,right:r.right};}));
  expect(boxes.length).toBeGreaterThanOrEqual(6);
  boxes.slice(1).forEach((box,i)=>expect(box.top).toBeGreaterThanOrEqual(boxes[i].bottom));
  await page.getByLabel('Recurring task frequency',{exact:true}).selectOption('custom');
  await page.getByLabel('Recurring task ending',{exact:true}).selectOption('after_count');
  await expect(page.getByLabel('Recurring task occurrence count')).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
  await page.screenshot({path:`test-artifacts/reopened-recurrence-${width}.png`,fullPage:true});
 });
 test(`Units register is bounded and every existing unit section remains reachable at ${width}`,async({page})=>{
  await page.setViewportSize({width,height:1000});await api(page,{units:Array.from({length:30},(_,i)=>({id:'unit-'+i,name:'Department '+String(i).padStart(2,'0'),code:'D'+i})),unit_memberships:[{unit_id:'unit-0',role:'manager',profile_id:'person',profiles:{id:'person',full_name:'Recorded head',active:true}}]});
  await page.goto(fixture+'units');const register=page.getByRole('region',{name:'Organisation units register'});
  await expect(register.getByRole('row')).toHaveCount(31);
  expect(await register.evaluate(node=>node.scrollHeight>node.clientHeight)).toBe(true);
  await page.getByLabel('Find a unit',{exact:true}).fill('Department 00');
  await page.getByRole('button',{name:'Open Department 00',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Department 00',exact:true})).toBeVisible();
  for(const name of ['People','Work','Objectives','Projects','Reporting','Attendance','Cost','Overview']){
   await page.getByRole('tablist',{name:'Unit sections'}).getByRole('tab',{name,exact:true}).click();
   await expect(page.getByRole('region',{name:'Department 00 '+name.toLowerCase(),exact:true})).toBeVisible();
  }
  await page.getByRole('button',{name:'Edit setup',exact:true}).click();
  const setup=page.getByRole('dialog',{name:'Edit unit',exact:true});
  await expect(setup.getByLabel('Unit name',{exact:true})).toHaveValue('Department 00');
  await setup.getByRole('button',{name:'Close',exact:true}).click();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
  await page.screenshot({path:`test-artifacts/reopened-unit-${width}.png`,fullPage:true});
 });
}
test('failed street tiles offer retry while employee markers remain readable',async({page})=>{
 let failed=true,requests=0;
 await page.route('https://tile.openstreetmap.org/**',route=>{requests++;return failed?route.abort():route.fulfill({status:200,contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64')});});
 await page.goto('/tests/fixtures/owner-corrections.html?screen=map&actor=admin');
 const retry=page.getByRole('button',{name:'Retry street map',exact:true});await expect(retry).toBeVisible();
 await page.getByRole('button',{name:'View recorded work start for Synthetic colleague',exact:true}).click();
 await expect(page.getByRole('region',{name:'Selected work start'})).toContainText('Synthetic work-start record');
 const before=requests;failed=false;await retry.click();
 await expect(retry).toHaveCount(0);expect(requests).toBeGreaterThan(before);
 await expect(page.locator('.ceac-street-map-tiles img').first()).toBeVisible();
});
test('Pending Decisions shows the original dated employment snapshot and an optional comment',async({page})=>{
 const before={id:'old',created_at:'2026-10-01T09:00Z',effective_on:'2026-10-01',employment_type:'fixed_term',job_title:'Coordinator',employment_status:'active'};
 const after={...before,id:'event',created_at:'2026-10-27T09:00Z',effective_on:'2026-11-01',employment_type:'permanent',change_type:'employment_details_changed',actor_name:'HR colleague',reason:'Authorised contract change'};
 await api(page,{workflow_definitions:[{id:'definition',workflow_key:'employment-change-review',label:'Employment change review'}],workflow_runs:[{id:'run',workflow_definition_id:'definition',source_event_id:'source',subject_profile_id:'person'}],workflow_run_steps:[{id:'step',workflow_run_id:'run',label:'Review employment change',required_capability:'people.manage',state:'ready',created_at:'2026-10-27T09:00Z'}],profiles:[{id:'person',full_name:'Synthetic colleague'}],platform_events:{id:'source',event_type:'employment.changed',payload:{change_type:'employment_details_changed'},idempotency_key:'employment:event'},admin_employment_detail:{history:[after,before]}});
 await page.goto(fixture+'workflows');await page.getByRole('button',{name:/Review employment change/}).click();
 const context=page.getByRole('region',{name:'Original change'});await expect(context).toContainText('Fixed Term');await expect(context).toContainText('Permanent');await expect(context).toContainText('2026-11-01');
 await expect(page.getByRole('button',{name:'Confirm review',exact:true})).toBeEnabled();
 await expect(page.getByLabel('Check outcome')).toHaveCount(0);await expect(page.getByLabel('Check review note')).toHaveValue('');
});
test('a check with unverified original details cannot be marked reviewed',async({page})=>{
 await api(page,{workflow_definitions:[{id:'definition',workflow_key:'employment-change-review'}],workflow_runs:[{id:'run',workflow_definition_id:'definition',source_event_id:'source',subject_profile_id:'person'}],workflow_run_steps:[{id:'step',workflow_run_id:'run',label:'Review employment change',required_capability:'people.manage',state:'ready',created_at:'2026-10-27T09:00Z'}],platform_events:{id:'source',event_type:'employment.changed',idempotency_key:'employment:missing-history'},admin_employment_detail:{history:[]}});
 await page.goto(fixture+'workflows');await page.getByRole('button',{name:/Review employment change/}).click();
 await expect(page.getByRole('status').filter({hasText:'original employment change was not found'})).toBeVisible();
 await expect(page.getByRole('button',{name:'Confirm review',exact:true})).toBeDisabled();
 await expect(page.getByRole('button',{name:'Flag for follow-up',exact:true})).toBeDisabled();
});
test('restoring review authority requires fresh original-change verification',async({page})=>{
 const change={id:'event',created_at:'2026-10-27T09:00Z',effective_on:'2026-10-27',employment_type:'permanent',change_type:'employment_details_changed'};
 await api(page,{workflow_definitions:[{id:'definition',workflow_key:'employment-change-review'}],workflow_runs:[{id:'run',workflow_definition_id:'definition',source_event_id:'source',subject_profile_id:'person'}],workflow_run_steps:[{id:'step',workflow_run_id:'run',label:'Review employment change',required_capability:'people.manage',state:'ready',created_at:'2026-10-27T09:00Z'}],platform_events:{id:'source',event_type:'employment.changed',idempotency_key:'employment:event'}});
 let allowed=true,hold=null;
 await page.route('**/rest/v1/rpc/admin_employment_detail',async route=>{
  if(!allowed)return route.fulfill({status:403,contentType:'application/json',body:JSON.stringify({message:'Synthetic authority revoked'})});
  if(hold)await hold;
  return route.fulfill({contentType:'application/json',body:JSON.stringify({history:[change]})});
 });
 await page.goto('/tests/fixtures/owner-corrections.html?screen=workflows&actor=admin&permissiontest=1');
 await page.getByRole('button',{name:/Review employment change/}).click();
 await expect(page.getByRole('button',{name:'Confirm review',exact:true})).toBeEnabled();
 allowed=false;await page.getByRole('button',{name:'Toggle review permission',exact:true}).dispatchEvent('click');
 await expect(page.getByRole('button',{name:'Confirm review',exact:true})).toHaveCount(0);
 await expect(page.getByText('The employment history could not be verified. No review has been recorded.',{exact:true})).toBeVisible();
 let release;hold=new Promise(resolve=>{release=resolve;});allowed=true;
 await page.getByRole('button',{name:'Toggle review permission',exact:true}).dispatchEvent('click');
 await expect(page.getByRole('button',{name:'Confirm review',exact:true})).toBeDisabled();
 release();await expect(page.getByRole('button',{name:'Confirm review',exact:true})).toBeEnabled();
});

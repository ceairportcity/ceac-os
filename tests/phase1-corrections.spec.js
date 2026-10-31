import {test,expect} from '@playwright/test';

async function mock(page){
 const writes=[],activities=[];let failUpload=true;
 const support={id:'case',reference:'TS-001',category:'cannot_upload',summary:'Synthetic upload issue',description:'The document upload fails after choosing a file.',reported_by:'reporter',affected_profile_id:'reporter',affected_unit_id:'unit',state:'open',assigned_to:null,impact:'normal',opened_at:'2026-10-28T09:00:00Z',updated_at:'2026-10-28T09:00:00Z'};
 await page.route('**/*',async route=>{
  const req=route.request(),u=new URL(req.url()),name=u.pathname.split('/').pop();
  const reply=(data,status=200)=>route.fulfill({status,contentType:'application/json',headers:{'content-range':Array.isArray(data)?`*/${data.length}`:'*/1','access-control-expose-headers':'content-range'},body:JSON.stringify(data)});
  if(u.pathname.includes('/storage/v1/object/')){writes.push({name:'storage'});if(failUpload){failUpload=false;return reply({message:'Synthetic upload failed'},500);}return reply({Key:'evidence'});}
  if(!u.pathname.includes('/rest/v1/'))return ['localhost','127.0.0.1'].includes(u.hostname)?route.continue():route.abort();
  if(req.method()!=='GET'&&req.method()!=='HEAD'){
   const body=req.postDataJSON();writes.push({name,body});
   if(name==='work_activity_records'){const entry={...body,id:'activity',recorded_at:'2026-10-29T09:00:00Z',contributor:{full_name:'Synthetic colleague'}};activities.push(entry);return reply({id:entry.id});}
   if(name==='plan_work_activity_followup')return reply('task');
   if(name==='support_case_people')return reply([{case_id:'case',reporter_name:'Synthetic reporter',affected_name:'Synthetic reporter',department_name:'Synthetic IT'}]);
   if(name==='register_operational_file')return reply({file_id:'file',storage_path:'synthetic/evidence.pdf',storage_bucket:'ceac-operational-private'});
   if(name==='support_cases'){if(req.method()!=='POST')Object.assign(support,body);return reply(req.method()==='POST'?null:support);}
   return reply(null);
  }
  if(name==='work_activity_records')return reply(u.searchParams.has('count')?activities:(u.searchParams.has('id')?activities[0]:activities));
  if(name==='support_team_memberships')return reply({id:'membership',role:'member'});
  if(name==='support_cases')return reply([support]);
  if(name==='profiles')return reply([{id:'reporter',full_name:'Synthetic reporter'}]);
  if(name==='units')return reply([{id:'unit',name:'Synthetic IT'}]);
  return reply([]);
 });
 return {writes,activities};
}

for(const width of [390,1440]){
 test(`compact map shows office names and selects everyone at shared coordinates ${width}`,async({page})=>{
  await page.setViewportSize({width,height:1000});await page.addInitScript({path:'tests/fixtures/google-maps-stub.js'});await mock(page);
  await page.goto('/tests/fixtures/phase1-corrections.html?screen=map');
  const office=page.getByLabel('Recorded office starts');
  await expect(office.getByRole('button',{name:'Synthetic Ama',exact:true})).toBeVisible();
  await expect(office.getByRole('button',{name:'Synthetic Kojo',exact:true})).toHaveCount(0);
  const amaPin=page.getByRole('button',{name:'View recorded work start for Synthetic Ama',exact:true});
  const kojoPin=page.getByRole('button',{name:'View recorded work start for Synthetic Kojo',exact:true});
  await expect(amaPin.locator('.ceac-map-avatar')).toHaveText('SA');
  await expect(kojoPin.locator('.ceac-map-avatar')).toHaveText('SK');
  expect(await amaPin.locator('.ceac-map-avatar').evaluate(el=>el.getBoundingClientRect().width)).toBeLessThanOrEqual(32);
  const mapsBefore=await page.evaluate(()=>window.syntheticMaps);
  await kojoPin.click();
  await expect(page.getByText('Selected: two',{exact:true})).toBeVisible();
  await expect(kojoPin).toHaveAttribute('aria-pressed','true');
  await amaPin.click();
  await expect(page.getByText('Selected: one',{exact:true})).toBeVisible();
  expect(await page.evaluate(()=>window.syntheticMaps)).toBe(mapsBefore);
  await page.screenshot({path:`test-artifacts/phase1-map-${width}.png`,fullPage:true});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
 });
 test(`activity upload retries without another activity and retains a dated plan ${width}`,async({page})=>{
  await page.setViewportSize({width,height:1000});const {writes}=await mock(page);
  await page.goto('/tests/fixtures/phase1-corrections.html?screen=diary');
  await page.getByRole('button',{name:'Add a work update'}).click();
  await page.getByLabel('What did you do?').fill('Finished the supplier meeting');
  await page.getByLabel('What happens next?',{exact:true}).fill('Follow up next week');
  await page.getByLabel('When will you do it? (optional)').fill('2026-11-03');
  await page.locator('input[type=file]').setInputFiles({name:'evidence.pdf',mimeType:'application/pdf',buffer:Buffer.from('Synthetic evidence')});
  expect((await page.getByRole('button',{name:'Save work update',exact:true}).boundingBox()).width).toBeLessThan(240);
  await page.screenshot({path:`test-artifacts/phase1-diary-form-${width}.png`,fullPage:true});
  await page.getByRole('button',{name:'Save work update',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('The activity is saved. Retry');
  await expect(page.getByLabel('What did you do?')).toBeDisabled();
  await page.getByRole('button',{name:'Save work update',exact:true}).click();
  await expect(page.getByRole('status').filter({hasText:'Its follow-up remains'})).toBeVisible();
  expect(writes.filter(row=>row.name==='work_activity_records')).toHaveLength(1);
  expect(writes.filter(row=>row.name==='register_operational_file')).toHaveLength(1);
  expect(writes.filter(row=>row.name==='plan_work_activity_followup')).toHaveLength(2);
  expect(writes.find(row=>row.name==='work_activity_records').body).toMatchObject({activity_state:'done',next_action:'Follow up next week',next_action_on:'2026-11-03'});
  await page.screenshot({path:`test-artifacts/phase1-diary-${width}.png`,fullPage:true});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
 });
 test(`support intake records identity and deliberate category; triage shows reporter ${width}`,async({page})=>{
  await page.setViewportSize({width,height:1000});const {writes}=await mock(page);
  await page.goto('/tests/fixtures/phase1-corrections.html?screen=help');
  await expect(page.getByText('Synthetic colleague',{exact:true})).toBeVisible();
  await expect(page.getByLabel('What do you need help with?')).toHaveValue('');
  await page.getByLabel('What do you need help with?').selectOption('cannot_upload');
  await page.getByLabel('Effect on your work').selectOption('work_blocked');
  await page.getByLabel('Short summary').fill('Synthetic upload issue');
  await page.getByLabel('What happened?').fill('The document upload fails after choosing a file.');
  await page.getByRole('button',{name:'Send help request'}).click();
  await expect.poll(()=>writes.filter(row=>row.name==='support_cases').length).toBe(1);
  expect(writes.find(row=>row.name==='support_cases').body).toMatchObject({reported_by:'actor',affected_unit_id:'unit',category:'cannot_upload',impact:'work_blocked'});
  await page.goto('/tests/fixtures/phase1-corrections.html?screen=support');
  await page.getByRole('button',{name:'Help Desk',exact:true}).click();
  await page.getByRole('button',{name:/Synthetic upload issue/}).first().click();
  const detail=page.getByRole('region',{name:'Synthetic upload issue'});
  await expect(detail).toContainText('Synthetic reporter');
  await expect(detail).toContainText('Synthetic IT');
  await expect(detail.getByLabel('Case status')).toBeDisabled();
  await detail.getByRole('button',{name:'Take this case'}).click();
  await expect(detail.getByLabel('Case status')).toBeEnabled();
  await page.screenshot({path:`test-artifacts/phase1-support-${width}.png`,fullPage:true});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
 });
 test(`Calendar private compose has separate visible task and time labels ${width}`,async({page})=>{
  await page.setViewportSize({width,height:1000});await mock(page);
  await page.goto('/tests/fixtures/phase1-corrections.html?screen=calendar');
  await page.getByRole('tab',{name:/Tasks/}).click();
  const compose=page.getByRole('group',{name:'Add a private task',exact:true});
  await expect(compose.getByText('Task',{exact:true})).toBeVisible();
  await expect(compose.getByText('Time (optional)',{exact:true})).toBeVisible();
  await compose.getByLabel('New private task').fill('Prepare tomorrow');
  expect((await compose.getByLabel('New private task').boundingBox()).width).toBeGreaterThan(100);
  await page.screenshot({path:`test-artifacts/phase1-calendar-${width}.png`,fullPage:true});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
 });
 test(`shared work details save the current version ${width}`,async({page})=>{
  await page.setViewportSize({width,height:1000});const {writes}=await mock(page);
  await page.goto('/tests/fixtures/phase1-corrections.html?screen=edit');
  await page.getByRole('button',{name:'Edit work details'}).click();
  await page.getByLabel('Title',{exact:true}).fill('Updated synthetic assignment');
  await page.getByRole('button',{name:'Save work details'}).click();
  await expect(page.getByText('Saved: 1',{exact:true})).toBeVisible();
  expect(writes.find(row=>row.name==='edit_open_work_details').body).toMatchObject({p_work_item_id:'work',p_title:'Updated synthetic assignment',p_expected_movement:null});
 });
 test(`HR can edit work it assigned across departments ${width}`,async({page})=>{
  await page.setViewportSize({width,height:1000});const {writes}=await mock(page);
  await page.goto('/tests/fixtures/phase1-corrections.html?screen=edit&actor=admin');
  await page.getByRole('button',{name:'Edit work details'}).click();
  await page.getByLabel('Title',{exact:true}).fill('HR clarified assigned work');
  await page.getByRole('button',{name:'Save work details'}).click();
  await expect(page.getByText('Saved: 1',{exact:true})).toBeVisible();
  expect(writes.find(row=>row.name==='edit_open_work_details').body).toMatchObject({p_work_item_id:'work',p_title:'HR clarified assigned work'});
 });
 test(`Calendar work chip selects its own date before opening the record ${width}`,async({page})=>{
  await page.setViewportSize({width,height:1000});await mock(page);
  const date=new Date(),last=new Date(date.getFullYear(),date.getMonth()+1,0).getDate();date.setDate(date.getDate()===last?date.getDate()-1:date.getDate()+1);date.setHours(12,0,0,0);
  await page.route('**/rest/v1/work_items*',route=>route.fulfill({contentType:'application/json',body:JSON.stringify([{id:'work',kind:'task',title:'Synthetic future work',status:'in_progress',due_at:date.toISOString()}])}));
  await page.goto('/tests/fixtures/phase1-corrections.html?screen=calendar');
  if(width===390){
   await page.getByRole('button',{name:new RegExp(`${date.getDate()} ${date.toLocaleDateString('en-GB',{month:'long'})} ${date.getFullYear()}`)}).click();
   await page.getByRole('tab',{name:'Tasks',exact:true}).click();
   await expect(page.getByRole('button',{name:/Synthetic future work/}).first()).toBeVisible();
  }else await page.locator('.ev2cal-day-events').getByRole('button',{name:'Synthetic future work',exact:true}).click();
  await expect(page.getByRole('complementary',{name:'Selected day workspace'}).getByRole('heading',{name:date.toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long'}),exact:true})).toBeVisible();
  await expect(page.getByRole('tab',{name:'Tasks',exact:true})).toHaveAttribute('aria-selected','true');
 });
 test(`empty Learning publication directs the author to missing content ${width}`,async({page})=>{
  await page.setViewportSize({width,height:1000});await mock(page);
  await page.route('**/rest/v1/learning_courses*',route=>route.fulfill({contentType:'application/json',body:JSON.stringify([{id:'course',title:'Synthetic empty course',state:'draft'}])}));
  await page.goto('/tests/fixtures/owner-corrections.html?screen=learning&actor=admin&full=1');
  await page.getByRole('button',{name:/Synthetic empty course.*Continue building/}).click();
  await page.getByRole('button',{name:'Review & publish',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Before publishing',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Publish course',exact:true})).toBeDisabled();
  await page.getByRole('button',{name:'Edit course outline',exact:true}).click();
  await expect(page.getByRole('button',{name:'2 · Modules & resources',exact:true})).toHaveAttribute('aria-current','step');
 });
}

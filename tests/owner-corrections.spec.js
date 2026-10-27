import {test,expect} from '@playwright/test';
async function api(page,{deny=false,deliveryFailure=false,hold=false}={}){
 const writes=[],reads=[];let release;let pending=false;
 const wait=new Promise(resolve=>{release=resolve;});
 await page.route('**/*',async route=>{
  const req=route.request(),u=new URL(req.url()),name=u.pathname.split('/').pop();
  if(!u.pathname.includes('/rest/v1/')&&!u.pathname.includes('/auth/v1/'))return ['localhost','127.0.0.1'].includes(u.hostname)?route.continue():route.abort();
  const reply=(data,status=200)=>route.fulfill({status,contentType:'application/json',headers:{'content-range':`0-0/${Array.isArray(data)?data.length:1}`,'access-control-expose-headers':'content-range'},body:JSON.stringify(data)});
  if(name==='workforce_record_pattern'){writes.push({name,body:req.postDataJSON()});return reply({message:'Synthetic schedule denied'},403);}
  if(name==='performance_hr_decide_release'){writes.push({name,body:req.postDataJSON()});return deny?reply({message:'Synthetic approval denied'},403):reply(null);}
  if(name==='create_pending_invitation'){
   writes.push(req.postDataJSON());if(hold)await wait;
   if(deny)return reply({message:'Synthetic invitation denied'},403);
   pending=true;return reply(null);
  }
  if(name==='otp')return deliveryFailure?reply({message:'Synthetic provider rejected',error_code:'unexpected_failure'},500):reply({});
  reads.push({name,query:u.search});
  const params=new URL(page.url()).searchParams;
  const rows={workforce_day_types:[{id:'office',name:'Office',active:true,session_expected:true},{id:'off',name:'Weekly off',active:true,session_expected:false}],learning_courses:[{id:'course',title:'Synthetic orientation',summary:'An example learner course',state:'draft'}],learning_modules:[{id:'module',course_id:'course',title:'Synthetic module',required:true,position:1}],learning_resources:[{id:'resource',module_id:'module',resource_type:'text',title:'Synthetic resource',body_text:'Synthetic learner content'}],meeting_sessions:{id:'meeting',org_id:'org',scope:'organisation',title:'Synthetic future meeting',agenda:'Owner supplied agenda',starts_at:'2099-11-01T09:00:00Z',ends_at:'2099-11-01T10:00:00Z',created_by:'organiser'},meeting_participants:[{profile_id:'actor',role:params.get('organiser')==='1'?'organiser':'participant'}],meeting_private_notes:null,appraisal_cycles:[{id:'cycle',name:'Synthetic cycle',status:'open',starts_on:'2026-10-01',ends_on:'2026-10-31'}],appraisals:[{id:'appraisal',cycle_id:'cycle',profile_id:params.get('self')==='1'?'actor':'person',manager_id:'manager',status:'manager_draft',profiles:{full_name:'Synthetic subject'}}],appraisal_entries:[{id:'assessment',entry_type:'manager_assessment',body:'Synthetic assessment',created_at:'2026-10-27T09:00:00Z'}],performance_review_release_requests:[{id:'release',requested_assessment_id:'assessment',requested_by:'manager',request_reason:'Synthetic reviewer request',state:'pending'}],submissions:[{id:'submission',work_item_id:'work',note:'Synthetic submitted outcome',submitted_at:'2026-10-26T09:00:00Z',profiles:{full_name:'Synthetic colleague'},submission_files:[]}],units:[{id:'unit',name:'Synthetic department',active:true}],profiles:[{id:'person',full_name:'Synthetic colleague',email:'existing@example.org',active:true}],unit_memberships:[{id:'membership',profile_id:'person',unit_id:'unit',role:'staff'}],work_items:[{id:'work',ref:'SYN-1',title:'Synthetic assigned work',unit_id:'unit',status:'in_progress'}],admin_access_invitations:pending?[{id:'invitation',email:'new@example.org',activation_state:'pending'}]:[]};
  if(name==='work_items'&&(req.headers().accept||'').includes('vnd.pgrst.object'))return reply({id:'work',org_id:'org',ref:'SYN-1',title:'Synthetic assigned work',status:'in_review',expected_outcome:'Synthetic expected outcome'});
  return reply(rows[name]===null?null:rows[name]||[]);
 });
 return {writes,reads,release};
}
async function fillInvite(page){
 await page.goto('/tests/fixtures/owner-corrections.html');
 await page.getByLabel('Full name',{exact:true}).fill('Synthetic New Person');
 await page.getByLabel('Invitation email',{exact:true}).fill('new@example.org');
 await page.getByLabel('Invitation unit',{exact:true}).selectOption('unit');
}
for(const width of [390,1440]){
 test(`directory reads work only after deliberate opening and closes on re-entry at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:1000});const {reads}=await api(page);
  await page.goto('/tests/fixtures/owner-corrections.html?screen=directory');
  await page.getByRole('button',{name:'People',exact:true}).click();
  await page.getByRole('button',{name:/Synthetic colleague/}).click();
  await expect(page.getByRole('button',{name:'View assigned work',exact:true})).toBeVisible();
  expect(reads.filter(x=>x.name==='work_items')).toHaveLength(0);
  await page.getByRole('button',{name:'View assigned work',exact:true}).click();
  await expect(page.getByRole('button',{name:/SYN-1/})).toBeVisible();
  expect(reads.filter(x=>x.name==='work_items')).toHaveLength(1);
  await page.getByRole('button',{name:'Hide assigned work',exact:true}).click();
  await expect(page.getByRole('button',{name:/SYN-1/})).toHaveCount(0);
  await page.getByRole('button',{name:'Back to Organisation',exact:true}).click();
  await page.getByRole('button',{name:/Synthetic colleague/}).click();
  await expect(page.getByRole('button',{name:'View assigned work',exact:true})).toHaveAttribute('aria-expanded','false');
  expect(reads.filter(x=>x.name==='work_items')).toHaveLength(1);
 });
 test(`confirmed invitation clears its create fields at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:1000});const {writes}=await api(page);await fillInvite(page);
  await page.getByRole('button',{name:'Send Staff invitation',exact:true}).click();
  await expect(page.getByLabel('Invitation email',{exact:true})).toHaveValue('');
  await expect(page.getByLabel('Full name',{exact:true})).toHaveValue('');
  await expect(page.getByLabel('Invitation unit',{exact:true})).toHaveValue('');
  await expect(page.getByRole('status').filter({hasText:'Invitation recorded'})).toBeVisible();
  expect(writes).toHaveLength(1);
 });
 test(`denied invitation retains the draft at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:1000});await api(page,{deny:true});await fillInvite(page);
  await page.getByRole('button',{name:'Send Staff invitation',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('Synthetic invitation denied');
  await expect(page.getByLabel('Invitation email',{exact:true})).toHaveValue('new@example.org');
  await expect(page.getByLabel('Full name',{exact:true})).toHaveValue('Synthetic New Person');
 });
 test(`recorded invitation with failed email clears fields and keeps truthful warning at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:1000});await api(page,{deliveryFailure:true});await fillInvite(page);
  await page.getByRole('button',{name:'Send Staff invitation',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('Delivery is unconfirmed');
  await expect(page.getByLabel('Invitation email',{exact:true})).toHaveValue('');
 });
 test(`late invitation success preserves newer typing at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:1000});const state=await api(page,{hold:true});await fillInvite(page);
  await page.getByRole('button',{name:'Send Staff invitation',exact:true}).click();
  await expect.poll(()=>state.writes.length).toBe(1);
  await page.getByLabel('Full name',{exact:true}).fill('Next unsaved person');state.release();
  await expect(page.getByRole('status').filter({hasText:'Invitation recorded'})).toBeVisible();
  await expect(page.getByLabel('Full name',{exact:true})).toHaveValue('Next unsaved person');
 });
}
test('old actor completion cannot clear a new actor draft',async({page})=>{
 const state=await api(page,{hold:true});await fillInvite(page);
 await page.getByRole('button',{name:'Send Staff invitation',exact:true}).click();
 await expect.poll(()=>state.writes.length).toBe(1);
 await page.getByRole('button',{name:'Switch fixture actor',exact:true}).click();
 await page.getByLabel('Full name',{exact:true}).fill('New account unsaved person');state.release();
 await expect(page.getByLabel('Full name',{exact:true})).toHaveValue('New account unsaved person');
 await expect(page.getByRole('status').filter({hasText:'Invitation recorded'})).toHaveCount(0);
});

for(const width of [390,1440]){
 for(const actor of ['admin','executive'])test(`${actor} meeting viewer cannot edit the organiser agenda at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:1000});await api(page);
  await page.goto(`/tests/fixtures/owner-corrections.html?screen=meeting&actor=${actor}`);
  await expect(page.getByText('Owner supplied agenda',{exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Save agenda',exact:true})).toHaveCount(0);
  await expect(page.getByRole('textbox')).toHaveCount(0);
 });
 test(`recorded organiser retains agenda editing at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:1000});await api(page);
  await page.goto('/tests/fixtures/owner-corrections.html?screen=meeting&organiser=1');
  await expect(page.getByRole('button',{name:'Save agenda',exact:true})).toBeVisible();
  await expect(page.getByPlaceholder('What should this meeting cover?')).toHaveValue('Owner supplied agenda');
 });
 test(`organisation review never reads private working details at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:1000});const {reads}=await api(page);
  await page.goto('/tests/fixtures/owner-corrections.html?screen=review');
  await expect(page.getByText('Synthetic expected outcome',{exact:true})).toBeVisible();
  expect(reads.filter(x=>['submissions','work_activity_records','checklist_items','checklist_ticks'].includes(x.name))).toHaveLength(0);
  await page.getByRole('button',{name:'View submitted outcome',exact:true}).click();
  await expect(page.getByText('Synthetic submitted outcome',{exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Record activity',exact:true})).toHaveCount(0);
  expect(reads.filter(x=>['work_activity_records','checklist_items','checklist_ticks'].includes(x.name))).toHaveLength(0);
 });
 test(`HR approves without typing while decline keeps its reason requirement at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:1000});const {writes}=await api(page);
  await page.goto('/tests/fixtures/owner-corrections.html?screen=performance');
  const approve=page.getByRole('button',{name:'HR approve publication',exact:true}),decline=page.getByRole('button',{name:'HR decline with reason',exact:true}),note=page.getByLabel('HR assessment publication decision reason',{exact:true});
  await expect(approve).toBeEnabled();await expect(decline).toBeDisabled();
  await note.fill('short');await expect(approve).toBeDisabled();
  await note.fill('Needs a corrected assessment');await expect(decline).toBeEnabled();
  await note.fill('');await approve.click();
  await expect.poll(()=>writes.length).toBe(1);
  expect(writes[0]).toEqual({name:'performance_hr_decide_release',body:{p_request_id:'release',p_approve:true,p_reason:'Assessment reviewed and approved for publication.'}});
 });
 test(`HR self-publication remains unavailable at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:1000});await api(page);
  await page.goto('/tests/fixtures/owner-corrections.html?screen=performance&self=1');
  await expect(page.getByText('Synthetic subject',{exact:true}).first()).toBeVisible();
  await expect(page.getByRole('button',{name:'HR approve publication',exact:true})).toHaveCount(0);
 });
}

for(const width of [390,1440]){
 test(`course builder previews real content without author or completion controls at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:1000});const {writes}=await api(page);
  await page.goto('/tests/fixtures/owner-corrections.html?screen=learning');
  await expect(page.getByRole('region',{name:'Course builder',exact:true})).toContainText('1 prepared');
  await expect(page.getByRole('button',{name:'Publish course',exact:true})).toBeEnabled();
  await page.getByRole('button',{name:'Learner preview',exact:true}).click();
  await expect(page.getByText('Synthetic learner content',{exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Publish course',exact:true})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Add module',exact:true})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Complete module',exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'Course outline',exact:true}).click();
  await expect(page.getByRole('button',{name:'Add module',exact:true})).toBeVisible();
  expect(writes).toHaveLength(0);
 });
 test(`weekly schedule grid retains all days and a denied draft at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:1000});const {writes}=await api(page);
  await page.goto('/tests/fixtures/owner-corrections.html?screen=schedule');
  await page.getByRole('button',{name:'Edit authorised work schedule',exact:true}).click();
  await page.getByRole('button',{name:'Fill approved normal office week',exact:true}).click();
  await expect(page.getByRole('table',{name:'Seven-day working week',exact:true}).getByRole('row')).toHaveCount(8);
  await expect(page.getByLabel('Saturday start',{exact:true})).toBeDisabled();
  await page.getByLabel('Monday start',{exact:true}).fill('09:30');
  await page.getByLabel('Effective from',{exact:true}).fill('2026-11-01');
  await page.getByLabel('HR schedule reason',{exact:true}).fill('Synthetic employee agreement');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
  await page.getByRole('button',{name:'Record HR-authorised schedule',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('could not be confirmed');
  await expect(page.getByLabel('Monday start',{exact:true})).toHaveValue('09:30');
  await expect(page.getByRole('button',{name:'Record HR-authorised schedule',exact:true})).toBeDisabled();
  await expect(page.getByRole('button',{name:'Reload authorised schedule',exact:true})).toBeVisible();
  expect(writes).toHaveLength(1);
  expect(writes[0].body.p_clock_map.mon).toEqual({start:'09:30',end:'17:00'});
  expect(Object.keys(writes[0].body.p_day_map)).toHaveLength(7);
 });
}

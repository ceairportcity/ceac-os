import {test,expect} from '@playwright/test';

async function setup(page,role,{reject=false,lostAck=false,unclosed=false}={}) {
 await page.clock.install({time:new Date('2026-10-31T12:00:00Z')});
 const old={id:'earlier-session',started_at:'2026-10-30T12:00:00Z',last_confirmed_at:'2026-10-30T12:00:00Z',place:'elsewhere',flags:{offsite_location_name:'Home'}};
 let closed=false,first=true;const writes=[];
 await page.route('**/*',route=>{
  const req=route.request(),u=new URL(req.url()),name=u.pathname.split('/').pop();
  const reply=data=>route.fulfill({contentType:'application/json',body:JSON.stringify(data)});
  if(!u.pathname.includes('/rest/v1/'))return ['localhost','127.0.0.1'].includes(u.hostname)?route.continue():route.abort();
  if(req.method()==='POST') {
   writes.push({name,body:req.postDataJSON()});
   if(name==='reconcile_work_session') {
    if(reject&&first){first=false;return route.fulfill({status:400,contentType:'application/json',body:JSON.stringify({code:'P0001',message:'Please check the end time.'})});}
    closed=!unclosed;
    if(lostAck)return route.abort();
    return reply({...old,ended_at:writes.at(-1).body.p_effective_ended_at});
   }
   return reply([]);
  }
  if(name==='work_sessions')return reply(u.searchParams.has('id')?{id:old.id,ended_at:closed?'2026-10-30T16:30:00Z':null}:closed?null:old);
  return reply([]);
 });
 await page.goto(`/tests/fixtures/start-work-recovery.html?role=${role}&stale=1`);
 await page.getByRole('button',{name:role==='staff'?'Review':'Review earlier session',exact:true}).click();
 return writes;
}
async function enter(page){
 await page.getByLabel('End date',{exact:true}).fill('2026-10-30');
 await page.getByLabel('End time',{exact:true}).fill('16:30');
 await page.getByLabel('Correction note',{exact:false}).fill('Forgot to end work before leaving.');
}
for(const role of ['staff','employee','manager','executive']) {
 for(const width of [320,390,1440])test(`${role} saves an actual end time with a visible mobile action at ${width}`,async({page})=>{
  await page.setViewportSize({width,height:740});const writes=await setup(page,role);const dialog=page.getByRole('dialog',{name:'Correct earlier session'});
  await expect(dialog).toBeVisible();await enter(page);
  const save=dialog.getByRole('button',{name:'Save end time',exact:true});await expect(save).toBeInViewport();
  expect(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
  if(role==='executive'&&width===390)await page.screenshot({path:'test-artifacts/session-correction-executive-390.png'});
  await save.click();await expect(dialog).toHaveCount(0);await expect(page.getByText('End time saved. You can start work.',{exact:true})).toBeVisible();
  expect(writes).toHaveLength(1);expect(writes[0]).toMatchObject({name:'reconcile_work_session',body:{p_session_id:'earlier-session',p_action:'close',p_effective_ended_at:'2026-10-30T16:30:00.000Z',p_note:'Forgot to end work before leaving.'}});
  await expect(page.getByRole('button',{name:'Start work',exact:true})).toBeEnabled();
 });
 test(`${role} validates missing, early and future times without losing the form`,async({page})=>{
  const writes=await setup(page,role);const save=page.getByRole('button',{name:'Save end time',exact:true});
  await save.click();await expect(page.getByRole('alert').filter({hasText:'Choose the date and time'})).toBeVisible();
  await enter(page);await page.getByLabel('End time',{exact:true}).fill('08:00');await save.click();
  await expect(page.getByRole('alert').filter({hasText:'End time must be after'})).toBeVisible();
  await page.getByLabel('End date',{exact:true}).fill('2026-11-01');await save.click();await expect(page.getByRole('alert').filter({hasText:'cannot be in the future'})).toBeVisible();
  expect(writes).toHaveLength(0);await expect(page.getByLabel('Correction note',{exact:false})).toHaveValue('Forgot to end work before leaving.');
 });
 test(`${role} keeps rejected corrections and rechecks before a safe resave`,async({page})=>{
  const writes=await setup(page,role,{reject:true});await enter(page);await page.getByRole('button',{name:'Save end time',exact:true}).click();
  await expect(page.getByRole('dialog')).toBeVisible();await expect(page.getByRole('button',{name:'Save end time',exact:true})).toBeDisabled();
  await expect(page.getByLabel('End time',{exact:true})).toHaveValue('16:30');await expect(page.getByLabel('Correction note',{exact:false})).toHaveValue('Forgot to end work before leaving.');
  await page.getByRole('button',{name:'Recheck saved session',exact:true}).click();await expect(page.getByRole('button',{name:'Save end time',exact:true})).toBeEnabled();
  await page.getByRole('button',{name:'Save end time',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);expect(writes).toHaveLength(2);
 });
 test(`${role} recovers a lost save acknowledgement without a duplicate write`,async({page})=>{
  const writes=await setup(page,role,{lostAck:true});await enter(page);await page.getByRole('button',{name:'Save end time',exact:true}).click();
  await expect(page.getByRole('button',{name:'Recheck saved session',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Recheck saved session',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);expect(writes).toHaveLength(1);
 });
}
test('Accra end time stays unchanged in an overseas browser',async({browser})=>{
 const context=await browser.newContext({timezoneId:'America/New_York'});const page=await context.newPage();const writes=await setup(page,'executive');await enter(page);await page.getByRole('button',{name:'Save end time',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);expect(writes[0].body.p_effective_ended_at).toBe('2026-10-30T16:30:00.000Z');await context.close();
});

test('short phone viewport keeps Save visible while the fields scroll',async({page})=>{
 await page.setViewportSize({width:390,height:420});await setup(page,'executive');await enter(page);
 await expect(page.getByRole('button',{name:'Save end time',exact:true})).toBeInViewport();
 await page.getByRole('button',{name:'Save end time',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
});
test('saving disables repeat submissions and dismiss controls until the row is verified',async({page})=>{
 await setup(page,'executive');await enter(page);let finish;
 const gate=new Promise(resolve=>{finish=resolve;});
 await page.route('**/rest/v1/rpc/reconcile_work_session',async route=>{await gate;await route.fulfill({status:400,contentType:'application/json',body:JSON.stringify({message:'Please check the end time.'})});});
 await page.getByRole('button',{name:'Save end time',exact:true}).click();
 await expect(page.getByRole('button',{name:'Saving…',exact:true})).toBeDisabled();
 await expect(page.getByRole('button',{name:'Cancel',exact:true})).toBeDisabled();
 await expect(page.getByRole('button',{name:'Close dialog',exact:true})).toBeDisabled();
 await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toBeVisible();finish();
 await expect(page.getByRole('button',{name:'Recheck saved session',exact:true})).toBeVisible();
});

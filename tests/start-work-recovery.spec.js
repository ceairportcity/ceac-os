import {test,expect} from '@playwright/test';

async function fixture(page,role,{officeFail=false,workFail=false,empty=false,uncertain=false,rejectVenue=false,workExpired=false}={}){
 const state={writes:[],reads:[],officeFail,workFail,persisted:null,readFailure:false};
 await page.addInitScript(()=>{
  window.positionMode='fallback';window.positionAttempts=[];
  Object.defineProperty(navigator,'geolocation',{configurable:true,value:{getCurrentPosition(ok,fail,options){
   window.positionAttempts.push(options.enableHighAccuracy);
   if(window.positionMode==='denied')return fail({code:1});
   if(options.enableHighAccuracy)return fail({code:2});
   ok({coords:{latitude:5.6037,longitude:-0.187,accuracy:850},timestamp:Date.now()});
  }}});
 });
 await page.route('**/*',route=>{
  const req=route.request(),url=new URL(req.url()),name=url.pathname.split('/').pop();
  if(!url.pathname.includes('/rest/v1/'))return ['127.0.0.1','localhost'].includes(url.hostname)?route.continue():route.abort();
  const reply=(data,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
  if(req.method()==='POST'){
   state.writes.push({name,body:req.postDataJSON()});
   if(name!=='work_sessions')return reply([]);
   if(rejectVenue)return reply({code:'P0001',message:'Recorded coordinates are outside this authorised CEAC duty location.'},400);
   state.persisted={id:'recorded-session',...req.postDataJSON(),started_at:new Date().toISOString()};
   state.readFailure=uncertain;return reply(state.persisted,201);
  }
  state.reads.push({name,query:url.search});
  if(name==='work_sessions'){
   if(state.readFailure)return reply({message:'Synthetic read unavailable'},403);
   return reply(state.persisted?[state.persisted]:[]);
  }
  if(name==='office_locations')return state.officeFail?reply({message:'Synthetic venue list unavailable'},503):reply([{id:'venue',name:'Synthetic CEAC venue'}]);
  if(name==='work_items'){
   if(state.workFail)return reply({message:'Synthetic responsibility list unavailable'},503);
   if(empty||(workExpired&&url.searchParams.get('select')==='id'))return reply([]);
   return reply([{id:'responsibility',ref:'SYN-1',title:'Synthetic responsibility',status:'in_progress'}]);
  }
  return reply([]);
 });
 await page.goto(`/tests/fixtures/start-work-recovery.html?role=${role}`);
 await page.getByRole('button',{name:'Start work',exact:true}).click();
 const dialog=page.getByRole('dialog');await expect(dialog).toBeVisible();
 return {state,dialog};
}
async function office(page,dialog,role){await dialog.getByRole('combobox').selectOption('venue');return dialog.getByRole('button',{name:'Start work',exact:true});}
async function offsite(page,dialog,role){
 if(role==='staff')await dialog.getByRole('button',{name:'Somewhere else',exact:true}).click();
 else await dialog.getByRole('radio',{name:'Off-site work',exact:true}).check();
 await dialog.getByRole('textbox',{name:'Where are you working from?'}).fill('Synthetic remote office');
}
for(const role of ['staff','employee'])for(const width of [390,1440]){
 test(`${role} Start Work falls back without hiding accuracy at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:1000});const {state,dialog}=await fixture(page,role);
  await (await office(page,dialog,role)).click();
  await expect(dialog).toHaveCount(0);await expect(page.getByRole('button',{name:'End work',exact:true})).toBeVisible();
  expect(await page.evaluate(()=>window.positionAttempts)).toEqual([true,false]);
  expect(state.writes).toHaveLength(1);expect(state.writes[0]).toMatchObject({name:'work_sessions',body:{org_id:'org',profile_id:'employee',office_location_id:'venue',place:'office',location_accuracy_m:850}});
 });
 test(`${role} denied location keeps selected venue and allows deliberate retry at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:1000});const {state,dialog}=await fixture(page,role);
  await page.evaluate(()=>{window.positionMode='denied';});await (await office(page,dialog,role)).click();
  await expect(dialog.getByRole('alert')).toContainText('Location permission was denied');
  await expect(dialog.getByRole('combobox')).toHaveValue('venue');expect(state.writes).toHaveLength(0);
  expect(await page.evaluate(()=>window.positionAttempts)).toEqual([true]);
  await page.evaluate(()=>{window.positionMode='fallback';});await dialog.getByRole('button',{name:'Start work',exact:true}).click();
  await expect(page.getByRole('button',{name:'End work',exact:true})).toBeVisible();expect(state.writes).toHaveLength(1);
 });
}
for(const role of ['staff','employee']){
 test(`${role} repeated Start clicks are a single write`,async({page})=>{
  const {state,dialog}=await fixture(page,role);
  const start=await office(page,dialog,role);
  await start.evaluate(button=>{button.click();button.click();});
  await expect(page.getByRole('button',{name:'End work',exact:true})).toBeVisible();
  expect(state.writes).toHaveLength(1);
 });
 test(`${role} off-site start is independent of a failed office list`,async({page})=>{
  const {state,dialog}=await fixture(page,role,{officeFail:true});await offsite(page,dialog,role);
  await dialog.getByRole('combobox').selectOption('responsibility');await dialog.getByRole('button',{name:'Start work',exact:true}).click();
  await expect(page.getByRole('button',{name:'End work',exact:true})).toBeVisible();
  expect(state.writes[0].body).toMatchObject({place:'elsewhere',work_item_id:'responsibility',office_location_id:null});
  expect(state.reads.some(row=>row.name==='work_items'&&row.query.includes('org_id=eq.org')&&row.query.includes('assignee_id=eq.employee'))).toBe(true);
 });
 test(`${role} start options can recover inside the form after list failures`,async({page})=>{
  const {state,dialog}=await fixture(page,role,{officeFail:true,workFail:true});
  await expect(dialog.getByRole('alert').filter({hasText:'could not'})).toBeVisible();
  await expect(dialog.getByRole('combobox')).toBeDisabled();state.officeFail=false;state.workFail=false;
  await dialog.getByRole('button',{name:'Reload start options',exact:true}).click();
  await dialog.getByRole('combobox').selectOption('venue');await expect(dialog.getByRole('button',{name:'Start work',exact:true})).toBeEnabled();expect(state.writes).toHaveLength(0);
 });
 for(const width of [390,1440])test(`${role} no responsibility starts off-site with actual location and a place name at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:1000});
  const {state,dialog}=await fixture(page,role,{empty:true});await offsite(page,dialog,role);
  await page.screenshot({path:`/tmp/offsite-${role}-${width}.png`,fullPage:true});
  await expect(dialog.getByRole('status')).toContainText('No responsibility is required');
  await dialog.getByRole('button',{name:'Start work',exact:true}).click();
  await expect(page.getByRole('button',{name:'End work',exact:true})).toBeVisible();
  expect(state.writes).toHaveLength(1);
  expect(state.writes[0].body).toMatchObject({place:'elsewhere',work_item_id:null,lat:5.6037,lng:-0.187,flags:{offsite_location_name:'Synthetic remote office'}});
 });
 test(`${role} failed optional work list does not block off-site attendance`,async({page})=>{
  const {state,dialog}=await fixture(page,role,{workFail:true});await offsite(page,dialog,role);
  await dialog.getByRole('button',{name:'Start work',exact:true}).click();
  await expect(page.getByRole('button',{name:'End work',exact:true})).toBeVisible();
  expect(state.writes[0].body.work_item_id).toBeNull();
 });
 test(`${role} off-site location denial retains place name for retry`,async({page})=>{
  const {state,dialog}=await fixture(page,role,{empty:true});await offsite(page,dialog,role);
  await page.evaluate(()=>{window.positionMode='denied';});
  await dialog.getByRole('button',{name:'Start work',exact:true}).click();
  await expect(dialog.getByRole('alert').filter({hasText:'permission was denied'})).toBeVisible();
  expect(state.writes).toHaveLength(0);
  await expect(dialog.getByRole('textbox',{name:'Where are you working from?'})).toHaveValue('Synthetic remote office');
  await page.evaluate(()=>{window.positionMode='fallback';});
  await dialog.getByRole('button',{name:'Start work',exact:true}).click();
  await expect(page.getByRole('button',{name:'End work',exact:true})).toBeVisible();
  expect(state.writes).toHaveLength(1);
 });
 test(`${role} blank off-site place cannot start and switching modes preserves the draft`,async({page})=>{
  const {state,dialog}=await fixture(page,role,{empty:true});await offsite(page,dialog,role);
  const name=dialog.getByRole('textbox',{name:'Where are you working from?'});
  await name.fill('   ');await expect(dialog.getByRole('button',{name:'Start work',exact:true})).toBeDisabled();
  await name.fill('Synthetic remote office');
  if(role==='staff')await dialog.getByRole('button',{name:'At an authorised office or programme location',exact:true}).click();
  else await dialog.getByRole('radio',{name:'Authorised office or programme venue',exact:true}).check();
  await offsite(page,dialog,role);await expect(name).toHaveValue('Synthetic remote office');
  expect(state.writes).toHaveLength(0);
 });
 test(`${role} expired responsibility is a pre-insert failure and keeps retry available`,async({page})=>{
  const {state,dialog}=await fixture(page,role,{workExpired:true});await offsite(page,dialog,role);await dialog.getByRole('combobox').selectOption('responsibility');
  await dialog.getByRole('button',{name:'Start work',exact:true}).click();await expect(dialog.getByRole('alert').filter({hasText:'no longer an authorised'})).toBeVisible();
  await expect(dialog.getByRole('button',{name:'Reload start options',exact:true})).toBeEnabled();expect(state.writes).toHaveLength(0);
 });
 test(`${role} uncertain committed Start requires read-back and never duplicates`,async({page})=>{
  const {state,dialog}=await fixture(page,role,{uncertain:true});await (await office(page,dialog,role)).click();
  await expect(dialog).toHaveCount(0);await expect(page.getByRole('button',{name:'Start work',exact:true})).toBeDisabled();
  state.readFailure=false;await page.getByRole('button',{name:'Retry session verification',exact:true}).click();await expect(page.getByRole('button',{name:'End work',exact:true})).toBeVisible();expect(state.writes).toHaveLength(1);
 });
 test(`${role} rejected office location preserves geofence and explains the failure`,async({page})=>{
  const {state,dialog}=await fixture(page,role,{rejectVenue:true});await (await office(page,dialog,role)).click();
  await expect(page.getByRole('alert').filter({hasText:'outside the selected venue'})).toBeVisible();
  await expect(page.getByRole('button',{name:'Start work',exact:true})).toBeDisabled();await page.getByRole('button',{name:'Retry session verification',exact:true}).click();
  await expect(page.getByRole('button',{name:'Start work',exact:true})).toBeEnabled();expect(state.persisted).toBeNull();expect(state.writes).toHaveLength(1);
 });
}

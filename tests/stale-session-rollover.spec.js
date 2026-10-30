import {test,expect} from '@playwright/test';

async function setup(page,role,{unrelated=false,oldOpen=false,denied=false}={}){
 const yesterday=new Date(Date.now()-86400000).toISOString();
 const old={id:'earlier-session',started_at:yesterday,last_confirmed_at:yesterday,place:'elsewhere',flags:{}};
 let current=old;const writes=[];
 await page.addInitScript(({denied})=>{
  Object.defineProperty(navigator,'geolocation',{configurable:true,value:{getCurrentPosition(ok,fail){
   if(denied)return fail({code:1});
   ok({coords:{latitude:5.6,longitude:-.18,accuracy:20},timestamp:Date.now()});
  }}});
 },{denied});
 await page.route('**/*',route=>{
  const req=route.request(),u=new URL(req.url()),name=u.pathname.split('/').pop();
  const reply=data=>route.fulfill({contentType:'application/json',body:JSON.stringify(data)});
  if(!u.pathname.includes('/rest/v1/'))return ['localhost','127.0.0.1'].includes(u.hostname)?route.continue():route.abort();
  if(req.method()==='POST'){
   writes.push({name,body:req.postDataJSON()});
   if(name==='continue_work_session_with_location'){
    const created={id:'today-session',started_at:new Date().toISOString(),last_confirmed_at:new Date().toISOString(),place:'elsewhere',flags:{continued_from_session_id:old.id}};
    current=unrelated?{...created,id:'unrelated-session'}:created;
    return reply(created);
   }
   return reply([]);
  }
  if(name==='work_sessions')return reply(u.searchParams.has('id')?{id:old.id,ended_at:oldOpen?null:yesterday}:current);
  return reply([]);
 });
 await page.goto(`/tests/fixtures/start-work-recovery.html?role=${role}&stale=1`);
 await page.getByRole('button',{name:role==='staff'?'Review':'Review earlier session',exact:true}).click();
 return writes;
}
for(const role of ['staff','employee','manager','executive']){
 for(const width of [390,1440])test(`${role} starts a verified new day after forgotten end at ${width}`,async({page})=>{
  await page.setViewportSize({width,height:1000});const writes=await setup(page,role);
  await page.getByRole('button',{name:"Start today's session",exact:true}).click();
  await expect(page.getByRole('button',{name:'End work',exact:true})).toBeVisible();
  expect(writes).toHaveLength(1);expect(writes[0]).toMatchObject({name:'continue_work_session_with_location',body:{p_session_id:'earlier-session',p_lat:5.6,p_lng:-.18}});
 });
 for(const failure of ['unrelated','oldOpen'])test(`${role} rejects ${failure} recovery evidence`,async({page})=>{
  await setup(page,role,{[failure]:true});await page.getByRole('button',{name:"Start today's session",exact:true}).click();
  await expect(page.getByRole('button',{name:'Retry session verification',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'End work',exact:true})).toHaveCount(0);
 });
 test(`${role} denied location leaves yesterday unchanged and recovery available`,async({page})=>{
  const writes=await setup(page,role,{denied:true});await page.getByRole('button',{name:"Start today's session",exact:true}).click();
  await expect(page.getByRole('button',{name:"Start today's session",exact:true})).toBeEnabled();
  await expect(page.getByRole('alert').filter({hasText:'Location permission was denied'}).first()).toBeVisible();
  expect(writes).toHaveLength(0);
 });
}

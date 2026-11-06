import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {transformWithOxc} from 'vite';
import * as delivery from '../supabase/functions/ceac-web-push/delivery.mjs';
import {buildCeacNotificationBriefing} from '../src/lib/notificationPriority.js';
const compiled=(await transformWithOxc(readFileSync('supabase/functions/ceac-web-push/index.ts','utf8'),'index.ts')).code.replace(/^import .*$/gm,'');
const id='11111111-1111-4111-8111-111111111111', other='22222222-2222-4222-8222-222222222222';
function edge(tables={},rpc={}){
 const requests=[],outgoing=[];
 const admin={from(table){const filters={};const query={select(){return this;},eq(k,v){filters[k]=v;return this;},is(){return this;},order(){return this;},limit(){return this;},
   async maybeSingle(){const value=typeof tables[table]==='function'?tables[table](filters):tables[table];return {data:value||null};},
   then(resolve,reject){const value=typeof tables[table]==='function'?tables[table](filters):tables[table];return Promise.resolve({data:Array.isArray(value)?value:[]}).then(resolve,reject);}};return query;},
  async rpc(name,args){requests.push({name,args});return {data:typeof rpc[name]==='function'?rpc[name](args):rpc[name]??true};}};
 const context={Deno:{serve(){}},URL,Date,Set,Intl,console,createClient:()=>admin,webpush:{setVapidDetails(){},async sendNotification(_subscription,payload){outgoing.push(JSON.parse(payload));return {statusCode:201};}},...delivery};
 runInNewContext(compiled+'\nglobalThis.inspectPush={describeJob,dispatch};',context);
 return {describe:(job,sub)=>context.inspectPush.describeJob(admin,job,sub),requests,dispatch:conf=>context.inspectPush.dispatch(admin,conf),outgoing};
}
const person={id,org_id:id,active:true,full_name:'Original sender'};
const subscription={profile_id:id,org_id:id,preview_allowed:true,categories:{},quiet_start:null,quiet_end:null};
const notice={id,recipient_id:id,org_id:id,context_kind:'memo',context_id:id,event_kind:'memo_response',source_event_id:other};
const job={id,profile_id:id,org_id:id,source_kind:'notice',source_id:id,source_key:'notice:'+id};

test('memo reply identifies its actual author and routes to its conversation',async()=>{
 const f=edge({profiles:where=>({...person,id:where.id,full_name:where.id===other?'Actual reply author':'Original sender'}),ceac_notification_events:notice,
 memos:{id,org_id:id,sender_id:id,status:'sent',confidential:false},memo_recipients:{profile_id:id},memo_exchanges:{author_id:other},unit_memberships:[{units:{name:'IT'}}]});
 const payload=await f.describe(job,subscription);
 assert.match(payload.title,/Actual reply author/);assert.match(payload.body,/Replied/);assert.equal(payload.path,'/?tab=messages&memo='+id);assert.equal(payload.tag,'ceac-memo:'+id);
});
test('confidential memos override an enabled device preview',async()=>{
 const f=edge({profiles:person,ceac_notification_events:notice,memos:{id,org_id:id,sender_id:id,status:'sent',confidential:true},memo_recipients:{profile_id:id},memo_exchanges:{author_id:other}});
 const payload=await f.describe(job,subscription);assert.equal(payload.title,'CEAC');assert.doesNotMatch(JSON.stringify(payload),/Original sender/);
});
test('a recorded routine date never reaches push delivery',async()=>{
 const f=edge({profiles:person,routine_reminder_deliveries:{id,org_id:id,for_profile_id:id,work_item_id:id,due_at:'2026-11-06T12:00:00Z',scheduled_on:'2026-11-06'}},{ceac_push_routine_current:false});
 assert.equal(await f.describe({...job,source_kind:'routine_reminder',source_due_at:'2026-11-06T12:00:00Z'},subscription),null);
 assert.equal(f.requests[0].name,'ceac_push_routine_current');
});
test('an actionable routine opens that specific scheduled date',async()=>{
 const f=edge({profiles:person,routine_reminder_deliveries:{id,org_id:id,for_profile_id:id,work_item_id:id,due_at:'2026-11-06T12:00:00Z',scheduled_on:'2026-11-06'},work_items:{id,kind:'routine',status:'in_progress',confidential:false}});
 const payload=await f.describe({...job,source_kind:'routine_reminder',source_due_at:'2026-11-06T12:00:00Z'},subscription);
 assert.match(payload.path,/routineDate=2026-11-06/);
});
test('work category preferences apply to work notices independently of memos',async()=>{
 const f=edge({profiles:person,ceac_notification_events:{...notice,context_kind:'work_item',event_kind:'work_assigned'},work_items:{id,status:'not_started',title:'Prepare graphics',assigned_by:other,assignee_id:id}});
 assert.equal(await f.describe(job,{...subscription,categories:{work:false,messages:true}}),null);
 const payload=await f.describe(job,{...subscription,categories:{work:true,messages:false}});assert.match(payload.body,/Prepare graphics/);assert.match(payload.path,/tab=work/);
});
test('changed or cancelled meetings invalidate the old reminder',async()=>{
 const f=edge({profiles:person,meeting_sessions:{id,org_id:id,status:'cancelled',starts_at:'2026-11-06T12:00:00Z'}});
 assert.equal(await f.describe({...job,source_kind:'meeting_reminder',source_due_at:'2026-11-06T12:00:00Z'},subscription),null);
});
test('revoked context access cancels a pending notification',async()=>{
 const f=edge({profiles:person,ceac_notification_events:notice},{ceac_push_context_visible:false});assert.equal(await f.describe(job,subscription),null);
});
test('future work and meetings do not inflate the unread badge',()=>{
 const briefing=buildCeacNotificationBriefing({me:{},now:Date.parse('2026-11-06T11:45:00Z'),workItems:[{id,due_at:'2026-11-06T12:00:00Z',status:'in_progress'}],meetings:[{id,starts_at:'2026-11-06T12:00:00Z'}]});
 assert.equal(briefing.count,0);assert.ok(briefing.items.length>0);
});
test('service worker accepts exact CEAC records and rejects external or unexpected routes',()=>{
 const context={self:{location:{origin:'https://ceac.example'},addEventListener(){}},URL};runInNewContext(readFileSync('public/sw.js','utf8'),context);
 assert.equal(context.safePushDestination('/?tab=work&item='+id),'https://ceac.example/?tab=work&item='+id);
 for(const bad of ['https://external.invalid','//external.invalid','/?tab=work&item='+id+'&redirect=https://evil.invalid','/?tab=work&item=invalid'])assert.equal(context.safePushDestination(bad),'https://ceac.example/?tab=messages&updates=1');
});

test('quiet hours postpone delivery until their end rather than consuming retries repeatedly',async()=>{
 const hour=new Date().getUTCHours();
 const f=edge({profiles:person});
 await assert.rejects(f.describe(job,{...subscription,quiet_start:hour,quiet_end:(hour+1)%24,timezone:'Africa/Accra'}),error=>error.message==='quiet_hours'&&Date.parse(error.retryAt)>Date.now());
});
test('accepted provider delivery contains a declarative fallback, exact route and verified unread badge',async()=>{
 const keys={auth:Buffer.alloc(16,1).toString('base64url'),p256dh:Buffer.from([4,...Array(64).fill(1)]).toString('base64url')};
 const f=edge({profiles:person,ceac_notification_events:notice,memos:{id,org_id:id,sender_id:id,status:'sent',confidential:false},memo_recipients:{profile_id:id},memo_exchanges:{author_id:other},
 ceac_push_subscriptions:{...subscription,id,endpoint:'https://fcm.googleapis.com/synthetic',auth_key:keys.auth,p256dh:keys.p256dh,app_origin:'https://ceac-os-git.vercel.app'}},
 {ceac_claim_push_jobs:[{...job,subscription_id:id,attempts:1,lease_token:id,expires_at:new Date(Date.now()+600000).toISOString()}],ceac_push_unread_count:3});
 const result=await f.dispatch({publicKey:'synthetic',privateKey:'synthetic'});
 assert.equal(result.sent,1);assert.equal(f.outgoing.length,1);
 assert.equal(f.outgoing[0].web_push,8030);assert.equal(f.outgoing[0].notification.app_badge,'3');
 assert.equal(f.outgoing[0].notification.navigate,'https://ceac-os-git.vercel.app/?tab=messages&memo='+id);
 assert.equal(f.requests.find(row=>row.name==='ceac_finish_push_job').args.p_state,'sent');
});

test('ordinary Room activity requires explicit device opt-in and follows its Room setting',async()=>{
 const f=edge({profiles:person,ceac_notification_events:{...notice,context_kind:'room',event_kind:'room_activity'},room_notification_preferences:{notification_level:'all'},room_messages:{id,author_id:other,created_at:'2026-11-06T12:00:00Z'}});
 assert.equal(await f.describe(job,subscription),null);
 const payload=await f.describe(job,{...subscription,categories:{rooms:true}});
 assert.match(payload.body,/Sent a message/);assert.equal(payload.path,'/?tab=messages&room='+id);
});
test('muted Rooms and removed messages do not send queued mentions',async()=>{
 const base={profiles:person,ceac_notification_events:{...notice,context_kind:'room',event_kind:'room_mention'},room_messages:{id,author_id:other,created_at:'2026-11-06T12:00:00Z'}};
 assert.equal(await edge({...base,room_notification_preferences:{notification_level:'mute'}}).describe(job,subscription),null);
 assert.equal(await edge(base,{ceac_push_room_message_current:false}).describe(job,subscription),null);
});

import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";
import {buildPushPreview,deliveryOutcome} from "../tools/push-foundation/delivery.mjs";

const source = file => readFileSync(file,"utf8");
const noticeId = "2cb13838-7e95-4111-ab2c-111111111111";

function loadWorker() {
  const listeners={};
  const visible=[];
  const visited=[];
  const self={
    location:{origin:"https://ceac.example"},
    registration:{showNotification:async(title,options)=>{visible.push({title,...options});}},
    clients:{
      matchAll:async()=>[],
      openWindow:async url=>{visited.push(url);},
    },
    addEventListener:(event,callback)=>{listeners[event]=callback;},
  };
  runInNewContext(source("public/sw.js"),{self,URL,caches:{},fetch:async()=>{},console});
  return {listeners,visible,visited};
}

test("background push uses the existing CEAC service worker and rejects untrusted IDs",async()=>{
  const sw=loadWorker();
  let awaited=null;
  sw.listeners.push({data:{json:()=>({notificationId:"not-an-id",title:"Fake"})},
    waitUntil:value=>{awaited=value;}});
  assert.equal(awaited,null);
  assert.equal(sw.visible.length,0);
  sw.listeners.push({data:{json:()=>({notificationId:noticeId,title:"CEAC Work",body:"Please review"})},
    waitUntil:value=>{awaited=value;}});
  await awaited;
  assert.equal(sw.visible.length,1);
  assert.equal(sw.visible[0].title,"CEAC Work");
  assert.deepEqual(JSON.parse(JSON.stringify(sw.visible[0].data)),{notificationId:noticeId});
});
test("a notification tap never trusts a URL from a push message",async()=>{
  const sw=loadWorker();
  let awaiting=null;
  sw.listeners.notificationclick({
    notification:{data:{notificationId:noticeId,url:"https://external.invalid/phishing"},close(){}},
    waitUntil:value=>{awaiting=value;},
  });
  await awaiting;
  assert.deepEqual(sw.visited,["https://ceac.example/?tab=messages&updates=1"]);
});
test("privacy default hides sender details unless ordinary previews are enabled",()=>{
  const event={id:noticeId,sensitivity:"private",senderName:"Private Sender",
    senderDepartment:"Private Department",message:"Secret message"};
  const privatePreview=buildPushPreview(event,{showPreview:true});
  assert.equal(privatePreview.title,"CEAC");
  assert.ok(!JSON.stringify(privatePreview).includes("Private Sender"));
  assert.ok(!JSON.stringify(privatePreview).includes("Secret message"));
  const ordinary=buildPushPreview({...event,sensitivity:"ordinary"},{showPreview:true});
  assert.match(ordinary.title,/Private Sender/);
});
test("expired subscriptions and retriable failures remain distinguishable",()=>{
  assert.equal(deliveryOutcome(410,1,1000).state,"expired_subscription");
  assert.equal(deliveryOutcome(503,1,1000).state,"retry");
});
test("database and Edge code use protected queues and recheck access",()=>{
  const schema=source("supabase/migrations/20261105202000_ceac_web_push.sql");
  const edge=source("supabase/functions/ceac-web-push/index.ts");
  const client=source("src/lib/ceacPush.js");
  assert.match(schema,/enable row level security/);
  assert.match(schema,/FOR UPDATE SKIP LOCKED/i);
  assert.match(schema,/grant execute on function public.ceac_claim_push_jobs/);
  assert.match(schema,/from public,anon,authenticated/);
  assert.match(edge,/admin\.auth\.getUser\(accessToken\)/);
  assert.match(edge,/memo_recipients/);
  assert.match(edge,/meeting_participants/);
  assert.match(edge,/x-ceac-push-worker/);
  assert.match(client,/Notification\.requestPermission\(\)/);
  assert.match(client,/disconnectDevicePushOnSignOut/);
  assert.doesNotMatch(client,/localStorage\.setItem/);
});
test("logout keeps a previous session token only in RAM for device revocation",()=>{
  const app=source("src/App.jsx");
  const client=source("src/lib/ceacPush.js");
  assert.match(app,/onAuthStateChange\(\(event, authSession\)/);
  assert.match(app,/if \(authSession\?\.access_token\) lastPushAuthToken = authSession\.access_token/);
  assert.match(app,/disconnectDevicePushOnSignOut\(previousToken\)/);
  assert.match(client,/disconnectDevicePushOnSignOut\(previousAccessToken = null\)/);
  assert.match(client,/previousAccessToken \|\| lastSubscriptionBearer/);
  assert.doesNotMatch(client,/localStorage\.setItem/);
});
test("iOS setup is optional and only exposed after a user action",()=>{
  const view=source("src/components/DevicePushSettings.jsx");
  assert.match(view,/Home Screen/);
  assert.match(view,/onClick=\{\(\)=>void enable\(\)\}/);
  assert.doesNotMatch(view,/useEffect\(\(\)=>\s*\{\s*enableDevicePush/);
});

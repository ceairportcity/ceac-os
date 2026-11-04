import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {buildCeacNotificationBriefing,ceacNoticeTarget,defaultRoomLevel} from "../src/lib/notificationPriority.js";
import {isWorkOverdue, dueLabel} from "../src/lib/time.js";
import {notificationRetryDelay,runNotificationTasks} from "../src/lib/notificationRefreshControl.js";
import {createBoundedRestFetch} from "../src/lib/boundedRestFetch.js";
const now=Date.UTC(2026,10,3,7,0);
const iso=minutes=>new Date(now+minutes*60000).toISOString();
const room={id:"room-a",name:"Executive access Room",unread_count:42,last_at:iso(-3)};
const person={id:"user",is_exec:true,is_admin:false};
test("Executive room visibility does not subscribe the Executive to 42 conversations",()=>{
  const r=buildCeacNotificationBriefing({me:person,now,rooms:[room]});
  assert.equal(defaultRoomLevel(person),"mentions");
  assert.equal(r.count,0);assert.equal(r.room,0);assert.equal(r.roomPreferences[0].level,"mentions");
});
test("A mention is personal unless a user explicitly mutes the Room",()=>{
  const args={me:person,now,rooms:[room],mentions:[{id:"mn",created_at:iso(-2),room_messages:{room_id:room.id}}]};
  const mentioned=buildCeacNotificationBriefing(args);
  assert.equal(mentioned.room,1);
  assert.equal(mentioned.items.find(x=>x.type==="room").level,"personal");
  const muted=buildCeacNotificationBriefing({...args,preferences:[{room_id:room.id,notification_level:"mute"}]});
  assert.equal(muted.room,0);assert.equal(muted.count,0);
});
test("Read conversations do not keep old mentions in the badge",()=>{
  const r=buildCeacNotificationBriefing({me:person,now,rooms:[room],
    roomReads:[{room_id:room.id,last_read_at:iso(-1)}],
    mentions:[{id:"mn",created_at:iso(-5),room_messages:{room_id:room.id}}]});
  assert.equal(r.room,0);
});
test("Staff may follow all Room messages and can switch to mentions-only",()=>{
  const me={id:"staff",is_admin:false,is_exec:false};
  assert.equal(buildCeacNotificationBriefing({me,now,rooms:[room]}).room,42);
  assert.equal(buildCeacNotificationBriefing({me,now,rooms:[room],
    preferences:[{room_id:room.id,notification_level:"mentions"}]}).room,0);
});
test("Meeting starting within 30 minutes is an action, a cancelled meeting is silent",()=>{
  const r=buildCeacNotificationBriefing({me:person,now,meetings:[
    {id:"mt1",title:"Staff briefing",starts_at:iso(20),status:"scheduled"},
    {id:"mt2",title:"Cancelled",starts_at:iso(10),status:"cancelled"},
    {id:"mt3",title:"Later",starts_at:iso(150),status:"scheduled"}
  ]});
  assert.equal(r.items.length,1);assert.equal(r.items[0].level,"attention");
  assert.equal(r.items[0].type,"meeting");
  assert.equal(r.items[0].url,"/?tab=home&meeting=mt1");
});
test("An overdue assignment remains actionable; completed work disappears",()=>{
  const r=buildCeacNotificationBriefing({me:person,now,workItems:[
    {id:"work1",title:"Prepare report",due_at:iso(-20),status:"in_progress"},
    {id:"work2",title:"Already delivered",due_at:iso(-10),status:"completed"},
    {id:"work3",title:"Private records",due_at:iso(15),status:"assigned",confidential:true},
  ]});
  assert.equal(r.items.length,2);
  assert.ok(r.items.every(x=>x.level==="attention"));
  assert.equal(r.items.find(x=>x.id==="work:work3").meta,"Confidential assigned task");
});
test("Read notifications are removed, but their work deadline remains until done",()=>{
  const id="11111111-1111-4111-8111-111111111111";
  const r=buildCeacNotificationBriefing({me:person,now,events:[
    {id:"e1",kind:"work_assigned",context_kind:"work_item",context_id:id,created_at:iso(-5),read_at:null},
    {id:"e2",kind:"memo_sent",context_kind:"memo",context_id:id,created_at:iso(-7),read_at:iso(-2)}
  ],workItems:[{id,title:"Report",status:"in_progress",due_at:iso(45)}]});
  assert.equal(r.count,1);assert.equal(r.items[0].type,"work");
  assert.equal(r.memo,0);
});
test("Generic target routing preserves private Memo, Work and Compliance destinations",()=>{
  const id="11111111-1111-4111-8111-111111111111";
  assert.equal(ceacNoticeTarget({context_kind:"memo",context_id:id}),"/?tab=messages&memo="+id);
  assert.equal(ceacNoticeTarget({context_kind:"work_item",context_id:id}),"/?tab=work&item="+id);
  assert.equal(ceacNoticeTarget({context_kind:"compliance_policy",context_id:id}),"/?tab=compliance&section=policies");
  assert.equal(ceacNoticeTarget({context_kind:"compliance_evidence",context_id:id}),"/?tab=compliance&section=evidence");
  assert.equal(ceacNoticeTarget({context_kind:"compliance_exception",context_id:id}),"/?tab=compliance&section=exceptions");
});
test("Only one shared notification panel is supplied to all role home screens",()=>{
  const app=readFileSync("src/App.jsx","utf8");
  for(const role of ["ExecutiveHome","AdminHome","ManagerHome","Home"])
    assert.match(app,new RegExp("<"+role+"[^\\n]*notificationPanel=\\{notificationPanel\\}"));
  const shell=readFileSync("src/experience-v2/shell/ShellV2.jsx","utf8");
  assert.match(shell,/position:"absolute"/);
  assert.match(shell,/ceac-notification-trigger/);
});

test("global notification requests never exceed the concurrent worker budget",async()=>{
  let active=0,max=0;
  const tasks=Array.from({length:11},(_,i)=>async()=>{
    active++;max=Math.max(max,active);
    await new Promise(resolve=>setTimeout(resolve,5));
    active--;
    return {data:[i],error:null};
  });
  const rows=await runNotificationTasks(tasks,3);
  assert.equal(max,3);
  assert.deepEqual(rows.map(row=>row.data[0]),Array.from({length:11},(_,i)=>i));
});

test("one failing notification source cannot prevent other sources completing",async()=>{
  const rows=await runNotificationTasks([
    async()=>({data:["ok"]}),
    async()=>{throw Error("database timeout");},
    async()=>({data:["still ok"]}),
  ],2);
  assert.deepEqual(rows[0].data,["ok"]);
  assert.match(rows[1].error.message,/timeout/);
  assert.deepEqual(rows[2].data,["still ok"]);
});

test("notification retries back off rather than flood a slow database",()=>{
  assert.equal(notificationRetryDelay(1),30000);
  assert.equal(notificationRetryDelay(2),60000);
  assert.equal(notificationRetryDelay(3),120000);
  assert.equal(notificationRetryDelay(4),240000);
  assert.equal(notificationRetryDelay(5),360000);
});

test("shared notifications avoid overlapping requests and keep minute-level reminders",()=>{
  const hook=readFileSync("src/lib/useCeacUnreadNotifications.js","utf8");
  assert.match(hook,/document\.visibilityState==="hidden"\|\|inFlight/);
  assert.match(hook,/runNotificationTasks\(tasks,3\)/);
  assert.match(hook,/new AbortController\(\)/);
  assert.match(hook,/window\.setTimeout\(\(\)=>controller\.abort\(\),12000\)/);
  assert.match(hook,/nextFetchAt=Date\.now\(\)\+180000/);
  assert.match(hook,/publish\(Date\.now\(\)\)/);
  assert.match(hook,/activeController\?\.abort\(\)/);
});

test("all CEAC overview database reads share a five-request concurrency budget",async()=>{
  let active=0,maximum=0;
  const fetcher=async()=>{
    active++;maximum=Math.max(maximum,active);
    await new Promise(resolve=>setTimeout(resolve,5));
    active--;
    return {ok:true};
  };
  const limited=createBoundedRestFetch(fetcher,"https://ceac.supabase.co",5);
  const responses=await Promise.all(Array.from({length:17},(_,i)=>
    limited("https://ceac.supabase.co/rest/v1/work_items?batch="+i)));
  assert.equal(maximum,5);
  assert.ok(responses.every(row=>row.ok));
});

test("authentication traffic is never blocked behind database requests",async()=>{
  let release;
  const fetcher=(url)=>url.includes("/auth/v1/")
    ?Promise.resolve({ok:true,auth:true})
    :new Promise(resolve=>{release=()=>resolve({ok:true});});
  const limited=createBoundedRestFetch(fetcher,"https://ceac.supabase.co",1);
  const db=limited("https://ceac.supabase.co/rest/v1/profiles");
  // Wait for the queue's first microtask to dispatch the database request.
  await Promise.resolve();
  const auth=await limited("https://ceac.supabase.co/auth/v1/token");
  assert.equal(auth.auth,true);
  release();
  await db;
});

test("aborting a queued database request prevents it from reaching Supabase",async()=>{
  let release,started=0;
  const fetcher=()=>{started++;return new Promise(resolve=>{release=()=>resolve({ok:true});});};
  const limited=createBoundedRestFetch(fetcher,"https://ceac.supabase.co",1);
  const first=limited("https://ceac.supabase.co/rest/v1/profiles");
  await Promise.resolve();
  const controller=new AbortController();
  const second=limited("https://ceac.supabase.co/rest/v1/rooms",{signal:controller.signal});
  controller.abort();
  await assert.rejects(second,{name:"AbortError"});
  release();
  await first;
  assert.equal(started,1);
});

test("Supabase client enforces a global database budget without limiting Auth",()=>{
  const source=readFileSync("src/lib/supabase.js","utf8");
  assert.match(source,/createBoundedRestFetch\(globalThis\.fetch\.bind\(globalThis\),supabaseUrl,5\)/);
});

test("legacy Inbox avoids expensive Room requests while showing Memos or Updates",()=>{
  const inbox=readFileSync("src/screens/Inbox.jsx","utf8");
  assert.match(inbox,/section!=="rooms"&&!actionsOpen/);
  assert.match(inbox,/controller\.abort\(\)/);
  assert.match(inbox,/window\.setInterval\(refresh,180000\)/);
  assert.match(inbox,/lastBackgroundLoad\.current<120000/);
});

test("review, returned and dependency items are not overdue work for staff",()=>{
  const past=iso(-24*60);
  for(const status of ["in_review","waiting_on","returned","completed","self_certified","cancelled"]){
    assert.equal(isWorkOverdue({status,due_at:past},now),false,status);
    assert.doesNotMatch(dueLabel(past,status),/overdue/i);
  }
  assert.equal(isWorkOverdue({status:"in_progress",due_at:past},now),true);
  assert.equal(isWorkOverdue({status:"not_started",due_at:past,kind:"routine"},now),false);
});

test("deadline notifications suppress work submitted for review or waiting on others",()=>{
  const states=["in_review","waiting_on","returned","completed","self_certified","cancelled"];
  const workItems=states.map((status,i)=>({id:"w"+i,title:status,due_at:iso(-25),status}));
  workItems.push({id:"active",title:"Still being worked",due_at:iso(-25),status:"in_progress"});
  const r=buildCeacNotificationBriefing({me:person,now,workItems});
  assert.deepEqual(r.items.filter(x=>x.type==="work").map(x=>x.id),["work:active"]);
});

test("staff and manager views use state-aware due labels and overdue criteria",()=>{
  const fs=["src/screens/Home.jsx","src/screens/ManagerHome.jsx",
    "src/experience-v2/staff-today/StaffTodayV2.jsx",
    "src/experience-v2/manager-overview/ManagerOverviewV2.jsx"];
  for(const file of fs)assert.match(readFileSync(file,"utf8"),/isWorkOverdue/);
  const diary=readFileSync("src/components/WorkActivityDiary.jsx","utf8");
  assert.match(diary,/Record earlier work/);
  assert.match(diary,/max=\{ghanaDay\(\)\}/);
});


test("unread Memo notices use authorised sender and subject, with one card per correspondence",()=>{
  const id="11111111-1111-4111-8111-111111111111";
  const briefing=buildCeacNotificationBriefing({me:person,now,events:[
    {id:"new",kind:"memo_response",context_kind:"memo",context_id:id,created_at:iso(-2)},
    {id:"old",kind:"memo_sent",context_kind:"memo",context_id:id,created_at:iso(-5),
      memo_actor:"Gabriel Rockson",memo_detail:"Technical Support Head · IT",memo_subject:"Weekly report"},
    {id:"other",kind:"memo_sent",context_kind:"memo",context_id:"22222222-2222-4222-8222-222222222222",
      created_at:iso(-6),memo_actor:"Rebecca Arthur",memo_detail:"HR",memo_subject:"Personnel update"}
  ]});
  assert.equal(briefing.memo,2);
  assert.equal(briefing.items.filter(row=>row.type==="event").length,2);
  assert.equal(briefing.items[0].title,"New reply to a memo");
  assert.equal(briefing.items[1].title,"New memo from Rebecca Arthur");
  assert.match(briefing.items[1].meta,/Personnel update/);
});
test("memo metadata is fetched only for unread memo events using existing role-scoped APIs",()=>{
  const hook=readFileSync("src/lib/useCeacUnreadNotifications.js","utf8");
  assert.match(hook,/if\(memoIds\.length\)/);
  assert.match(hook,/memo_recipient_directory/);
  assert.match(hook,/\.in\("id",memoIds\)\.abortSignal\(signal\)/);
  assert.doesNotMatch(hook,/select\(".*memo_versions.*body/);
});

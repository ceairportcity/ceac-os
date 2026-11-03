import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {buildCeacNotificationBriefing,ceacNoticeTarget,defaultRoomLevel} from "../src/lib/notificationPriority.js";
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

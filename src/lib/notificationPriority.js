// Pure, account-scoped notification prioritisation. No confidential message
// bodies are exposed in the Overview or bell, even when the source includes them.
const actionableDeadlineStatus = /^(not_started|in_progress|assigned)$/i;
const cancelledMeeting = /cancelled|canceled|deleted/i;
const decisions = new Set(["case_opened","case_referred","exception_requested","evidence_submitted"]);
const headings = {
  memo_sent:"New Memo", memo_response:"New reply to a Memo",
  work_assigned:"Work assigned to you", evidence_submitted:"Evidence needs your review",
  evidence_reviewed:"Your evidence was reviewed",
  case_opened:"Attendance question needs your response",
  case_response:"An attendance question has a response",
  case_referred:"Attendance question referred to you",
  case_resolved:"Attendance question resolved",
  policy_published:"A policy is available",
  exception_requested:"Exception request needs review",
  exception_decided:"Your exception request has an outcome",
};
const validId = id => /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(String(id||""));
const ms = value => { const n=Date.parse(value||"");return Number.isFinite(n)?n:NaN; };
// Ghana date-only deadlines remain due until the end of the stated day.
const workDeadlineMs = value => typeof value==="string" && /^\\d{4}-\\d{2}-\\d{2}$/.test(value)
  ? Date.parse(value+"T23:59:59.999Z") : ms(value);
const within = (value,start,end) => {const t=ms(value);return t>=start&&t<=end;};
export function defaultRoomLevel(me) {
  return me?.is_admin || me?.is_exec ? "mentions" : "all";
}
export function ceacNoticeTarget(row) {
  const id=String(row?.context_id||row?.id||"");
  if (!validId(id)) return "/?tab=messages&updates=1";
  const encoded=encodeURIComponent(id);
  if(row.context_kind==="memo")return "/?tab=messages&memo="+encoded;
  if(row.context_kind==="support_case")return "/?tab=technical-support&case="+encoded;
  if(row.context_kind==="work_item")return "/?tab=work&item="+encoded;
  if(row.context_kind==="compliance_case")return "/?tab=compliance&case="+encoded;
  if(row.context_kind==="compliance_policy")return "/?tab=compliance&section=policies";
  if(row.context_kind==="compliance_evidence")return "/?tab=compliance&section=evidence";
  if(row.context_kind==="compliance_exception")return "/?tab=compliance&section=exceptions";
  return "/?tab=messages&updates=1";
}
const item=(id,level,title,meta,url,createdAt,type)=>({id,level,title,meta,url,createdAt,type});
export function buildCeacNotificationBriefing({
  me,events=[],rooms=[],preferences=[],mentions=[],roomReads=[],meetings=[],
  workItems=[],attentionQueue=[],reminders=[],calendarEvents=[],now=Date.now()
}={}){
  const defaultLevel=defaultRoomLevel(me);
  const levelByRoom=Object.fromEntries(preferences.map(p=>[p.room_id,p.notification_level]));
  const readByRoom=new Map(roomReads.map(r=>[r.room_id,ms(r.last_read_at)||0]));
  const mentionByRoom=new Map();
  for(const mention of mentions){
    const roomId=mention.room_messages?.room_id || mention.room_id;
    if(!roomId || !within(mention.created_at,now-30*86400000,now+30000))continue;
    if(ms(mention.created_at)<=(readByRoom.get(roomId)||0))continue;
    mentionByRoom.set(roomId,(mentionByRoom.get(roomId)||0)+1);
  }
  const entries=[],roomSummary=[],unreadMemoIds=new Set();
  for(const event of events){
    if(event.read_at)continue;
    const kind=event.kind||event.event_kind||"update";
    const isMemo=event.context_kind==="memo";
    // Multiple replies on one correspondence appear as one inbox notification.
    if(isMemo){
      if(unreadMemoIds.has(event.context_id))continue;
      unreadMemoIds.add(event.context_id);
    }
    const isSupport=event.context_kind==="support_case";
    const urgent=isSupport||decisions.has(kind);
    const memoName=isMemo&&event.memo_actor ? " from "+String(event.memo_actor).slice(0,80) : "";
    const title=isSupport?"New staff Technical Support request":isMemo?(kind==="memo_sent"?"New memo"+memoName:"New reply to a memo"+memoName):headings[kind]||"New update for you";
    const memoMeta=isMemo?[event.memo_detail,event.memo_subject].filter(Boolean).join(" · "):"";
    entries.push(item("event:"+event.id,urgent?"attention":"personal",
      title,(isSupport?[event.support_reference,event.support_summary].filter(Boolean).join(" · ") || "Open Help Desk to review":memoMeta|| (urgent?"Action required":"Personal update")).slice(0,160),
      ceacNoticeTarget(event),event.created_at,"event"));
  }
  for(const room of rooms){
    const level=levelByRoom[room.id]||defaultLevel;
    const mentionCount=mentionByRoom.get(room.id)||0;
    const amount=level==="mute"?0:level==="all"?Math.max(0,Number(room.unread_count)||0):mentionCount;
    roomSummary.push({id:room.id,name:room.name||"Room",level,unread:amount,mentions:mentionCount});
    if(!amount)continue;
    entries.push(item("room:"+room.id,mentionCount>0?"personal":"activity",
      mentionCount>0?"You were mentioned in a Room":"New Room messages",
      (room.name||"Room")+" · "+amount+" unread",
      "/?tab=messages",room.last_at||new Date(now).toISOString(),"room"));
  }
  for(const meeting of meetings){
    if(cancelledMeeting.test(meeting.status||""))continue;
    const minutes=(ms(meeting.starts_at)-now)/60000;
    if(!Number.isFinite(minutes)||minutes>60||minutes< -15)continue;
    const urgent=minutes<=30;
    entries.push(item("meeting:"+meeting.id,urgent?"attention":"personal",
      minutes<=0?"Meeting is starting":minutes<=30?"Meeting starts soon":"Meeting in the next hour",
      (meeting.title||"Scheduled meeting")+" · "+(minutes>0?Math.ceil(minutes)+" min":"Now"),
      "/?tab=home&meeting="+encodeURIComponent(meeting.id),meeting.starts_at,"meeting"));
  }
  for(const work of workItems){
    if(!actionableDeadlineStatus.test(work.status||"")||!work.due_at||work.kind==="routine")continue;
    const minutes=(workDeadlineMs(work.due_at)-now)/60000;
    if(!Number.isFinite(minutes)||minutes>3*1440)continue;
    const urgent=minutes<0;
    entries.push(item("work:"+work.id,urgent?"attention":"personal",
      urgent?"Work is past due":minutes<=1440?"Work due within a day":"Work due soon",
      work.confidential?"Confidential assigned task":String(work.title||"Assigned task").slice(0,100),
      "/?tab=work&item="+encodeURIComponent(work.id),work.due_at,"work"));
  }
  for(const action of attentionQueue){
    if(!action.work_item_id)continue;
    const title=action.action_kind==="review_required"?"Work is awaiting your review"
      :action.action_kind==="returned_work"?"Returned work needs attention"
      :action.action_kind==="routine_due"?"Scheduled responsibility needs attention":"Assigned work is ready";
    entries.push(item("action:"+action.action_kind+":"+action.work_item_id,
      "attention",title,String(action.work_title||"Assigned responsibility").slice(0,100),
      "/?tab=work&item="+encodeURIComponent(action.work_item_id),
      action.action_at||new Date(now).toISOString(),"action"));
  }
  for(const reminder of reminders){
    if(reminder.seen_at||!within(reminder.remind_at,now-2*86400000,now+3600000))continue;
    entries.push(item("reminder:"+reminder.id,"attention","Personal reminder",
      String(reminder.title||"You have a reminder").slice(0,100),
      "/?tab=home",reminder.remind_at,"reminder"));
  }
  for(const event of calendarEvents){
    if(!event.reminder_at || !within(event.reminder_at,now-3600000,now+3600000)
       || !within(event.starts_at,now-900000,now+3*86400000))continue;
    entries.push(item("calendar:"+event.id,"personal","Calendar reminder",
      String(event.title||"Your calendar event").slice(0,100),
      "/?tab=home",event.reminder_at,"calendar"));
  }
  // A work assignment can have both an event and a due-time reminder. The
  // latter is the actionable item, so avoid showing both in the short stack.
  const workWithDeadline=new Set(workItems.filter(w=>w.due_at).map(w=>w.id));
  const actionIds=new Set(attentionQueue.map(a=>a.work_item_id));
  const filtered=entries.filter(e=>{
    const workId=e.url.includes("tab=work&item=")?decodeURIComponent(e.url.split("item=")[1]||""):null;
    if(e.type==="event"&&workId&&(workWithDeadline.has(workId)||actionIds.has(workId)))return false;
    if(e.type==="work"&&workId&&actionIds.has(workId))return false;
    return true;
  });
  const rank={attention:0,personal:1,activity:2};
  const output=filtered.sort((a,b)=>rank[a.level]-rank[b.level]
    || (ms(b.createdAt)||0)-(ms(a.createdAt)||0));
  // The badge counts individual Room messages at most once: a group card is
  // merely their preview. Keep this number bounded for device badges.
  const personalItems=output.filter(e=>e.type!=="room").length;
  const roomUnread=roomSummary.reduce((sum,r)=>sum+r.unread,0);
  return {
    items:output,roomPreferences:roomSummary,defaultRoomLevel:defaultLevel,
    attention:output.filter(e=>e.level==="attention").length,
    personal:output.filter(e=>e.level==="personal").length,
    room:roomUnread,memo:unreadMemoIds.size,
    count:Math.min(999,personalItems+roomUnread),
  };
}

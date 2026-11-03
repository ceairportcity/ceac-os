import {useCallback,useEffect,useRef,useState} from "react";
import {supabase} from "./supabase";
import {buildCeacNotificationBriefing} from "./notificationPriority";

// One account-scoped source for the bell, Overview and Updates workspace.
// Poll while the app is visible; re-evaluate meeting/reminder thresholds as
// time passes. This is not a claim of delivery while the app is closed.
export function useCeacUnreadNotifications(me) {
  const [counts,setCounts]=useState(null);
  const [error,setError]=useState("");
  const [revision,setRevision]=useState(0);
  const currentScope=useRef("");
  const scope=String(me?.org_id||"")+":"+String(me?.id||"");
  const refresh=useCallback(()=>setRevision(v=>v+1),[]);
  const setRoomLevel=useCallback(async(roomId,level)=>{
    if(!me?.id || !me?.org_id || !["all","mentions","mute"].includes(level))
      throw new Error("Choose an authorised Room notification setting.");
    const result=await supabase.from("room_notification_preferences").upsert({
      org_id:me.org_id,profile_id:me.id,room_id:roomId,notification_level:level
    },{onConflict:"room_id,profile_id"});
    if(result.error)throw result.error;
    window.dispatchEvent(new Event("ceac:notifications-changed"));
  },[me?.org_id,me?.id]);

  useEffect(()=>{
    const changedAccount=currentScope.current!==scope;
    currentScope.current=scope;
    if(!me?.id||!me?.org_id){setCounts(null);setError("");return;}
    let active=true;
    if(changedAccount){setCounts(null);setError("");}
    async function load(){
      if(document.visibilityState==="hidden")return;
      const now=Date.now(),start=new Date(now-15*60000).toISOString();
      const ends=new Date(now+75*60000).toISOString();
      const soon=new Date(now+3*86400000).toISOString();
      try{
        const results=await Promise.all([
          supabase.rpc("my_ceac_notifications"),
          supabase.rpc("my_room_directory"),
          supabase.from("room_notification_preferences").select("room_id,notification_level")
            .eq("profile_id",me.id),
          supabase.from("room_reads").select("room_id,last_read_at").eq("profile_id",me.id),
          supabase.from("room_mentions").select("id,created_at,room_messages!inner(room_id)")
            .eq("profile_id",me.id).gte("created_at",new Date(now-30*86400000).toISOString()).limit(150),
          supabase.from("meeting_participants").select("meeting_id").eq("profile_id",me.id).limit(200),
          supabase.from("meeting_sessions").select("id,title,starts_at,ends_at,status,created_by")
            .gte("starts_at",start).lte("starts_at",ends).limit(100),
          supabase.from("work_items").select("id,title,due_at,status,confidential")
            .eq("assignee_id",me.id).not("due_at","is",null).lte("due_at",soon)
            .order("due_at",{ascending:false}).limit(80),
          supabase.from("personal_reminders").select("id,title,remind_at,seen_at")
            .eq("profile_id",me.id).is("seen_at",null).lte("remind_at",ends)
            .gte("remind_at",new Date(now-2*86400000).toISOString()).limit(40),
          supabase.from("personal_calendar_events").select("id,title,starts_at,reminder_at")
            .eq("profile_id",me.id).gte("starts_at",start).lte("starts_at",soon).limit(60),
          supabase.rpc("my_work_attention_queue"),
        ]);
        if(!active||currentScope.current!==scope)return;
        const [events,rooms,prefs,reads,mentions,participants,meetings,works,reminders,calendar,actions]=results;
        if(events.error || !Array.isArray(events.data) || rooms.error || !Array.isArray(rooms.data))
          throw new Error("Personal notifications could not be verified.");
        const invited=new Set((participants.data||[]).map(p=>p.meeting_id));
        const personalMeetings=(meetings.data||[]).filter(m=>m.created_by===me.id||invited.has(m.id));
        const optionalFailures=results.slice(2).some(result=>Boolean(result.error));
        const next=buildCeacNotificationBriefing({
          me,events:events.data,rooms:rooms.data,preferences:prefs.data||[],
          roomReads:reads.data||[],mentions:mentions.data||[],
          meetings:personalMeetings,workItems:works.data||[],attentionQueue:actions.data||[],
          reminders:reminders.data||[],calendarEvents:calendar.data||[],now
        });
        setCounts({...next,roomPreferencesAvailable:!prefs.error,
          roomPreferencesError:prefs.error?"Room alert preferences could not be loaded.":""});
        setError(optionalFailures?"Some optional reminders could not be checked. Retry updates.":"");
        if("setAppBadge" in navigator){
          if(next.count)void navigator.setAppBadge(next.count).catch(()=>{});
          else if("clearAppBadge" in navigator)void navigator.clearAppBadge().catch(()=>{});
        }
      }catch{
        if(active&&currentScope.current===scope)setError("Updates could not be verified. Retry.");
      }
    }
    void load();
    const timer=window.setInterval(load,60000);
    const visible=()=>{if(document.visibilityState==="visible")void load();};
    window.addEventListener("focus",visible);
    document.addEventListener("visibilitychange",visible);
    window.addEventListener("ceac:notifications-changed",visible);
    return()=>{
      active=false;
      clearInterval(timer);
      window.removeEventListener("focus",visible);
      document.removeEventListener("visibilitychange",visible);
      window.removeEventListener("ceac:notifications-changed",visible);
    };
  },[scope,revision,me?.id,me?.org_id,me?.is_admin,me?.is_exec]);

  return counts===null?null:{...counts,error,refresh,setRoomLevel};
}

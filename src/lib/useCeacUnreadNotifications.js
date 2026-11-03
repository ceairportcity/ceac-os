import {useCallback,useEffect,useRef,useState} from "react";
import {supabase} from "./supabase";
import {buildCeacNotificationBriefing} from "./notificationPriority";
import {runNotificationTasks,notificationRetryDelay} from "./notificationRefreshControl";

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
    let inFlight=false;
    let activeController=null;
    let nextFetchAt=0;
    let lastAttemptAt=0;
    let consecutiveFailures=0;
    let snapshot=null;
    let preferencesHealthy=true;
    if(changedAccount){setCounts(null);setError("");}

    // Meeting and reminder thresholds change every minute without requiring
    // another database request. Keep the last verified response during outages.
    function publish(now=Date.now()){
      if(!active||!snapshot||currentScope.current!==scope)return;
      const personalMeetings=snapshot.meetings.filter(m=>m.created_by===me.id
        ||m.meeting_participants?.some(p=>p.profile_id===me.id));
      const next=buildCeacNotificationBriefing({
        me,events:snapshot.events,rooms:snapshot.rooms,
        preferences:snapshot.prefs,roomReads:snapshot.reads,
        mentions:snapshot.mentions,meetings:personalMeetings,
        workItems:snapshot.works,attentionQueue:snapshot.actions,
        reminders:snapshot.reminders,calendarEvents:snapshot.calendar,now
      });
      setCounts({...next,scope,roomPreferencesAvailable:preferencesHealthy,
        roomPreferencesError:preferencesHealthy?"":"Room alert preferences could not be loaded."});
      if("setAppBadge" in navigator){
        if(next.count)void navigator.setAppBadge(next.count).catch(()=>{});
        else if("clearAppBadge" in navigator)void navigator.clearAppBadge().catch(()=>{});
      }
    }

    async function load(){
      if(!active||document.visibilityState==="hidden"||inFlight||Date.now()<nextFetchAt)return;
      inFlight=true;
      lastAttemptAt=Date.now();
      const now=lastAttemptAt;
      const start=new Date(now-15*60000).toISOString();
      const ends=new Date(now+75*60000).toISOString();
      const soon=new Date(now+3*86400000).toISOString();
      const controller=new AbortController();
      activeController=controller;
      const deadline=window.setTimeout(()=>controller.abort(),12000);
      const signal=controller.signal;
      try{
        // Keep requests in small groups instead of sending ten requests at
        // once for every active browser. This also prevents a request storm
        // when a slow database overlaps with focus and minute timers.
        const tasks=[
          ()=>supabase.rpc("my_ceac_notifications").abortSignal(signal),
          ()=>supabase.from("meeting_sessions").select("id,title,starts_at,ends_at,status,created_by,meeting_participants(profile_id)")
            .gte("starts_at",start).lte("starts_at",ends).limit(100).abortSignal(signal),
          ()=>supabase.from("personal_reminders").select("id,title,remind_at,seen_at")
            .eq("profile_id",me.id).is("seen_at",null).lte("remind_at",ends)
            .gte("remind_at",new Date(now-2*86400000).toISOString()).limit(40).abortSignal(signal),
          ()=>supabase.from("personal_calendar_events").select("id,title,starts_at,reminder_at")
            .eq("profile_id",me.id).gte("starts_at",start).lte("starts_at",soon).limit(60).abortSignal(signal),
          ()=>supabase.from("work_items").select("id,title,due_at,status,confidential")
            .eq("assignee_id",me.id).not("due_at","is",null).lte("due_at",soon)
            .order("due_at",{ascending:false}).limit(80).abortSignal(signal),
          ()=>supabase.rpc("my_work_attention_queue").abortSignal(signal),
          ()=>supabase.rpc("my_room_directory").abortSignal(signal),
          ()=>supabase.from("room_notification_preferences").select("room_id,notification_level")
            .eq("profile_id",me.id).abortSignal(signal),
          ()=>supabase.from("room_reads").select("room_id,last_read_at")
            .eq("profile_id",me.id).abortSignal(signal),
          ()=>supabase.from("room_mentions").select("id,created_at,room_messages!inner(room_id)")
            .eq("profile_id",me.id).gte("created_at",new Date(now-30*86400000).toISOString())
            .limit(150).abortSignal(signal),
        ];
        const results=await runNotificationTasks(tasks,3);
        if(!active||currentScope.current!==scope)return;
        const keys=["events","meetings","reminders","calendar","works",
          "actions","rooms","prefs","reads","mentions"];
        const candidate={};
        const failures=[];
        for(let i=0;i<keys.length;i++){
          const response=results[i];
          if(response?.error||!response||!Array.isArray(response.data)){
            failures.push(keys[i]);
            candidate[keys[i]]=snapshot?.[keys[i]]||[];
          }else{
            candidate[keys[i]]=response.data;
          }
        }
        // Never claim an empty inbox when its authoritative source has failed.
        if(failures.includes("events")&&!snapshot)throw new Error("No verified personal updates.");
        preferencesHealthy=!failures.includes("prefs");
        snapshot=candidate;
        publish();
        const degraded=failures.length>0;
        setError(degraded?"Some updates could not be checked. Your last verified items remain visible.":"");
        if(failures.length>=3){
          consecutiveFailures++;
          nextFetchAt=Date.now()+notificationRetryDelay(consecutiveFailures);
        }else{
          consecutiveFailures=0;
          nextFetchAt=Date.now()+180000;
        }
      }catch{
        if(active&&currentScope.current===scope){
          setError("Updates could not be verified. Existing items remain visible. Retry.");
          consecutiveFailures++;
          nextFetchAt=Date.now()+notificationRetryDelay(consecutiveFailures);
        }
      }finally{
        window.clearTimeout(deadline);
        if(activeController===controller)activeController=null;
        inFlight=false;
      }
    }
    void load();
    const timer=window.setInterval(()=>{
      publish(Date.now());
      void load();
    },60000);
    const visible=()=>{
      if(document.visibilityState!=="visible")return;
      publish(Date.now());
      // A focus and visibilitychange pair must not each trigger a fetch.
      if(Date.now()-lastAttemptAt>=60000)void load();
    };
    const changed=()=>{
      if(document.visibilityState!=="visible")return;
      // Marked-read and new-message events must refresh, without bypassing
      // the single-flight guard or flooding the server on repeated events.
      if(Date.now()-lastAttemptAt>=15000){
        nextFetchAt=0;
        void load();
      }
    };
    window.addEventListener("focus",visible);
    document.addEventListener("visibilitychange",visible);
    window.addEventListener("ceac:notifications-changed",changed);
    return()=>{
      active=false;
      activeController?.abort();
      window.clearInterval(timer);
      window.removeEventListener("focus",visible);
      document.removeEventListener("visibilitychange",visible);
      window.removeEventListener("ceac:notifications-changed",changed);
    };
  },[scope,revision,me?.id,me?.org_id,me?.is_admin,me?.is_exec]);

  return !counts || counts.scope!==scope ? null : {...counts,error,refresh,setRoomLevel};
}

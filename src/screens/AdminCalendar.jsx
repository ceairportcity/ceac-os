import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { LoadingState, ProductNotice } from "../components/bits";
import { humanError } from "../lib/productLanguage";
import { Button, StatePanel } from "../experience-v2/components";
import StaffCalendar from "./StaffCalendar";
import {
  CalendarPageHeader,
  CalendarTimeline,
  CalendarViewTabs,
} from "../experience-v2/calendar/CalendarFamilyV2";

function dateKey(value){
  const parts=new Intl.DateTimeFormat("en-CA",{timeZone:"Africa/Accra",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date(value));
  const by=Object.fromEntries(parts.map((part)=>[part.type,part.value]));
  return `${by.year}-${by.month}-${by.day}`;
}
function labelDate(value){return new Date(value).toLocaleString("en-GB",{timeZone:"Africa/Accra",weekday:"short",day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"});}

const RANGE_ITEMS = [
  { value:"14", label:"Next 14 days", icon:"calendar" },
  { value:"30", label:"Next 30 days", icon:"calendar" },
  { value:"90", label:"Next 90 days", icon:"calendar" },
];

export default function AdminCalendar({ me, openItem, openMeeting, scheduleMeeting, roleMode="admin", openProject }) {
  const [calendarScope,setCalendarScope]=useState("organisation");
  const [events,setEvents]=useState([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState(null);
  const [windowDays,setWindowDays]=useState(30);

  useEffect(()=>{load();},[me.org_id]);

  async function load(){
    setLoading(true); setError(null);
    try{
      const now=new Date();
      const end=new Date(now.getTime()+90*864e5);
      const [meetings,projects,ministry,leave]=await Promise.all([
        supabase.from("meeting_sessions").select("id,title,starts_at,ends_at,status,scope,provider").gte("starts_at",now.toISOString()).lte("starts_at",end.toISOString()).neq("status","cancelled"),
        supabase.from("projects").select("id,name,starts_on,ends_on,status").eq("org_id",me.org_id),
        supabase.from("ministry_events").select("id,title,starts_at,ends_at,location,cancelled").gte("starts_at",now.toISOString()).lte("starts_at",end.toISOString()),
        supabase.from("leave_requests").select("id,profile_id,start_date,end_date,status,profiles!leave_requests_profile_id_fkey(full_name)").eq("status","approved").gte("end_date",now.toISOString().slice(0,10)).lte("start_date",end.toISOString().slice(0,10)),
      ]);
      const failed=[meetings,projects,ministry,leave].find((row)=>row.error);
      if(failed) throw failed.error;
      const rows=[];
      (meetings.data||[]).forEach((meeting)=>rows.push({id:"m-"+meeting.id,type:"Meeting",at:meeting.starts_at,title:meeting.title,meta:`${meeting.scope} · ${meeting.provider}`,meetingId:meeting.id}));
      (ministry.data||[]).filter((event)=>!event.cancelled).forEach((event)=>rows.push({id:"e-"+event.id,type:"Ministry activity",at:event.starts_at,title:event.title,meta:event.location||"Location not recorded"}));
      (projects.data||[]).forEach((project)=>{
        if(project.starts_on&&project.starts_on>=dateKey(now)) rows.push({id:"ps-"+project.id,type:"Project",at:project.starts_on+"T00:00:00Z",title:project.name+" starts",meta:project.status,projectId:project.id});
        if(project.ends_on&&project.ends_on>=dateKey(now)) rows.push({id:"pe-"+project.id,type:"Project",at:project.ends_on+"T00:00:00Z",title:project.name+" ends",meta:project.status,projectId:project.id});
      });
      (leave.data||[]).forEach((request)=>rows.push({id:"l-"+request.id,type:"Approved leave",at:request.start_date+"T00:00:00Z",title:request.profiles?.full_name||"CEAC member",meta:`${request.start_date} → ${request.end_date}`}));
      setEvents(rows.sort((a,b)=>new Date(a.at)-new Date(b.at)));
    }catch(err){setError(humanError(err,"Organisation calendar could not be loaded."));}
    finally{setLoading(false);}
  }

  const visible=useMemo(()=>{
    const cutoff=Date.now()+windowDays*864e5;
    return events.filter((event)=>new Date(event.at).getTime()<=cutoff);
  },[events,windowDays]);

  const groups=useMemo(()=>{
    const map={};
    visible.forEach((event)=>{const key=dateKey(event.at);(map[key]=map[key]||[]).push(event);});
    return Object.entries(map).map(([day,rows])=>({
      key:day,
      label:new Date(day+"T00:00:00Z").toLocaleDateString("en-GB",{weekday:"long",day:"numeric",month:"long"}),
      events:rows.map((event)=>({
        ...event,
        kind:event.type==="Meeting"?"meeting":event.type==="Project"?"projects":event.type==="Approved leave"?"leave":"ministry",
        icon:event.type==="Meeting"?"meeting":event.type==="Project"?"projects":event.type==="Approved leave"?"time":"ministry",
        meta:event.type==="Meeting"?labelDate(event.at):event.meta,
        status:event.type,
        statusTone:event.type==="Meeting"?"action":event.type==="Approved leave"?"success":"neutral",
        onClick:event.meetingId?()=>openMeeting?.(event.meetingId):event.projectId&&openProject?()=>openProject(event.projectId):undefined,
      })),
    }));
  },[visible,openMeeting,openProject]);

  const personalLabel=roleMode==="executive"?"Group Pastor · My calendar":"Administration · My calendar";
  const sharedLabel=roleMode==="executive"?"Church calendar":"Organisation calendar";
  const scopeControl=<div className="phase6-calendar-scope" role="tablist" aria-label={roleMode==="executive"?"Executive calendar scope":"Administration calendar scope"}>
    <button type="button" role="tab" aria-selected={calendarScope==="my"} className={calendarScope==="my"?"is-selected":""} onClick={()=>setCalendarScope("my")}>My calendar</button>
    <button type="button" role="tab" aria-selected={calendarScope==="organisation"} className={calendarScope==="organisation"?"is-selected":""} onClick={()=>setCalendarScope("organisation")}>{sharedLabel}</button>
  </div>;

  if(calendarScope==="my") return <StaffCalendar
    me={me}
    openItem={openItem}
    openMeeting={openMeeting}
    statusLabel={personalLabel}
    scopeControl={scopeControl}
  />;

  return <div className="body ev2cal-role-page ev2cal-admin-page">
    <CalendarPageHeader
      eyebrow={roleMode==="executive"?"Church schedule":"Organisation schedule"}
      title="Calendar"
      description={roleMode==="executive"?"Your meetings, ministry events and project dates in one calendar.":"Upcoming meetings, ministry activities, project dates and approved leave in one chronological operating view."}
      status={roleMode==="executive"?"Church timeline":"Organisation timeline"}
      statusTone="action"
      action={<Button icon="meeting" onClick={()=>scheduleMeeting?.({scope:"organisation",organisation:true})}>Schedule meeting</Button>}
    />

    {scopeControl}

    {error&&<ProductNotice
      tone="error"
      title="Calendar could not finish loading"
      action={<button className="btn btn-ghost btn-sm" onClick={load}>Try again</button>}
    >{error}</ProductNotice>}

    <div className="ev2cal-admin-range">
      <CalendarViewTabs
        value={String(windowDays)}
        onChange={(value)=>setWindowDays(Number(value))}
        items={RANGE_ITEMS}
        ariaLabel="Calendar range"
      />
      <span>{visible.length} recorded item{visible.length===1?"":"s"} in this range</span>
    </div>

    {loading?<LoadingState label="Loading organisation calendar…"/>:
      visible.length===0
        ?<StatePanel
          state="empty"
          icon="calendar"
          title="Nothing upcoming in this range"
          description="Meetings, project dates, ministry activities and approved leave will appear here when they are recorded."
        />
        :<CalendarTimeline groups={groups}/>
    }
  </div>;
}

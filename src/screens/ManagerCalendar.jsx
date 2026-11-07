import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import useRoutineCalendar from "../lib/useRoutineCalendar";
import { routineCalendarStatus } from "../lib/readRoutineCalendar.js";
import { Sheet, ProductNotice, LoadingState } from "../components/bits";
import { humanError } from "../lib/productLanguage";
import { Button } from "../experience-v2/components";
import StaffCalendar from "./StaffCalendar";
import CalendarExplorer, { useCalendarPosition } from "../experience-v2/calendar/CalendarExplorer";
import { calendarWorkStatus, calendarWindow, calendarSpan, expandCalendarEvent } from "../lib/calendarPlanning";
import { CalendarPageHeader } from "../experience-v2/calendar/CalendarFamilyV2";

const FILTERS = [
  { value:"all", label:"All", icon:"calendar" },
  { value:"meetings", label:"Meetings", icon:"meeting" },
  { value:"projects", label:"Projects", icon:"projects" },
  { value:"tasks", label:"Work", icon:"work" },
  { value:"leave", label:"Leave", icon:"time" },
  { value:"activities", label:"Ministry/unit activities", icon:"ministry" },
];
const pad = (n) => String(n).padStart(2, "0");
const dateKey = (d) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const parseDateOnly = (s) => { const [y,m,d] = String(s).slice(0,10).split("-").map(Number); return new Date(y,m-1,d); };
const addDays = (d,n) => { const x=new Date(d); x.setDate(x.getDate()+n); return x; };
const startOfWeek = (d) => { const x=new Date(d.getFullYear(),d.getMonth(),d.getDate()); const day=(x.getDay()+6)%7; x.setDate(x.getDate()-day); return x; };
const labelDate = (s) => parseDateOnly(s).toLocaleDateString("en-GB",{day:"numeric",month:"short"});
const labelDay = (s) => parseDateOnly(s).toLocaleDateString("en-GB",{weekday:"long",day:"numeric",month:"long"});
const accraDateKey = (value) => {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Accra", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(value));
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${byType.year}-${byType.month}-${byType.day}`;
};
export default function ManagerCalendar({ me, openItem, openProject, openMeeting, scheduleMeeting, openPerson, initialDate, onFocusHandled }) {
  const [calendarScope,setCalendarScope]=useState("unit");
  const {cursor,setCursor,selectedDate,setSelectedDate}=useCalendarPosition(me,"unit",initialDate);
  useEffect(()=>{if(initialDate)onFocusHandled?.();},[]);
  const [events,setEvents]=useState([]);
  const [selectedActivity,setSelectedActivity]=useState(null);
  const [selectedLeave,setSelectedLeave]=useState(null);
  const requestVersion=useRef(0);
  useEffect(()=>()=>{requestVersion.current++;},[]);
  const [error,setError]=useState(null);
  const [loading,setLoading]=useState(true);

  const routineCalendar=useRoutineCalendar(me,{scope:"unit",enabled:calendarScope==="unit",
    fromDate:dateKey(new Date(cursor.getFullYear(),cursor.getMonth()-1,1)),
    throughDate:dateKey(new Date(cursor.getFullYear(),cursor.getMonth()+2,0))});
  const calendarEvents=useMemo(()=>[...events,...routineCalendar.events],[events,routineCalendar.events]);

  useEffect(()=>{if(calendarScope==="unit")load();else requestVersion.current++;},[me.id,me.unit_id,calendarScope,cursor.getFullYear(),cursor.getMonth()]);

  async function load(){
    const request=++requestVersion.current;
    const range=calendarWindow(cursor);
    setLoading(true); setError(null);
    try{
    const [projects, work, members, leave, ministry, ministryNeeds, meetings] = await Promise.all([
      supabase.from("projects").select("id,name,starts_on,ends_on,status,lead_unit_id,project_units(unit_id)").or(`and(starts_on.gte.${range.from},starts_on.lt.${range.to}),and(ends_on.gte.${range.from},ends_on.lt.${range.to})`),
      supabase.from("work_items").select("id,ref,title,due_at,status,project_id").eq("unit_id",me.unit_id).gte("due_at",range.fromAt).lt("due_at",range.toAt).neq("visibility","private").neq("kind","routine"),
      supabase.from("unit_memberships").select("profile_id").eq("unit_id",me.unit_id),
      supabase.from("leave_requests").select("id,profile_id,kind,start_date,end_date,status,profiles!leave_requests_profile_id_fkey(full_name)").eq("status","approved").gte("end_date",range.from).lt("start_date",range.to),
      supabase.from("ministry_events").select("id,title,kind,scope,unit_id,starts_at,ends_at,all_day,location,notes,cancelled").or(`ends_at.gte.${range.fromAt},and(ends_at.is.null,starts_at.gte.${range.fromAt})`).lt("starts_at",range.toAt),
      supabase.from("ministry_event_units").select("event_id,unit_id,note").eq("unit_id",me.unit_id),
      supabase.from("meeting_sessions").select("id,title,scope,unit_id,project_id,starts_at,ends_at,status,provider,join_url,meeting_participants(profile_id,role)").or(`ends_at.gt.${range.fromAt},and(ends_at.is.null,starts_at.gte.${range.fromAt})`).lt("starts_at",range.toAt).neq("status","cancelled").order("starts_at")
    ]);
    if(request!==requestVersion.current)return;
    const firstError=[projects.error,work.error,members.error,leave.error,ministry.error,ministryNeeds.error,meetings.error].find(Boolean);
    if(firstError){ setError(humanError(firstError,"Calendar could not be loaded.")); setLoading(false); return; }
    const memberIds=new Set((members.data||[]).map(x=>x.profile_id));
    const out=[];
    (projects.data||[]).filter((p)=>p.lead_unit_id===me.unit_id||(p.project_units||[]).some((row)=>row.unit_id===me.unit_id)).forEach(p=>{
      if(p.starts_on) out.push({id:`project-start-${p.id}`,type:"projects",date:p.starts_on,title:`${p.name} starts`,projectId:p.id});
      if(p.ends_on) out.push({id:`project-end-${p.id}`,type:"projects",date:p.ends_on,title:`${p.name} ends`,projectId:p.id});
    });
    (work.data||[]).forEach(w=>out.push({id:`task-${w.id}`,type:"tasks",date:accraDateKey(w.due_at),title:`${w.ref} · ${w.title}`,itemId:w.id,workStatus:w.status}));
    (leave.data||[]).filter(l=>memberIds.has(l.profile_id)).forEach(l=>{
      calendarSpan(l.start_date,l.end_date,range.from,range.to).forEach(day=>{out.push({
        id:`leave-${l.id}-${day}`,
        type:"leave",
        date:day,
        title:`${l.profiles?.full_name||"Team member"} · ${l.kind} leave`,
        leave:{ id:l.id, profile_id:l.profile_id, full_name:l.profiles?.full_name||"Team member", kind:l.kind, start_date:l.start_date, end_date:l.end_date, status:l.status }
      }); });
    });
    const needByEvent = new Map((ministryNeeds.data||[]).map((row)=>[row.event_id,row.note]));
    (ministry.data||[]).filter((event)=>event.scope==="church"||event.unit_id===me.unit_id||needByEvent.has(event.id)).forEach((event)=>{
      const needNote=needByEvent.get(event.id);
      calendarSpan(accraDateKey(event.starts_at),accraDateKey(event.ends_at?new Date(new Date(event.ends_at).getTime()-1):event.starts_at),range.from,range.to).forEach(day=>{
        out.push({
          id:`activity-${event.id}-${day}`,
          type:"activities",
          date:day,
          title:`${event.cancelled?"Cancelled · ":""}${event.title}${needNote?` · Your unit: ${needNote}`:""}${event.location?` · ${event.location}`:""}`,
          startsAt:event.starts_at,endsAt:event.ends_at,allDay:event.all_day,
          activity: {
            id: event.id,
            title: event.title,
            kind: event.kind,
            scope: event.scope,
            starts_at: event.starts_at,
            ends_at: event.ends_at,
            all_day: event.all_day,
            location: event.location,
            notes: event.notes,
            cancelled: event.cancelled,
            unit_note: needNote || null,
          },
        });
      });
    });
    (meetings.data||[]).forEach((meeting)=>{
      const participantCount=(meeting.meeting_participants||[]).length;
      const scopeLabel=meeting.scope==="project"?"Project":meeting.scope==="unit"?"Unit":"Organisation";
      const providerLabel=meeting.provider==="zoom"?"Zoom":"External";
      out.push(...expandCalendarEvent({
        id:`meeting-${meeting.id}`,
        type:"meetings",
        date:accraDateKey(meeting.starts_at),
        title:meeting.title,
        meetingId:meeting.id,
        meetingStatus:meeting.status,
        startsAt:meeting.starts_at,
        endsAt:meeting.ends_at,
        meta:`${scopeLabel} meeting · ${participantCount} participant${participantCount===1?"":"s"} · ${providerLabel}`,
      },range.from,range.to));
    });
    setEvents(out);
    }catch(err){if(request===requestVersion.current)setError(humanError(err,"Calendar could not be loaded."));}
    finally{if(request===requestVersion.current)setLoading(false);}
  }

  const openCalendarEvent=useCallback((event)=>{
    setSelectedDate(event.date);
    if(event.itemId) return openItem(event.itemId,event.routineState?event.scheduledOn:null);
    if(event.meetingId) return openMeeting?.(event.meetingId);
    if(event.projectId) return openProject(event.projectId);
    if(event.leave) return setSelectedLeave(event.leave);
    if(event.activity) return setSelectedActivity(event.activity);
    return null;
  },[openItem,openMeeting,openProject,setSelectedDate]);

  const displayEvent=useCallback((event)=>({
    ...event,
    kind:event.type,
    metaTime:event.startsAt?new Date(event.startsAt).toLocaleTimeString("en-GB",{timeZone:"Africa/Accra",hour:"2-digit",minute:"2-digit"}):null,
    icon:event.type==="meetings"?"meeting":event.type==="projects"?"projects":event.type==="tasks"?"work":event.type==="leave"?"time":"ministry",
    meta:event.meta
      || (event.leave?`${event.leave.start_date} → ${event.leave.end_date}`:null)
      || (event.type==="activities"?(event.activity?.location||event.activity?.unit_note||"Ministry activity"):null)
      || (event.type==="projects"?"Project date":event.type==="tasks"?"Work deadline":"Recorded calendar item"),
    status:event.meetingStatus==="cancelled"||event.activity?.cancelled
      ?"Cancelled"
      :event.type==="meetings"
        ?"Meeting"
        :event.type==="projects"
          ?"Project"
          :event.type==="tasks"
            ?(event.routineState?routineCalendarStatus(event.routineState):calendarWorkStatus(event.workStatus))
            :event.type==="leave"
              ?"Approved"
              :"Ministry",
    statusTone:["completed","self_certified"].includes(event.workStatus)?"success":event.workStatus==="returned"?"warning":event.meetingStatus==="cancelled"||event.activity?.cancelled
      ?"danger"
      :event.type==="meetings"
        ?"action"
        :event.type==="leave"
          ?"success"
          :"neutral",
    onClick:()=>openCalendarEvent(event),
  }),[openCalendarEvent]);
  const displayEvents=useMemo(()=>calendarEvents.map(displayEvent),[calendarEvents,displayEvent]);

  const scopeControl=<div className="phase6-calendar-scope" role="tablist" aria-label="Manager calendar scope">
    <button type="button" role="tab" aria-selected={calendarScope==="my"} className={calendarScope==="my"?"is-selected":""} onClick={()=>setCalendarScope("my")}>My calendar</button>
    <button type="button" role="tab" aria-selected={calendarScope==="unit"} className={calendarScope==="unit"?"is-selected":""} onClick={()=>setCalendarScope("unit")}>Unit calendar</button>
  </div>;

  if(calendarScope==="my") return <StaffCalendar
    me={me}
    openItem={openItem}
    openMeeting={openMeeting}
    statusLabel="Manager · My calendar"
    scopeControl={scopeControl}
    scheduleMeeting={scheduleMeeting}
  />;

  return <div className="body ev2cal-role-page ev2cal-manager-page">
    <CalendarPageHeader
      eyebrow={me.unit_name}
      title="Calendar"
      description="Your unit’s meetings, work and important dates."
      statusTone="action"
      action={<Button icon="meeting" onClick={()=>scheduleMeeting?.({ scope:"unit", unitId:me.unit_id, unitName:me.unit_name,startsAt:`${selectedDate}T09:00` })}>Schedule meeting</Button>}
    />

    {scopeControl}

    {error&&<ProductNotice tone="error" title="Could not load the calendar">{error}</ProductNotice>}

    {routineCalendar.loading&&<p className="screen-note" role="status">Loading routine dates…</p>}
    {routineCalendar.error&&<ProductNotice tone="error" title="Routine dates unavailable">{routineCalendar.error}<Button variant="secondary" onClick={routineCalendar.reload}>Retry routine dates</Button></ProductNotice>}

    {loading?<LoadingState label="Loading calendar…"/>:<CalendarExplorer me={me} scope="unit" events={displayEvents} layers={FILTERS.filter(item=>item.value!=="all")} cursor={cursor} setCursor={setCursor} selectedDate={selectedDate} onSelectDate={setSelectedDate}/>}

    <details className="ceac-calendar-connection"><summary>Your Google Calendar</summary><p>Automatic personal sync is not connected yet. Add individual meetings from their details, or open Google Calendar.</p><a href="https://calendar.google.com/calendar/u/0/r" target="_blank" rel="noreferrer">Open Google Calendar</a></details>

    {selectedLeave&&<Sheet onClose={()=>setSelectedLeave(null)}>
      <div className="eyebrow">Approved leave</div>
      <div className="h2" style={{marginTop:5}}>{selectedLeave.full_name}</div>
      <div className="card" style={{marginTop:14}}>
        <div className="row-t">{selectedLeave.kind} leave</div>
        <div className="row-m">{selectedLeave.start_date} → {selectedLeave.end_date}</div>
        <div className="row-note">Status: approved</div>
      </div>
      <button className="btn btn-ghost" style={{marginTop:12}} onClick={()=>{ const personId=selectedLeave.profile_id; setSelectedLeave(null); openPerson(personId,"current"); }}>Open team member</button>
      <button className="btn btn-ghost" style={{marginTop:8}} onClick={()=>setSelectedLeave(null)}>Close</button>
    </Sheet>}

    {selectedActivity&&<Sheet onClose={()=>setSelectedActivity(null)}>
      <div className="eyebrow">{selectedActivity.kind.replaceAll("_"," ")} · {selectedActivity.scope==="church"?"Church-wide":"Unit activity"}</div>
      <div className="h2" style={{marginTop:5}}>{selectedActivity.title}</div>
      {selectedActivity.cancelled&&<div className="flag flag-brick"><h4>Cancelled</h4>This event remains on the calendar because teams may already have planned around it.</div>}
      <div className="card" style={{marginTop:14}}>
        <div className="row-m">{selectedActivity.all_day?"All day":new Date(selectedActivity.starts_at).toLocaleString("en-GB",{timeZone:"Africa/Accra",day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})}{selectedActivity.ends_at&&!selectedActivity.all_day?` → ${new Date(selectedActivity.ends_at).toLocaleString("en-GB",{timeZone:"Africa/Accra",day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})}`:""}</div>
        {selectedActivity.location&&<div className="row-note">Location: {selectedActivity.location}</div>}
        {selectedActivity.unit_note&&<div className="row-note"><b>Your unit:</b> {selectedActivity.unit_note}</div>}
        {selectedActivity.notes&&<div className="row-note">{selectedActivity.notes}</div>}
      </div>
      <button className="btn btn-ghost" style={{marginTop:12}} onClick={()=>setSelectedActivity(null)}>Close</button>
    </Sheet>}
  </div>;
}

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import useRoutineCalendar from "../lib/useRoutineCalendar";
import { routineCalendarStatus } from "../lib/readRoutineCalendar.js";
import { Sheet, ProductNotice, LoadingState } from "../components/bits";
import { humanError } from "../lib/productLanguage";
import { Button, Surface } from "../experience-v2/components";
import StaffCalendar from "./StaffCalendar";
import {
  CalendarAgenda,
  CalendarFilters,
  CalendarMonthGrid,
  CalendarPageHeader,
  CalendarPeriodControls,
  CalendarViewTabs,
} from "../experience-v2/calendar/CalendarFamilyV2";

const FILTERS = [
  { value:"all", label:"All", icon:"calendar" },
  { value:"meetings", label:"Meetings", icon:"meeting" },
  { value:"projects", label:"Projects", icon:"projects" },
  { value:"tasks", label:"Work", icon:"work" },
  { value:"leave", label:"Leave", icon:"time" },
  { value:"activities", label:"Ministry/unit activities", icon:"ministry" },
];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
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
const googleStamp = (value) => new Date(value).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
function googleCalendarUrl(event) {
  const start = new Date(event.startsAt);
  const end = event.endsAt ? new Date(event.endsAt) : new Date(start.getTime() + 60 * 60000);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${googleStamp(start)}/${googleStamp(end)}`,
    details: "CEAC OS meeting. Open CEAC OS for the authoritative meeting record.",
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export default function ManagerCalendar({ me, openItem, openProject, openMeeting, scheduleMeeting, openPerson }) {
  const now=new Date();
  const [calendarScope,setCalendarScope]=useState("unit");
  const [view,setView]=useState("month");
  const [filter,setFilter]=useState("all");
  const [cursor,setCursor]=useState(now);
  const [selectedDate,setSelectedDate]=useState(dateKey(now));
  const [events,setEvents]=useState([]);
  const [selectedActivity,setSelectedActivity]=useState(null);
  const [selectedLeave,setSelectedLeave]=useState(null);
  const [filterSheet,setFilterSheet]=useState(false);
  const [error,setError]=useState(null);
  const [loading,setLoading]=useState(true);

  const routineCalendar=useRoutineCalendar(me,{scope:"unit",enabled:calendarScope==="unit",
    fromDate:dateKey(new Date(cursor.getFullYear(),cursor.getMonth()-1,1)),
    throughDate:dateKey(new Date(cursor.getFullYear(),cursor.getMonth()+2,0))});
  const calendarEvents=[...events,...routineCalendar.events];

  useEffect(()=>{ load(); },[me.id,me.unit_id]);

  async function load(){
    setLoading(true); setError(null);
    const [projects, work, members, leave, ministry, ministryNeeds, meetings] = await Promise.all([
      supabase.from("projects").select("id,name,starts_on,ends_on,status,lead_unit_id,project_units(unit_id)"),
      supabase.from("work_items").select("id,ref,title,due_at,status,project_id").eq("unit_id",me.unit_id).not("due_at","is",null).neq("visibility","private").neq("kind","routine"),
      supabase.from("unit_memberships").select("profile_id").eq("unit_id",me.unit_id),
      supabase.from("leave_requests").select("id,profile_id,kind,start_date,end_date,status,profiles!leave_requests_profile_id_fkey(full_name)").eq("status","approved"),
      supabase.from("ministry_events").select("id,title,kind,scope,unit_id,starts_at,ends_at,all_day,location,notes,cancelled"),
      supabase.from("ministry_event_units").select("event_id,unit_id,note").eq("unit_id",me.unit_id),
      supabase.from("meeting_sessions").select("id,title,scope,unit_id,project_id,starts_at,ends_at,status,provider,join_url,meeting_participants(profile_id,role)").order("starts_at")
    ]);
    const firstError=[projects.error,work.error,members.error,leave.error,ministry.error,ministryNeeds.error,meetings.error].find(Boolean);
    if(firstError){ setError(humanError(firstError,"Calendar could not be loaded.")); setLoading(false); return; }
    const memberIds=new Set((members.data||[]).map(x=>x.profile_id));
    const out=[];
    (projects.data||[]).filter((p)=>p.lead_unit_id===me.unit_id||(p.project_units||[]).some((row)=>row.unit_id===me.unit_id)).forEach(p=>{
      if(p.starts_on) out.push({id:`project-start-${p.id}`,type:"projects",date:p.starts_on,title:`${p.name} starts`,projectId:p.id});
      if(p.ends_on) out.push({id:`project-end-${p.id}`,type:"projects",date:p.ends_on,title:`${p.name} ends`,projectId:p.id});
    });
    (work.data||[]).forEach(w=>out.push({id:`task-${w.id}`,type:"tasks",date:accraDateKey(w.due_at),title:`${w.ref} · ${w.title}`,itemId:w.id}));
    (leave.data||[]).filter(l=>memberIds.has(l.profile_id)).forEach(l=>{
      let d=parseDateOnly(l.start_date), end=parseDateOnly(l.end_date);
      while(d<=end){ out.push({
        id:`leave-${l.id}-${dateKey(d)}`,
        type:"leave",
        date:dateKey(d),
        title:`${l.profiles?.full_name||"Team member"} · ${l.kind} leave`,
        leave:{ id:l.id, profile_id:l.profile_id, full_name:l.profiles?.full_name||"Team member", kind:l.kind, start_date:l.start_date, end_date:l.end_date, status:l.status }
      }); d=addDays(d,1); }
    });
    const needByEvent = new Map((ministryNeeds.data||[]).map((row)=>[row.event_id,row.note]));
    (ministry.data||[]).filter((event)=>event.scope==="church"||event.unit_id===me.unit_id||needByEvent.has(event.id)).forEach((event)=>{
      const needNote=needByEvent.get(event.id);
      let d=parseDateOnly(accraDateKey(event.starts_at));
      const end=parseDateOnly(accraDateKey(event.ends_at||event.starts_at));
      while(d<=end){
        out.push({
          id:`activity-${event.id}-${dateKey(d)}`,
          type:"activities",
          date:dateKey(d),
          title:`${event.cancelled?"Cancelled · ":""}${event.title}${needNote?` · Your unit: ${needNote}`:""}${event.location?` · ${event.location}`:""}`,
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
        d=addDays(d,1);
      }
    });
    (meetings.data||[]).forEach((meeting)=>{
      const participantCount=(meeting.meeting_participants||[]).length;
      const scopeLabel=meeting.scope==="project"?"Project":meeting.scope==="unit"?"Unit":"Organisation";
      const providerLabel=meeting.provider==="zoom"?"Zoom":"External";
      out.push({
        id:`meeting-${meeting.id}`,
        type:"meetings",
        date:accraDateKey(meeting.starts_at),
        title:meeting.title,
        meetingId:meeting.id,
        meetingStatus:meeting.status,
        startsAt:meeting.starts_at,
        endsAt:meeting.ends_at,
        meta:`${scopeLabel} meeting · ${participantCount} participant${participantCount===1?"":"s"} · ${providerLabel}`,
      });
    });
    setEvents(out); setLoading(false);
  }

  const days=useMemo(()=>{
    if(view==="week"){ const s=startOfWeek(cursor); return Array.from({length:7},(_,i)=>addDays(s,i)); }
    const first=new Date(cursor.getFullYear(),cursor.getMonth(),1);
    const start=startOfWeek(first);
    return Array.from({length:42},(_,i)=>addDays(start,i));
  },[cursor,view]);
  const visible=filter==="all"?calendarEvents:calendarEvents.filter(e=>e.type===filter);
  const heading=view==="month"?`${MONTHS[cursor.getMonth()]} ${cursor.getFullYear()}`:`${labelDate(dateKey(days[0]))} – ${labelDate(dateKey(days[6]))}`;
  const googleMeetings=events
    .filter((event)=>event.type==="meetings"&&event.meetingStatus!=="cancelled"&&event.startsAt&&new Date(event.startsAt)>=new Date())
    .sort((a,b)=>new Date(a.startsAt)-new Date(b.startsAt))
    .slice(0,3);

  const openCalendarEvent=(event)=>{
    if(event.itemId) return openItem(event.itemId,event.routineState?event.scheduledOn:null);
    if(event.meetingId) return openMeeting?.(event.meetingId);
    if(event.projectId) return openProject(event.projectId);
    if(event.leave) return setSelectedLeave(event.leave);
    if(event.activity) return setSelectedActivity(event.activity);
    return null;
  };

  const displayEvent=(event)=>({
    ...event,
    kind:event.type,
    icon:event.type==="meetings"?"meeting":event.type==="projects"?"projects":event.type==="tasks"?"work":event.type==="leave"?"time":"ministry",
    meta:event.meta
      || (event.leave?`${event.leave.start_date} → ${event.leave.end_date}`:null)
      || (event.activity?.location||event.activity?.unit_note||"Ministry activity")
      || (event.type==="projects"?"Project date":event.type==="tasks"?"Work deadline":"Recorded calendar item"),
    status:event.meetingStatus==="cancelled"||event.activity?.cancelled
      ?"Cancelled"
      :event.type==="meetings"
        ?"Meeting"
        :event.type==="projects"
          ?"Project"
          :event.type==="tasks"
            ?(event.routineState?routineCalendarStatus(event.routineState):"Due")
            :event.type==="leave"
              ?"Approved"
              :"Ministry",
    statusTone:event.meetingStatus==="cancelled"||event.activity?.cancelled
      ?"danger"
      :event.type==="meetings"
        ?"action"
        :event.type==="leave"
          ?"success"
          :"neutral",
    onClick:()=>openCalendarEvent(event),
  });

  const selectedEvents=visible.filter(event=>event.date===selectedDate).map(displayEvent);

  const move=(amount)=>{
    const next=view==="month"
      ?new Date(cursor.getFullYear(),cursor.getMonth()+amount,1)
      :addDays(cursor,amount*7);
    setCursor(next);
    setSelectedDate(dateKey(next));
  };
  const goToday=()=>{
    const today=new Date();
    setCursor(today);
    setSelectedDate(dateKey(today));
  };
  const switchView=(next)=>{
    setView(next);
    setSelectedDate(dateKey(cursor));
  };

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
  />;

  return <div className="body ev2cal-role-page ev2cal-manager-page">
    <CalendarPageHeader
      eyebrow={me.unit_name}
      title="Calendar"
      description="Meetings, project dates, routine dates, work deadlines, approved leave and ministry activity in one place."
      status="Unit schedule"
      statusTone="action"
      action={<Button icon="meeting" onClick={()=>scheduleMeeting?.({ scope:"unit", unitId:me.unit_id, unitName:me.unit_name })}>Schedule meeting</Button>}
    />

    {scopeControl}

    {error&&<ProductNotice tone="error" title="Could not load the calendar">{error}</ProductNotice>}

    {routineCalendar.loading&&<p className="screen-note" role="status">Loading routine dates…</p>}
    {routineCalendar.error&&<ProductNotice tone="error" title="Routine dates unavailable">{routineCalendar.error}<Button variant="secondary" onClick={routineCalendar.reload}>Retry routine dates</Button></ProductNotice>}

    <div className="ev2cal-toolbar">
      <CalendarViewTabs
        value={view}
        onChange={switchView}
        ariaLabel="Calendar view"
        items={[
          { value:"month", label:"Month", icon:"calendar" },
          { value:"week", label:"Week", icon:"calendar" },
        ]}
      />
      <Button variant="secondary" icon="filter" onClick={()=>setFilterSheet(true)}>
        View {FILTERS.find((item)=>item.value===filter)?.label||"All"}
      </Button>
    </div>

    <CalendarPeriodControls
      label={heading}
      onPrevious={()=>move(-1)}
      onNext={()=>move(1)}
      onToday={goToday}
    />

    {loading?<LoadingState label="Loading calendar…"/>:<div className="ev2cal-role-layout">
      <CalendarMonthGrid
        days={days}
        currentMonth={view==="month"?cursor.getMonth():undefined}
        selectedDateKey={selectedDate}
        onSelectDate={(key)=>setSelectedDate(key)}
        getEvents={(key)=>visible.filter(event=>event.date===key).map(displayEvent)}
        maxEventsPerDay={view==="week"?6:3}
        ariaLabel={view==="month"?"Manager month calendar":"Manager week calendar"}
      />
      <div className="ev2cal-side-stack">
        <CalendarAgenda
          title={labelDay(selectedDate)}
          description="Recorded unit calendar items for the selected date. Open an item to keep its existing authoritative workflow."
          events={selectedEvents}
          emptyTitle="Nothing recorded for this date"
          emptyDescription={visible.length?"Choose another date to inspect this filtered view.":"No events are recorded for this view."}
        />

        <Surface variant="soft" padding="standard" className="ev2cal-google" aria-label="Google Calendar">
          <div className="ev2cal-integration-copy">
            <strong>Your Google Calendar</strong>
            <p>Automatic personal sync is not connected yet because CEAC OS does not hold a Google authorisation for your account. You can add CEAC meetings yourself from here without giving Administration access to your calendar.</p>
          </div>
          <div className="ev2cal-link-row">
            <a className="ev2cal-external-link" href="https://calendar.google.com/calendar/u/0/r" target="_blank" rel="noreferrer">Open Google Calendar</a>
            {googleMeetings.map((meeting)=><a key={meeting.id} className="ev2cal-external-link" href={googleCalendarUrl(meeting)} target="_blank" rel="noreferrer">Add {meeting.title}</a>)}
          </div>
        </Surface>
      </div>
    </div>}

    {filterSheet&&<Sheet onClose={()=>setFilterSheet(false)}>
      <div className="eyebrow">Calendar view</div>
      <div className="h2" style={{marginTop:5}}>Show on calendar</div>
      <p className="screen-note">Choose one layer. Your Month or Week setting stays unchanged.</p>
      <CalendarFilters
        value={filter}
        ariaLabel="Calendar layer"
        items={FILTERS}
        onChange={(value)=>{setFilter(value);setFilterSheet(false);}}
      />
    </Sheet>}

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

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { LoadingState, ProductNotice } from "../components/bits";
import { Button } from "../experience-v2/components";
import { humanError } from "../lib/productLanguage";
import {
  CalendarAgenda,
  CalendarFilters,
  CalendarMonthGrid,
  CalendarPageHeader,
  CalendarPeriodControls,
} from "../experience-v2/calendar/CalendarFamilyV2";

const pad=(v)=>String(v).padStart(2,"0");
const dayKey=(d)=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const addDays=(d,n)=>{const x=new Date(d);x.setDate(x.getDate()+n);return x;};
const startOfWeek=(d)=>{const x=new Date(d.getFullYear(),d.getMonth(),d.getDate());x.setDate(x.getDate()-((x.getDay()+6)%7));return x;};
const accraDay=(value)=>{const parts=new Intl.DateTimeFormat("en-CA",{timeZone:"Africa/Accra",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date(value));const map=Object.fromEntries(parts.map(p=>[p.type,p.value]));return `${map.year}-${map.month}-${map.day}`;};
const labelDay=(key)=>new Date(`${key}T12:00:00`).toLocaleDateString("en-GB",{weekday:"long",day:"numeric",month:"long"});
const shortDate=(key)=>new Date(`${key}T12:00:00`).toLocaleDateString("en-GB",{day:"numeric",month:"short"});

const FILTER_ITEMS = [
  { value:"all", label:"All", icon:"calendar" },
  { value:"meeting", label:"Meetings", icon:"meeting" },
  { value:"work", label:"Work", icon:"work" },
  { value:"personal", label:"Personal", icon:"check" },
  { value:"ministry", label:"Ministry", icon:"ministry" },
  { value:"leave", label:"Leave", icon:"time" },
];

function timeLabel(value){
  if(!value)return null;
  return String(value).slice(0,5);
}

export default function StaffCalendar({me,openItem,openMeeting}){
  const today=new Date();
  const [cursor,setCursor]=useState(today);
  const [selectedDate,setSelectedDate]=useState(dayKey(today));
  const [events,setEvents]=useState([]);
  const [personalTasks,setPersonalTasks]=useState([]);
  const [dayNotes,setDayNotes]=useState([]);
  const [dayTab,setDayTab]=useState("tasks");
  const [taskTitle,setTaskTitle]=useState("");
  const [taskTime,setTaskTime]=useState("");
  const [noteDraft,setNoteDraft]=useState("");
  const [busy,setBusy]=useState(false);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState(null);
  const [notice,setNotice]=useState(null);
  const [filter,setFilter]=useState("all");

  useEffect(()=>{load();},[me.id,me.unit_id,cursor.getFullYear(),cursor.getMonth()]);
  useEffect(()=>{
    const row=dayNotes.find(note=>note.note_date===selectedDate);
    setNoteDraft(row?.body||"");
  },[selectedDate,dayNotes]);

  async function load(){
    setLoading(true);setError(null);
    try{
      const rangeStart=new Date(cursor.getFullYear(),cursor.getMonth()-1,1);
      const rangeEnd=new Date(cursor.getFullYear(),cursor.getMonth()+2,1);
      const from=rangeStart.toISOString();
      const to=rangeEnd.toISOString();
      const fromDay=dayKey(rangeStart);
      const toDay=dayKey(rangeEnd);
      const [work,meetings,ministry,leave,tasks,notes]=await Promise.all([
        supabase.from("work_items").select("id,ref,title,status,due_at,projects(name)").eq("assignee_id",me.id).not("due_at","is",null).neq("visibility","private"),
        supabase.from("meeting_sessions").select("id,title,scope,unit_id,project_id,starts_at,ends_at,status,provider,projects(name),units(name)").gte("starts_at",from).lt("starts_at",to).order("starts_at"),
        supabase.from("ministry_events").select("id,title,kind,scope,unit_id,starts_at,ends_at,all_day,location,cancelled").gte("starts_at",from).lt("starts_at",to).order("starts_at"),
        supabase.from("leave_requests").select("id,kind,start_date,end_date,status").eq("profile_id",me.id).eq("status","approved").order("start_date"),
        supabase.from("personal_day_tasks").select("id,plan_date,title,details,planned_time,completed_at,created_at").eq("profile_id",me.id).gte("plan_date",fromDay).lt("plan_date",toDay).order("plan_date").order("planned_time",{ascending:true,nullsFirst:false}),
        supabase.from("personal_day_notes").select("id,note_date,body,updated_at").eq("profile_id",me.id).gte("note_date",fromDay).lt("note_date",toDay).order("note_date"),
      ]);
      const first=[work.error,meetings.error,ministry.error,leave.error,tasks.error,notes.error].find(Boolean);if(first)throw first;
      const rows=[];
      (work.data||[]).forEach(item=>rows.push({id:`work-${item.id}`,kind:"work",date:accraDay(item.due_at),title:item.title,meta:`${item.ref}${item.projects?.name?` · ${item.projects.name}`:""}`,itemId:item.id}));
      (meetings.data||[]).filter(row=>row.status!=="cancelled").forEach(row=>rows.push({id:`meeting-${row.id}`,kind:"meeting",date:accraDay(row.starts_at),title:row.title,meta:new Date(row.starts_at).toLocaleTimeString("en-GB",{timeZone:"Africa/Accra",hour:"2-digit",minute:"2-digit"}),meetingId:row.id}));
      (ministry.data||[]).filter(row=>row.scope==="church"||row.unit_id===me.unit_id).forEach(row=>rows.push({id:`ministry-${row.id}`,kind:"ministry",date:accraDay(row.starts_at),title:`${row.cancelled?"Cancelled · ":""}${row.title}`,meta:row.location||"Ministry activity"}));
      (leave.data||[]).forEach(row=>{let d=new Date(`${row.start_date}T00:00:00`),end=new Date(`${row.end_date}T00:00:00`);while(d<=end){rows.push({id:`leave-${row.id}-${dayKey(d)}`,kind:"leave",date:dayKey(d),title:`${row.kind} leave`,meta:"Approved"});d=addDays(d,1);}});
      const privateTasks=tasks.data||[];
      privateTasks.forEach(task=>rows.push({id:`personal-${task.id}`,kind:"personal",date:task.plan_date,title:task.title,meta:task.planned_time?timeLabel(task.planned_time):"Private task",taskId:task.id,completed:Boolean(task.completed_at)}));
      setPersonalTasks(privateTasks);
      setDayNotes(notes.data||[]);
      setEvents(rows);
    }catch(err){setError(humanError(err,"Your calendar could not be loaded."));setEvents([]);setPersonalTasks([]);setDayNotes([]);}
    finally{setLoading(false);}
  }

  async function addPersonalTask(){
    if(!taskTitle.trim())return;
    setBusy(true);setError(null);setNotice(null);
    const {error:insertError}=await supabase.from("personal_day_tasks").insert({
      org_id:me.org_id,
      profile_id:me.id,
      plan_date:selectedDate,
      title:taskTitle.trim(),
      planned_time:taskTime||null,
    });
    setBusy(false);
    if(insertError){setError(humanError(insertError,"Your private task could not be added."));return;}
    setTaskTitle("");setTaskTime("");setNotice("Private task added.");await load();
  }

  async function togglePersonalTask(task){
    setBusy(true);setError(null);
    const {error:updateError}=await supabase.from("personal_day_tasks")
      .update({completed_at:task.completed_at?null:new Date().toISOString()})
      .eq("id",task.id).eq("profile_id",me.id);
    setBusy(false);
    if(updateError){setError(humanError(updateError,"Your private task could not be updated."));return;}
    await load();
  }

  async function saveDayNote(){
    setBusy(true);setError(null);setNotice(null);
    const {error:saveError}=await supabase.from("personal_day_notes").upsert({
      org_id:me.org_id,
      profile_id:me.id,
      note_date:selectedDate,
      body:noteDraft,
    },{onConflict:"profile_id,note_date"});
    setBusy(false);
    if(saveError){setError(humanError(saveError,"Your private day note could not be saved."));return;}
    setNotice("Private note saved.");await load();
  }

  const first=new Date(cursor.getFullYear(),cursor.getMonth(),1);
  const gridStart=startOfWeek(first);
  const days=useMemo(()=>Array.from({length:42},(_,i)=>addDays(gridStart,i)),[cursor.getFullYear(),cursor.getMonth()]);
  const visible=filter==="all"?events:events.filter(e=>e.kind===filter);

  const open=(event)=>event.itemId?openItem?.(event.itemId):event.meetingId?openMeeting?.(event.meetingId):null;
  const displayEvent=(event,includeDate=false)=>({
    ...event,
    icon:event.kind==="meeting"?"meeting":event.kind==="work"?"work":event.kind==="personal"?"check":event.kind==="ministry"?"ministry":"time",
    meta:`${includeDate?new Date(`${event.date}T12:00:00`).toLocaleDateString("en-GB",{weekday:"short",day:"numeric",month:"short"})+" · ":""}${event.meta||""}`,
    status:event.kind==="leave"?"Approved":event.kind==="meeting"?"Meeting":event.kind==="work"?"Due":event.kind==="personal"?(event.completed?"Done":"Private"):"Ministry",
    statusTone:event.kind==="leave"?"success":event.kind==="meeting"?"action":event.kind==="personal"&&event.completed?"success":"neutral",
    onClick:event.itemId||event.meetingId?()=>open(event):undefined,
  });

  const selectedShared=events.filter(event=>event.date===selectedDate&&event.kind!=="personal");
  const selectedPrivate=personalTasks.filter(task=>task.plan_date===selectedDate);
  const selectedWork=selectedShared.filter(event=>event.kind==="work");
  const selectedSchedule=selectedShared.filter(event=>event.kind!=="work");
  const upcoming=[...visible]
    .filter(event=>event.date>=dayKey(new Date())&&event.kind!=="personal")
    .sort((a,b)=>a.date.localeCompare(b.date))
    .slice(0,8)
    .map(event=>displayEvent(event,true));

  const moveMonth=(amount)=>{
    const next=new Date(cursor.getFullYear(),cursor.getMonth()+amount,1);
    setCursor(next);
    setSelectedDate(dayKey(next));
  };
  const goToday=()=>{
    const now=new Date();
    setCursor(now);
    setSelectedDate(dayKey(now));
  };

  return <div className="body ev2cal-role-page ev2cal-staff-page phase6-calendar-page">
    <CalendarPageHeader
      eyebrow="My workspace"
      title="Calendar"
      description="Shared CEAC commitments and your private planning in one calendar. Private tasks and notes stay visible only to you."
      status="Staff / Volunteer"
      statusTone="action"
    />

    <CalendarFilters value={filter} onChange={setFilter} items={FILTER_ITEMS} ariaLabel="Calendar filters" />

    {error&&<ProductNotice tone="error" title="Could not load Calendar">{error}</ProductNotice>}
    {notice&&<ProductNotice tone="success" title="Calendar">{notice}</ProductNotice>}

    {loading?<LoadingState label="Loading your calendar…"/>:<>
      <CalendarPeriodControls
        label={cursor.toLocaleDateString("en-GB",{month:"long",year:"numeric"})}
        onPrevious={()=>moveMonth(-1)}
        onNext={()=>moveMonth(1)}
        onToday={goToday}
      />

      <div className="phase6-calendar-workspace">
        <div className="phase6-calendar-month">
          <CalendarMonthGrid
            days={days}
            currentMonth={cursor.getMonth()}
            selectedDateKey={selectedDate}
            onSelectDate={(key)=>{setSelectedDate(key);setDayTab("tasks");}}
            getEvents={(key)=>visible.filter(event=>event.date===key).map(event=>displayEvent(event))}
            ariaLabel="Personal month calendar"
          />
        </div>

        <aside className="phase6-day-workspace" aria-label="Selected day workspace">
          <header className="phase6-day-workspace-head">
            <div>
              <span>Day workspace</span>
              <h2>{labelDay(selectedDate)}</h2>
              <p>Shared records stay authoritative. Personal tasks and notes are private to you.</p>
            </div>
            <span className="phase6-private-pill">Private planning protected</span>
          </header>

          <div className="phase6-day-tabs" role="tablist" aria-label="Day workspace views">
            <button type="button" role="tab" aria-selected={dayTab==="tasks"} className={dayTab==="tasks"?"is-selected":""} onClick={()=>setDayTab("tasks")}>Tasks</button>
            <button type="button" role="tab" aria-selected={dayTab==="notes"} className={dayTab==="notes"?"is-selected":""} onClick={()=>setDayTab("notes")}>Notes</button>
          </div>

          {dayTab==="tasks"?<div className="phase6-day-task-view">
            <section className="phase6-day-block">
              <div className="phase6-day-block-head"><h3>Schedule</h3><span>{selectedSchedule.length}</span></div>
              {selectedSchedule.length?selectedSchedule.map(event=><button key={event.id} type="button" className="phase6-day-shared-row" onClick={()=>open(event)} disabled={!event.itemId&&!event.meetingId}>
                <span className={`phase6-day-kind is-${event.kind}`}>{event.kind}</span>
                <span><strong>{event.title}</strong><small>{event.meta||"Recorded CEAC commitment"}</small></span>
              </button>):<p className="phase6-day-empty">No shared schedule item is recorded for this day.</p>}
            </section>

            <section className="phase6-day-block">
              <div className="phase6-day-block-head"><h3>Today's tasks</h3><span>{selectedPrivate.length+selectedWork.length}</span></div>
              {selectedWork.map(event=><button key={event.id} type="button" className="phase6-day-shared-row" onClick={()=>open(event)}>
                <span className="phase6-day-kind is-work">work</span>
                <span><strong>{event.title}</strong><small>{event.meta}</small></span>
              </button>)}
              {selectedPrivate.map(task=><label key={task.id} className={task.completed_at?"phase6-private-task is-complete":"phase6-private-task"}>
                <input type="checkbox" checked={Boolean(task.completed_at)} disabled={busy} onChange={()=>togglePersonalTask(task)}/>
                <span><strong>{task.title}</strong><small>{task.planned_time?timeLabel(task.planned_time):"Private personal task"}</small></span>
                <em>Private</em>
              </label>)}
              {!selectedPrivate.length&&!selectedWork.length?<p className="phase6-day-empty">No task is planned or due on this day.</p>:null}
              <div className="phase6-private-task-compose">
                <input className="field" aria-label="New private task" placeholder="Add a private task" value={taskTitle} onChange={event=>setTaskTitle(event.target.value)} />
                <input className="field" aria-label="Private task time" type="time" value={taskTime} onChange={event=>setTaskTime(event.target.value)} />
                <Button size="sm" disabled={busy||!taskTitle.trim()} onClick={addPersonalTask}>Add task</Button>
              </div>
            </section>
          </div>:<div className="phase6-day-note-view">
            <div className="phase6-note-boundary">
              <strong>Private notes for {shortDate(selectedDate)}</strong>
              <span>Only you can read this day note. Meeting decisions and shared notes remain in their meeting records.</span>
            </div>
            <textarea className="field phase6-day-note-editor" aria-label="Private day notes" rows={12} value={noteDraft} onChange={event=>setNoteDraft(event.target.value)} placeholder="Write private planning notes for this day…" />
            <div className="phase6-day-note-actions">
              <span>{noteDraft.length.toLocaleString()} / 12,000</span>
              <Button disabled={busy||noteDraft.length>12000} onClick={saveDayNote}>{busy?"Saving…":"Save private note"}</Button>
            </div>
          </div>}
        </aside>
      </div>

      <div className="phase6-calendar-coming-up">
        <CalendarAgenda
          eyebrow="Shared commitments"
          title="Coming up"
          description="Upcoming Work, meetings, approved leave and ministry commitments. Private planning stays in your day workspace."
          events={upcoming}
          emptyTitle="Nothing coming up"
          emptyDescription="Nothing shared is recorded in this view."
        />
      </div>
    </>}
  </div>;
}

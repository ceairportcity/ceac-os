import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import useRoutineCalendar from "../lib/useRoutineCalendar";
import CalendarExplorer, { useCalendarPosition } from "../experience-v2/calendar/CalendarExplorer";
import { calendarWorkStatus, calendarWindow, calendarSpan, calendarDate } from "../lib/calendarPlanning";
import { calendarJournalLeaveEvent } from "../lib/calendarJournalNavigation";
import { routineCalendarStatus } from "../lib/readRoutineCalendar.js";
import { FieldGroup, LoadingState, ProductNotice, Sheet } from "../components/bits";
import { Button } from "../experience-v2/components";
import { humanError } from "../lib/productLanguage";
import PersonalRecurringTaskComposer from "../components/PersonalRecurringTaskComposer";
import PersonalPlanningEditor from "../components/PersonalPlanningEditor";
import PersonalNotesLibrary from "../components/PersonalNotesLibrary";
import { isMissingPersonalPlanningSchema } from "../lib/stage1SchemaCompatibility";
import {
  CalendarAgenda,
  CalendarPageHeader,
} from "../experience-v2/calendar/CalendarFamilyV2";

const pad=(v)=>String(v).padStart(2,"0");
const dayKey=(d)=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const addDays=(d,n)=>{const x=new Date(d);x.setDate(x.getDate()+n);return x;};
const startOfWeek=(d)=>{const x=new Date(d.getFullYear(),d.getMonth(),d.getDate());x.setDate(x.getDate()-((x.getDay()+6)%7));return x;};
const accraDay=(value)=>{const parts=new Intl.DateTimeFormat("en-CA",{timeZone:"Africa/Accra",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date(value));const map=Object.fromEntries(parts.map(p=>[p.type,p.value]));return `${map.year}-${map.month}-${map.day}`;};
const labelDay=(key)=>new Date(`${key}T12:00:00`).toLocaleDateString("en-GB",{weekday:"long",day:"numeric",month:"long"});
const shortDate=(key)=>new Date(`${key}T12:00:00`).toLocaleDateString("en-GB",{day:"numeric",month:"short"});
const timeLabel=(value)=>value?String(value).slice(0,5):null;

const FILTER_ITEMS = [
  { value:"all", label:"All", icon:"calendar" },
  { value:"meeting", label:"Meetings", icon:"meeting" },
  { value:"work", label:"Work", icon:"work" },
  { value:"personal", label:"Personal", icon:"check" },
  { value:"ministry", label:"Ministry", icon:"ministry" },
  { value:"leave", label:"Leave", icon:"time" },
];

export default function StaffCalendar({me,openItem,openMeeting,statusLabel="Staff / Volunteer",scopeControl=null,initialDate=null,onFocusHandled,scheduleMeeting}){
  const today=new Date();
  const {cursor,setCursor,selectedDate,setSelectedDate}=useCalendarPosition(me,"personal",initialDate);
  useEffect(()=>{if(initialDate)onFocusHandled?.();},[]);
  const [events,setEvents]=useState([]);
  const focusedEvent=new URLSearchParams(window.location.search).get("event");
  useEffect(()=>{if(!focusedEvent || !/^[0-9a-f-]{36}$/i.test(focusedEvent))return;
    document.querySelector('[data-calendar-event="'+focusedEvent+'"]')?.scrollIntoView({block:"nearest"});
  },[events,focusedEvent]);
  const [personalTasks,setPersonalTasks]=useState([]);
  const [dayNotes,setDayNotes]=useState([]);
  const [checklistRows,setChecklistRows]=useState([]);
  const [meetingNotes,setMeetingNotes]=useState([]);
  const [workOptions,setWorkOptions]=useState([]);
  const [workOptionsLoading,setWorkOptionsLoading]=useState(false);
  const [projectOptions,setProjectOptions]=useState([]);
  const [dayTab,setDayTab]=useState("schedule");
  const [taskTitle,setTaskTitle]=useState("");
  const [taskTime,setTaskTime]=useState("");
  const [noteDraft,setNoteDraft]=useState("");
  const [notesLibraryOpen,setNotesLibraryOpen]=useState(false);
  const [notesRevision,setNotesRevision]=useState(0);
  const [composer,setComposer]=useState(null);
  const [composerType,setComposerType]=useState("event");
  const [composeTitle,setComposeTitle]=useState("");
  const [composeDetails,setComposeDetails]=useState("");
  const [composeDate,setComposeDate]=useState(dayKey(today));
  const [composeStart,setComposeStart]=useState("09:00");
  const [composeEnd,setComposeEnd]=useState("10:00");
  const [composeLocation,setComposeLocation]=useState("");
  const [composeUnscheduled,setComposeUnscheduled]=useState(false);
  const [composeReminder,setComposeReminder]=useState("");
  const [composeWorkId,setComposeWorkId]=useState("");
  const [composeProjectId,setComposeProjectId]=useState("");
  const [composeChecklist,setComposeChecklist]=useState("");
  const [composeNoteKind,setComposeNoteKind]=useState("dated");
  const [busy,setBusy]=useState(false);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState(null);
  const [notice,setNotice]=useState(null);
  const requestVersion=useRef(0);
  const materializedThrough=useRef(new Map());
  useEffect(()=>()=>{requestVersion.current++;},[]);
  const [personalPlanningReady,setPersonalPlanningReady]=useState(true);
  const [recurrenceReady,setRecurrenceReady]=useState(true);
  const [editingPrivateItem,setEditingPrivateItem]=useState(null);

  const routineCalendar=useRoutineCalendar(me,{scope:"own",
    fromDate:dayKey(new Date(cursor.getFullYear(),cursor.getMonth()-1,1)),
    throughDate:dayKey(new Date(cursor.getFullYear(),cursor.getMonth()+2,0))});
  const calendarEvents=useMemo(()=>[
    ...events,
    ...routineCalendar.events.map(event=>({...event,kind:"work"})),
    ...dayNotes.filter(note=>note.note_date||note.dated_for).map(note=>({
      id:"note-"+note.id, kind:"personal", personalType:"note", noteId:note.id,
      date:note.note_date||note.dated_for, title:note.note_kind==="daily"?"Daily journal":note.title||"Private note",
      meta:"Private note", raw:note,
    })),
  ],[events,routineCalendar.events,dayNotes]);

  useEffect(()=>{load();},[me.id,me.unit_id,cursor.getFullYear(),cursor.getMonth()]);
  // The visible calendar needs only dated Work in its visible window. Load the
  // full available Work options only if the person is creating a private task.
  useEffect(()=>{
    if(!composer || composerType!=="task")return;
    let active=true;setWorkOptionsLoading(true);
    supabase.from("work_items").select("id,ref,title,project_id,projects(id,name)")
      .eq("assignee_id",me.id).neq("visibility","private")
      .then(({data,error:readError})=>{
        if(!active)return;
        if(readError){setWorkOptions([]);setProjectOptions([]);setError("Work links could not be loaded. You can still create a private task without linking one.");return;}
        setWorkOptions(data||[]);
        const projects=new Map();
        (data||[]).forEach(item=>{if(item.projects?.id)projects.set(item.projects.id,item.projects.name);});
        setProjectOptions([...projects.entries()].map(([id,name])=>({id,name})));
      }).finally(()=>{if(active)setWorkOptionsLoading(false);});
    return()=>{active=false;};
  },[composer,composerType,me.id,me.org_id]);
  const journalRow=dayNotes.find(note=>note.note_date===selectedDate&&note.note_kind==="daily");
  const savedJournal=journalRow?.body||"";
  useEffect(()=>{setNoteDraft(savedJournal);},[selectedDate,savedJournal]);
  const journalDirty=dayTab==="notes"&&noteDraft!==savedJournal;
  const journalDirtyRef=useRef(false);
  journalDirtyRef.current=journalDirty;
  const protectJournal=useCallback(()=>{
    if(!journalDirtyRef.current)return true;
    if(!window.confirm("Discard unsaved changes to your daily journal?"))return false;
    journalDirtyRef.current=false;
    setNoteDraft(savedJournal);
    return true;
  },[savedJournal]);
  useEffect(()=>{
    if(!journalDirty)return;
    const warn=event=>{event.preventDefault();event.returnValue="";};
    const guard=event=>{if(!protectJournal())event.preventDefault();};
    window.addEventListener("beforeunload",warn);
    window.addEventListener(calendarJournalLeaveEvent,guard);
    return ()=>{
      window.removeEventListener("beforeunload",warn);
      window.removeEventListener(calendarJournalLeaveEvent,guard);
    };
  },[journalDirty,protectJournal]);
  const selectCalendarDate=useCallback(key=>{
    if(!protectJournal())return false;
    setSelectedDate(key);setDayTab("schedule");return true;
  },[protectJournal,setSelectedDate]);
  const switchDayTab=key=>{if(key!==dayTab&&!protectJournal())return;setDayTab(key);};

  async function load(){
    const request=++requestVersion.current;
    setLoading(true);setError(null);
    try{
      const {from:fromDay,to:toDay,fromAt:from,toAt:to}=calendarWindow(cursor);
      const [work,meetings,ministry,leave]=await Promise.all([
        supabase.from("work_items").select("id,ref,title,kind,status,due_at,project_id,projects(id,name)").eq("assignee_id",me.id).neq("visibility","private").gte("due_at",from).lt("due_at",to),
        supabase.from("meeting_sessions").select("id,title,scope,unit_id,project_id,starts_at,ends_at,status,provider,projects(name),units(name)").or(`ends_at.gte.${from},and(ends_at.is.null,starts_at.gte.${from})`).lt("starts_at",to).order("starts_at"),
        supabase.from("ministry_events").select("id,title,kind,scope,unit_id,starts_at,ends_at,all_day,location,cancelled").or(`ends_at.gte.${from},and(ends_at.is.null,starts_at.gte.${from})`).lt("starts_at",to).order("starts_at"),
        supabase.from("leave_requests").select("id,kind,start_date,end_date,status").eq("profile_id",me.id).eq("status","approved").gte("end_date",fromDay).lt("start_date",toDay).order("start_date"),
      ]);
      if(request!==requestVersion.current)return;
      const sharedError=[work.error,meetings.error,ministry.error,leave.error].find(Boolean);if(sharedError)throw sharedError;
      // Materialise only this signed-in person's schedule under owner-only RLS.
      // A missing recurrence migration never invents personal instances.
      const series=await supabase.from("personal_task_series")
        .select("id").eq("org_id",me.org_id).eq("profile_id",me.id).eq("is_active",true);
      if(series.error){
        if(!isMissingPersonalPlanningSchema(series.error))throw series.error;
        setRecurrenceReady(false);
      }else{
        setRecurrenceReady(true);
        const maxHorizon=new Date();
        maxHorizon.setUTCDate(maxHorizon.getUTCDate()+369);
        const through=toDay<dayKey(maxHorizon)?toDay:dayKey(maxHorizon);
        for(const item of series.data||[]){
          if(materializedThrough.current.get(item.id)>=through)continue;
          const generated=await supabase.rpc("personal_materialize_task_series",{
            p_series_id:item.id,p_through_date:through,
          });
          if(generated.error){
            if(isMissingPersonalPlanningSchema(generated.error)){setRecurrenceReady(false);break;}
            throw generated.error;
          }
          materializedThrough.current.set(item.id,through);
        }
      }
      let [tasks,unscheduledTasks,notes,privateEvents,overdueTasks]=await Promise.all([
        supabase.from("personal_day_tasks").select("id,plan_date,title,details,planned_time,reminder_at,linked_work_item_id,linked_project_id,completed_at,created_at,series_id,dismissed_at").eq("profile_id",me.id).is("dismissed_at",null).gte("plan_date",fromDay).lt("plan_date",toDay).order("plan_date").order("planned_time",{ascending:true,nullsFirst:false}),
        supabase.from("personal_day_tasks").select("id,plan_date,title,details,planned_time,reminder_at,linked_work_item_id,linked_project_id,completed_at,created_at,series_id,dismissed_at").eq("profile_id",me.id).is("plan_date",null).is("completed_at",null).is("dismissed_at",null).order("created_at",{ascending:false}).limit(30),
        supabase.from("personal_day_notes").select("id,note_date,dated_for,note_kind,title,body,reminder_at,updated_at").eq("profile_id",me.id).or(`and(note_date.gte.${fromDay},note_date.lt.${toDay}),and(dated_for.gte.${fromDay},dated_for.lt.${toDay})`).order("updated_at",{ascending:false}),
        supabase.from("personal_calendar_events").select("id,title,details,starts_at,ends_at,location,reminder_at").eq("profile_id",me.id).or(`ends_at.gte.${from},and(ends_at.is.null,starts_at.gte.${from})`).lt("starts_at",to).order("starts_at"),
        supabase.from("personal_day_tasks").select("id,plan_date,title,details,planned_time,reminder_at,linked_work_item_id,linked_project_id,completed_at,created_at,series_id,dismissed_at,series_id").eq("profile_id",me.id).lt("plan_date",accraDay(new Date())).is("completed_at",null).is("dismissed_at",null).order("plan_date",{ascending:false}).limit(500),
      ]);
      const personalError=[tasks.error,unscheduledTasks.error,notes.error,privateEvents.error,overdueTasks.error].find(Boolean);
      if(personalError){
        if(!isMissingPersonalPlanningSchema(personalError))throw personalError;
        tasks={data:[],error:null};unscheduledTasks={data:[],error:null};notes={data:[],error:null};privateEvents={data:[],error:null};overdueTasks={data:[],error:null};
        setRecurrenceReady(false);
        setPersonalPlanningReady(false);
      }else setPersonalPlanningReady(true);
      const privateTasks=[...new Map([...(tasks.data||[]),...(unscheduledTasks.data||[]),...(overdueTasks.data||[])].map(item=>[item.id,item])).values()];
      const meetingRows=(meetings.data||[]).filter(row=>row.status!=="cancelled");
      const [checklists,privateMeetingNotes]=await Promise.all([
        privateTasks.length
          ? supabase.from("personal_day_task_checklist").select("id,task_id,title,position,completed_at").in("task_id",privateTasks.map(row=>row.id)).order("position")
          : Promise.resolve({data:[],error:null}),
        meetingRows.length
          ? supabase.from("meeting_private_notes").select("id,meeting_id,body,updated_at").eq("author_id",me.id).in("meeting_id",meetingRows.map(row=>row.id))
          : Promise.resolve({data:[],error:null}),
      ]);
      if(checklists.error){
        if(!isMissingPersonalPlanningSchema(checklists.error))throw checklists.error;
        checklists.data=[];checklists.error=null;setPersonalPlanningReady(false);
      }
      if(privateMeetingNotes.error)throw privateMeetingNotes.error;

      const rows=[];
      (work.data||[]).filter(item=>item.due_at&&item.kind!=="routine").forEach(item=>rows.push({id:`work-${item.id}`,kind:"work",date:accraDay(item.due_at),title:item.title,meta:`${item.ref}${item.projects?.name?` · ${item.projects.name}`:""}`,workStatus:item.status,itemId:item.id,sortAt:item.due_at,time:new Date(item.due_at).toLocaleTimeString("en-GB",{timeZone:"Africa/Accra",hour:"2-digit",minute:"2-digit"})}));
      meetingRows.forEach(row=>calendarSpan(accraDay(row.starts_at),accraDay(row.ends_at?new Date(new Date(row.ends_at).getTime()-1):row.starts_at),fromDay,toDay).forEach(day=>rows.push({id:`meeting-${row.id}-${day}`,kind:"meeting",date:day,title:row.title,meta:`${new Date(row.starts_at).toLocaleTimeString("en-GB",{timeZone:"Africa/Accra",hour:"2-digit",minute:"2-digit"})}${row.ends_at?`–${new Date(row.ends_at).toLocaleTimeString("en-GB",{timeZone:"Africa/Accra",hour:"2-digit",minute:"2-digit"})}`:""}`,meetingId:row.id,startsAt:row.starts_at,endsAt:row.ends_at,sortAt:row.starts_at,time:new Date(row.starts_at).toLocaleTimeString("en-GB",{timeZone:"Africa/Accra",hour:"2-digit",minute:"2-digit"})})));
      (ministry.data||[]).filter(row=>row.scope==="church"||row.unit_id===me.unit_id).forEach(row=>calendarSpan(accraDay(row.starts_at),accraDay(row.ends_at?new Date(new Date(row.ends_at).getTime()-1):row.starts_at),fromDay,toDay).forEach(day=>rows.push({id:`ministry-${row.id}-${day}`,kind:"ministry",date:day,title:`${row.cancelled?"Cancelled · ":""}${row.title}`,meta:`${row.all_day?"All day":new Date(row.starts_at).toLocaleTimeString("en-GB",{timeZone:"Africa/Accra",hour:"2-digit",minute:"2-digit"})}${row.location?` · ${row.location}`:""}`,startsAt:row.starts_at,endsAt:row.ends_at,allDay:row.all_day,cancelled:row.cancelled,sortAt:row.starts_at,time:row.all_day?"All day":new Date(row.starts_at).toLocaleTimeString("en-GB",{timeZone:"Africa/Accra",hour:"2-digit",minute:"2-digit"})})));
      (leave.data||[]).forEach(row=>calendarSpan(row.start_date,row.end_date,fromDay,toDay).forEach(day=>rows.push({id:`leave-${row.id}-${day}`,kind:"leave",date:day,title:`${row.kind} leave`,meta:"All day · Approved",time:"All day",allDay:true})));
      privateTasks.filter(task=>task.plan_date).forEach(task=>rows.push({id:`personal-task-${task.id}`,kind:"personal",personalType:"task",date:task.plan_date,title:task.title,meta:task.planned_time?timeLabel(task.planned_time):"Private task",taskId:task.id,raw:task,completed:Boolean(task.completed_at)}));
      (privateEvents.data||[]).forEach(event=>calendarSpan(accraDay(event.starts_at),accraDay(event.ends_at?new Date(new Date(event.ends_at).getTime()-1):event.starts_at),fromDay,toDay).forEach(day=>rows.push({id:`personal-event-${event.id}-${day}`,kind:"personal",personalType:"event",date:day,title:event.title,meta:`${new Date(event.starts_at).toLocaleTimeString("en-GB",{timeZone:"Africa/Accra",hour:"2-digit",minute:"2-digit"})}${event.ends_at?`–${new Date(event.ends_at).toLocaleTimeString("en-GB",{timeZone:"Africa/Accra",hour:"2-digit",minute:"2-digit"})}`:""}${event.location?` · ${event.location}`:""}`,privateEventId:event.id,raw:event,startsAt:event.starts_at,endsAt:event.ends_at,sortAt:event.starts_at,time:new Date(event.starts_at).toLocaleTimeString("en-GB",{timeZone:"Africa/Accra",hour:"2-digit",minute:"2-digit"})})));
      if(request!==requestVersion.current)return;
      // Work link choices load only when a task composer is opened.
      setChecklistRows(checklists.data||[]);
      setMeetingNotes((privateMeetingNotes.data||[]).map(note=>({...note,meeting:meetingRows.find(row=>row.id===note.meeting_id)||null})));
      setPersonalTasks(privateTasks);
      setDayNotes(notes.data||[]);
      setEvents(rows);
    }catch(err){if(request!==requestVersion.current)return;setError(humanError(err,"Your calendar could not be loaded."));setEvents([]);setPersonalTasks([]);setDayNotes([]);setChecklistRows([]);setMeetingNotes([]);setWorkOptions([]);setProjectOptions([]);}
    finally{if(request===requestVersion.current)setLoading(false);}
  }

  function openComposer(type="event"){
    if(!protectJournal())return;
    setComposerType(type);
    setComposeTitle("");
    setComposeDetails("");
    setComposeDate(selectedDate);
    setComposeStart("09:00");
    setComposeEnd("10:00");
    setComposeLocation("");
    setComposeUnscheduled(false);
    setComposeReminder("");
    setComposeWorkId("");
    setComposeProjectId("");
    setComposeChecklist("");
    setComposeNoteKind("dated");
    setComposer(true);
  }

  async function saveComposer(){
    setBusy(true);setError(null);setNotice(null);
    try{
      if(composerType==="event"){
        const startsAt=new Date(`${composeDate}T${composeStart}:00Z`).toISOString();
        const endsAt=composeEnd?new Date(`${composeDate}T${composeEnd}:00Z`).toISOString():null;
        const {error:e}=await supabase.from("personal_calendar_events").insert({
          org_id:me.org_id,profile_id:me.id,title:composeTitle.trim(),details:composeDetails.trim()||null,
          starts_at:startsAt,ends_at:endsAt,location:composeLocation.trim()||null,
          reminder_at:composeReminder?new Date(composeReminder).toISOString():null,
        }); if(e)throw e;
        setNotice("Private calendar event added.");
      }else if(composerType==="task"){
        const {data:task,error:e}=await supabase.from("personal_day_tasks").insert({
          org_id:me.org_id,profile_id:me.id,plan_date:composeUnscheduled?null:composeDate,
          title:composeTitle.trim(),details:composeDetails.trim()||null,planned_time:composeUnscheduled?null:(composeStart||null),
          reminder_at:composeReminder?new Date(composeReminder).toISOString():null,
          linked_work_item_id:composeWorkId||null,linked_project_id:composeProjectId||null,
        }).select("id").single(); if(e)throw e;
        const checklist=composeChecklist.split("\n").map(value=>value.trim()).filter(Boolean);
        if(checklist.length){
          const {error:checkError}=await supabase.from("personal_day_task_checklist").insert(checklist.map((title,index)=>({org_id:me.org_id,profile_id:me.id,task_id:task.id,title,position:index})));
          if(checkError)throw checkError;
        }
        setNotice(composeUnscheduled?"Private task kept unscheduled.":"Private task added.");
      }else{
        const dated=composeNoteKind==="dated";
        const payload={
          org_id:me.org_id,profile_id:me.id,note_kind:dated?"personal":"general",
          note_date:null,dated_for:dated?composeDate:null,title:composeTitle.trim()||null,body:composeDetails.trim(),
          reminder_at:composeReminder?new Date(composeReminder).toISOString():null,
        };
        const {error:e}=await supabase.from("personal_day_notes").insert(payload).select("id").single();
        if(e)throw e;
        setNotesRevision(value=>value+1);
        setNotice(dated?"Private note saved for "+shortDate(composeDate)+".":"Standalone note saved in your Notes library.");
        if(dated){setCursor(calendarDate(composeDate));setSelectedDate(composeDate);setDayTab("notes");}
        else setNotesLibraryOpen(true);
      }
      setComposer(null);await load();
    }catch(err){setError(humanError(err,"Your private planning item could not be saved."));}
    finally{setBusy(false);}
  }

  async function addPersonalTask(unscheduled=false){
    if(!taskTitle.trim())return;
    setBusy(true);setError(null);setNotice(null);
    const {error:insertError}=await supabase.from("personal_day_tasks").insert({
      org_id:me.org_id,profile_id:me.id,plan_date:unscheduled?null:selectedDate,title:taskTitle.trim(),planned_time:unscheduled?null:(taskTime||null),
    });
    setBusy(false);
    if(insertError){setError(humanError(insertError,"Your private task could not be added."));return;}
    setTaskTitle("");setTaskTime("");setNotice(unscheduled?"Private task kept unscheduled.":"Private task added to this day.");await load();
  }

  async function togglePersonalTask(task){
    if(busy)return;
    setBusy(true);setError(null);
    const patch=completedAt=>{
      setPersonalTasks(rows=>rows.map(row=>row.id===task.id?{...row,completed_at:completedAt}:row));
      setEvents(rows=>rows.map(row=>row.taskId===task.id?{...row,completed:Boolean(completedAt),raw:{...row.raw,completed_at:completedAt}}:row));
    };
    const completedAt=task.completed_at?null:new Date().toISOString();
    patch(completedAt);
    try{
      const {data:updated,error:updateError}=await supabase.from("personal_day_tasks").update({completed_at:completedAt}).eq("id",task.id).eq("profile_id",me.id).select("id,completed_at").single();
      if(updateError)throw updateError;
      patch(updated.completed_at);
    }catch(error){patch(task.completed_at);setError(humanError(error,"Your private task could not be updated."));}
    finally{setBusy(false);}
  }

  async function toggleChecklist(row){
    if(busy)return;
    setBusy(true);setError(null);
    const patch=completedAt=>setChecklistRows(rows=>rows.map(item=>item.id===row.id?{...item,completed_at:completedAt}:item));
    patch(row.completed_at?null:new Date().toISOString());
    try{
      const {data:updated,error:updateError}=await supabase.from("personal_day_task_checklist").update({completed_at:row.completed_at?null:new Date().toISOString()}).eq("id",row.id).eq("profile_id",me.id).select("id,completed_at").single();
      if(updateError)throw updateError;
      patch(updated.completed_at);
    }catch(error){patch(row.completed_at);setError(humanError(error,"That checklist item could not be updated."));}
    finally{setBusy(false);}
  }

  async function schedulePersonalTask(task){
    setBusy(true);setError(null);setNotice(null);
    const {error:updateError}=await supabase.from("personal_day_tasks").update({plan_date:selectedDate}).eq("id",task.id).eq("profile_id",me.id);
    setBusy(false);
    if(updateError){setError(humanError(updateError,"Your private task could not be scheduled."));return;}
    setNotice(`Private task moved to ${labelDay(selectedDate)}.`);await load();
  }

  async function saveDayNote(){
    if(busy||!noteDraft.trim()||noteDraft.length>12000)return;
    setBusy(true);setError(null);setNotice(null);
    const existing=dayNotes.find(note=>note.note_date===selectedDate&&note.note_kind==="daily");
    const action=existing
      ? supabase.from("personal_day_notes").update({body:noteDraft}).eq("id",existing.id).eq("profile_id",me.id)
      : supabase.from("personal_day_notes").insert({
          org_id:me.org_id,profile_id:me.id,note_date:selectedDate,note_kind:"daily",body:noteDraft,
        });
    const {error:saveError}=await action.select("id").single();
    setBusy(false);
    if(saveError){setError(humanError(saveError,"Your daily journal could not be saved."));return;}
    setNotesRevision(value=>value+1);
    setNotice("Daily journal saved for "+shortDate(selectedDate)+".");
    await load();
  }

  async function deleteDayNote(){
    if(busy || !window.confirm("Delete your private journal for this day?"))return;
    const row=dayNotes.find(note=>note.note_date===selectedDate&&note.note_kind==="daily");
    if(!row){setNoteDraft("");return;}
    setBusy(true);setError(null);
    const {error:failure}=await supabase.from("personal_day_notes")
      .delete().eq("id",row.id).eq("profile_id",me.id);
    setBusy(false);
    if(failure){setError(humanError(failure,"Your private journal could not be deleted."));return;}
    setNoteDraft("");setNotesRevision(value=>value+1);setNotice("Private journal deleted.");await load();
  }

  const open=useCallback((event)=>event.taskId?setEditingPrivateItem({kind:"task",...event.raw}):event.itemId?openItem?.(event.itemId,event.routineState?event.scheduledOn:null):event.meetingId?openMeeting?.(event.meetingId):event.privateEventId?setEditingPrivateItem({kind:"event",...event.raw}):null,[openItem,openMeeting]);
  const displayEvent=useCallback((event,includeDate=false)=>({
    ...event,
    icon:event.kind==="meeting"?"meeting":event.kind==="work"?"work":event.kind==="personal"?"check":event.kind==="ministry"?"ministry":"time",
    meta:`${includeDate?new Date(`${event.date}T12:00:00`).toLocaleDateString("en-GB",{weekday:"short",day:"numeric",month:"short"})+" · ":""}${event.meta||""}`,
    status:event.cancelled?"Cancelled":event.routineState?routineCalendarStatus(event.routineState):event.kind==="leave"?"Approved":event.kind==="meeting"?"Meeting":event.kind==="work"?calendarWorkStatus(event.workStatus):event.kind==="personal"?(event.completed?"Done":"Private"):"Ministry",
    statusTone:event.kind==="leave"?"success":event.kind==="meeting"?"action":event.kind==="work"&&["completed","self_certified"].includes(event.workStatus)?"success":event.kind==="work"&&event.workStatus==="returned"?"warning":event.kind==="personal"&&event.completed?"success":"neutral",
    onClick:event.noteId?()=>{if(selectCalendarDate(event.date)!==false)setDayTab("notes");}:event.itemId||event.meetingId||event.privateEventId||event.taskId?()=>{if(selectCalendarDate(event.date)===false)return;setDayTab(event.kind==="work"?"tasks":"schedule");open(event);}:undefined,
  }),[open,selectCalendarDate]);
  const displayEvents=useMemo(()=>calendarEvents.map(event=>displayEvent(event)),[calendarEvents,displayEvent]);

  function renderUpcoming(visible){
    const upcoming=visible.filter(event=>event.date>=accraDay(new Date())&&event.kind!=="personal"&&!(event.kind==="work"&&["completed","self_certified","cancelled"].includes(event.workStatus))).sort((a,b)=>a.date.localeCompare(b.date)).slice(0,8).map(event=>displayEvent(event,true));
    return <div className="phase6-calendar-coming-up"><CalendarAgenda eyebrow="Shared commitments" title="Coming up" description="Upcoming commitments matching your Calendar filters." events={upcoming} emptyTitle="Nothing coming up" emptyDescription="No shared commitments match this view."/></div>;
  }


  function renderDayWorkspace(filteredEvents,active){
  const selectedShared=filteredEvents.filter(event=>event.date===selectedDate&&event.kind!=="personal");
  const selectedPrivateEvents=filteredEvents.filter(event=>event.date===selectedDate&&event.kind==="personal"&&event.personalType==="event");
  const visibleTaskIds=new Set(filteredEvents.filter(event=>event.taskId).map(event=>event.taskId));
  const selectedPrivate=personalTasks.filter(task=>visibleTaskIds.has(task.id)&&task.plan_date===selectedDate);
  const unscheduledPrivate=personalTasks.filter(task=>active.includes("personal")&&task.plan_date==null&&!task.completed_at);
  const overduePrivate=personalTasks.filter(task=>active.includes("personal")&&task.plan_date&&task.plan_date<accraDay(new Date())&&!task.completed_at);
  const selectedWork=selectedShared.filter(event=>event.kind==="work");
  const selectedSchedule=[...selectedShared.filter(event=>event.kind!=="work"),...selectedPrivateEvents].sort((a,b)=>String(a.sortAt||a.date).localeCompare(String(b.sortAt||b.date)));
  const selectedMeetingNotes=meetingNotes.filter(note=>note.meeting&&accraDay(note.meeting.starts_at)===selectedDate&&note.body?.trim());
  const datedNotes=dayNotes.filter(note=>note.note_kind!=="daily"&&(note.note_date||note.dated_for)===selectedDate);
  const checklistFor=(taskId)=>checklistRows.filter(row=>row.task_id===taskId);
  const noteCount=(journalRow?.body?.trim()?1:0)+selectedMeetingNotes.length+datedNotes.length;
  const taskCount=selectedPrivate.length+selectedWork.length;
    return (        <aside className="phase6-day-workspace" aria-label="Selected day workspace">
          <header className="phase6-day-workspace-head">
            <div><span>Day workspace</span><h2>{labelDay(selectedDate)}</h2><p>Personal events, tasks and notes are visible only to you.</p></div>
            <span className="phase6-private-pill">Private planning protected</span>
            <div className="phase6-day-metrics" aria-label="Selected day summary"><span><b>{selectedSchedule.length}</b> scheduled</span><span><b>{taskCount}</b> tasks</span><span><b>{noteCount}</b> notes</span></div>
          </header>

          <div className="phase6-day-tabs" role="tablist" aria-label="Day workspace views">
            <button type="button" role="tab" aria-selected={dayTab==="schedule"} className={dayTab==="schedule"?"is-selected":""} onClick={()=>switchDayTab("schedule")}>Schedule</button>
            <button type="button" role="tab" aria-selected={dayTab==="tasks"} className={dayTab==="tasks"?"is-selected":""} onClick={()=>switchDayTab("tasks")}>Tasks</button>
            <button type="button" role="tab" aria-selected={dayTab==="notes"} className={dayTab==="notes"?"is-selected":""} onClick={()=>switchDayTab("notes")}>Notes</button>
          </div>

          {dayTab==="schedule"?<div className="phase6-day-task-view phase6-day-schedule-view">
            <section className="phase6-day-block">
              <div className="phase6-day-block-head"><h3>Schedule</h3><span>{selectedSchedule.length}</span></div>
              {selectedSchedule.length?<div className="phase6-schedule-rail">{selectedSchedule.map(event=><div key={event.id} data-calendar-event={event.privateEventId || event.id} className={`phase6-schedule-row is-${event.kind}`}><time>{event.time||"—"}</time><span className="phase6-schedule-line" aria-hidden="true"/><button type="button" onClick={()=>open(event)} disabled={!event.itemId&&!event.meetingId&&!event.privateEventId}><span className={`phase6-day-kind is-${event.kind}`}>{event.routineState?"routine":event.personalType==="event"?"private event":event.kind}</span><span><strong>{event.title}</strong><small>{event.meta||"Recorded CEAC commitment"}</small></span></button></div>)}</div>:<p className="phase6-day-empty">No shared or private schedule item is recorded for this day.</p>}
            </section>
          </div>:dayTab==="tasks"?<div className="phase6-day-task-view">
            <section className="phase6-day-block">
              <div className="phase6-day-block-head"><h3>Tasks for {shortDate(selectedDate)}</h3><span>{selectedPrivate.length+selectedWork.length}</span></div>
              {selectedWork.map(event=><button key={event.id} type="button" className="phase6-day-shared-row" onClick={()=>open(event)}>
                <span className="phase6-day-kind is-work">work</span><span><strong>{event.title}</strong><small>{event.meta} · {event.routineState?routineCalendarStatus(event.routineState):calendarWorkStatus(event.workStatus)}</small></span>
              </button>)}
              {selectedPrivate.map(task=><div key={task.id} className="phase6-private-task-card"><label className={task.completed_at?"phase6-private-task is-complete":"phase6-private-task"}><input type="checkbox" checked={Boolean(task.completed_at)} disabled={busy} onChange={()=>togglePersonalTask(task)}/><span><strong>{task.title}</strong><small>{[task.planned_time?timeLabel(task.planned_time):"Private personal task",task.reminder_at?"reminder set":null,task.linked_work_item_id?"linked CEAC Work":task.linked_project_id?"linked Project":null].filter(Boolean).join(" · ")}</small></span><em>Private</em></label>{checklistFor(task.id).length>0&&<div className="phase6-task-checklist">{checklistFor(task.id).map(row=><label key={row.id}><input type="checkbox" checked={Boolean(row.completed_at)} disabled={busy} onChange={()=>toggleChecklist(row)}/><span>{row.title}</span></label>)}</div>}<div className="phase6-private-task-actions"><Button variant="quiet" size="sm" disabled={busy} onClick={()=>setEditingPrivateItem({kind:"task",...task})}>Edit / delete</Button></div></div>)}
              {!selectedPrivate.length&&!selectedWork.length?<p className="phase6-day-empty">No task is planned or due on this day.</p>:null}
              {personalPlanningReady&&<div className="phase6-private-task-compose" role="group" aria-label="Add a private task">
                <h4>Add a private task</h4>
                <label>Task<input className="field" aria-label="New private task" placeholder="What do you need to do?" value={taskTitle} onChange={event=>setTaskTitle(event.target.value)} /></label>
                <label>Time (optional)<input className="field" aria-label="Private task time" type="time" value={taskTime} onChange={event=>setTaskTime(event.target.value)} /></label>
                <div className="phase6-private-task-actions">
                  <Button variant="secondary" size="sm" disabled={busy||!taskTitle.trim()} onClick={()=>addPersonalTask(true)}>Keep unscheduled</Button>
                  <Button size="sm" disabled={busy||!taskTitle.trim()} onClick={()=>addPersonalTask(false)}>Add to {shortDate(selectedDate)}</Button>
                </div>
              </div>}
            </section>

            {personalPlanningReady&&<PersonalRecurringTaskComposer me={me} selectedDate={selectedDate} ready={recurrenceReady} onChanged={load}/>}
            {overduePrivate.length>0&&<section className="phase6-day-block" aria-label="Overdue private tasks">
              <div className="phase6-day-block-head"><h3>Overdue private tasks</h3><span>{overduePrivate.length}{overduePrivate.length===500?"+":""}</span></div>
              <p className="screen-note">Missed recurring or individual tasks stay overdue until you complete or delete them. No instance is automatically marked done.</p>
              {overduePrivate.map(task=><div key={task.id} className="phase6-private-task-card">
                <label className="phase6-private-task">
                  <input type="checkbox" checked={false} disabled={busy} onChange={()=>togglePersonalTask(task)}/>
                  <span><strong>{task.title}</strong><small>Overdue since {task.plan_date}{task.series_id?" · repeating task":""}</small></span>
                </label>
                <Button variant="quiet" size="sm" disabled={busy} onClick={()=>setEditingPrivateItem({kind:"task",...task})}>Edit / delete</Button>
              </div>)}
            </section>}
            <section className="phase6-day-block phase6-unscheduled-block">
              <div className="phase6-day-block-head"><h3>Unscheduled tasks</h3><span>{unscheduledPrivate.length}</span></div>
              {unscheduledPrivate.length?unscheduledPrivate.map(task=><div key={task.id} className="phase6-unscheduled-task">
                <span><strong>{task.title}</strong><small>Private · no calendar date yet</small></span>
                <Button variant="quiet" size="sm" disabled={busy} onClick={()=>schedulePersonalTask(task)}>Add to {shortDate(selectedDate)}</Button>
                <Button variant="quiet" size="sm" disabled={busy} onClick={()=>setEditingPrivateItem({kind:"task",...task})}>Edit / delete</Button>
              </div>):<p className="phase6-day-empty">No private tasks are waiting for a date.</p>}
            </section>
          </div>:<div className="phase6-day-note-view">
            {personalPlanningReady?<article className="phase6-note-card is-journal"><div className="phase6-note-card-head"><span>Journal</span><div><strong>Daily journal</strong><small>Private · {shortDate(selectedDate)}</small></div></div><textarea className="field phase6-day-note-editor" aria-label="Private day notes" rows={8} value={noteDraft} onChange={event=>setNoteDraft(event.target.value)} placeholder="Write private planning notes for this day…" /><div className="phase6-day-note-actions"><span>{noteDraft.length.toLocaleString()} / 12,000</span><Button disabled={busy||!noteDraft.trim()||noteDraft.length>12000} onClick={saveDayNote}>{busy?"Saving…":"Save journal"}</Button><Button variant="quiet" size="sm" disabled={busy} onClick={deleteDayNote}>Delete journal</Button></div></article>:<p className="phase6-day-empty">Your private journal is unavailable. Please contact support.</p>}
            <div className="phase6-day-note-actions">
              <Button variant="secondary" size="sm" onClick={()=>openComposer("note")}>New note</Button>
              <Button variant="secondary" size="sm" onClick={()=>setNotesLibraryOpen(true)}>Browse all notes</Button>
            </div>
            {selectedMeetingNotes.map(note=><button key={note.id} type="button" className="phase6-note-card is-meeting" onClick={()=>openMeeting?.(note.meeting_id)}><div className="phase6-note-card-head"><span>Meeting</span><div><strong>{note.meeting?.title||"Meeting note"}</strong><small>Linked meeting note · authoritative in Meeting</small></div></div><p>{note.body}</p></button>)}
            {datedNotes.map(note=><article key={note.id} className={`phase6-note-card is-${note.note_kind}`}><div className="phase6-note-card-head"><span>Dated</span><div><strong>{note.title||(note.note_kind==="personal"?"Personal note":"General note")}</strong><small>Private note{note.reminder_at?" · reminder set":""}</small></div></div><p>{note.body||"No note text recorded."}</p><Button variant="quiet" size="sm" disabled={busy} onClick={()=>setEditingPrivateItem({kind:"note",...note})}>Edit / delete</Button></article>)}
          </div>}
        </aside>);
  }

  return <div className="body ev2cal-role-page ev2cal-staff-page phase6-calendar-page">
    <CalendarPageHeader
      eyebrow="My workspace"
      title="Calendar"
      description="Your meetings, work and personal plans."
      statusTone="action"
      action={<><Button variant="secondary" disabled={!personalPlanningReady || loading} onClick={()=>setNotesLibraryOpen(true)}>Notes</Button><Button disabled={!personalPlanningReady || loading} onClick={()=>openComposer("event")}>+ Add</Button></>}
    />

    {scopeControl}
    {!personalPlanningReady&&<ProductNotice tone="attention" title="Private planning is unavailable">Your shared calendar is available. Please contact support to enable private events, tasks and notes.</ProductNotice>}
    {error&&<ProductNotice tone="error" title="Could not load Calendar">{error}</ProductNotice>}
    {routineCalendar.loading&&<p className="screen-note" role="status">Loading routine dates…</p>}
    {routineCalendar.error&&<ProductNotice tone="error" title="Routine dates unavailable">{routineCalendar.error}<Button variant="secondary" onClick={routineCalendar.reload}>Retry routine dates</Button></ProductNotice>}
    {notice&&<ProductNotice tone="success" title="Calendar">{notice}</ProductNotice>}

    {loading?<LoadingState label="Loading your calendar…"/>:<>
      <CalendarExplorer me={me} scope="personal" footer={renderUpcoming} events={displayEvents} layers={personalPlanningReady?FILTER_ITEMS.filter(item=>item.value!=="all"):FILTER_ITEMS.filter(item=>!["all","personal"].includes(item.value))} cursor={cursor} setCursor={setCursor} selectedDate={selectedDate} onSelectDate={selectCalendarDate}>
        {renderDayWorkspace}
      </CalendarExplorer>


    </>}

    {notesLibraryOpen&&personalPlanningReady&&<PersonalNotesLibrary me={me} revision={notesRevision}
      onClose={()=>setNotesLibraryOpen(false)}
      onNew={()=>{setNotesLibraryOpen(false);openComposer("note");}}
      onOpenNote={note=>{
        if(note.note_kind==="daily"){
          if(selectCalendarDate(note.note_date)===false)return;
          setCursor(calendarDate(note.note_date));setDayTab("notes");
        }else setEditingPrivateItem({kind:"note",...note});
        setNotesLibraryOpen(false);
      }}/>}
    {editingPrivateItem&&personalPlanningReady&&<PersonalPlanningEditor key={editingPrivateItem.id} me={me} item={editingPrivateItem} onClose={()=>setEditingPrivateItem(null)} onChanged={async()=>{await load();setNotesRevision(value=>value+1);}}/>}
    {composer&&personalPlanningReady&&<Sheet onClose={()=>!busy&&setComposer(null)}>
      <div className="phase6-planning-composer">
        {scheduleMeeting&&<Button variant="secondary" onClick={()=>{setComposer(null);scheduleMeeting({startsAt:`${selectedDate}T09:00`});}}>Schedule a CEAC meeting</Button>}
        <div><span className="eyebrow">Private planning</span><div className="h2">Add to my workspace</div><p className="screen-note">Personal Events, Tasks and Notes stay private. Use CEAC Work or Meetings when an organisational record is required.</p></div>
        <div className="phase6-composer-tabs" role="tablist" aria-label="Personal planning item type">
          {["event","task","note"].map(type=><button key={type} type="button" role="tab" aria-selected={composerType===type} className={composerType===type?"is-selected":""} onClick={()=>setComposerType(type)}>{type[0].toUpperCase()+type.slice(1)}</button>)}
        </div>
        <FieldGroup label={composerType==="note"?"Title (optional)":"Title"}><input className="field" aria-label="Planning title" value={composeTitle} onChange={event=>setComposeTitle(event.target.value)} placeholder={composerType==="event"?"Event title":composerType==="task"?"Task title":"Note title"} /></FieldGroup>
        {composerType==="task"&&<label className="phase6-unscheduled-toggle"><input type="checkbox" checked={composeUnscheduled} onChange={event=>setComposeUnscheduled(event.target.checked)}/><span>Keep this task unscheduled</span></label>}
        {(composerType!=="task"||!composeUnscheduled)&&(composerType!=="note"||composeNoteKind==="dated")&&<FieldGroup label="Date"><input className="field" aria-label="Planning date" type="date" value={composeDate} onChange={event=>setComposeDate(event.target.value)} /></FieldGroup>}
        {composerType==="event"&&<div className="phase6-composer-grid">
          <FieldGroup label="Start"><input className="field" aria-label="Event start time" type="time" value={composeStart} onChange={event=>setComposeStart(event.target.value)} /></FieldGroup>
          <FieldGroup label="End"><input className="field" aria-label="Event end time" type="time" value={composeEnd} onChange={event=>setComposeEnd(event.target.value)} /></FieldGroup>
          <FieldGroup label="Location"><input className="field" aria-label="Event location" value={composeLocation} onChange={event=>setComposeLocation(event.target.value)} placeholder="Optional" /></FieldGroup>
        </div>}
        {composerType==="task"&&!composeUnscheduled&&<FieldGroup label="Time (optional)"><input className="field" aria-label="Task time" type="time" value={composeStart} onChange={event=>setComposeStart(event.target.value)} /></FieldGroup>}
        {composerType==="note"&&<FieldGroup label="Note type"><select className="field" aria-label="Note type" value={composeNoteKind} onChange={event=>setComposeNoteKind(event.target.value)}><option value="dated">Dated note</option><option value="standalone">Standalone note</option></select></FieldGroup>}
        <FieldGroup label={composerType==="note"?"Note":"Details (optional)"}><textarea className="field" aria-label="Planning details" rows={composerType==="note"?8:4} value={composeDetails} maxLength={composerType==="note"?12000:4000} onChange={event=>setComposeDetails(event.target.value)} /></FieldGroup>
        {composerType==="task"&&<><FieldGroup label="Checklist" hint="One private checklist item per line."><textarea className="field" aria-label="Task checklist" rows={3} value={composeChecklist} onChange={event=>setComposeChecklist(event.target.value)} /></FieldGroup><div className="phase6-composer-grid"><FieldGroup label="Link CEAC Work">{workOptionsLoading&&<span role="status" className="screen-note">Loading available work…</span>}<select className="field" aria-label="Link CEAC Work" value={composeWorkId} onChange={event=>setComposeWorkId(event.target.value)}><option value="">No Work link</option>{workOptions.map(item=><option key={item.id} value={item.id}>{item.ref} · {item.title}</option>)}</select></FieldGroup><FieldGroup label="Link Project"><select className="field" aria-label="Link Project" value={composeProjectId} onChange={event=>setComposeProjectId(event.target.value)}><option value="">No Project link</option>{projectOptions.map(project=><option key={project.id} value={project.id}>{project.name}</option>)}</select></FieldGroup></div></>}
        <FieldGroup label="Reminder (optional)"><input className="field" aria-label="Planning reminder" type="datetime-local" value={composeReminder} onChange={event=>setComposeReminder(event.target.value)} /></FieldGroup>
        {error&&<ProductNotice tone="error" title="Could not save private planning">{error}</ProductNotice>}
        <div className="phase6-composer-actions"><Button variant="secondary" disabled={busy} onClick={()=>setComposer(null)}>Cancel</Button><Button disabled={busy||(composerType!=="note"&&!composeTitle.trim())||(composerType==="note"&&!composeDetails.trim())||(composerType==="event"&&(!composeDate||!composeStart||!composeEnd||composeEnd<composeStart))} onClick={saveComposer}>{busy?"Saving…":`Save ${composerType}`}</Button></div>
      </div>
    </Sheet>}
  </div>;
}

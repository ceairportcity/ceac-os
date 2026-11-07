import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { LoadingState, ProductNotice, Sheet } from '../components/bits';
import { humanError } from '../lib/productLanguage';
import { Button } from '../experience-v2/components';
import StaffCalendar from './StaffCalendar';
import CalendarExplorer, { useCalendarPosition } from '../experience-v2/calendar/CalendarExplorer';
import { CalendarPageHeader } from '../experience-v2/calendar/CalendarFamilyV2';
import { calendarDay, calendarDate, calendarSpan, calendarWindow, calendarWorkStatus, expandCalendarEvent } from '../lib/calendarPlanning';

const LAYERS=[{value:'meeting',label:'Meetings'},{value:'projects',label:'Projects'},{value:'work',label:'Work deadlines'},{value:'ministry',label:'Ministry'},{value:'leave',label:'Approved leave'}];
const when=value=>new Date(value).toLocaleString('en-GB',{timeZone:'Africa/Accra',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
export default function AdminCalendar({me,openItem,openMeeting,scheduleMeeting,roleMode='admin',openProject,initialDate,onFocusHandled}) {
  const [calendarScope,setCalendarScope]=useState('organisation');
  const {cursor,setCursor,selectedDate,setSelectedDate}=useCalendarPosition(me,"organisation",initialDate);
  useEffect(()=>{if(initialDate)onFocusHandled?.();},[]);
  const [events,setEvents]=useState([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState(null);
  const [detail,setDetail]=useState(null);
  const version=useRef(0);
  useEffect(()=>()=>{version.current++;},[]);
  useEffect(()=>{if(calendarScope==='organisation')load();else version.current++;},[me.id,me.org_id,calendarScope,cursor.getUTCFullYear(),cursor.getUTCMonth()]);
  async function load(){
    const request=++version.current;const range=calendarWindow(cursor);
    setLoading(true);setError(null);
    try{
      const [meetings,projects,ministry,leave,work]=await Promise.all([
        supabase.from('meeting_sessions').select('id,title,starts_at,ends_at,status,scope,provider').or(`ends_at.gt.${range.fromAt},and(ends_at.is.null,starts_at.gte.${range.fromAt})`).lt('starts_at',range.toAt).neq('status','cancelled'),
        supabase.from('projects').select('id,name,starts_on,ends_on,status').eq('org_id',me.org_id).or(`and(starts_on.gte.${range.from},starts_on.lt.${range.to}),and(ends_on.gte.${range.from},ends_on.lt.${range.to})`),
        supabase.from('ministry_events').select('id,title,starts_at,ends_at,all_day,location,notes,cancelled').or(`ends_at.gte.${range.fromAt},and(ends_at.is.null,starts_at.gte.${range.fromAt})`).lt('starts_at',range.toAt),
        supabase.from('leave_requests').select('id,profile_id,start_date,end_date,status,profiles!leave_requests_profile_id_fkey(full_name)').eq('status','approved').gte('end_date',range.from).lt('start_date',range.to),
        supabase.from('work_items').select('id,ref,title,status,due_at').eq('org_id',me.org_id).neq('visibility','private').neq('kind','routine').gte('due_at',range.fromAt).lt('due_at',range.toAt),
      ]);
      if(request!==version.current)return;
      const failed=[meetings,projects,ministry,leave,work].find(r=>r.error);if(failed)throw failed.error;
      const rows=[];
      for(const m of meetings.data||[])rows.push(...expandCalendarEvent({id:`meeting-${m.id}`,kind:'meeting',date:calendarDay(m.starts_at),title:m.title,startsAt:m.starts_at,endsAt:m.ends_at,meta:when(m.starts_at),status:'Meeting',statusTone:'action',onClick:()=>openMeeting?.(m.id)},range.from,range.to));
      for(const p of projects.data||[]){
        for(const [date,label] of [[p.starts_on,'starts'],[p.ends_on,'ends']])if(date&&date>=range.from&&date<range.to)rows.push({id:`project-${p.id}-${label}`,kind:'projects',date,title:`${p.name} ${label}`,meta:p.status,status:'Project',onClick:()=>openProject?.(p.id)});
      }
      for(const e of ministry.data||[])if(!e.cancelled)for(const date of calendarSpan(calendarDay(e.starts_at),calendarDay(e.ends_at?new Date(new Date(e.ends_at).getTime()-1):e.starts_at),range.from,range.to))rows.push({id:`ministry-${e.id}-${date}`,kind:'ministry',date,title:e.title,startsAt:e.starts_at,endsAt:e.ends_at,allDay:e.all_day,meta:e.location||'Ministry activity',status:'Ministry',onClick:()=>setDetail(e)});
      for(const l of leave.data||[])for(const date of calendarSpan(l.start_date,l.end_date,range.from,range.to))rows.push({id:`leave-${l.id}-${date}`,kind:'leave',date,title:`${l.profiles?.full_name||'CEAC member'} · Leave`,meta:`${l.start_date} → ${l.end_date}`,status:'Approved',statusTone:'success',allDay:true});
      for(const w of work.data||[])rows.push({id:`work-${w.id}`,kind:'work',date:calendarDay(w.due_at),title:w.title,meta:w.ref,status:calendarWorkStatus(w.status),statusTone:['completed','self_certified'].includes(w.status)?'success':'neutral',onClick:()=>openItem?.(w.id)});
      setEvents(rows);
    }catch(err){if(request===version.current){setEvents([]);setError(humanError(err,'Organisation calendar could not be loaded.'));}}
    finally{if(request===version.current)setLoading(false);}
  }
  const sharedLabel=roleMode==='executive'?'Church calendar':'Organisation calendar';
  const scopeControl=<div className="phase6-calendar-scope" role="tablist" aria-label="Calendar scope">
    <button type="button" role="tab" aria-selected={calendarScope==='my'} className={calendarScope==='my'?'is-selected':''} onClick={()=>setCalendarScope('my')}>My calendar</button>
    <button type="button" role="tab" aria-selected={calendarScope==='organisation'} className={calendarScope==='organisation'?'is-selected':''} onClick={()=>setCalendarScope('organisation')}>{sharedLabel}</button>
  </div>;
  if(calendarScope==='my')return <StaffCalendar me={me} openItem={openItem} openMeeting={openMeeting} scheduleMeeting={scheduleMeeting} statusLabel={roleMode==='executive'?'Group Pastor · My calendar':'Administration · My calendar'} scopeControl={scopeControl}/>;
  return <div className="body ev2cal-role-page ev2cal-admin-page">
    <CalendarPageHeader eyebrow="Shared schedule" title="Calendar" description="Meetings, delivery dates and approved leave." action={<Button icon="meeting" onClick={()=>scheduleMeeting?.({scope:'organisation',organisation:true,startsAt:`${selectedDate}T09:00`})}>Schedule meeting</Button>}/>
    {scopeControl}
    {error&&<ProductNotice tone="error" title="Calendar could not load" action={<Button variant="secondary" onClick={load}>Try again</Button>}>{error}</ProductNotice>}
    {loading?<LoadingState label="Loading calendar…"/>:<CalendarExplorer me={me} scope="organisation" events={events} layers={LAYERS} defaultLayers={['meeting','projects','ministry','leave']} cursor={cursor} setCursor={setCursor} selectedDate={selectedDate} onSelectDate={setSelectedDate}/>}
    {detail&&<Sheet onClose={()=>setDetail(null)}><div className="eyebrow">Ministry activity</div><h2>{detail.title}</h2><p>{when(detail.starts_at)}{detail.ends_at?` – ${when(detail.ends_at)}`:''}</p>{detail.location&&<p>{detail.location}</p>}{detail.notes&&<p>{detail.notes}</p>}<Button variant="secondary" onClick={()=>setDetail(null)}>Close</Button></Sheet>}
  </div>;
}

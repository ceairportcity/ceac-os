import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ModalDialog } from '../components';
import { CalendarAgenda, CalendarMonthGrid, CalendarPeriodControls, CalendarTimeline, CalendarViewTabs } from './CalendarFamilyV2';
import { calendarDay, calendarDate, calendarDays, indexCalendarEvents, layoutCalendarDay, shiftCalendarDay } from '../../lib/calendarPlanning';

// Preferences contain presentation choices only. No personal event data is saved.
export function useCalendarPreference(me,scope,name,fallback) {
  const key=`ceac-calendar:${me.org_id}:${me.id}:${scope}:${name}`;
  const [value,setValue]=useState(()=>{try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}});
  useEffect(()=>{try{localStorage.setItem(key,JSON.stringify(value));}catch{/* Private browsing can disable storage. */}},[key,value]);
  return [value,setValue];
}
export function useCalendarPosition(me,scope,initialDate){
  const key=`ceac-calendar-position:${me.org_id}:${me.id}:${scope}`;
  const valid=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(calendarDate(value).getTime())&&calendarDay(calendarDate(value))===value;
  const [position,setPosition]=useState(()=>{
    const initial=initialDate?.slice(0,10);
    if(valid(initial))return {selected:initial,cursor:initial};
    try{const saved=JSON.parse(sessionStorage.getItem(key));if(saved?.today===calendarDay()&&valid(saved.selected)&&valid(saved.cursor))return saved;}catch{}
    return {selected:calendarDay(),cursor:calendarDay()};
  });
  useEffect(()=>{try{sessionStorage.setItem(key,JSON.stringify({...position,today:calendarDay()}));}catch{}},[key,position]);
  const positionRef=useRef(position);
  const update=useCallback(patch=>{
    const next={...positionRef.current,...patch};positionRef.current=next;
    try{sessionStorage.setItem(key,JSON.stringify({...next,today:calendarDay()}));}catch{}
    setPosition(next);
  },[key]);
  const setSelectedDate=useCallback(value=>update({selected:value}),[update]);
  const setCursor=useCallback(value=>update({cursor:calendarDay(value)}),[update]);
  const cursor=useMemo(()=>calendarDate(position.cursor),[position.cursor]);
  return {selectedDate:position.selected,cursor,setSelectedDate,setCursor};
}
const labelDay=day=>calendarDate(day).toLocaleDateString('en-GB',{timeZone:'Africa/Accra',weekday:'long',day:'numeric',month:'long'});
const time=value=>new Date(value).toLocaleTimeString('en-GB',{timeZone:'Africa/Accra',hour:'2-digit',minute:'2-digit'});
export default function CalendarExplorer({me,scope,events,layers,cursor,setCursor,selectedDate,onSelectDate,children,defaultLayers,footer}) {
  const [view,setView]=useCalendarPreference(me,scope,'view','month');
  const [density,setDensity]=useCalendarPreference(me,scope,'density','compact');
  const [chosen,setChosen]=useCalendarPreference(me,scope,'layers',defaultLayers||layers.map(l=>l.value));
  const [query,setQuery]=useState('');
  // Keep the selected day close to hand on phones. Desktop and iPad always retain the full month.
  // Remember only presentation preferences; no calendar or private-task data is stored.
  const [monthOpen,setMonthOpen]=useCalendarPreference(me,scope,'phoneMonthExpanded',false);
  const [agendaLimit,setAgendaLimit]=useState(100);
  const [showFilters,setShowFilters]=useState(false);
  const active=Array.isArray(chosen)?chosen:layers.map(l=>l.value);
  const currentView=['month','week','agenda'].includes(view)?view:'month';
  const visible=useMemo(()=>events.filter(e=>active.includes(e.kind)&&(!query.trim()||`${e.title} ${e.meta||''}`.toLowerCase().includes(query.trim().toLowerCase()))),[events,chosen,query]);
  const index=useMemo(()=>indexCalendarEvents(visible),[visible]);
  const days=useMemo(()=>calendarDays(cursor,currentView==='month'||currentView==='agenda'?'month':'week'),[cursor,currentView]);
  const changeDate=key=>{if(onSelectDate(key)===false)return;if(currentView==='week'||key.slice(0,7)!==calendarDay(cursor).slice(0,7))setCursor(calendarDate(key));};
  const move=amount=>{let key;if(currentView==='week')key=shiftCalendarDay(selectedDate,amount*7);else{const d=calendarDate(calendarDay(cursor));d.setUTCMonth(d.getUTCMonth()+amount,1);key=calendarDay(d);}if(onSelectDate(key)===false)return;setCursor(calendarDate(key));};
  const today=()=>{const key=calendarDay();if(onSelectDate(key)===false)return;setCursor(calendarDate(key));};
  const month=cursor.toLocaleDateString('en-GB',{timeZone:'Africa/Accra',month:'long',year:'numeric'});
  const firstDay=days[0],lastDay=days[6];
  const short=value=>value.toLocaleDateString('en-GB',{timeZone:'Africa/Accra',day:'numeric',month:'short'});
  const period=currentView==='week'?`${firstDay.getUTCMonth()===lastDay.getUTCMonth()?firstDay.getUTCDate():short(firstDay)}–${short(lastDay)} ${lastDay.getUTCFullYear()}`:month;
  const groups=useMemo(()=>[...index.entries()].filter(([day])=>day.slice(0,7)===calendarDay(cursor).slice(0,7)).sort(([a],[b])=>a.localeCompare(b)).map(([key,rows])=>({key,label:labelDay(key),events:rows})),[index,cursor]);
  useEffect(()=>setAgendaLimit(100),[query,cursor.getUTCFullYear(),cursor.getUTCMonth(),chosen]);
  const agendaGroups=useMemo(()=>{let remaining=agendaLimit;return groups.flatMap(group=>{if(remaining<=0)return [];const rows=group.events.slice(0,remaining);remaining-=rows.length;return [{...group,events:rows}];});},[groups,agendaLimit]);
  const agendaTotal=groups.reduce((sum,group)=>sum+group.events.length,0);
  const toggle=value=>setChosen(active.includes(value)?active.filter(v=>v!==value):[...active,value]);
  return <section className="ceac-calendar-explorer" aria-label="Calendar planner">
    <div className="ceac-calendar-controls">
      <CalendarViewTabs value={currentView} onChange={setView} items={[{value:'month',label:'Month'},{value:'week',label:'Week'},{value:'agenda',label:'Agenda'}]}/>
      <div className="ceac-calendar-tools"><button type="button" className="btn btn-ghost btn-sm" aria-expanded={showFilters} onClick={()=>setShowFilters(!showFilters)}>Filter{active.length!==layers.length?` · ${active.length}`:''}</button>
      {currentView==='month'&&<label>Month detail<select aria-label="Month detail" value={density} onChange={e=>setDensity(e.target.value)}><option value="compact">Compact</option><option value="details">Details</option></select></label>}</div>
    </div>
    <ModalDialog open={showFilters} onClose={()=>setShowFilters(false)} title="Show on calendar" panelClassName="ceac-calendar-filter"><fieldset className="ceac-calendar-layers"><legend>Show together</legend>{layers.map(layer=><label key={layer.value}><input type="checkbox" checked={active.includes(layer.value)} onChange={()=>toggle(layer.value)}/>{layer.label}</label>)}<button type="button" className="btn btn-ghost btn-sm" onClick={()=>setChosen(layers.map(l=>l.value))}>Show all</button><input type="search" aria-label="Search this calendar" placeholder="Search this calendar" value={query} onChange={e=>setQuery(e.target.value)}/></fieldset><button type="button" className="btn" onClick={()=>setShowFilters(false)}>Done</button></ModalDialog>
    {query&&<button type="button" className="btn btn-ghost btn-sm" onClick={()=>setQuery('')}>Clear search: {query}</button>}
    <CalendarPeriodControls label={period} onPrevious={()=>move(-1)} onNext={()=>move(1)} onToday={today}/>
    <div className={`ceac-calendar-planner is-${currentView}`}>
      <div className={`ceac-calendar-main density-${density}${monthOpen?'':' is-month-collapsed'}`}>
        {currentView==='month'&&<button className="btn btn-ghost btn-sm ceac-calendar-collapse" type="button" aria-expanded={monthOpen} onClick={()=>setMonthOpen(!monthOpen)}>{monthOpen?'Collapse month':'Show full month'}</button>}
        {currentView==='month'?<CalendarMonthGrid days={days} currentMonth={cursor.getUTCMonth()} selectedDateKey={selectedDate} onSelectDate={changeDate} getEvents={key=>index.get(key)||[]} compact={density!=="details"} ariaLabel={scope==='personal'?"Personal month calendar":scope==='unit'?"Unit month calendar":"Organisation month calendar"}/>:currentView==='week'?<CalendarWeek days={days} index={index} selectedDate={selectedDate} onSelectDate={changeDate}/>:groups.length?<><CalendarTimeline groups={agendaGroups}/>{agendaTotal>agendaLimit&&<button type="button" className="btn btn-ghost" onClick={()=>setAgendaLimit(limit=>limit+100)}>Show more · {agendaTotal-agendaLimit} remaining</button>}</>:<p className="screen-note" role="status">No matching items this month. Change the filters or add a plan.</p>}
      </div>
      {(typeof children==='function'?children(visible,active):children)||<CalendarAgenda title={labelDay(selectedDate)} description="Meetings, plans and due work for this day." events={index.get(selectedDate)||[]} emptyTitle="Nothing scheduled for this day" emptyDescription="Choose another date or change the calendar filters."/>}
    </div>
    {footer?.(visible)}
  </section>;
}
function CalendarWeek({days,index,selectedDate,onSelectDate}) {
  const columns=useMemo(()=>days.map(date=>{const key=calendarDay(date);const rows=index.get(key)||[];return {key,date,timed:layoutCalendarDay(rows,key),other:rows.filter(e=>!e.startsAt||e.allDay||e.status==='Cancelled')};}),[days,index]);
  const timed=columns.flatMap(c=>c.timed);
  const first=Math.min(8,...timed.map(e=>Math.floor(e.start/60)));
  const last=Math.max(18,...timed.map(e=>Math.ceil(e.end/60)));
  const hours=Array.from({length:last-first},(_,i)=>first+i);
  return <div className={`ceac-calendar-week-scroll${columns.find(c=>c.key===selectedDate)?.timed.length?' has-selected-times':''}`} tabIndex={0} aria-label="Weekly time schedule, Africa/Accra"><div className="ceac-calendar-week-days">
    <div className="ceac-calendar-week-label">Accra</div>{columns.map(c=><button type="button" key={c.key} className="ceac-calendar-week-date" aria-pressed={c.key===selectedDate} onClick={()=>onSelectDate(c.key)}>{c.date.toLocaleDateString('en-GB',{timeZone:'Africa/Accra',weekday:'short',day:'numeric'})}{c.timed.length>0&&<span aria-hidden="true"> ·</span>}</button>)}
    </div><div className="ceac-calendar-week"><div className="ceac-calendar-week-label">All day<br/>Due work</div>{columns.map(c=><div key={c.key} className={`ceac-calendar-week-other${c.key===selectedDate?' is-selected-day':''}`}>{c.other.slice(0,6).map(e=><button type="button" key={e.id} disabled={!e.onClick} title={`${e.title} · ${e.status||''}`} onClick={e.onClick}><strong>{e.title}</strong><small>{e.status||'All day'}</small></button>)}{c.other.length>6&&<button type="button" onClick={()=>onSelectDate(c.key)}>+{c.other.length-6} more</button>}</div>)}
    <div className="ceac-calendar-hours">{hours.map(h=><time key={h}>{String(h).padStart(2,'0')}:00</time>)}</div>
    {columns.map(c=><div key={c.key} className={`ceac-calendar-time-column${c.key===selectedDate?' is-selected-day':''}`} style={{height:hours.length*64}}>{hours.map(h=><div className="ceac-calendar-hour-line" key={h}/>)}{c.timed.map(e=><button type="button" key={e.id} disabled={!e.onClick} onClick={e.onClick} className={`ceac-calendar-time-event is-${e.kind}`} style={{top:(e.start-first*60)*64/60,height:(e.end-e.start)*64/60,left:`${e.lane/e.lanes*100}%`,width:`${100/e.lanes}%`}} title={`${e.title} · ${time(e.startsAt)}${e.endsAt?`–${time(e.endsAt)}`:''}`}><time>{time(e.startsAt)}{e.endsAt?`–${time(e.endsAt)}`:''}</time><strong>{e.title}</strong></button>)}</div>)}
  </div><p className="ceac-calendar-no-times">No timed appointments on this day.</p></div>;
}

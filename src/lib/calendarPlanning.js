// Calendar dates and wall-clock times are always CEAC's Africa/Accra time.
const dateFormatter = new Intl.DateTimeFormat('en-CA', { timeZone:'Africa/Accra', year:'numeric', month:'2-digit', day:'2-digit' });
export function calendarDay(value = new Date()) {
  const parts=Object.fromEntries(dateFormatter.formatToParts(new Date(value)).map(p=>[p.type,p.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}
export function calendarDate(key) { return new Date(`${key}T12:00:00Z`); }
export function shiftCalendarDay(key, amount) { const d=calendarDate(key);d.setUTCDate(d.getUTCDate()+amount);return calendarDay(d); }
export function calendarDays(cursor, view='month') {
  const date=calendarDate(calendarDay(cursor));
  if(view==='month')date.setUTCDate(1);
  date.setUTCDate(date.getUTCDate()-(date.getUTCDay()+6)%7);
  return Array.from({length:view==='month'?42:7},(_,i)=>calendarDate(shiftCalendarDay(calendarDay(date),i)));
}
export function calendarWindow(cursor) {
  const d=calendarDate(calendarDay(cursor));
  const from=calendarDay(new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()-1,1)));
  const to=calendarDay(new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+2,1)));
  return {from,to,fromAt:`${from}T00:00:00Z`,toAt:`${to}T00:00:00Z`};
}
export function calendarWorkStatus(status) {
  if(['completed','self_certified'].includes(status))return 'Completed';
  if(status==='in_review')return 'Waiting for approval';
  if(status==='returned')return 'Changes requested';
  if(['waiting_on','waiting','blocked'].includes(status))return 'Waiting';
  if(status==='cancelled')return 'Cancelled';
  return 'Due';
}
export function indexCalendarEvents(events) {
  const index=new Map();
  for(const event of events){const day=event.date;if(!day)continue;if(!index.has(day))index.set(day,[]);index.get(day).push(event);}
  for(const rows of index.values())rows.sort((a,b)=>String(a.startsAt||a.sortAt||'').localeCompare(String(b.startsAt||b.sortAt||''))||a.title.localeCompare(b.title));
  return index;
}
// Clip long events/leave to the loaded window before expanding; no year-long loops.
export function calendarSpan(start,end,from,to) {
  const result=[];let day=start>from?start:from;const last=end||start;
  while(day<=last&&day<to){result.push(day);day=shiftCalendarDay(day,1);}
  return result;
}
export function calendarMinutes(value) { const d=new Date(value);return d.getUTCHours()*60+d.getUTCMinutes(); }
// Interval partitioning keeps simultaneous appointments side by side, not on top
// of one another. Deadlines never enter this timed layout.
export function layoutCalendarDay(events,day) {
  const timed=events.filter(e=>e.startsAt&&!e.allDay&&e.status!=='Cancelled').map(event=>{
    const start=calendarDay(event.startsAt)<day?0:calendarMinutes(event.startsAt);
    const end=event.endsAt?(calendarDay(event.endsAt)>day?1440:calendarMinutes(event.endsAt)):start+60;
    return {...event,start,end:Math.min(1440,Math.max(start+15,end))};
  }).sort((a,b)=>a.start-b.start||b.end-a.end);
  let group=[],until=-1;
  const finish=()=>{const lanes=[];for(const e of group){let lane=lanes.findIndex(end=>end<=e.start);if(lane<0)lane=lanes.length;e.lane=lane;lanes[lane]=e.end;}for(const e of group)e.lanes=lanes.length;};
  for(const event of timed){if(event.start>=until){finish();group=[];until=-1;}group.push(event);until=Math.max(until,event.end);}finish();
  return timed;
}
export function findCalendarConflicts(events,startValue,endValue) {
  const start=new Date(startValue).getTime();const end=endValue?new Date(endValue).getTime():start+3600000;
  if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start)return [];
  return events.filter(e=>{const from=new Date(e.starts_at).getTime();const to=e.ends_at?new Date(e.ends_at).getTime():from+3600000;return e.status!=='cancelled'&&from<end&&to>start;});
}
export function expandCalendarEvent(event,from,to) {
  const last=event.endsAt?new Date(new Date(event.endsAt).getTime()-1):event.startsAt;
  return calendarSpan(calendarDay(event.startsAt),calendarDay(last),from,to).map(date=>({...event,id:`${event.id}-${date}`,date}));
}

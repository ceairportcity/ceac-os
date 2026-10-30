import {useState} from 'react';
import {staffInitials,attendanceSnapshot,recordedPlace} from '../lib/workforcePresentation';

/** Compact attendance evidence shared by Executive, HR and Compliance. */
export default function WorkforceAttendancePanel({people=[],results=[],office=null,selectedId,onSelect,roleLabel='People & HR'}){
 const [expanded,setExpanded]=useState(false);
 const summary=attendanceSnapshot(people);
 const executive=roleLabel==='Executive';
 const limit=executive?4:6;
 const selected=results.find(p=>p.id===selectedId);
 const shown=expanded?results:results.slice(0,limit);
 const visible=selected&&!shown.some(p=>p.id===selected.id)?[selected,...shown.slice(0,Math.max(0,limit-1))]:shown;
 const time=value=>value?new Date(value).toLocaleTimeString('en-GB',{timeZone:'Africa/Accra',hour:'2-digit',minute:'2-digit'}):'Not recorded';
 return <section className="workforce-attendance" aria-label="Recorded staff attendance details">
  <div className="workforce-attendance-head">
   <div><strong>Attendance snapshot</strong><p>Recorded work starts · Ghana time · Not live tracking</p></div>
   <span className="workforce-attendance-period">Today</span>
  </div>
  <div className="workforce-attendance-metrics" aria-label="Today's recorded work-start summary">
   <div><strong>{summary.started}</strong><span>Started work</span></div>
   <div><strong>{summary.office}</strong><span>Office selected</span></div>
   <div><strong>{summary.offsite}</strong><span>Off-site selected</span></div>
   <div><strong>{summary.notStarted}</strong><span>No start recorded</span></div>
  </div>
  <div className="workforce-attendance-list-head"><strong>{executive?'Recent staff starts':'Staff attendance details'}</strong><span>{results.length} matching records</span></div>
  <div className="workforce-attendance-list">
   {visible.map(person=>{
    const place=recordedPlace(person,office);
    const active=person.id===selectedId;
    const hasPoint=person.latitude!=null&&person.longitude!=null&&Number.isFinite(Number(person.latitude))&&Number.isFinite(Number(person.longitude));
    return <button key={person.id} type="button" className={'workforce-attendance-row'+(active?' is-selected':'')} aria-pressed={active} onClick={()=>onSelect?.(active?null:person.id)}>
     <span className="workforce-person-avatar" aria-hidden="true">{staffInitials(person.name)}</span>
     <span className="workforce-attendance-person"><strong>{person.name}</strong><small>{person.unit}</small></span>
     <span className="workforce-attendance-place"><strong>{place.label}</strong><small>{place.address}</small></span>
     <span className="workforce-attendance-time"><strong>{time(person.mapStart)}</strong><small>{person.mapStart?(person.mapOpen?'Session open':'Session ended'):'Not recorded'}{person.mapStart&&!hasPoint?' · No GPS':''}</small></span>
     <span className="workforce-attendance-chevron" aria-hidden="true">›</span>
    </button>;
   })}
   {!visible.length&&<p className="workforce-attendance-empty">No staff records match the current filters. This does not establish absence.</p>}
  </div>
  {results.length>limit&&<button className="btn btn-ghost btn-sm workforce-attendance-more" type="button" onClick={()=>setExpanded(p=>!p)}>{expanded?'Show fewer records':`View all ${results.length} matching records`}</button>}
  <p className="workforce-attendance-note">Office/off-site describes the employee's recorded selection, not independently verified presence. Unverified street names are not guessed.</p>
 </section>;
}

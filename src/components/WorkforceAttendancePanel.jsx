import {useState} from 'react';
import {staffInitials,recordedPlace} from '../lib/workforcePresentation';

/**
 * Shared, role-scoped attendance selector underneath the street map.
 * The map owns the workforce summary; this list is a route to a person's
 * recorded work start, not a second duplicate KPI dashboard.
 */
export default function WorkforceAttendancePanel({people=[],results=[],office=null,selectedId,onSelect,roleLabel='People & HR'}){
 const [expanded,setExpanded]=useState(false);
 const executive=roleLabel==='Executive';
 const limit=executive?4:6;
 const selected=results.find(p=>p.id===selectedId);
 const shown=expanded?results:results.slice(0,limit);
 const visible=selected&&!shown.some(p=>p.id===selected.id)?[selected,...shown.slice(0,Math.max(0,limit-1))]:shown;
 const time=v=>v?new Date(v).toLocaleTimeString('en-GB',{timeZone:'Africa/Accra',hour:'2-digit',minute:'2-digit'}):'Not recorded';
 return <section className="workforce-attendance-panel" aria-label="Recorded staff attendance details">
  <header className="workstart-heading">
   <div><h2>{executive?'Staff work starts':'Attendance records'}</h2>
    <p>Choose a person to inspect their recorded start and location. This is not live tracking.</p>
   </div>
   <span>Today</span>
  </header>
  <div className="workforce-attendance-list">
   <div aria-label="Daily staff attendance records">
    {visible.map(person=>{
     const place=recordedPlace(person,office);
     const hasPoint=Number.isFinite(person?.latitude)&&Number.isFinite(person?.longitude);
     return <button type="button" key={person.id} data-attendance-person={person.id}
       aria-pressed={person.id===selectedId} onClick={()=>onSelect?.(person.id===selectedId?null:person.id)}>
      <strong>{staffInitials(person.name)} · {person.name}</strong>
      <span>{person.unit}</span>
      <span>{person.mapStart?`${time(person.mapStart)} · ${person.mapOpen?'Session open':'Session ended'}`:'No start recorded'}</span>
      <span>{person.mapStart?place.address:place.label}{person.mapStart&&!hasPoint?' · Map location unavailable':''}</span>
     </button>;
    })}
    {!visible.length&&<p className="screen-note">No records match the selected filters. This does not establish absence.</p>}
   </div>
  </div>
  {results.length>limit&&<button type="button" className="btn btn-ghost btn-sm" onClick={()=>setExpanded(v=>!v)}>
    {expanded?'Show fewer':`View all ${results.length} matching people`}</button>}
  <p className="screen-note">Recorded office/off-site selection is not independent proof of presence. Street addresses are displayed only when verified.</p>
 </section>;
}

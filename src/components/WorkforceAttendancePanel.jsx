import {useState} from 'react';
import {staffInitials,attendanceSnapshot,recordedPlace} from '../lib/workforcePresentation';

/** Read-only, role-scoped attendance evidence; relies on existing CEAC styles. */
export default function WorkforceAttendancePanel({people=[],results=[],office=null,selectedId,onSelect,roleLabel='People & HR'}){
 const [expanded,setExpanded]=useState(false);
 const snapshot=attendanceSnapshot(people);
 const executive=roleLabel==='Executive';
 const limit=executive?4:6;
 const selected=results.find(p=>p.id===selectedId);
 const shown=expanded?results:results.slice(0,limit);
 const visible=selected&&!shown.some(p=>p.id===selected.id)?[selected,...shown.slice(0,Math.max(0,limit-1))]:shown;
 const time=v=>v?new Date(v).toLocaleTimeString('en-GB',{timeZone:'Africa/Accra',hour:'2-digit',minute:'2-digit'}):'Not recorded';
 const facts=[
  [snapshot.started,'Started work'],
  [snapshot.office,'Office selected'],
  [snapshot.offsite,'Off-site selected'],
  [snapshot.notStarted,'No start recorded'],
 ];
 return <section className="workstart-unmapped-detail" aria-label="Recorded staff attendance details">
  <header className="workstart-heading">
   <div><h2>Attendance snapshot</h2><p>Recorded work starts · Ghana time · not live tracking</p></div>
   <span>Today</span>
  </header>
  <div className="workstart-toolbar" aria-label="Today's recorded work-start summary">
   {facts.map(([count,label])=><div key={label} className="workstart-unmapped-detail"><strong>{count}</strong><span>{label}</span></div>)}
  </div>
  <div className="workstart-summary"><strong>{executive?'Recent staff starts':'Staff attendance details'}</strong><span>{results.length} matching records</span></div>
  <div className="workstart-accessible-list">
   <div aria-label="Daily staff attendance records">
    {visible.map(person=>{
     const place=recordedPlace(person,office);
     const hasPoint=Number.isFinite(person?.latitude)&&Number.isFinite(person?.longitude);
     return <button type="button" key={person.id} aria-pressed={person.id===selectedId} onClick={()=>onSelect?.(person.id===selectedId?null:person.id)}>
      <strong>{staffInitials(person.name)} · {person.name}</strong>
      <span>{person.unit}</span>
      <span>{place.label} · {place.address}</span>
      <span>{time(person.mapStart)} · {person.mapStart?(person.mapOpen?'Session open':'Session ended'):'No start recorded'}{person.mapStart&&!hasPoint?' · Location not captured':''}</span>
     </button>;
    })}
    {!visible.length&&<p className="screen-note">No staff records match the current filters. This does not establish absence.</p>}
   </div>
  </div>
  {results.length>limit&&<button type="button" className="btn btn-ghost btn-sm" onClick={()=>setExpanded(v=>!v)}>{expanded?'Show fewer records':`View all ${results.length} matching records`}</button>}
  <p className="screen-note">Office/off-site is the recorded selection, not independently verified presence. Unverified street names are not guessed.</p>
 </section>;
}

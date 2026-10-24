import {useMemo,useRef,useState} from "react";
import {adminWorkforceToday,clusterWorkStartLocations} from "../lib/adminWorkforceToday";
import WorkforceStreetMap from "./WorkforceStreetMap";
const stamp=v=>v?new Date(v).toLocaleTimeString("en-GB",{timeZone:"Africa/Accra",hour:"2-digit",minute:"2-digit"}):"Not recorded";
const located=r=>Number.isFinite(r?.latitude)&&Number.isFinite(r?.longitude);
/** Role-scoped start snapshots. Identity and coordinates never go to the tile provider. */
export default function AdminWorkforceToday({roster=[],sessions=[],operationalProfiles=[],onOpenPeople,onOpenPerson,onOpenAccess,onOpenWorkforce,roleLabel="People & HR",dateLabel="today"}){
 const lastListSelection=useRef(null);
 const [term,setTerm]=useState(""),[filter,setFilter]=useState("started"),[selectedId,setSelectedId]=useState(null);
 const [unitFilter,setUnitFilter]=useState(""),[startChoice,setStartChoice]=useState("latest");
 const people=useMemo(()=>adminWorkforceToday(roster,sessions,operationalProfiles,startChoice),[roster,sessions,operationalProfiles,startChoice]);
 const unitNames=useMemo(()=>[...new Set(people.flatMap(r=>r.unitNames))].sort(),[people]);
 const results=useMemo(()=>people.filter(r=>(!term||(r.name+" "+r.unit).toLowerCase().includes(term.toLowerCase()))&&(!unitFilter||r.unitNames.includes(unitFilter))&&(filter==="started"?r.firstStart:filter==="open"?r.open:filter==="noSession"?!r.firstStart:filter==="noCoordinates"?r.firstStart&&!located(r):true)),[people,term,unitFilter,filter]);
 const clusters=useMemo(()=>clusterWorkStartLocations(results),[results]);
 const selected=results.find(r=>r.id===selectedId)||null;
 const started=people.filter(r=>r.firstStart),missing=started.filter(r=>!located(r));
 const detail=selected?<div className="workstart-person-detail">
  <strong>{selected.name}</strong><span>{selected.unit}</span>
  <span>{startChoice==="latest"?"Latest":"First"} start: {stamp(selected.mapStart)}</span>
  <span>{selected.place==="office"?"Office selected":selected.place==="elsewhere"?"Elsewhere selected":"Place not recorded"} · {selected.mapStart?(selected.mapOpen?"Session open":"Session ended"):"No session recorded"}</span>
  <small>{located(selected)?`Location estimate${Number.isFinite(selected.accuracyM)?` ±${Math.round(selected.accuracyM)} m`:" · accuracy unavailable"}`:"Start GPS unavailable or not captured"}. Not verified live presence.</small>
  {selected.startHistory.length>1?<details><summary>Recorded starts ({selected.startHistory.length})</summary>{selected.startHistory.map(s=><p key={s.id}>{stamp(s.started_at)} · {s.place==="office"?"Office selected":s.place==="elsewhere"?"Elsewhere selected":"Place not recorded"}</p>)}</details>:null}
  {onOpenPerson&&!String(selected.id).startsWith("profile:")?<button className="btn btn-ghost btn-sm" type="button" onClick={()=>onOpenPerson(selected.id)}>Open employee record</button>:null}
  {onOpenAccess&&String(selected.id).startsWith("profile:")&&selected.profileId?<button className="btn btn-ghost btn-sm" type="button" onClick={()=>onOpenAccess(selected.profileId)}>Review account access</button>:null}
 </div>:null;
 return <section className="workstart-workspace" aria-label="Today's workforce start locations">
  <header className="workstart-heading"><div><span className="eyebrow">{roleLabel} · recorded attendance</span><h2>Where work was started {dateLabel==="today"?"today":"· "+dateLabel}</h2><p>Work-start snapshots, not live tracking.</p></div><div>{onOpenPeople?<button type="button" className="btn btn-ghost btn-sm" onClick={onOpenPeople}>People &amp; Access</button>:null}{onOpenWorkforce?<button type="button" className="btn btn-ghost btn-sm" onClick={onOpenWorkforce}>Open Workforce →</button>:null}</div></header>
  <div className="workstart-toolbar">
   <label>Find employee or unit<input className="field" aria-label="Search daily workforce" type="search" value={term} onChange={e=>setTerm(e.target.value)} placeholder="Search staff or department"/></label>
   <label>Department<select className="field" aria-label="Filter daily workforce by department" value={unitFilter} onChange={e=>setUnitFilter(e.target.value)}><option value="">All departments</option>{unitNames.map(n=><option key={n}>{n}</option>)}</select></label>
   <label>Show<select className="field" aria-label="Filter daily workforce" value={filter} onChange={e=>{setFilter(e.target.value);setSelectedId(null);}}><option value="started">Started work today</option><option value="open">Open work sessions</option><option value="noCoordinates">Start location unavailable</option><option value="noSession">No session recorded</option><option value="all">All roster records</option></select></label>
   <label>Recorded start<select className="field" aria-label="Recorded start to display" value={startChoice} onChange={e=>{setStartChoice(e.target.value);setSelectedId(null);}}><option value="latest">Latest start</option><option value="first">First start</option></select></label>
  </div>
  <div className="workstart-summary"><span>{started.length} employees with recorded starts · {started.length-missing.length} mapped</span><button type="button" onClick={()=>{setFilter("noCoordinates");setSelectedId(null);}}>{missing.length} start locations unavailable</button></div>
  <WorkforceStreetMap clusters={clusters} selectedId={selected?.id||null} onSelect={setSelectedId} selectedContent={located(selected)?detail:null}/>
  {selected&&!located(selected)?<div className="workstart-unmapped-detail">{detail}<button className="btn btn-ghost btn-sm" type="button" onClick={()=>{setSelectedId(null);lastListSelection.current?.focus();}}>Close details</button></div>:null}
  <details className="workstart-accessible-list" open={filter==="noCoordinates"||filter==="noSession"||undefined}><summary>Browse employees ({results.length})</summary><div aria-label="Daily workforce employee list">{results.length?results.map(r=><button type="button" key={r.id} aria-pressed={r.id===selectedId} onClick={event=>{lastListSelection.current=event.currentTarget;setSelectedId(r.id);}}><strong>{r.name}</strong><span>{r.unit}</span><small>{r.mapStart?`Started ${stamp(r.mapStart)} · ${located(r)?"Location captured":"Start GPS not captured"}`:"No session recorded"}</small></button>):<p>No employees match this filter; no attendance conclusion is implied.</p>}</div></details>
 </section>;
}

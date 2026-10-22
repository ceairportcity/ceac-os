import {useMemo,useState} from "react";
import {adminWorkforceToday,clusterWorkStartLocations} from "../lib/adminWorkforceToday";
import WorkforceStreetMap from "./WorkforceStreetMap";

const stamp=(value)=>value?new Date(value).toLocaleTimeString("en-GB",{timeZone:"Africa/Accra",hour:"2-digit",minute:"2-digit"}):"Not recorded";
const buttonStyle={display:"block",width:"100%",textAlign:"left",background:"transparent",border:"1px solid var(--ev2-line,var(--line))",borderRadius:8,padding:"10px 12px",cursor:"pointer"};
const goodCoordinate=(num)=>Number.isFinite(num);

/** HR-only factual session evidence. A plotted point is a recorded start, NEVER live tracking. */
export default function AdminWorkforceToday({roster=[],sessions=[],operationalProfiles=[],onOpenPeople,onOpenPerson,onOpenAccess,roleLabel="People & HR",dateLabel="today"}){
 const [term,setTerm]=useState(""),[filter,setFilter]=useState("started"),[selectedId,setSelectedId]=useState(null);
 const [unitFilter,setUnitFilter]=useState("");
 const people=useMemo(()=>adminWorkforceToday(roster,sessions,operationalProfiles),[roster,sessions,operationalProfiles]);
 const rosterUnitNames=useMemo(()=>new Map(roster.map(row=>[row.id,
  (Array.isArray(row.units)?row.units:[]).map(unit=>typeof unit==="string"?unit:unit?.name||unit?.unit_name).filter(Boolean)
 ])),[roster]);
 const unitNames=useMemo(()=>[...new Set([...rosterUnitNames.values()].flat())].sort((a,b)=>a.localeCompare(b)),[rosterUnitNames]);
 const results=useMemo(()=>people.filter(row=>{
  if(unitFilter && !(rosterUnitNames.get(row.id)||[row.unit]).includes(unitFilter))return false;
  const search=(row.name+" "+row.unit).toLocaleLowerCase();
  if(term&&!search.includes(term.toLocaleLowerCase()))return false;
  if(filter==="started")return !!row.firstStart;
  if(filter==="open")return !!row.open;
  if(filter==="noSession")return !row.firstStart;
  if(filter==="noCoordinates")return !!row.firstStart&&!goodCoordinate(row.latitude);
  return true;
 }),[people,term,filter,unitFilter,rosterUnitNames]);
 const clusters=useMemo(()=>clusterWorkStartLocations(results),[results]);
 const selected=results.find(row=>row.id===selectedId)||results[0]||null;
 const started=people.filter(row=>row.firstStart).length;
 const withoutCoordinates=people.filter(row=>row.firstStart&&!goodCoordinate(row.latitude)).length;
 return <section aria-label="Today's workforce start locations" style={{marginTop:18,minWidth:0}}>
  <div style={{display:"flex",justifyContent:"space-between",alignItems:"start",gap:12,flexWrap:"wrap",marginBottom:12}}>
   <div><span className="eyebrow">{roleLabel} · recorded attendance</span>
    <h2 style={{margin:"4px 0",fontSize:"1.15rem"}}>Where work was started {dateLabel==="today"?"today":"· "+dateLabel}</h2>
    <p className="screen-note" style={{margin:0}}>{started} employee{started===1?"":"s"} with recorded starts · {withoutCoordinates} start location{withoutCoordinates===1?"":"s"} unavailable.</p></div>
   {onOpenPeople && <button type="button" className="btn btn-ghost btn-sm" onClick={onOpenPeople}>People &amp; Access</button>}
  </div>
  <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:12}}>
   <label className="small" style={{flex:"1 1 190px"}}>Find employee or unit
    <input className="field" aria-label="Search daily workforce" type="search" value={term} onChange={event=>setTerm(event.target.value)} placeholder="Search staff or department"/>
   </label>
   <label className="small" style={{flex:"1 1 165px"}}>Department
    <select className="field" aria-label="Filter daily workforce by department" value={unitFilter}
     onChange={event=>setUnitFilter(event.target.value)}>
     <option value="">All departments</option>
     {unitNames.map(name=><option key={name} value={name}>{name}</option>)}
    </select>
   </label>
   <label className="small" style={{flex:"0 1 210px"}}>Show
    <select className="field" aria-label="Filter daily workforce" value={filter} onChange={event=>setFilter(event.target.value)}>
     <option value="started">Started work today</option><option value="open">Open work sessions</option>
     <option value="noCoordinates">Start location unavailable</option><option value="noSession">No session recorded</option><option value="all">All roster records</option>
    </select>
   </label>
  </div>
  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,290px),1fr))",gap:14}}>
   <div style={{minWidth:0}}>
    <WorkforceStreetMap clusters={clusters} selectedId={selected?.id || null} onSelect={setSelectedId} />
    {selected&&<div style={{padding:"12px 0",overflowWrap:"anywhere"}}>
     <strong>{selected.name}</strong>
     <p className="screen-note" style={{margin:"4px 0"}}>{selected.unit} · {selected.open?"Session open (not verified live presence)":selected.firstStart?"Session ended":"No session recorded"}</p>
     <p className="screen-note" style={{margin:"4px 0"}}>First start: {stamp(selected.firstStart)} · {selected.place==="office"?"Marked office":selected.place==="elsewhere"?"Marked elsewhere":"Place not recorded"}</p>
     {onOpenPerson && !String(selected.id).startsWith("profile:") && <button type="button" className="btn btn-ghost btn-sm" onClick={()=>onOpenPerson(selected.id)}>Open employee record</button>}
     {onOpenAccess && String(selected.id).startsWith("profile:") && selected.profileId && <button type="button" className="btn btn-ghost btn-sm" onClick={()=>onOpenAccess(selected.profileId)}>Review account access</button>}
     <p className="screen-note" style={{margin:"4px 0"}}>{goodCoordinate(selected.latitude)?`Start coordinates: ${selected.latitude.toFixed(5)}, ${selected.longitude.toFixed(5)} · GPS captured ${stamp(selected.locationCapturedAt)}${Number.isFinite(selected.accuracyM)?` · ±${Math.round(selected.accuracyM)} m`:""}`:"Start GPS unavailable or not captured"}</p>
    </div>}
   </div>
   <div style={{maxHeight:405,overflowY:"auto",minWidth:0,display:"grid",alignContent:"start",gap:7}} aria-label="Daily workforce employee list">
    {results.length===0?<p className="screen-note">No employees match this filter; no attendance conclusion is implied.</p>:results.map(row=><button type="button" key={row.id}
     style={{...buttonStyle,borderColor:selected?.id===row.id?"var(--ev2-action,var(--ink))":"var(--ev2-line,var(--line))"}}
     aria-pressed={selected?.id===row.id} onClick={()=>setSelectedId(row.id)}>
     <strong style={{display:"block",fontSize:13}}>{row.name}</strong>
     <span style={{display:"block",fontSize:12,opacity:.75}}>{row.unit}</span>
     <span style={{display:"block",fontSize:12,marginTop:3}}>{row.firstStart?`Started ${stamp(row.firstStart)} · ${row.open?"Session open":"Session ended"}`:"No session recorded"}</span>
     {row.firstStart&&!goodCoordinate(row.latitude)&&<span style={{fontSize:12}}>Start GPS not captured</span>}
    </button>)}
   </div>
  </div>
 </section>;
}

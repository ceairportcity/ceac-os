import {useMemo,useState} from "react";
import {adminWorkforceToday,clusterWorkStartLocations} from "../lib/adminWorkforceToday";

const stamp=(value)=>value?new Date(value).toLocaleTimeString("en-GB",{timeZone:"Africa/Accra",hour:"2-digit",minute:"2-digit"}):"Not recorded";
const buttonStyle={display:"block",width:"100%",textAlign:"left",background:"transparent",border:"1px solid var(--ev2-line,var(--line))",borderRadius:8,padding:"10px 12px",cursor:"pointer"};
const goodCoordinate=(num)=>Number.isFinite(num);

/** HR-only factual session evidence. A plotted point is a recorded start, NEVER live tracking. */
export default function AdminWorkforceToday({roster=[],sessions=[],operationalProfiles=[],onOpenPeople,onOpenPerson,roleLabel="People & HR",dateLabel="today"}){
 const [term,setTerm]=useState(""),[filter,setFilter]=useState("started"),[selectedId,setSelectedId]=useState(null);
 const people=useMemo(()=>adminWorkforceToday(roster,sessions,operationalProfiles),[roster,sessions,operationalProfiles]);
 const results=useMemo(()=>people.filter(row=>{
  const search=(row.name+" "+row.unit).toLocaleLowerCase();
  if(term&&!search.includes(term.toLocaleLowerCase()))return false;
  if(filter==="started")return !!row.firstStart;
  if(filter==="open")return !!row.open;
  if(filter==="noSession")return !row.firstStart;
  if(filter==="noCoordinates")return !!row.firstStart&&!goodCoordinate(row.latitude);
  return true;
 }),[people,term,filter]);
 const clusters=useMemo(()=>clusterWorkStartLocations(results),[results]);
 const selected=results.find(row=>row.id===selectedId)||results[0]||null;
 const latitudes=clusters.map(row=>row.lat),longitudes=clusters.map(row=>row.lng);
 const minLat=Math.min(...latitudes),maxLat=Math.max(...latitudes),minLng=Math.min(...longitudes),maxLng=Math.max(...longitudes);
 const position=(n,min,max)=>max===min?.5:(n-min)/(max-min);
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
   <label className="small" style={{flex:"0 1 210px"}}>Show
    <select className="field" aria-label="Filter daily workforce" value={filter} onChange={event=>setFilter(event.target.value)}>
     <option value="started">Started work today</option><option value="open">Open work sessions</option>
     <option value="noCoordinates">Start location unavailable</option><option value="noSession">No session recorded</option><option value="all">All roster records</option>
    </select>
   </label>
  </div>
  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,290px),1fr))",gap:14}}>
   <div style={{minWidth:0}}>
    <div style={{border:"1px solid var(--ev2-line,var(--line))",borderRadius:10,overflow:"hidden",minHeight:250,background:"var(--ev2-surface,var(--card))"}}>
     {clusters.length?<svg viewBox="0 0 600 300" role="group" aria-label="Recorded work-start coordinate plot, north at top" style={{width:"100%",maxHeight:300,display:"block"}}>
      <text x="16" y="22" fill="currentColor" fontSize="13">N ↑</text>
      <path d="M30 40 V270 H570" fill="none" stroke="currentColor" opacity=".17" strokeWidth="1"/>
      {clusters.map(cluster=>{
       const x=40+position(cluster.lng,minLng,maxLng)*520,y=260-position(cluster.lat,minLat,maxLat)*220;
       const active=cluster.people.some(person=>person.id===selected?.id);
       return <g key={cluster.key} tabIndex={0} role="button"
        aria-label={cluster.people.map(person=>person.name).join(", ")+" recorded start"}
        onClick={()=>setSelectedId(cluster.people[0].id)}
        onKeyDown={event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();setSelectedId(cluster.people[0].id);}}}
        style={{cursor:"pointer"}}>
        <circle cx={x} cy={y} r={active?15:12} fill="var(--ev2-action,#366a58)" stroke="var(--ev2-surface,#fff)" strokeWidth="3"/>
        <text x={x} y={y+4} fill="white" textAnchor="middle" fontSize="12" fontWeight="bold">{cluster.people.length}</text>
        <title>{cluster.people.map(person=>person.name).join(", ")}</title>
       </g>;
      })}
     </svg>:<div style={{minHeight:245,display:"grid",placeItems:"center",padding:18,textAlign:"center"}}>
      <span className="screen-note">No recorded start coordinates in the selected view. Staff remain visible in the list.</span>
     </div>}
    </div>
    <p className="screen-note" style={{fontSize:12,margin:"7px 0 0"}}>Relative coordinate plot, not a street map. Pins show first recorded work-start coordinates only; no continuous or current-location tracking. Multiple starts at one point are grouped.</p>
    {selected&&<div style={{padding:"12px 0",overflowWrap:"anywhere"}}>
     <strong>{selected.name}</strong>
     <p className="screen-note" style={{margin:"4px 0"}}>{selected.unit} · {selected.open?"Session open (not verified live presence)":selected.firstStart?"Session ended":"No session recorded"}</p>
     <p className="screen-note" style={{margin:"4px 0"}}>First start: {stamp(selected.firstStart)} · {selected.place==="office"?"Marked office":selected.place==="elsewhere"?"Marked elsewhere":"Place not recorded"}</p>
     {onOpenPerson && !String(selected.id).startsWith("profile:") && <button type="button" className="btn btn-ghost btn-sm" onClick={()=>onOpenPerson(selected.id)}>Open employee record</button>}
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

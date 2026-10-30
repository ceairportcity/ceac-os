import {useEffect,useMemo,useRef,useState} from "react";
import {adminWorkforceToday,clusterWorkStartLocations} from "../lib/adminWorkforceToday";
import {supabase} from "../lib/supabase";
import {primaryOfficePoint} from "../lib/workforceStreetMap";
import WorkforceStreetMap from "./WorkforceStreetMap";
import WorkforceAttendancePanel from "./WorkforceAttendancePanel";
import RecordedStreetAddress from "./RecordedStreetAddress";
import {recordedPlace,recordedMapUrl} from "../lib/workforcePresentation";
const EMPTY_ROWS=[];
const stamp=v=>v?new Date(v).toLocaleTimeString("en-GB",{timeZone:"Africa/Accra",hour:"2-digit",minute:"2-digit"}):"Not recorded";
const located=r=>Number.isFinite(r?.latitude)&&Number.isFinite(r?.longitude);
/** Role-scoped start snapshots. Rows remain scoped by the current role and organisation. */
export default function AdminWorkforceToday({me,roster=EMPTY_ROWS,sessions=EMPTY_ROWS,operationalProfiles=EMPTY_ROWS,onOpenPeople,onOpenPerson,onOpenAccess,onOpenWorkforce,roleLabel="People & HR",dateLabel="today",directoryLabel="People & Access",peopleLabel="employees"}){
 const lastListSelection=useRef(null);
 const officeScope=me?.org_id&&me?.id?me.org_id+":"+me.id:"";
 const [officeRead,setOfficeRead]=useState({scope:"",point:null,error:false});
 useEffect(()=>{
  let current=true;
  if(!officeScope)return;
  setOfficeRead({scope:officeScope,point:null,error:false});
  async function loadOffice(){
   try{
    const {data,error}=await supabase.from("office_locations").select("name,lat,lng,is_primary")
     .eq("org_id",me.org_id).eq("is_primary",true).limit(1).maybeSingle();
    if(current)setOfficeRead({scope:officeScope,point:error?null:primaryOfficePoint(data),error:!!error});
   }catch{if(current)setOfficeRead({scope:officeScope,point:null,error:true});}
  }
  void loadOffice();
  return ()=>{current=false;};
 },[officeScope]);
 const office=officeRead.scope===officeScope?officeRead.point:null;
 const [term,setTerm]=useState(""),[filter,setFilter]=useState("started"),[selectedId,setSelectedId]=useState(null);
 const [unitFilter,setUnitFilter]=useState(""),[startChoice,setStartChoice]=useState("latest");
 const [verifiedStreets,setVerifiedStreets]=useState({});
 const people=useMemo(()=>adminWorkforceToday(roster,sessions,operationalProfiles,startChoice),[roster,sessions,operationalProfiles,startChoice]);
 const unitNames=useMemo(()=>[...new Set(people.flatMap(r=>r.unitNames))].sort(),[people]);
 const results=useMemo(()=>people.filter(r=>(!term||(r.name+" "+r.unit).toLowerCase().includes(term.toLowerCase()))&&(!unitFilter||r.unitNames.includes(unitFilter))&&(filter==="started"?r.firstStart:filter==="open"?r.open:filter==="noSession"?!r.firstStart:filter==="noCoordinates"?r.firstStart&&!located(r):true)),[people,term,unitFilter,filter]);
 const clusters=useMemo(()=>clusterWorkStartLocations(results),[results]);
 const selected=results.find(r=>r.id===selectedId)||null;
 const started=people.filter(r=>r.firstStart),missing=started.filter(r=>!located(r));
 const detail=selected?<div className="workstart-person-detail">
  <strong>{selected.name}</strong><span>{selected.unit}</span>
  <span>{startChoice==="latest"?"Latest":"First"} start: {stamp(selected.mapStart)}</span>
  <span><strong>Recorded location:</strong> {recordedPlace(selected,office).label} · {recordedPlace(selected,office,verifiedStreets[selected.id]).address}</span>
  {located(selected)&&<RecordedStreetAddress key={selected.id} latitude={selected.latitude} longitude={selected.longitude} onResolved={street=>setVerifiedStreets(previous=>({...previous,[selected.id]:street}))}/>}
  {recordedMapUrl(selected)&&<a href={recordedMapUrl(selected)} target="_blank" rel="noopener noreferrer">View recorded point in Google Maps</a>}
  <span>{selected.place==="office"?"Office selected":selected.place==="elsewhere"?"Elsewhere selected":"Place not recorded"} · {selected.mapStart?(selected.mapOpen?"Session open":"Session ended"):"No session recorded"}</span>
  <small>{located(selected)?`Location estimate${Number.isFinite(selected.accuracyM)?` ±${Math.round(selected.accuracyM)} m`:" · accuracy unavailable"}`:"Start GPS unavailable or not captured"}. Not verified live presence.</small>
  {selected.startHistory.length>1?<details><summary>Recorded starts ({selected.startHistory.length})</summary>{selected.startHistory.map(s=><p key={s.id}>{stamp(s.started_at)} · {s.place==="office"?"Office selected":s.place==="elsewhere"?"Elsewhere selected":"Place not recorded"}</p>)}</details>:null}
  {onOpenPerson&&!String(selected.id).startsWith("profile:")?<button className="btn btn-ghost btn-sm" type="button" onClick={()=>onOpenPerson(selected.id)}>Open employee record</button>:null}
  {onOpenAccess&&String(selected.id).startsWith("profile:")&&selected.profileId?<button className="btn btn-ghost btn-sm" type="button" onClick={()=>onOpenAccess(selected.profileId)}>Review account access</button>:null}
 </div>:null;
 return <section className="workstart-workspace" aria-label="Today's workforce start locations">
  <header className="workstart-heading"><div><span className="eyebrow">{roleLabel} · recorded attendance</span><h2>Where work was started {dateLabel==="today"?"today":"· "+dateLabel}</h2><p>Work-start snapshots, not live tracking.</p></div><div>{onOpenPeople?<button type="button" className="btn btn-ghost btn-sm" onClick={onOpenPeople}>{directoryLabel}</button>:null}{onOpenWorkforce?<button type="button" className="btn btn-ghost btn-sm" onClick={onOpenWorkforce}>Open Workforce →</button>:null}</div></header>
  <div className="workstart-toolbar">
   <label>Find {peopleLabel==="people"?"person":"employee"} or unit<input className="field" aria-label="Search daily workforce" type="search" value={term} onChange={e=>setTerm(e.target.value)} placeholder="Search staff or department"/></label>
   <label>Department<select className="field" aria-label="Filter daily workforce by department" value={unitFilter} onChange={e=>setUnitFilter(e.target.value)}><option value="">All departments</option>{unitNames.map(n=><option key={n}>{n}</option>)}</select></label>
   <label>Show<select className="field" aria-label="Filter daily workforce" value={filter} onChange={e=>{setFilter(e.target.value);setSelectedId(null);}}><option value="started">Started work today</option><option value="open">Open work sessions</option><option value="noCoordinates">Start location unavailable</option><option value="noSession">No session recorded</option><option value="all">{peopleLabel==="people"?"All directory records":"All roster records"}</option></select></label>
   <label>Recorded start<select className="field" aria-label="Recorded start to display" value={startChoice} onChange={e=>{setStartChoice(e.target.value);setSelectedId(null);}}><option value="latest">Latest start</option><option value="first">First start</option></select></label>
  </div>
  <div className="workstart-summary"><span>{started.length} {started.length===1?(peopleLabel==="people"?"person":"employee"):peopleLabel} with recorded starts · {started.length-missing.length} mapped</span><button type="button" onClick={()=>{setFilter("noCoordinates");setSelectedId(null);}}>{missing.length} start locations unavailable</button></div>
  <WorkforceStreetMap key={officeScope} clusters={clusters} office={office} selectedId={selected?.id||null} onSelect={setSelectedId} selectedContent={located(selected)?detail:null}/>
  <WorkforceAttendancePanel people={people} results={results} office={office} selectedId={selectedId} onSelect={setSelectedId} roleLabel={roleLabel} verifiedStreets={verifiedStreets}/>
  {officeRead.scope===officeScope&&officeRead.error&&<p role="status">The saved office reference could not be loaded. Staff records remain available.</p>}
  {selected&&!located(selected)?<div className="workstart-unmapped-detail">{detail}<button className="btn btn-ghost btn-sm" type="button" onClick={()=>{setSelectedId(null);lastListSelection.current?.focus();}}>Close details</button></div>:null}

 </section>;
}

import {useEffect,useMemo,useState} from "react";
import {supabase} from "../lib/supabase";
import {workforceTodayReviewNeedsReview} from "../lib/workforceTodayReview";
import {reconcileWorkforceRosterToday} from "../lib/workforceRosterToday";

const OPTIONS=[
 ["review","Needs review"],
 ["started","Recorded starts"],
 ["leave","Approved leave"],
 ["all","All employees"],
];
const LABELS={
 evidence_unavailable:"Session evidence unavailable",
 schedule_source_unavailable:"Scheduled day type unavailable",
 schedule_unconfigured:"Schedule not configured",
 no_session_recorded:"No session recorded",
 no_login_account:"No login account (schedule recorded)",
 identity_unlinked:"Account not yet matched to HR roster",
 recorded_start:"Recorded start",
 approved_leave:"Approved leave",
 no_session_expected:"No work session scheduled",
 inactive:"Inactive HR roster record",
};
function localTime(value) {
 if(!value)return "Not recorded";
 const date=new Date(value);
 return Number.isFinite(date.valueOf())
  ?date.toLocaleTimeString("en-GB",{timeZone:"Africa/Accra",hour:"2-digit",minute:"2-digit"})
  :"Recorded time unavailable";
}

/** Canonical HR roster (including no-login employees) + existing authorised
 * Workforce linked-profile facts. Missing source reads FAIL CLOSED.
 * No second employee store, session engine or attendance finding. */
export default function WorkforceTodayReviewList({
 me,date,rows=[],schedules=[],dayTypes=[],sourceUnavailable=false,onSchedule,onSessions,overview=false,renderPlanner,requestsToReview=null,approvedToday=null,
}){
 const [text,setText]=useState(""),[view,setView]=useState(overview?"all":"review");
 const [reload,setReload]=useState(0);
 const [directory,setDirectory]=useState({scope:"",loading:true,rows:[],error:""});
 const scope=`${me.org_id}:${me.id}`;
 useEffect(()=>{
  let current=true;
  setDirectory({scope:"",loading:true,rows:[],error:""});
  if(!me.is_admin)return()=>{current=false;};
  (async()=>{
   try{
    const result=await supabase.rpc("admin_employee_roster_summary");
    if(result.error||!Array.isArray(result.data)||result.data.some(item=>!item?.id))
     throw new Error("Canonical Administration employee roster could not be verified.");
    if(current)setDirectory({scope,loading:false,rows:result.data,error:""});
   }catch{
    if(current)setDirectory({scope,loading:false,rows:[],
     error:"The HR roster could not be verified. Daily coverage is withheld, not shown as zero."});
   }
  })();
  return()=>{current=false;};
 },[scope,me.is_admin,reload]);

 const normalized=useMemo(()=>{
  if(directory.scope!==scope||directory.loading||directory.error||sourceUnavailable)return null;
  try {
   return reconcileWorkforceRosterToday({
    roster:directory.rows,linkedRows:rows,schedules,dayTypes,date,
   }).sort((a,b)=>Number(workforceTodayReviewNeedsReview(b.category))-Number(workforceTodayReviewNeedsReview(a.category))
    ||String(a.name).localeCompare(String(b.name)));
  }catch{return null;}
 },[directory,scope,sourceUnavailable,rows,schedules,dayTypes,date]);

 if(directory.scope!==scope||directory.loading)
  return <p role="status">Checking the canonical employee roster before showing daily coverage…</p>;
 if(directory.error||sourceUnavailable||!Array.isArray(normalized))
  return <div role="alert">
   <p className="screen-note">{directory.error||"A required roster, schedule, day-type or session source is unavailable. No employee is marked absent, unconfigured or started on incomplete evidence."}</p>
   <button className="btn btn-ghost btn-sm" type="button" onClick={()=>setReload(v=>v+1)}>Retry roster verification</button>
  </div>;
 const scheduleAttention=normalized.filter(row=>row.active!==false&&["schedule_unconfigured","schedule_source_unavailable"].includes(row.category)).length;
 const attention=normalized.filter(row=>workforceTodayReviewNeedsReview(row.category)).length;
 const started=normalized.filter(row=>row.started&&!row.sessionEvidenceUnavailable).length;
 const linked=normalized.filter(row=>Boolean(row.profileId)&&Boolean(row.employeeId)).length;
 const unlinked=normalized.filter(row=>!row.profileId&&Boolean(row.employeeId)).length;
 const matching=normalized.filter(row=>{
  if(text.trim()&&!((row.name||"")+" "+(row.unit||"")).toLocaleLowerCase().includes(text.trim().toLocaleLowerCase()))return false;
  if(view==="review")return workforceTodayReviewNeedsReview(row.category);
  if(view==="started")return row.category==="recorded_start";
  if(view==="leave")return row.category==="approved_leave";
  return true;
 });
 return <div className="ev2wf-today-review" style={{display:"grid",gap:12,minWidth:0}} aria-label="Workforce factual evidence review queue">
  {overview&&<div className="timeleave-summary" aria-label="Time and leave summary">
   <div><span>Requests to review</span><strong>{requestsToReview??"Unavailable"}</strong><small>Includes requests awaiting a Manager</small></div>
   <div><span>Approved leave today</span><strong>{approvedToday??"Unavailable"}</strong><small>Recorded approved requests</small></div>
   <div><span>Schedules need attention</span><strong>{scheduleAttention}</strong><small>Not an absence finding</small></div>
  </div>}
  {overview&&renderPlanner?.({scheduleAttention})}
  {overview&&<h2>Recorded work sessions · today</h2>}
  <div className="ev2wf-today-review-summary" style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,flexWrap:"wrap",padding:"10px 12px",border:"1px solid var(--ev2-line,var(--line))",borderRadius:8}}>
   <strong>{attention} contexts to review</strong>
   <span>{started} recorded start{started===1?"":"s"} · {linked} linked HR roster · {unlinked} without login · {normalized.length} records (including unmatched accounts)</span>
  </div>
  <div className="ev2wf-today-review-controls" style={{display:"flex",flexWrap:"wrap",gap:12}}>
   <label className="small" style={{flex:"1 1 170px",minWidth:0}}>Review filter
    <select className="field" value={view} aria-label="Filter daily workforce records" onChange={e=>setView(e.target.value)}>
     {OPTIONS.map(([id,label])=><option key={id} value={id}>{label}</option>)}
    </select>
   </label>
   <label className="small" style={{flex:"2 1 200px",minWidth:0}}>Find employee or unit
    <input className="field" type="search" aria-label="Find workforce evidence" value={text} onChange={e=>setText(e.target.value)}/>
   </label>
  </div>
  {!matching.length&&<p className="screen-note" role="status">No authorised records match this filter. Missing evidence is not an attendance finding.</p>}
  <div className="ev2wf-today-review-list tbl-scroll timeleave-register" role="region" aria-label="Daily employee session register" tabIndex={0}>
   <table className="tbl" aria-label="Recorded work sessions today">
    <thead><tr><th scope="col">Person</th><th scope="col">Scheduled</th><th scope="col">Recorded start</th><th scope="col">State</th><th scope="col">Action</th></tr></thead>
    <tbody>{matching.map(row=><tr key={row.employeeId||"profile:"+row.profileId} className="ev2wf-today-review-entry">
     <th scope="row">{row.name||"Employee"}<small>{row.unit||"Unit not recorded"}</small>{!row.profileId&&<small>No CEAC login account</small>}</th>
     <td>{row.dayType||"Not configured"}{row.clockLabel&&<small>{row.clockLabel}</small>}</td>
     <td>{row.started?localTime(row.firstStart):row.profileId?"No start recorded":"No login account"}</td>
     <td>{LABELS[row.category]||"Evidence unavailable"}</td>
     <td>
      {["schedule_unconfigured","no_login_account"].includes(row.category)&&row.employeeId&&onSchedule&&
       <button type="button" className="btn btn-ghost btn-sm" onClick={()=>onSchedule(row.employeeId)}>Review week</button>}
      {row.profileId&&onSessions&&
       <button type="button" className="btn btn-ghost btn-sm" onClick={()=>onSessions(row.profileId)}>Inspect sessions</button>}
     </td>
    </tr>)}</tbody>
   </table>
  </div>
  <p className="screen-note">Roster facts, account access, approved schedules and recorded sessions are separate sources. “Needs review” does not establish absence, lateness, discipline, payroll consequences or a KPI score.</p>
 </div>;
}

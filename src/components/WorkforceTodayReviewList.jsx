import {useMemo,useState} from "react";
import {workforceTodayReviewCategory,workforceTodayReviewNeedsReview} from "../lib/workforceTodayReview";
import "./WorkforceTodayReviewList.css";

const OPTIONS=[
 ["review","Needs review"],
 ["started","Recorded starts"],
 ["leave","Approved leave"],
 ["all","All linked"],
];
const LABELS={
 evidence_unavailable:"Session evidence unavailable",
 schedule_unconfigured:"Schedule not configured",
 no_session_recorded:"No session recorded",
 recorded_start:"Recorded start",
 approved_leave:"Approved leave",
 no_session_expected:"No work session scheduled",
};
function localTime(value) {
 if(!value)return "Not recorded";
 const date=new Date(value);
 return Number.isFinite(date.valueOf())
  ?date.toLocaleTimeString("en-GB",{timeZone:"Africa/Accra",hour:"2-digit",minute:"2-digit"})
  :"Recorded time unavailable";
}

/** Compact review of actual authorised linked-account facts; no automatic findings. */
export default function WorkforceTodayReviewList({rows=[],onSchedule,onSessions}){
 const [text,setText]=useState(""),[view,setView]=useState("review");
 const normalized=useMemo(()=>rows.map(row=>({
  ...row, category:workforceTodayReviewCategory(row),
 })).sort((a,b)=>Number(workforceTodayReviewNeedsReview(b.category))-Number(workforceTodayReviewNeedsReview(a.category))
  ||String(a.name).localeCompare(String(b.name))),[rows]);
 const attention=normalized.filter(r=>workforceTodayReviewNeedsReview(r.category)).length;
 const started=normalized.filter(r=>r.category==="recorded_start").length;
 const matching=normalized.filter(row=>{
  if(text.trim()&&!((row.name||"")+" "+(row.unit||"")).toLocaleLowerCase().includes(text.trim().toLocaleLowerCase()))return false;
  if(view==="review")return workforceTodayReviewNeedsReview(row.category);
  if(view==="started")return row.category==="recorded_start";
  if(view==="leave")return row.category==="approved_leave";
  return true;
 });
 return <div className="ev2wf-today-review" aria-label="Workforce factual evidence review queue">
  <div className="ev2wf-today-review-summary">
   <strong>{attention} to review</strong>
   <span>{started} recorded starts · {normalized.length} account-linked employees in this view</span>
  </div>
  <div className="ev2wf-today-review-controls">
   <label className="small">Review filter
    <select className="field" value={view} aria-label="Filter daily workforce records" onChange={e=>setView(e.target.value)}>
     {OPTIONS.map(([id,label])=><option key={id} value={id}>{label}</option>)}
    </select>
   </label>
   <label className="small">Find employee or unit
    <input className="field" type="search" aria-label="Find workforce evidence" value={text} onChange={e=>setText(e.target.value)}/>
   </label>
  </div>
  {!matching.length&&<p className="screen-note" role="status">No linked-account records match this review filter. Missing evidence is never an attendance finding.</p>}
  <div className="ev2wf-today-review-list">
   {matching.map(row=><article key={row.profileId} className="ev2wf-today-review-entry">
    <div>
     <strong>{row.name||"Employee"}</strong>
     <span>{row.unit||"Unit not recorded"} · {row.dayType||"Day type not recorded"}</span>
     <small>{row.started?("First start "+localTime(row.firstStart)):"No verified work start shown"}{row.clockLabel?" · Expected "+row.clockLabel:""}</small>
    </div>
    <div className="ev2wf-today-review-decision">
     <span>{LABELS[row.category]}</span>
     {row.category==="schedule_unconfigured"&&onSchedule&&<button type="button" className="btn btn-ghost btn-sm" onClick={onSchedule}>Set week</button>}
     {["no_session_recorded","evidence_unavailable"].includes(row.category)&&onSessions&&<button type="button" className="btn btn-ghost btn-sm" onClick={onSessions}>Inspect sessions</button>}
    </div>
   </article>)}
  </div>
  <p className="screen-note">This list covers authorised linked-account workforce evidence; roster-only employees are managed in the independent People/HR schedule register. “Needs review” denotes missing configuration or evidence, not absence, lateness, a penalty or a KPI score.</p>
 </div>;
}

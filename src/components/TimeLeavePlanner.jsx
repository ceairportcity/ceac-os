import {useState} from "react";
import {leaveCalendarDays,leaveOnCalendarDay} from "../lib/timeLeaveCalendar";
import {leaveStageLabel} from "../lib/leaveDecisionStage";
import "./TimeLeavePlanner.css";

/** Presentation of already-authorised leave rows; existing decision renderers own every action. */
export default function TimeLeavePlanner({rows=[],scope="My",unavailable=false,renderDecision,onOpenLeave,onOpenSessions}){
 const today=new Date().toISOString().slice(0,10);
 const [month,setMonth]=useState(()=>today.slice(0,7)),[day,setDay]=useState(today),[selectedId,setSelectedId]=useState(null),[term,setTerm]=useState("");
 const [year,monthNumber]=month.split("-").map(Number);
 const title=new Date(Date.UTC(year,monthNumber-1,1)).toLocaleDateString("en-GB",{timeZone:"Africa/Accra",month:"long",year:"numeric"});
 const visible=rows.filter(r=>!term||(r.profiles?.full_name||"").toLocaleLowerCase().includes(term.toLocaleLowerCase()));
 const selected=visible.find(r=>r.id===selectedId)||null;
 const pending=visible.filter(r=>["pending","escalated"].includes(r.status));
 const daily=leaveOnCalendarDay(visible,day);
 const shift=amount=>{const next=new Date(Date.UTC(year,monthNumber-1+amount,1)).toISOString().slice(0,7);setMonth(next);setDay(next+"-01");setSelectedId(null);};
 return <section className="timeleave-planner" aria-label={scope+" leave calendar"}>
  <header className="timeleave-heading"><div><span>PLAN TIME · REVIEW REQUESTS</span><h2>{scope} leave calendar</h2><p>Approved leave and requests stay distinct. Pending requests do not reduce balances.</p></div><div className="timeleave-heading-actions"><button type="button" onClick={onOpenLeave}>Leave requests ({unavailable?"—":pending.length})</button><button type="button" onClick={onOpenSessions}>Recorded time →</button></div></header>
  {unavailable?<p role="status" className="timeleave-unavailable">Leave records could not be verified. Retry Workforce data; the calendar does not imply availability.</p>:null}
  <div className="timeleave-layout"><div className="timeleave-calendar">
   <div className="timeleave-month"><div><button type="button" aria-label="Previous leave month" onClick={()=>shift(-1)}>‹</button><strong aria-live="polite">{title}</strong><button type="button" aria-label="Next leave month" onClick={()=>shift(1)}>›</button></div><button type="button" onClick={()=>{setMonth(today.slice(0,7));setDay(today);setSelectedId(null);}}>Today</button></div>
   <div className="timeleave-legend"><span className="is-approved">Approved</span><span className="is-pending">Requested · not approved</span></div>
   <div className="timeleave-weekdays" aria-hidden="true">{["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map(n=><span key={n}>{n}</span>)}</div>
   <div className="timeleave-days" role="group" aria-label={title+" leave dates"}>{leaveCalendarDays(year,monthNumber-1).map(cell=>{
    const records=unavailable?[]:leaveOnCalendarDay(visible,cell.date),approved=records.filter(r=>r.status==="approved").length,requested=records.length-approved;
    return <button type="button" key={cell.date} aria-label={cell.date+(unavailable?" · leave unavailable":` · ${approved} approved · ${requested} requested`)} aria-pressed={day===cell.date} className={[cell.inMonth?"":"is-outside",cell.date===today?"is-today":"",day===cell.date?"is-selected":""].join(" ")} onClick={()=>{setDay(cell.date);setSelectedId(null);}}><time dateTime={cell.date}>{cell.number}</time>{approved?<span className="is-approved">{approved} approved</span>:null}{requested?<span className="is-pending">{requested} requested</span>:null}</button>;
   })}</div>
   <footer>Showing recorded leave only; an empty date is not proof that someone is available.</footer>
  </div><aside className="timeleave-inspector" aria-label="Leave selection and decisions">
   <label>Find employee<input type="search" value={term} onChange={e=>{setTerm(e.target.value);setSelectedId(null);}} placeholder="Search visible requests"/></label>
   {selected?<><div className="timeleave-inspector-heading"><h3>Selected request</h3><button type="button" onClick={()=>setSelectedId(null)}>Back to requests</button></div>{renderDecision?renderDecision(selected):<div className="timeleave-request-detail"><strong>{selected.kind} leave</strong><p>{selected.start_date} → {selected.end_date}</p><p>{selected.status==="approved"?"Approved":leaveStageLabel(selected)}</p><p>{selected.decision_note||"No decision note recorded."}</p><a href="?tab=me">Open My Hub for leave requests and cancellations →</a></div>}</>:<><h3>{day}</h3><p className="timeleave-selection-note">Select a request to view its details and available actions.</p><div className="timeleave-request-list">{daily.map(r=><button type="button" key={r.id} onClick={()=>setSelectedId(r.id)}><strong>{r.profiles?.full_name||"My leave"}</strong><span>{r.kind} · {r.status==="approved"?"Approved":leaveStageLabel(r)}</span></button>)}{!unavailable&&!daily.length?<p>No recorded leave on this date.</p>:null}</div><h3>Requests to review ({unavailable?"—":pending.length})</h3><div className="timeleave-request-list">{!unavailable?pending.map(r=><button type="button" key={r.id} onClick={()=>{setSelectedId(r.id);setDay(r.start_date);setMonth(r.start_date.slice(0,7));}}><strong>{r.profiles?.full_name||"My leave"}</strong><span>{r.kind} · {r.start_date}</span><small>{leaveStageLabel(r)}</small></button>):null}{!unavailable&&!pending.length?<p>No requests waiting in your visible scope.</p>:null}</div></>}
  </aside></div>
 </section>;
}

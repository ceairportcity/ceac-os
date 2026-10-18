import {useEffect,useRef,useState} from "react";
import {supabase} from "../lib/supabase";
import {reportRange,accraDate} from "../lib/stage2PerformanceFacts";
import "./QuarterlyReviewEventControl.css";

const today=()=>accraDate(new Date().toISOString());
/** One official quarterly ministry review event, not a second HR appraisal.
 * Protected HR case/reviewer assignment and publication remain separate.
 */
export default function QuarterlyReviewEventControl({me}){
 const date=today();
 const [year,setYear]=useState(Number(date.slice(0,4)));
 const [quarter,setQuarter]=useState(Math.ceil(Number(date.slice(5,7))/3));
 const [title,setTitle]=useState("");
 const [purpose,setPurpose]=useState("");
 const [meetingOn,setMeetingOn]=useState("");
 const [dueOn,setDueOn]=useState("");
 const [rows,setRows]=useState([]);
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false);
 // A schedule insert must not fire twice before React re-renders busy.
 const creationPending=useRef(false);
 const [error,setError]=useState("");
 const [unavailable,setUnavailable]=useState(false);
 const [open,setOpen]=useState(false);
 const allowed=Boolean(me.is_exec) || (Boolean(me.is_admin) &&
   ((me.capabilities||[]).includes("performance.admin")||
    (me.capability_grants||[]).some(g=>g.capability==="performance.admin"&&!g.scope_unit_id)));
 const range=reportRange(year,"quarter",quarter);

 useEffect(()=>{
  let valid=true;
  (async()=>{
   setLoading(true);setError("");
   try{
    const response=await supabase.from("quarterly_ministry_review_events")
      .select("id,title,purpose,starts_on,ends_on,meeting_on,unit_submission_due_on,state,initiated_at")
      .eq("org_id",me.org_id).order("starts_on",{ascending:false}).limit(16);
    if(!valid)return;
    if(response.error){
      if(["42P01","PGRST205"].includes(response.error.code))setUnavailable(true);
      else setError("Quarterly review events could not be verified for your account.");
    } else {setUnavailable(false);setRows(response.data||[]);}
   }catch{if(valid)setError("Quarterly review records could not be loaded.");}
   finally{if(valid)setLoading(false);}
  })();
  return()=>{valid=false;};
 },[me.id,me.org_id]);

 async function create(){
  if(!allowed||busy||creationPending.current||!meetingOn||!dueOn||meetingOn<range.end||dueOn<range.start||dueOn>meetingOn||title.trim().length<5||purpose.trim().length<12)return;
  creationPending.current=true;
  setBusy(true);setError("");
  try{
   const result=await supabase.from("quarterly_ministry_review_events").insert({
     org_id:me.org_id,starts_on:range.start,ends_on:range.end,
     meeting_on:meetingOn,unit_submission_due_on:dueOn,title:title.trim(),
     purpose:purpose.trim(),initiated_by:me.id,
   }).select("id,title,purpose,starts_on,ends_on,meeting_on,unit_submission_due_on,state,initiated_at").single();
   if(result.error)throw result.error;
   if(!result.data?.id||result.data.starts_on!==range.start||result.data.ends_on!==range.end)
     throw new Error("The quarterly review creation could not be verified. Recheck the schedule before submitting again.");
   setRows(old=>[result.data,...old.filter(row=>row.id!==result.data.id)].sort((a,b)=>String(b.starts_on).localeCompare(String(a.starts_on))));
   setOpen(false);setTitle("");setPurpose("");setMeetingOn("");setDueOn("");
  }catch(e){setError(e?.message||"The quarterly review creation is uncertain. Check the schedule before trying again.");}
  finally{creationPending.current=false;setBusy(false);}
 }

 if(!allowed)return null;
 return <section className="s2-quarter-events" aria-label="Quarterly leadership review schedule">
   <header><div><span>Governance</span><h2>Quarterly ministry review</h2>
     <p>Executive or authorised Administration opens the official leadership review. HR retains independent control of employee appraisals and publication.</p></div>
     {!unavailable&&<button type="button" className="s2-quarter-events-action" onClick={()=>setOpen(v=>!v)}>{open?"Close":"Schedule quarterly review"}</button>}
   </header>
   {loading&&<p role="status">Checking review events…</p>}
   {unavailable&&<p>Quarterly review scheduling awaits the approved Stage 2 migration. No meeting has been created.</p>}
   {error&&<p role="alert" className="s2-quarter-events-error">{error}</p>}
   {open&&!unavailable&&<form className="s2-quarter-events-form" onSubmit={e=>{e.preventDefault();create();}}>
     <label>Year <input type="number" min="2000" max="2200" value={year} onChange={e=>setYear(Number(e.target.value))} required /></label>
     <label>Quarter <select value={quarter} onChange={e=>setQuarter(Number(e.target.value))}>{[1,2,3,4].map(q=><option value={q} key={q}>Q{q}</option>)}</select></label>
     <p className="s2-quarter-events-range">{range.start} to {range.end} · Africa/Accra</p>
     <label>Presentation meeting date <input type="date" min={range.end} value={meetingOn} onChange={e=>setMeetingOn(e.target.value)} required /></label>
     <label>Department submission deadline <input type="date" min={range.start} max={meetingOn||undefined} value={dueOn} onChange={e=>setDueOn(e.target.value)} required /></label>
     <label className="s2-quarter-events-wide">Meeting title <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Quarterly ministry performance review" required /></label>
     <label className="s2-quarter-events-wide">Purpose and expected decisions <textarea rows={3} value={purpose} onChange={e=>setPurpose(e.target.value)} required /></label>
     <p className="s2-quarter-events-wide">Scheduling does not invent submitted departmental results, employee scores, completed HR cases or verified outcomes. It does not automatically publish appraisals.</p>
     <button type="submit" className="s2-quarter-events-action" disabled={busy||!meetingOn||!dueOn||dueOn<range.start||dueOn>meetingOn||meetingOn<range.end||title.trim().length<5||purpose.trim().length<12}>{busy?"Scheduling…":"Open quarterly review"}</button>
   </form>}
   {!loading&&!unavailable&&!error&&<div className="s2-quarter-events-list">
    {!rows.length&&<p>No quarterly ministry review event has been scheduled.</p>}
    {rows.map(event=><article key={event.id}><strong>{event.title}</strong>
      <small>{event.starts_on} → {event.ends_on} · {event.state}</small>
      <p>{event.purpose}</p>
      <span>Unit reports due {event.unit_submission_due_on} · Leadership meeting {event.meeting_on}</span>
    </article>)}
   </div>}
 </section>;
}

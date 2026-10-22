import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { OperationalFileList } from "./OperationalFiles";
import { ghanaCalendarDate } from "../lib/dailyLandscape";
import {validRoutineDate} from "../lib/routineDateRoute";
import { readRoutineSchedulePreview } from "../lib/readRoutineSchedulePreview";
import { readRoutineDateProgress, routineEvidenceLinks } from "../lib/routineDateProgress";
import RoutineSingleDateException from "./RoutineSingleDateException";

const labels={in_progress:"In progress",waiting_on:"Waiting on",ready_for_review:"Ready for review"};
/** One dated routine history, never the master task's checklist/completion. */
export default function RoutineDateProgress({me,item,routine,steps,canRecord=false,canManageDates=false,initialDate=null}) {
 const [date,setDate]=useState(()=>validRoutineDate(initialDate)||ghanaCalendarDate());
 const [history,setHistory]=useState([]),[verified,setVerified]=useState("");
 const [dateScheduleState,setDateScheduleState]=useState("");
 const [error,setError]=useState(""),[writeError,setWriteError]=useState("");
 const [status,setStatus]=useState("in_progress"),[done,setDone]=useState([]);
 const [note,setNote]=useState(""),[links,setLinks]=useState("");
 const [busy,setBusy]=useState(false),[reload,setReload]=useState(0);
 const [limit,setLimit]=useState(5);
 const [historyOpen,setHistoryOpen]=useState(false);
 const scope=me.org_id+":"+me.id+":"+item.id+":"+routine.id+":"+date;
 const current=useRef(scope); current.current=scope;
 const sending=useRef(false);
 const ready=verified===scope && !error;
 const rows=ready?history:[];
 const permitted=canRecord && dateScheduleState!=="skipped" && routine.active && !routine.paused_at && item.visibility==="unit" && !item.confidential;
 const stepKey=steps.map(step=>step.id+":"+step.label).join("|");
 useEffect(()=>{
  let active=true;
  setHistory([]);setVerified("");setDateScheduleState("");setError("");setWriteError("");setLimit(5);setHistoryOpen(false);
  setDone([]);setNote("");setLinks("");setStatus("in_progress");
  (async()=>{
   try {
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Choose a valid scheduled date.");
    const dates=await readRoutineSchedulePreview(supabase,[item.id],{fromDate:date,throughDate:date});
    if(dates.length!==1 || dates[0].operationId!==routine.id)
     throw new Error("This date is not scheduled for this responsibility.");
    if(dates[0].state==="skipped"){
      if(!active)return;
      setDateScheduleState("skipped");setHistory([]);setVerified(scope);return;
    }
    setDateScheduleState(dates[0].state);
    const result=await readRoutineDateProgress(supabase,{orgId:me.org_id,operationId:routine.id,date});
    if(!active) return;
    setHistory(result);
    const last=result[0];
    setDone((last?.completed_step_ids||[]).filter(id=>steps.some(step=>step.id===id)));
    setStatus(last?.status||"in_progress");setNote(last?.note||"");setLinks((last?.evidence_links||[]).join("\n"));
    setVerified(scope);
   } catch(cause) { if(active) {setError(cause.message||"This date's progress could not be verified.");setVerified(scope);} }
  })();
  return()=>{active=false;};
 },[scope,stepKey,reload]);
 async function save(event) {
  event.preventDefault();
  if(!ready || !permitted || busy || sending.current) return;
  const requestScope=scope;
  sending.current=true;setBusy(true);setWriteError("");
  try {
   const expected=(rows[0]?.entry_number||0)+1;
   const result=await supabase.from("routine_date_progress").insert({
    org_id:me.org_id,operation_id:routine.id,scheduled_on:date,entry_number:expected,actor_id:me.id,
    status,completed_step_ids:done,note:note.trim()||null,evidence_links:routineEvidenceLinks(links),
   }).select("id,org_id,operation_id,scheduled_on,entry_number,actor_id").single();
   if(result.error) throw result.error;
   if(!result.data?.id || result.data.org_id!==me.org_id || result.data.operation_id!==routine.id
    || result.data.scheduled_on!==date || result.data.entry_number!==expected || result.data.actor_id!==me.id)
    throw new Error("Save could not be verified. Refresh this date before trying again.");
   if(current.current===requestScope) {setVerified("");setReload(n=>n+1);}
  } catch(cause) {if(current.current===requestScope) setWriteError(cause.message||"Progress could not be saved. Refresh this date before trying again.");}
  finally {sending.current=false;if(current.current===requestScope) setBusy(false);}
 }
 return <section className="s2-routine-review" aria-label="Progress for a routine date" style={{padding:12,gap:10,marginTop:12}}>
  <h3 style={{margin:0,fontSize:14}}>Progress for one date</h3>
  <label className="small">Scheduled date<input className="field" type="date" value={date}
   disabled={busy} onChange={event=>setDate(event.target.value)} /></label>
  {verified!==scope && <p role="status">Checking this scheduled date…</p>}
  {error && verified===scope && <p role="alert">{error}</p>}
  <button type="button" className="text-action" disabled={busy} onClick={()=>setReload(n=>n+1)}>Refresh date</button>
  <RoutineSingleDateException me={me} operationId={routine.id} workItemId={item.id} date={date}
    canManage={canManageDates} onChanged={()=>setReload(n=>n+1)} />
  {ready && <>
   <p className="small">{dateScheduleState==="skipped"?"This occurrence was explicitly skipped. No progress or outcome is implied.":rows.length?labels[rows[0].status]:"No progress recorded for this date."} · Record the outcome separately when this date is finished.</p>
   {permitted && <form className="s2-routine-review-form" onSubmit={save}>
    <fieldset disabled={busy} style={{border:0,padding:0,margin:0,minWidth:0,display:"grid",gap:8}}><legend>Checklist for {date}</legend>
     {steps.length?steps.map(step=><label key={step.id} style={{display:"flex",gap:8,alignItems:"start"}}>
      <input type="checkbox" checked={done.includes(step.id)} onChange={event=>setDone(previous=>event.target.checked?[...previous,step.id]:previous.filter(id=>id!==step.id))} />{step.label}
     </label>):<p className="small">No repeat steps are defined for this responsibility.</p>}
    </fieldset>
    <label>Status for this date<select className="field" value={status} disabled={busy} onChange={event=>setStatus(event.target.value)}>
     {Object.entries(labels).map(([key,label])=><option key={key} value={key}>{label}</option>)}
    </select></label>
    <label>Progress note<textarea className="field" rows={2} maxLength={2500} value={note} disabled={busy} onChange={event=>setNote(event.target.value)} /></label>
    <label>Evidence links, one per line<textarea className="field" rows={2} value={links} disabled={busy} onChange={event=>setLinks(event.target.value)} /></label>
    {writeError && <p role="alert">{writeError}</p>}
    <button className="btn btn-sm" disabled={busy || Boolean(writeError) || status==="waiting_on" && note.trim().length<3 || status==="ready_for_review" && done.length!==steps.length}>
     {busy?"Saving date progress…":"Save date progress"}
    </button>
   </form>}
   {rows[0] && <OperationalFileList key={rows[0].id} contextType="routine_date_progress" contextId={rows[0].id}
    relation="routine_evidence" title={"Evidence files for "+date} emptyText="No files attached to this update."
    canUpload={permitted && rows[0].actor_id===me.id && !busy && !writeError} />}
   {rows.length>0 && <details onToggle={event=>setHistoryOpen(event.currentTarget.open)}><summary>{rows.length} recorded {rows.length===1?"update":"updates"} for {date}</summary>
    {historyOpen && rows.slice(0,limit).map(row=><article className="s2-routine-review-row" key={row.id}>
     <div><strong>{labels[row.status]} · Update {row.entry_number}</strong>
      <p className="small"><time dateTime={row.recorded_at}>{new Date(row.recorded_at).toLocaleString("en-GB")}</time>{row.actor_id===me.id?" · Recorded by you":" · "+(row.actor?.full_name||"Author details unavailable")}</p>
      <ul>{row.checklist_snapshot.map(step=><li key={step.id}>{step.done?"Done":"Not recorded"} · {step.label}</li>)}</ul>
      {row.note && <p>{row.note}</p>}
      {row.id!==rows[0].id && <OperationalFileList contextType="routine_date_progress" contextId={row.id}
       relation="routine_evidence" title={"Files attached to update "+row.entry_number} />}
      {row.evidence_links.map(link=><p key={link} style={{overflowWrap:"anywhere"}}><a href={link} target="_blank" rel="noopener noreferrer">{link}</a></p>)}
     </div>
    </article>)}
    {limit<rows.length && <button type="button" className="text-action" onClick={()=>setLimit(n=>n+5)}>Show earlier updates</button>}
   </details>}
  </>}
 </section>;
}

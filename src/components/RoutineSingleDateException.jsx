import {useEffect,useRef,useState} from "react";
import {supabase} from "../lib/supabase";
import {validRoutineDate} from "../lib/routineDateRoute";
import {ghanaCalendarDate} from "../lib/dailyLandscape";

/**
 * An organisational routine can skip/restore one date without rewriting the
 * recurring schedule. Server independently checks tenant, actor, due schedule,
 * recorded evidence and the expected revision. No client role grants.
 */
export default function RoutineSingleDateException({me,operationId,workItemId,date,canManage=false,onChanged}) {
 const [history,setHistory]=useState([]),[state,setState]=useState("loading");
 const [reason,setReason]=useState(""),[error,setError]=useState("");
 const [busy,setBusy]=useState(false),[reload,setReload]=useState(0);
 const generation=useRef(0),sending=useRef(false);
 const context=[me.org_id,me.id,operationId,workItemId,date].join(":");
 useEffect(()=>{
  const token=++generation.current;setHistory([]);setState("loading");setError("");setReason("");
  if(!canManage||!validRoutineDate(date)){setState("unavailable");return()=>{generation.current++;};}
  (async()=>{
   try{
    const result=await supabase.from("routine_date_exceptions")
      .select("id,version,action,reason,actor_id,recorded_at",{count:"exact"})
      .eq("org_id",me.org_id).eq("operation_id",operationId).eq("scheduled_on",date)
      .order("version",{ascending:false}).range(0,199);
    if(result.error||!Array.isArray(result.data)||!Number.isInteger(result.count)
      ||result.count!==result.data.length||result.data.some(row=>!row.version||!["skip","restore"].includes(row.action)))
     throw new Error("This date's full change history is unavailable. No change is permitted.");
    if(token!==generation.current)return;
    setHistory(result.data);setState("verified");
   }catch(e){if(token===generation.current){setState("unavailable");setError(e.message||"This date could not be verified.");}}
  })();
  return()=>{generation.current++;};
 },[context,canManage,reload]);
 if(!canManage)return null;
 const current=history[0]||null,skipped=current?.action==="skip";
 const today=ghanaCalendarDate();
 const futureOrToday=Boolean(validRoutineDate(date)&&date>=today&&date<=(()=>{let d=new Date(today+"T00:00:00Z");d.setUTCDate(d.getUTCDate()+370);return d.toISOString().slice(0,10);})());
 const canSubmit=state==="verified"&&futureOrToday&&!busy&&reason.trim().length>=8;
 async function save(){
  if(!canSubmit||sending.current)return;
  const token=generation.current,expected=current?.version||0,action=skipped?"restore":"skip";
  sending.current=true;setBusy(true);setError("");
  try{
   const result=await supabase.rpc("routine_change_single_date",{
    p_work_item_id:workItemId,p_scheduled_on:date,p_action:action,
    p_reason:reason.trim(),p_expected_version:expected,
   });
   if(result.error)throw result.error;
   if(result.data?.work_item_id!==workItemId||result.data?.scheduled_on!==date
     ||result.data?.action!==action||result.data?.version!==expected+1
     ||result.data?.recorded_by!==me.id)
     throw new Error("The server did not confirm the expected date change.");
   if(token===generation.current){setState("loading");setReload(x=>x+1);onChanged?.();}
  }catch(e){if(token===generation.current)setError(e.message||"Date change was not accepted.");}
  finally{sending.current=false;if(token===generation.current)setBusy(false);}
 }
 return <section aria-label="One-date routine exception" style={{border:"1px solid var(--ev2-line,var(--line))",padding:12,borderRadius:9,marginTop:12}}>
  <h4 style={{margin:"0 0 5px"}}>One-date schedule exception</h4>
  <p className="screen-note">This affects only {date}. It does not change other routine dates, a completed outcome, or the official recurring pattern.</p>
  {state==="loading"&&<p role="status">Checking date history…</p>}
  {state==="verified"&&<>
   <p className="screen-note">{skipped?"Date skipped by an authorised person":"Date remains scheduled"} · {history.length?history.length+" recorded change"+(history.length===1?"":"s"):"No exceptions recorded"}</p>
   <label className="small">Reason for {skipped?"restoring":"skipping"} this date
    <textarea className="field" rows={2} maxLength={2000} value={reason} onChange={event=>setReason(event.target.value)}/>
   </label>
   <button type="button" className="btn btn-sm" disabled={!canSubmit} onClick={save}>{busy?"Recording change…":skipped?"Restore this date":"Skip this date"}</button>
   {history.length>0&&<details style={{marginTop:10}}><summary>Reasoned exception history</summary>
    {history.map(event=><article key={event.id} className="screen-note">
      {event.action==="skip"?"Skipped":"Restored"} · version {event.version}
      <time dateTime={event.recorded_at}> · {new Date(event.recorded_at).toLocaleString("en-GB",{timeZone:"Africa/Accra"})}</time>
      <p>{event.reason}</p>
    </article>)}
   </details>}
  </>}
  {state==="verified"&&!futureOrToday&&<p className="screen-note">Only today or future scheduled dates can be changed. Earlier records remain historical.</p>}
  {error&&<p role="alert">{error}</p>}
  {state==="unavailable"&&<button type="button" className="btn btn-ghost btn-sm" onClick={()=>setReload(n=>n+1)}>Retry verifying date</button>}
 </section>;
}

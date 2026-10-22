import {useEffect,useRef,useState} from "react";
import {supabase} from "../lib/supabase";
import {ghanaCalendarDate} from "../lib/dailyLandscape";
import {routineCoverLabel} from "../lib/routineDateCovers";
export default function RoutineDateCover({me,item,date,cover,verified,canManage=false,hasEvidence=false,onChanged}){
 const [people,setPeople]=useState([]),[peopleReady,setPeopleReady]=useState(false);
 const [target,setTarget]=useState(""),[reason,setReason]=useState(""),[error,setError]=useState("");
 const [busy,setBusy]=useState(false),[retry,setRetry]=useState(0);
 const scope=[me.org_id,me.id,item.id,date,cover?.version||0].join(":");
 const current=useRef(scope);current.current=scope;const sending=useRef(false);
 useEffect(()=>{
  let active=true;setPeople([]);setPeopleReady(false);setTarget("");setReason("");setError("");setBusy(false);
  if(!canManage)return()=>{active=false;};
  (async()=>{try{
   const members=await supabase.from("unit_memberships").select("profile_id",{count:"exact"}).eq("org_id",me.org_id).eq("unit_id",item.unit_id);
   if(members.error||!Array.isArray(members.data)||members.count!==members.data.length||members.count>500)throw new Error("Eligible cover people could not be verified.");
   const ids=[...new Set(members.data.map(row=>row.profile_id))];
   if(!ids.length){if(active){setPeople([]);setPeopleReady(true);}return;}
   const [profiles,employment]=await Promise.all([
    supabase.from("profiles").select("id,full_name",{count:"exact"}).eq("org_id",me.org_id).eq("active",true).in("id",ids),
    supabase.from("employment_records").select("profile_id",{count:"exact"}).eq("org_id",me.org_id).eq("employment_status","active").in("profile_id",ids),
   ]);
   if([profiles,employment].some(result=>result.error||!Array.isArray(result.data)||result.count!==result.data.length))throw new Error("Eligible cover people could not be verified.");
   const eligible=new Set(employment.data.map(row=>row.profile_id));
   if(active){setPeople(profiles.data.filter(row=>eligible.has(row.id)&&row.id!==item.assignee_id).sort((a,b)=>a.full_name.localeCompare(b.full_name)));setPeopleReady(true);}
  }catch(cause){if(active)setError(cause.message||"Cover people are unavailable.");}})();
  return()=>{active=false;};
 },[scope,canManage,item.unit_id,retry]);
 const covered=cover?.action==="assign";
 const eligibleDate=date>=ghanaCalendarDate();
 async function save(restore){
  if(sending.current||busy||!verified||!canManage||!peopleReady||hasEvidence||!eligibleDate||reason.trim().length<8
   ||!restore&&!people.some(person=>person.id===target))return;
  const requestScope=scope;const assignee=restore?null:target;const revision=cover?.version||0;
  sending.current=true;setBusy(true);setError("");
  try{
   const result=await supabase.rpc("routine_set_date_cover",{p_work_item_id:item.id,p_scheduled_on:date,p_assignee_id:assignee,p_reason:reason.trim(),p_expected_version:revision});
   if(result.error)throw result.error;
   if(result.data?.work_item_id!==item.id||result.data?.scheduled_on!==date||result.data?.assignee_id!==assignee||result.data?.version!==revision+1||result.data?.recorded_by!==me.id)
    throw new Error("The date assignment could not be confirmed. Refresh before retrying.");
   if(current.current===requestScope)onChanged?.();
  }catch(cause){if(current.current===requestScope)setError(cause.message||"Date cover was not saved.");}
  finally{sending.current=false;if(current.current===requestScope)setBusy(false);}
 }
 return <section aria-label="Cover for this routine date" style={{borderTop:"1px solid var(--ev2-line,var(--line))",paddingTop:10,marginTop:10}}>
  <h4 style={{margin:"0 0 6px"}}>Cover for {date}</h4>
  {!verified?<p role="status">Checking this date assignment…</p>:<>
   <p className="small">{covered?routineCoverLabel(cover,me):"Using the series assignment"}. Other dates keep their own assignment.</p>
   {canManage&&<details><summary>Arrange or restore date cover</summary>
    {hasEvidence?<p className="small">Recorded work keeps its actual contributor. This date can no longer be reassigned.</p>:!eligibleDate?<p className="small">Past date assignments remain historical.</p>:<div style={{display:"grid",gap:8,marginTop:8}}>
     <label>Cover person<select className="field" value={target} disabled={busy||!peopleReady} onChange={event=>setTarget(event.target.value)}>
      <option value="">Choose an active department colleague</option>{people.map(person=><option key={person.id} value={person.id}>{person.full_name}</option>)}
     </select></label>
     <label>Reason for date cover<textarea className="field" rows={2} maxLength={2000} value={reason} disabled={busy} onChange={event=>setReason(event.target.value)}/></label>
     <button type="button" className="btn btn-sm" disabled={busy||!peopleReady||!target||reason.trim().length<8} onClick={()=>save(false)}>{busy?"Saving cover…":"Assign date cover"}</button>
     {covered&&<button type="button" className="text-action" disabled={busy||!peopleReady||reason.trim().length<8} onClick={()=>save(true)}>Restore series assignment</button>}
    </div>}
   </details>}
   {cover?.history.length>0&&<details><summary>Assignment history</summary>{[...cover.history].reverse().map(event=><article key={event.id} className="small" style={{marginTop:8}}>
    <strong>{event.action==="assign"?"Cover: "+(event.assignee?.full_name||"assigned colleague"):"Series assignment restored"}</strong>
    <p>{event.reason}</p><p>{event.actor?.full_name||"Author details unavailable"} · <time dateTime={event.recorded_at}>{new Date(event.recorded_at).toLocaleString("en-GB",{timeZone:"Africa/Accra"})}</time></p>
   </article>)}</details>}
  </>}
  {error&&<p role="alert">{error}</p>}{canManage&&!peopleReady&&error&&<button type="button" className="text-action" onClick={()=>setRetry(n=>n+1)}>Retry cover people</button>}
 </section>;
}

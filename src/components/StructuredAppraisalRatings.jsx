import { useEffect,useRef,useState } from "react";
import {supabase} from "../lib/supabase";
import {HUMAN_RUBRIC,VALID_RATINGS,validateHumanAppraisal} from "../lib/stage2PerformanceFacts";
import "./StructuredAppraisalRatings.css";

const empty=()=>({rating:"",reason:"",evidenceIds:[]});
const initial=()=>Object.fromEntries(HUMAN_RUBRIC.map(c=>[c.key,empty()]));
function ratingLabel(value){return ({1:"Below expectations",2:"Partially meets",3:"Meets",4:"Exceeds",5:"Exceptional","N/O":"Not observed / not applicable"})[value]||"Not selected";}
const isUnavailable=(error)=>["42P01","PGRST205","42703"].includes(error?.code);

/** Works on EXISTING appraisal/cycle/evidence and HR release engine.
 * Rating rows are append-only; their source Manager narrative must be
 * independently HR-released before the employee can see it.
 */
export default function StructuredAppraisalRatings({me,review,cycle,evidence,assessment,isReviewer,isHR,onSaved}){
 const cadence=cycle?.stage2_cadence;
 const [rows,setRows]=useState([]);
 const [reload,setReload]=useState(0);
 const [loading,setLoading]=useState(true);
 const [unavailable,setUnavailable]=useState(false);
 const [error,setError]=useState("");
 const [busy,setBusy]=useState(false);
 // Append-only confidential ratings/HR exceptions may not double-submit.
 const ratingMutationPending=useRef(false);
 const [open,setOpen]=useState(false);
 const [categories,setCategories]=useState(initial);
 const [overall,setOverall]=useState("");
 const [narrative,setNarrative]=useState("");
 const [strengths,setStrengths]=useState("");
 const [challenges,setChallenges]=useState("");
 const [actions,setActions]=useState("");
 const [exceptionKind,setExceptionKind]=useState("");
 const [exceptionReason,setExceptionReason]=useState("");
 const [exceptions,setExceptions]=useState([]);

 useEffect(()=>{
   let active=true;
   setLoading(true);setRows([]);setExceptions([]);setUnavailable(false);setError("");setOpen(false);
   (async()=>{
     try{
       const [ratingResult,exceptionsResult]=await Promise.all([
         supabase.from(me.id === review.profile_id
           ? "stage2_employee_published_human_ratings"
           : "appraisal_human_rating_versions")
           .select("id,appraisal_id,assessment_entry_id,profile_id,reviewer_id,cadence,rubric_version,category_ratings,overall_rating,overall_narrative,strengths,challenges,next_actions,created_at")
           .eq("appraisal_id",review.id).order("created_at",{ascending:false}),
         isHR?supabase.from("appraisal_review_exceptions")
           .select("id,reason_kind,reason,authorised_by,created_at").eq("appraisal_id",review.id)
           :Promise.resolve({data:[],error:null}),
       ]);
       if(!active)return;
       const failure=ratingResult.error||exceptionsResult.error;
       if(failure){
         if(isUnavailable(failure))setUnavailable(true);
         else setError("This protected rating record could not be read. No ratings were inferred.");
       }else{setRows(ratingResult.data||[]);setExceptions(exceptionsResult.data||[]);}
     }catch{if(active)setError("Protected rating records could not be verified.");}
     finally{if(active)setLoading(false);}
   })();
   return()=>{active=false};
 },[review.id,me.id,isHR,reload]);

 const recorded=rows.find(x=>x.assessment_entry_id===assessment?.id);
 const ratingDraft=HUMAN_RUBRIC.some(d=>categories[d.key].rating);
 const form={periodKind:cadence,employeeId:review.profile_id,reviewerId:me.id,
   categories,overall:{rating:overall},narrative,strengths,challenges,actions};
 const validation=validateHumanAppraisal(form);
 // Unavailable confidential history is unknown, never proof no rating exists.
 const versionsVerified=!loading&&!unavailable&&!error;
 const canEdit=versionsVerified&&isReviewer&&review.manager_id===me.id&&review.profile_id!==me.id &&
   !["closed","shared"].includes(review.status) && (cadence==="month"||cadence==="quarter") && !recorded;
 const selection=evidence.filter(x=>x.id);
 const ratingOptions=VALID_RATINGS.map(value=><option key={value} value={value}>{value} · {ratingLabel(value)}</option>);

 async function save(){
  if(busy||ratingMutationPending.current||!canEdit||!assessment?.id||!ratingDraft||!validation.valid)return;
  ratingMutationPending.current=true;
  setBusy(true);setError("");
  let recorded=false;
  try{
    const result=await supabase.from("appraisal_human_rating_versions").insert({
      org_id:me.org_id,appraisal_id:review.id,assessment_entry_id:assessment.id,
      profile_id:review.profile_id,reviewer_id:me.id,cadence,
      rubric_version:1,category_ratings:Object.fromEntries(
        HUMAN_RUBRIC.filter(x=>categories[x.key].rating).map(x=>[x.key,categories[x.key]])),
      overall_rating:overall||null,overall_narrative:narrative.trim()||null,
      strengths:strengths.trim()||null,challenges:challenges.trim()||null,next_actions:actions.trim()||null,
    });
    if(result.error)throw result.error;
    recorded=true;
    setOpen(false);
    setReload(n=>n+1);
    await onSaved?.();
  }catch(e){
    setError(recorded
      ? "Ratings were recorded, but refreshing the review failed. Reopen the review before changing anything."
      : "The protected ratings could not be confirmed. Check recorded versions before trying again.");
  }finally{
    ratingMutationPending.current=false;
    setBusy(false);
  }
 }
 async function saveException(){
   if(busy||ratingMutationPending.current||!versionsVerified||!isHR||!exceptionKind||exceptionReason.trim().length<12)return;
   ratingMutationPending.current=true;
   setBusy(true);setError("");
   let recorded=false;
   try{
     const result=await supabase.from("appraisal_review_exceptions").insert({
       org_id:me.org_id,appraisal_id:review.id,reason_kind:exceptionKind,
       reason:exceptionReason.trim(),authorised_by:me.id,
     });
     if(result.error)throw result.error;
     recorded=true;
     setExceptions(old=>[...old,{id:exceptionKind,reason_kind:exceptionKind,reason:exceptionReason}]);
     setExceptionKind("");setExceptionReason("");
     await onSaved?.();
   }catch(e){
     setError(recorded
       ? "The HR exception was recorded, but refreshing the review failed."
       : "The HR exception could not be confirmed. Recheck the exception history before trying again.");
   }finally{
     ratingMutationPending.current=false;
     setBusy(false);
   }
 }

 return <section className="s2-rating-section" aria-label="Human-entered Manager appraisal ratings">
  <header><div><span className="s2-rating-eyebrow">Human assessment</span>
   <h3>Structured Manager review</h3>
   <p>{cadence==="quarter"?"Quarterly ratings and explanations are required before HR can publish this formal review.":cadence==="month"?"Monthly structured ratings are optional.":"This legacy or non-calendar review does not automatically require the Stage 2 rubric."} No rating is calculated from attendance, task counts or machine judgement.</p></div>
   {canEdit&&<button className="btn btn-ghost btn-sm" type="button" onClick={()=>setOpen(v=>!v)}>{open?"Close editor":"Enter ratings"}</button>}</header>
  {loading&&<p role="status">Checking protected review versions…</p>}
  {unavailable&&<p role="status">Structured ratings await the approved Stage 2 database migration. Existing confidential appraisal records remain unchanged.</p>}
  {error&&<p role="alert" className="s2-rating-error">{error}</p>}
  {!loading&&(unavailable||error)&&<button type="button" className="btn btn-ghost btn-sm" disabled={busy||ratingMutationPending.current} onClick={()=>setReload(n=>n+1)}>Retry protected review verification</button>}
  {!loading&&!unavailable&&!error&&!rows.length&&<p>No human-entered structured ratings are available to your account for this review.</p>}
  {recorded&&<div className="s2-rating-summary">
    <div className="s2-rating-overall"><span>Reviewer-selected overall</span><strong>{recorded.overall_rating||"Not entered"}</strong><small>{recorded.overall_narrative||"Monthly overall rating not entered"}</small></div>
    {HUMAN_RUBRIC.map(d=>recorded.category_ratings?.[d.key]&&<div key={d.key}><strong>{d.label}: {recorded.category_ratings[d.key].rating}</strong><p>{recorded.category_ratings[d.key].reason}</p><small>Evidence references: {(recorded.category_ratings[d.key].evidenceIds||[]).length}</small></div>)}
    <p><strong>Strengths:</strong> {recorded.strengths||"Not recorded"} · <strong>Challenges:</strong> {recorded.challenges||"Not recorded"} · <strong>Next actions:</strong> {recorded.next_actions||"Not recorded"}</p>
    <small>Recorded {recorded.created_at?.slice(0,16).replace("T"," ")} UTC. Independent HR approval controls employee publication; this is not an automated score.</small>
  </div>}
  {canEdit&&!assessment&&<p>Record a Manager-authored narrative assessment first; then attach its independently selected category ratings and evidence.</p>}
  {canEdit&&open&&<div className="s2-rating-form">
    <p>One rating per observed category, with a specific reason and an actual evidence link. Choose N/O with an explanation if the category cannot fairly be assessed.</p>
    {HUMAN_RUBRIC.map(d=><div className="s2-rating-row" key={d.key}>
      <strong>{d.label}</strong>
      <label>Human rating <select aria-label={`${d.label}: human rating`} value={categories[d.key].rating} onChange={e=>setCategories(x=>({...x,[d.key]:{...x[d.key],rating:e.target.value}}))}>
        <option value="">Not entered</option>{ratingOptions}
      </select></label>
      <label>Explanation <textarea aria-label={`${d.label}: explanation`} value={categories[d.key].reason} rows={2} placeholder="Specific observation, not a generic grade" onChange={e=>setCategories(x=>({...x,[d.key]:{...x[d.key],reason:e.target.value}}))}/></label>
      <label>Evidence from this review <select aria-label={`${d.label}: evidence`} value={categories[d.key].evidenceIds[0]||""} onChange={e=>setCategories(x=>({...x,[d.key]:{...x[d.key],evidenceIds:e.target.value?[e.target.value]:[]}}))}>
        <option value="">No evidence chosen</option>
        {selection.map(ev=><option value={ev.id} key={ev.id}>{ev.label||ev.category||"Evidence"} · {ev.occurred_on||"undated"}</option>)}
      </select></label>
    </div>)}
    <div className="s2-rating-overall-form">
      <label>Overall rating (chosen by Manager, NEVER averaged) <select value={overall} onChange={e=>setOverall(e.target.value)}>
        <option value="">Not entered</option>{ratingOptions}
      </select></label>
      <label>Overall narrative <textarea rows={3} value={narrative} onChange={e=>setNarrative(e.target.value)} /></label>
      <label>Strengths <textarea rows={2} value={strengths} onChange={e=>setStrengths(e.target.value)} /></label>
      <label>Challenges <textarea rows={2} value={challenges} onChange={e=>setChallenges(e.target.value)} /></label>
      <label>Next actions <textarea rows={2} value={actions} onChange={e=>setActions(e.target.value)} /></label>
    </div>
    {!validation.valid&&<p className="s2-rating-hint" role="status">{validation.errors.slice(0,4).join(" · ")}</p>}
    <button className="btn" type="button" disabled={busy||!assessment||!ratingDraft||!validation.valid} onClick={save}>{busy?"Saving…":"Record human ratings"}</button>
  </div>}
  {versionsVerified&&isHR&&cadence==="quarter"&&!["closed","shared"].includes(review.status)&&<details className="s2-rating-hr-exception">
    <summary>Independent HR review exception</summary><p>Used only for attributable non-response or reviewer absence/conflict. This never creates a false employee response or rating.</p>
    {exceptions.map(x=><p key={x.id}><strong>{x.reason_kind.replaceAll("_"," ")}:</strong> {x.reason}</p>)}
    <label>Exception reason <select value={exceptionKind} onChange={e=>setExceptionKind(e.target.value)}>
      <option value="">Select</option><option value="employee_nonresponse">Employee non-response</option><option value="reviewer_absence">Reviewer absence</option><option value="reviewer_conflict">Reviewer conflict</option>
    </select></label>
    <label>Attributable HR explanation <textarea rows={3} value={exceptionReason} onChange={e=>setExceptionReason(e.target.value)} /></label>
    <button className="btn btn-ghost" type="button" disabled={busy||!versionsVerified||!exceptionKind||exceptionReason.trim().length<12} onClick={saveException}>Record HR exception</button>
  </details>}
 </section>;
}

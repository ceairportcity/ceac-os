import {useEffect, useRef, useState} from "react";
import {supabase} from "../lib/supabase";
import {LoadingState, ProductNotice} from "./bits";
import {WorkDetailHeader, WorkDetailSection, WorkDetailCopy} from "../experience-v2/work-family/WorkFamilyV2";
import {humanError} from "../lib/productLanguage";

/** Organisation inspection is a separate, limited surface. It never mounts
 * the owner's diary, checklist, progress recorder or assignment editor.
 * Existing database RLS remains the authority for each read and shared room.
 */
export default function ExecutiveWorkReview({id, me, back, openRoom}) {
  const [item,setItem]=useState(null),[loading,setLoading]=useState(true),[error,setError]=useState("");
  const [opened,setOpened]=useState(false),[submission,setSubmission]=useState(null),[reading,setReading]=useState(false),[submissionError,setSubmissionError]=useState("");
  const [reload,setReload]=useState(0);
  const pending=useRef(false),generation=useRef(0);
  useEffect(()=>{
    const request=++generation.current;
    setLoading(true);setError("");setItem(null);setOpened(false);setSubmission(null);setSubmissionError("");pending.current=false;
    (async()=>{
      try {
        const result=await supabase.from("work_items")
          .select("id,org_id,ref,title,kind,status,due_at,expected_outcome,unit_id,project_id")
          .eq("id",id).eq("org_id",me.org_id).single();
        if(result.error)throw result.error;
        if(!result.data||result.data.id!==id||result.data.org_id!==me.org_id)throw new Error("This work summary is unavailable.");
        if(request===generation.current)setItem(result.data);
      }catch(e){if(request===generation.current)setError(humanError(e,"This work summary could not be opened."));}
      finally{if(request===generation.current)setLoading(false);}
    })();
    return()=>{generation.current++;};
  },[id,me.org_id,me.id,reload]);
  async function openSubmission(){
    if(!item||pending.current)return;
    const request=generation.current;pending.current=true;setReading(true);setSubmissionError("");setOpened(true);
    try{
      const result=await supabase.from("submissions")
        .select("id,work_item_id,profile_id,note,submitted_at,profiles!submissions_profile_id_fkey(full_name),submission_files(url)")
        .eq("work_item_id",item.id).order("submitted_at",{ascending:false}).limit(1);
      if(result.error)throw result.error;
      if(request===generation.current)setSubmission(result.data?.[0]||null);
    }catch(e){if(request===generation.current)setSubmissionError(humanError(e,"The submitted outcome could not be opened."));}
    finally{if(request===generation.current){pending.current=false;setReading(false);}}
  }
  if(loading)return <div className="body"><LoadingState label="Opening work summary…"/></div>;
  if(error)return <div className="body"><button className="back" onClick={back}>← Back</button><ProductNotice tone="error" title="Work summary unavailable" action={<button type="button" className="btn" onClick={()=>setReload(n=>n+1)}>Try again</button>}>{error}</ProductNotice></div>;
  return <div className="body ev2-work-detail" aria-label="Work review">
    <WorkDetailHeader refCode={item.ref} kind={item.kind} title={item.title} context="Outcome review" due={item.due_at ? `Due ${new Date(item.due_at).toLocaleDateString("en-GB",{timeZone:"Africa/Accra",day:"numeric",month:"short",year:"numeric"})}` : "No due date recorded"} status={item.status} onBack={back}/>
    <p className="screen-note">Review only · Private working activity and completion checklists are not shown here.</p>
    {item.expected_outcome&&<WorkDetailSection title="Expected outcome"><WorkDetailCopy>{item.expected_outcome}</WorkDetailCopy></WorkDetailSection>}
    <WorkDetailSection title="Submitted outcome">
      {!opened&&<button type="button" className="btn" onClick={openSubmission}>View submitted outcome</button>}
      {reading?<LoadingState label="Opening submitted outcome…"/>:submissionError?<ProductNotice tone="error" title="Submitted outcome unavailable" action={<button type="button" className="btn" onClick={openSubmission}>Try again</button>}>{submissionError}</ProductNotice>:opened&&<>
        {submission?<>
          <p className="screen-note">Submitted by {submission.profiles?.full_name||"the responsible person"}{submission.submitted_at?` · ${new Date(submission.submitted_at).toLocaleDateString("en-GB",{timeZone:"Africa/Accra",day:"numeric",month:"short",year:"numeric"})}`:""}</p>
          <WorkDetailCopy>{submission.note||"No written summary accompanied this submission."}</WorkDetailCopy>
          {(submission.submission_files||[]).filter(file=>/^https:\/\//i.test(file.url||"")).map((file,index)=><p key={`${file.url}:${index}`}><a href={file.url} target="_blank" rel="noreferrer">Open submitted evidence {index+1}</a></p>)}
        </>:<p className="screen-note">No submitted outcome is available.</p>}
        {openRoom&&(item.project_id||item.unit_id)&&<button type="button" className="btn btn-ghost" onClick={()=>openRoom({...(item.project_id?{kind:"project",projectId:item.project_id}:{kind:"unit",unitId:item.unit_id}),reference:{object_type:"work_item",object_id:item.id,label:`${item.ref} · ${item.title}`}})}>Discuss in shared room</button>}
      </>}
    </WorkDetailSection>
  </div>;
}

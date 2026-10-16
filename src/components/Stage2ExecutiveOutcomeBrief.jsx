import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import {
  ReportingEvidenceCard, ReportingEvidenceGrid, ReportingEmpty,
  ReportingRecordRow, ReportingSection,
} from "../experience-v2/reporting-family/ReportingFamilyV2";
import "./Stage2ExecutiveOutcomeBrief.css";

/** Executive facts are independently scoped by the existing tenant/RLS model.
 * Work completed is recorded, NOT a verified objective or HR appraisal.
 * A live view cannot pretend to be a frozen quarterly submission.
 */
const unique = (rows) => [...new Map(rows.filter((r) => r?.id).map((r) => [r.id,r])).values()];
const completed = new Set(["completed","self_certified"]);
async function fetchAuthorised(build,label){
  const data=[];
  // Enforce exhaustive reads; no imaginary totals if the query hits a limit.
  for(let at=0;at<10000;at+=500){
    const res=await build().range(at,at+499);
    if(res.error)throw new Error(label+" could not be verified.");
    data.push(...res.data||[]);
    if((res.data||[]).length<500)return unique(data);
  }
  throw new Error(label+" exceeds the bounded authorised reporting query. Totals withheld.");
}

export default function Stage2ExecutiveOutcomeBrief({ me, period, units = [] }) {
  const [projects,setProjects] = useState([]);
  const [objectives,setObjectives] = useState([]);
  const [work,setWork] = useState([]);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState("");
  const [show,setShow] = useState("all");
  const [retry,setRetry] = useState(0);

  useEffect(()=>{
    let active=true;
    (async()=>{
      setLoading(true);setError("");setProjects([]);setObjectives([]);setWork([]);
      try{
        if(!period){if(active)setLoading(false);return;}
        const [p,o,w]=await Promise.all([
          fetchAuthorised(()=>supabase.from("projects")
            .select("id,name,purpose,status,lead_unit_id,starts_on,ends_on")
            .eq("org_id",me.org_id).order("id"),"Project records"),
          fetchAuthorised(()=>supabase.from("objectives")
            .select("id,project_id,name,ref,status,target_value,target_unit,achieved_value")
            .eq("org_id",me.org_id).order("id"),"Objective records"),
          fetchAuthorised(()=>supabase.from("work_items")
            .select("id,ref,title,project_id,unit_id,assignee_id,status,completed_at,created_at,due_at")
            .eq("org_id",me.org_id).neq("visibility","private").order("id"),"Contribution records"),
        ]);
        if(active){setProjects(p);setObjectives(o);setWork(w);}
      }catch(e){if(active)setError(String(e?.message||"Outcome evidence could not be verified."));}
      finally{if(active)setLoading(false);}
    })();
    return()=>{active=false;};
  },[me.org_id,period?.id,retry]);

  const facts=useMemo(()=>{
    const registered=projects.filter((p)=>
      (!p.starts_on||p.starts_on<=period?.ends_on) && (!p.ends_on||p.ends_on>=period?.starts_on));
    const ids=new Set(registered.map((p)=>p.id));
    const relevantObjectives=objectives.filter((x)=>ids.has(x.project_id));
    const worked=work.filter((x)=>ids.has(x.project_id)
      && x.completed_at && x.completed_at.slice(0,10)>=period?.starts_on
      && x.completed_at.slice(0,10)<=period?.ends_on
      && completed.has(x.status));
    const people=new Set(worked.map((x)=>x.assignee_id).filter(Boolean));
    const linked=new Set(worked.map((x)=>x.project_id));
    const byProject=registered.map((p)=>{
      const selected=worked.filter((x)=>x.project_id===p.id);
      const objectiveRows=relevantObjectives.filter((x)=>x.project_id===p.id);
      const lead=units.find((u)=>u.id===p.lead_unit_id);
      return {p,lead:lead?.name||"Unit unavailable",
        contributorCount:new Set(selected.map((x)=>x.assignee_id).filter(Boolean)).size,
        workCount:selected.length,objectives:objectiveRows,
        currentStatus:String(p.status||"Not recorded").replaceAll("_"," ")};
    });
    return {projects:registered,objectives:relevantObjectives,contributedProjects:linked.size,
      workCount:worked.length,personCount:people.size,byProject};
  },[projects,objectives,work,period,units]);
  const filtered=facts.byProject.filter((p)=>show==="all" || (show==="has-work" ? p.workCount>0 : p.workCount===0));

  return <ReportingSection
    eyebrow="Ministry outcome evidence"
    title="Recorded projects, objectives and individual contributions"
    description="These are distinct source-record facts within the reporting period, separate from how many units filed. A completed task or recorded objective status is not independent verification of a ministry outcome.">
    {loading && <p role="status">Verifying current project and Work source records…</p>}
    {error && <p role="alert" className="s2-exec-evidence-error">{error}
      <button type="button" onClick={()=>setRetry((n)=>n+1)}>Retry authorised evidence</button></p>}
    {!loading&&!error&&<>
      <ReportingEvidenceGrid>
        <ReportingEvidenceCard value={String(facts.projects.length)} label="projects overlapping period"
          detail="Distinct registered project IDs, not achievements"/>
        <ReportingEvidenceCard value={String(facts.contributedProjects)} label="projects with completed work"
          detail="Authorised contributor evidence; not verified outcomes"/>
        <ReportingEvidenceCard value={String(facts.workCount)} label="completed work records"
          detail="Distinct work IDs completed in period"/>
        <ReportingEvidenceCard value={String(facts.personCount)} label="distinct recorded contributors"
          detail="Assignees of completed authorised Work records"/>
      </ReportingEvidenceGrid>
      <div className="s2-exec-evidence-filters" aria-label="Project contribution filter">
        <label>Project contribution filter <select aria-label="Project contribution filter" value={show} onChange={(e)=>setShow(e.target.value)}>
          <option value="all">All period projects</option>
          <option value="has-work">With completed work records</option>
          <option value="no-work">Without completed work records</option>
        </select></label>
        <span>{facts.objectives.length} distinct objectives · Targets and measures remain as recorded, not independently certified</span>
      </div>
      {!filtered.length && <ReportingEmpty title="No project records match this filter"
        description="There may be unreported or ongoing activity; this is not a performance judgement." />}
      {!!filtered.length && <div className="s2-exec-evidence-list">
        {filtered.map(({p,lead,workCount,contributorCount,objectives:projectObjectives,currentStatus})=>
          <details key={p.id} className="s2-exec-evidence-project">
            <summary><div><strong>{p.name}</strong><small>{lead} · {currentStatus} · {workCount} completed Work records · {contributorCount} attributed contributors</small></div>
              <span>{projectObjectives.length} objectives</span></summary>
            <div className="s2-exec-evidence-detail">
              <p>{p.purpose||"No recorded purpose."}</p>
              {!projectObjectives.length && <p>No objectives are recorded for this project.</p>}
              {projectObjectives.map((o)=><ReportingRecordRow key={o.id}
                eyebrow={(o.ref||"Objective")+" · status: "+String(o.status||"not recorded").replaceAll("_"," ")}
                title={o.name}
                meta={o.achieved_value===null || o.achieved_value===undefined
                  ? "Actual not recorded"+(o.target_value!==null&&o.target_value!==undefined?" · target "+o.target_value+" "+(o.target_unit||""):"")
                  : "Recorded actual "+o.achieved_value+" "+(o.target_unit||"")+" · target "+(o.target_value??"Not recorded")}
                note="Recorded objective status and measured value require independent evidence before a verified ministry outcome claim." />)}
            </div>
          </details>)}
      </div>}
      <p className="s2-exec-evidence-footnote">This is a live read of currently authorised organisational records and is not a frozen approved quarterly ministry report. It does not expose individual unpublished appraisals, HR narratives, payroll, or employee ratings. Multi-person output is not multiplied across participants.</p>
    </>}
  </ReportingSection>;
}

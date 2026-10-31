import {useEffect,useMemo,useRef} from "react";
import {ministryPeriodEvidence} from "../lib/ministryReportingFacts";
import { verifiedReportingQuarter } from "../lib/quarterlyReportingWindow";
import { DataVizChart } from "../experience-v2/data-viz/DataVizV2";
import "./ExecutiveOutcomeBrief.css";

export default function ExecutiveOutcomeBrief({period,units,issuedReports=[],objectives=[],milestones=[],targets=[],evidenceRefs=[],decisions=[],readError=null}){
 const brief=useRef(null);
 useEffect(()=>{
  const opened=new Set();
  const before=()=>{for(const detail of brief.current?.querySelectorAll("details:not([open])")||[]){opened.add(detail);detail.open=true;}};
  const after=()=>{for(const detail of opened)detail.open=false;opened.clear();};
  window.addEventListener("beforeprint",before);window.addEventListener("afterprint",after);
  return ()=>{window.removeEventListener("beforeprint",before);window.removeEventListener("afterprint",after);after();};
 },[]);
 const facts=useMemo(()=>ministryPeriodEvidence({unitReports:issuedReports,objectives,milestones,targets,evidenceRefs,activeUnitIds:units.map(x=>x.id)}),[issuedReports,objectives,milestones,targets,evidenceRefs,units]);
 const names=Object.fromEntries(units.map(x=>[x.id,x.name]));
 const quarter=verifiedReportingQuarter(period);
 // Visualise the recorded states, never turn filing counts into an appraisal.
 const objectiveStates=[
  ["met","Met"],["on_track","On track"],["partly_met","Partly met"],
  ["at_risk","At risk"],["not_met","Not met"],["draft","Draft"],
 ];
 const objectiveCount=Object.fromEntries(objectiveStates.map(([state])=>[state,0]));
 for(const row of facts.objectives) objectiveCount[row.status||"unrecorded"]=(objectiveCount[row.status||"unrecorded"]||0)+1;
 const objectiveMix=Object.entries(objectiveCount).filter(([,value])=>value>0)
  .map(([state,value])=>({label:objectiveStates.find(([k])=>k===state)?.[1]||state.replaceAll("_"," "),count:value}));
 const milestoneStates=[["achieved","Achieved"],["in_progress","In progress"],["planned","Planned"],["missed","Missed"],["cancelled","Cancelled"]];
 const milestoneCount=Object.fromEntries(milestoneStates.map(([key])=>[key,0]));
 for(const row of facts.milestones) milestoneCount[row.status||"unrecorded"]=(milestoneCount[row.status||"unrecorded"]||0)+1;
 const milestoneMix=Object.entries(milestoneCount).filter(([,value])=>value>0)
  .map(([state,value])=>({label:milestoneStates.find(([k])=>k===state)?.[1]||state.replaceAll("_"," "),count:value}));
 const print=()=>window.print();
 return <section ref={brief} className="s2-exec-brief" aria-label="Executive outcomes briefing">
  <header className="s2-exec-brief-head">
    <div><span>Christ Embassy Airport City · Executive reporting</span><h2>{quarter ? "Quarterly ministry results and next decisions" : "Ministry reporting evidence (custom period)"}</h2>
      <p>{quarter ? quarter.label : period.label} · {period.starts_on} — {period.ends_on}. Issued organisational evidence, not automatic employee scoring.</p>
      <p>Report prepared {new Date().toLocaleDateString("en-GB",{timeZone:"Africa/Accra",day:"numeric",month:"long",year:"numeric"})} · Source records may change after this print.</p></div>
    <button className="s2-exec-brief-print" type="button" disabled={Boolean(readError)||!quarter} onClick={print}>Print / Save as PDF</button>
  </header>
  {!quarter && <p role="status" className="s2-exec-brief-warning">This is not a verified full calendar quarter. Select a quarterly reporting period before printing a quarterly report.</p>}
  {readError?<p role="alert" className="s2-exec-brief-warning">Detailed outcome records could not be verified. No achievement figures have been inferred.</p>:<>
    <div className="s2-exec-brief-stats">
      <article><strong>{facts.filing.submitted} / {facts.filing.visibleUnits}</strong><span>Units with issued report</span><small>Filing status only</small></article>
      <article><strong>{facts.objectives.length}</strong><span>Currently visible objectives</span><small>Not independently verified achievements</small></article>
      <article><strong>{facts.milestones.length}</strong><span>Visible project milestones</span><small>Unique milestones, not additive unit output</small></article>
    </div>
    {(objectiveMix.length>0||milestoneMix.length>0) && <section aria-label="Verified reporting visual summaries" className="s2-exec-brief-charts">
      {objectiveMix.length>0 && <DataVizChart kind="bar" title="Objective status"
        note="Number of visible objectives by their stored status; not a performance rating"
        data={objectiveMix} series={[{key:"count",label:"Objectives"}]} />}
      {milestoneMix.length>0 && <DataVizChart kind="bar" title="Project milestone status"
        note="Unique visible milestones by recorded state; no inferred completion"
        data={milestoneMix} series={[{key:"count",label:"Milestones"}]} />}
    </section>}
    <div className="s2-exec-brief-grid">
      <article className="s2-exec-brief-section">
        <h3>Submitted unit achievements and challenges</h3>
        {!facts.filedReports.length&&<p>No issued unit narratives are available for this period. This does not imply no work occurred.</p>}
        {facts.filedReports.map(report=><div className="s2-exec-brief-unit" key={report.unit_id}>
          <strong>{names[report.unit_id]||"Authorised department"}</strong>
          <small>Issued report v{report.version} · {report.submitted_at?.slice(0,10)||"Submission date unavailable"}</small>
          {report.narrative?<p>{report.narrative}</p>:<p>Achievements narrative not recorded.</p>}
          {report.challenges&&<p><b>Challenges:</b> {report.challenges}</p>}
        </div>)}
      </article>
      <article className="s2-exec-brief-section">
        <h3>Objectives and recorded progress</h3>
        {!facts.objectives.length&&<p>No objective records visible for this reporting context.</p>}
        {facts.objectives.map(o=><div className="s2-exec-brief-objective" key={o.id}>
          <strong>{o.name}</strong><span>{String(o.status||"not_recorded").replaceAll("_"," ")}</span>
          <small>{o.target_value!=null&&o.achieved_value!=null
            ?`Recorded actual ${o.achieved_value} ${o.target_unit||""} / target ${o.target_value} ${o.target_unit||""} — verification not shown`
            :"Target or achieved value not recorded; not zero"}</small>
        </div>)}
      </article>
    </div>
    <details className="s2-exec-brief-milestones"><summary>Project milestone evidence ({facts.milestones.length} unique)</summary>
      {!facts.milestones.length?<p>No milestone records visible.</p>
      :<div>{facts.milestones.map(m=><div key={m.id}><strong>{m.name}</strong>
         <span>{String(m.status||"not_recorded").replaceAll("_"," ")}</span>
         <small>{m.completed_at?"Recorded completion "+m.completed_at.slice(0,10):m.target_on?"Target "+m.target_on:"No recorded date"}</small>
        </div>)}</div>}
    </details>
    <div className="s2-exec-brief-section">
      <h3>Reported targets and following-period proposals</h3>
      {!facts.unitTargets.length&&<p>No quantified unit targets or next-period proposals are attached to the latest issued reports. A new commitment or decision is not implied.</p>}
      {facts.unitTargets.map(target=><div className="s2-exec-brief-unit" key={target.id}>
        <strong>{names[target.unit_id]||"Authorised department"} · {target.name}</strong>
        <small>Issued unit-report target · {target.target_value==null?"Target not recorded":`Target ${target.target_value} ${target.target_unit||""}`}
          {" · "}{target.achieved_value==null?"Achievement not recorded":`Recorded actual ${target.achieved_value} ${target.target_unit||""}`}</small>
        {target.next_target_value!=null&&<p><b>Proposed next-period target:</b> {target.next_target_value} {target.target_unit||""}. A proposed target is not an Executive approval.</p>}
        {target.note&&<p><b>Recorded unit explanation:</b> {target.note}</p>}
      </div>)}
      <h3>Linked evidence references</h3>
      {!facts.unitEvidence.length&&<p>No linked evidence references are attached to the latest issued unit reports.</p>}
      {facts.unitEvidence.map(ref=><div className="s2-exec-brief-unit" key={ref.id}>
        <strong>{names[ref.unit_id]||"Authorised department"} · {ref.label||"Recorded evidence reference"}</strong>
        <small>{String(ref.section||"Unit report").replaceAll("_"," ")} · {String(ref.object_type||"Source record").replaceAll("_"," ")} · reference only, not a source-file verification</small>
      </div>)}
      <h3>Recorded Work decisions within this reporting period</h3>
      {!decisions.length&&<p>No accessible, independently recorded Work decision is available for these period dates. This does not imply that no leadership discussions occurred.</p>}
      {decisions.map(decision=><div className="s2-exec-brief-unit" key={decision.work_item_id}>
        <strong>{names[decision.unit_id]||"Authorised Work scope"} · {decision.work_title||"Recorded Work decision"}</strong>
        <small>Work record · decided {decision.decided_at?.slice(0,10)||"date unavailable"} · separate from quarterly Executive approvals</small>
        <p><b>Recorded decision:</b> {decision.decision_text||"Decision text not recorded"}</p>
        {decision.rationale&&<p><b>Recorded rationale:</b> {decision.rationale}</p>}
      </div>)}
      <h3>Leadership decisions and follow-up</h3>
      <p>Issued department challenges are reproduced above. Unit next-target proposals are proposals, not decisions. This briefing does not invent an Executive decision, approval, accountable owner, funding commitment or due date when no independently approved decision source is connected.</p>
      <p>Human-entered appraisals, attendance findings and KPI approvals remain separate review-controlled evidence. This brief does not convert self-recorded activity or draft ratings into verified ministry outcomes.</p>
    </div>
    <footer><strong>Evidence and scope</strong><p>{facts.coverageNote} {facts.noDoubleCount} This briefing shows current objective/milestone states and released unit narratives visible to this account, not a frozen verified outcome snapshot. Reviewer decisions, attendance and protected HR appraisals are separate.</p></footer>
  </>}
 </section>;
}

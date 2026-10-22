import {useMemo} from "react";
import {ministryPeriodEvidence} from "../lib/ministryReportingFacts";
import { verifiedReportingQuarter } from "../lib/quarterlyReportingWindow";
import "./ExecutiveOutcomeBrief.css";

export default function ExecutiveOutcomeBrief({period,units,issuedReports=[],objectives=[],milestones=[],readError=null}){
 const facts=useMemo(()=>ministryPeriodEvidence({unitReports:issuedReports,objectives,milestones,activeUnitIds:units.map(x=>x.id)}),[issuedReports,objectives,milestones,units]);
 const names=Object.fromEntries(units.map(x=>[x.id,x.name]));
 const quarter=verifiedReportingQuarter(period);
 const print=()=>window.print();
 return <section className="s2-exec-brief" aria-label="Executive outcomes briefing">
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
      <h3>Leadership issues and next-quarter commitments</h3>
      <p>Issues recorded in issued unit reports are shown above under each department's challenges. No independent Executive decision, approval, prioritised commitment or following-quarter plan is published in this evidence source unless recorded through its authoritative workflow.</p>
      <p>Human-entered appraisals, attendance findings and KPI approvals are separate review-controlled evidence. This brief does not convert self-recorded activity or draft ratings into verified ministry outcomes.</p>
    </div>
    <footer><strong>Evidence and scope</strong><p>{facts.coverageNote} {facts.noDoubleCount} This briefing shows current objective/milestone states and released unit narratives visible to this account, not a frozen verified outcome snapshot. Reviewer decisions, attendance and protected HR appraisals are separate.</p></footer>
  </>}
 </section>;
}

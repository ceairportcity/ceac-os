import { DataVizChart } from "../experience-v2/data-viz/DataVizV2";
import "./ExecutiveIntelligence.css";

const sayStatus = (state) => ({
  submitted: "Filed", draft: "Started", waiting: "Not filed",
  on_track: "On track", at_risk: "At risk", not_met: "Not met",
  partly_met: "Partly met", met: "Met", planned: "Planned",
  achieved: "Achieved", missed: "Missed", in_progress: "In progress",
})[state] || String(state || "Not recorded").replaceAll("_", " ");

const shortDate = (date) => date ? new Date(date).toLocaleDateString("en-GB", {
  timeZone: "Africa/Accra", day: "numeric", month: "short", year: "numeric"
}) : "No date recorded";

function SummaryCard({ label, value, detail, onClick }) {
  const Tag = onClick ? "button" : "article";
  return <Tag type={onClick ? "button" : undefined} className={`ceac-exec-metric ${onClick ? "is-action" : ""}`} onClick={onClick}>
    <span>{label}</span><strong>{value}</strong><small>{detail}</small>
    {onClick && <b aria-hidden="true">View details →</b>}
  </Tag>;
}

function DepartmentRow({ row, objectives, available, onClick }) {
  const count = objectives.filter((item) => item.unit_id === row.unit.id).length;
  const needsCare = objectives.filter((item) => item.unit_id === row.unit.id &&
    ["at_risk","not_met"].includes(item.status)).length;
  return <button type="button" className="ceac-exec-unit" onClick={onClick}>
    <span className="ceac-exec-unit-copy"><strong>{row.unit.name}</strong>
      <small>{available ? `${count} recorded ${count === 1 ? "objective" : "objectives"}` : "Objective records unavailable"}</small>
    </span>
    {available && needsCare > 0 && <span className="ceac-exec-caution">{needsCare} need attention</span>}
    <span className={`ceac-exec-unit-status is-${row.state}`}>{sayStatus(row.state)}</span>
    <span aria-hidden="true" className="ceac-exec-unit-arrow">›</span>
  </button>;
}

export default function ExecutiveIntelligence({
  mode = "brief", period, rows = [], sources = {}, readError,
  selectedUnitId = "", onSelectDepartment, onQuarterly, onExplore, onOpenWork,
}) {
  const complete = !readError;
  const objectives = complete ? sources.objectives || [] : [];
  const milestones = complete ? sources.milestones || [] : [];
  const decisions = complete ? sources.decisions || [] : [];
  const issued = complete ? sources.issued || [] : [];
  const filed = rows.filter((row) => row.state === "submitted").length;
  const pending = rows.filter((row) => row.state !== "submitted");
  const atRisk = objectives.filter((row) => ["at_risk","not_met"].includes(row.status));
  const lateMilestones = milestones.filter((row) => row.status === "missed");
  const unitMap = Object.fromEntries(rows.map((row) => [row.unit.id, row.unit.name]));
  const statusCounts = Object.entries(
    objectives.reduce((acc, row) => {const key = sayStatus(row.status);acc[key]=(acc[key]||0)+1;return acc;}, {})
  ).map(([label, count]) => ({ label, count }));
  const milestoneCounts = Object.entries(
    milestones.reduce((acc, row) => {const key = sayStatus(row.status);acc[key]=(acc[key]||0)+1;return acc;}, {})
  ).map(([label, count]) => ({ label, count }));
  const activeUnit = rows.find((row) => row.unit.id === selectedUnitId);
  const currentUnitObjectives = objectives.filter((row) => row.unit_id === selectedUnitId);
  const currentUnitDecisions = decisions.filter((row) => row.unit_id === selectedUnitId);
  const focusLabel = period?.label || "Selected period";

  if (mode === "departments") return <section className="ceac-exec-intelligence">
    <div className="ceac-exec-heading"><div><span>DEPARTMENTS</span><h2>Explore each department</h2>
      <p>See which departments have filed, their recorded objectives and the decisions connected to their work.</p></div></div>
    <div className="ceac-exec-departments">
      <div className="ceac-exec-dept-list" aria-label="Departments">
        {rows.length ? rows.map((row) => <DepartmentRow key={row.unit.id} row={row}
          objectives={objectives} available={complete} onClick={()=>onSelectDepartment?.(row.unit.id)}/>) :
          <p className="ceac-exec-empty">No departments are available for this reporting view.</p>}
      </div>
      <article className="ceac-exec-dept-detail">
        {activeUnit ? <>
          <span className="ceac-exec-eyebrow">Department details</span><h3>{activeUnit.unit.name}</h3>
          <p>Reporting status: <strong>{sayStatus(activeUnit.state)}</strong>. A missing report does not mean no work was done.</p>
          <h4>Recorded objectives</h4>
          {!complete ? <p className="ceac-exec-empty">Objective records are unavailable. {readError}</p> :
            currentUnitObjectives.length ? <ul className="ceac-exec-source-list">{currentUnitObjectives.map((row) =>
              <li key={row.id}><strong>{row.name}</strong><span>{sayStatus(row.status)}</span>
                <small>{row.target_value == null ? "No recorded target" : `Target: ${row.target_value} ${row.target_unit||""}`}</small></li>)}</ul>
              : <p className="ceac-exec-empty">No objectives are recorded for this department.</p>}
          <h4>Recorded decisions in this period</h4>
          {!complete ? <p className="ceac-exec-empty">Decision records are unavailable.</p> :
            currentUnitDecisions.length ? <ul className="ceac-exec-source-list">{currentUnitDecisions.map((d,index)=>
              <li key={d.work_item_id+":"+index}><strong>{d.work_title||"Work decision"}</strong>
                <span>{d.decision_text}</span>
                {onOpenWork && d.work_item_id && <button type="button" onClick={()=>onOpenWork(d.work_item_id)}>Open work</button>}</li>)}</ul> :
              <p className="ceac-exec-empty">No work decisions are recorded for this department in the selected period.</p>}
          {onExplore && <button type="button" className="ceac-exec-link" onClick={onExplore}>Explore recorded work →</button>}
        </> : <div className="ceac-exec-dept-placeholder"><strong>Choose a department</strong>
            <p>Select a department to see its reporting status, objectives and recorded decisions.</p></div>}
      </article>
    </div>
  </section>;

  if (mode === "explore") return <section className="ceac-exec-intelligence">
    <div className="ceac-exec-heading"><div><span>EXPLORE</span><h2>Understand the recorded progress</h2>
      <p>Compare the information CEAC has recorded, then open the work behind it below.</p></div></div>
    {!complete ? <div className="ceac-exec-unavailable" role="status">The detailed records could not be checked completely. No totals are being estimated. {readError}</div> :
      <div className="ceac-exec-analysis-grid">
        {statusCounts.length > 1 ? <DataVizChart kind="bar" title="Objective status"
          note="Current recorded objectives across authorised departments"
          data={statusCounts} series={[{key:"count",label:"Objectives"}]}/> :
          <article className="ceac-exec-insight-card"><h3>Objective status</h3>
            <strong>{objectives.length}</strong><p>{objectives.length === 1 ? "Objective recorded" : "Objectives recorded"}</p>
            <small>{statusCounts.length ? statusCounts[0].label : "No objectives have been recorded."}</small></article>}
        {milestoneCounts.length > 1 ? <DataVizChart kind="bar" title="Project milestone status"
          note="Recorded milestone states. Open project records to understand progress."
          data={milestoneCounts} series={[{key:"count",label:"Milestones"}]}/> :
          <article className="ceac-exec-insight-card"><h3>Project milestones</h3>
            <strong>{milestones.length}</strong><p>Milestones recorded</p>
            <small>{milestoneCounts.length ? milestoneCounts[0].label : "No milestone records are available."}</small></article>}
      </div>}
    <div className="ceac-exec-explore-note"><strong>Explore work and contributions</strong>
      <p>Use the department, project and person filters below to inspect dated work. A recorded activity is not automatically an approved achievement.</p>
    </div>
  </section>;

  return <section className="ceac-exec-intelligence" aria-label="Organisation brief">
    <div className="ceac-exec-heading">
      <div><span>ORGANISATION BRIEF</span><h2>The organisation at a glance</h2>
        <p>{focusLabel} · See the reporting picture first, then open the details that matter.</p></div>
    </div>
    <div className="ceac-exec-metrics">
      <SummaryCard label="Departments that filed" value={`${filed} / ${rows.length}`}
        detail="Official reports received for this period" onClick={onQuarterly}/>
      <SummaryCard label="Reports not yet filed" value={pending.length}
        detail="Includes departments that have started a draft" onClick={onQuarterly}/>
      <SummaryCard label="Recorded objectives" value={complete ? objectives.length : "—"}
        detail="Current recorded status, not an appraisal" onClick={onExplore}/>
      <SummaryCard label="Work decisions" value={complete ? decisions.length : "—"}
        detail="Decisions recorded within this period" onClick={onExplore}/>
    </div>
    {!complete && <div className="ceac-exec-unavailable" role="status">
      Some detailed information could not be checked. Department filing status remains visible, but detailed totals are withheld.
    </div>}
    <div className="ceac-exec-two-col">
      <article className="ceac-exec-panel">
        <div className="ceac-exec-panel-head"><div><span>NEEDS ATTENTION</span><h3>Where to look next</h3></div></div>
        {pending.length === 0 && atRisk.length === 0 && lateMilestones.length === 0 ?
          <p className="ceac-exec-empty">There are no open filing gaps or recorded concerns in this view. This does not replace a full review.</p> : <>
          {pending.slice(0,4).map((row)=><button key={row.unit.id} type="button" className="ceac-exec-alert-row"
            onClick={()=>onSelectDepartment?.(row.unit.id)}><span><strong>{row.unit.name}</strong>
              <small>{row.state==="draft"?"Report started, not yet filed":"No report filed for this period"}</small></span><b>›</b></button>)}
          {atRisk.slice(0,3).map((row)=><button key={row.id} type="button" className="ceac-exec-alert-row"
            onClick={()=>row.unit_id ? onSelectDepartment?.(row.unit_id) : onExplore?.()}><span>
              <strong>{row.name}</strong><small>Objective marked {sayStatus(row.status).toLowerCase()}</small></span><b>›</b></button>)}
          {lateMilestones.length>0 && <div className="ceac-exec-alert-row is-static">
            <span><strong>{lateMilestones.length} missed ${lateMilestones.length===1?"milestone":"milestones"} recorded</strong><small>Explore project milestones for the details</small></span></div>}
          {pending.length>4 && <button type="button" className="ceac-exec-link" onClick={onQuarterly}>See all reporting gaps →</button>}
        </>}
      </article>
      <article className="ceac-exec-panel">
        <div className="ceac-exec-panel-head"><div><span>DEPARTMENT VIEW</span><h3>Reporting across CEAC</h3></div>
          <button type="button" className="ceac-exec-link" onClick={()=>onSelectDepartment?.("")}>All departments →</button></div>
        <div className="ceac-exec-mini-depts">
          {rows.slice(0,7).map((row)=><DepartmentRow key={row.unit.id} row={row} objectives={objectives}
            available={complete} onClick={()=>onSelectDepartment?.(row.unit.id)}/>)}
          {!rows.length && <p className="ceac-exec-empty">No department records are available.</p>}
        </div>
      </article>
    </div>
    <div className="ceac-exec-brief-footer"><p>Filing status, objectives and decisions come from different records. They are not combined into an employee score.</p>
      <button type="button" className="ceac-exec-link" onClick={onExplore}>Explore the evidence →</button></div>
  </section>;
}

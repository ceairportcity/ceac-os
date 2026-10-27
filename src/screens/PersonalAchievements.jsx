import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { ghanaDate, reportingRange, individualAchievementFacts } from "../lib/stage2AchievementMetrics";
import "./PersonalAchievements.css";

const niceDay = (date) => {
  if (!date) return "Not recorded";
  const parsed = typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)
    ? new Date(date+"T12:00:00Z") : new Date(date);
  if (!Number.isFinite(parsed.getTime())) return "Unverified date";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone:"Africa/Accra",year:"numeric",month:"short",day:"numeric"
  }).format(parsed);
};
const status = (state) => String(state||"Not recorded").replaceAll("_"," ");
const longMonth = (value) => new Intl.DateTimeFormat("en-GB", { month:"long",year:"numeric",timeZone:"Africa/Accra" })
  .format(new Date(value+"-15T12:00:00Z"));

/** Self-only factual print view. No private HR entries are ever loaded into this route. */
export default function PersonalAchievements({ me, back, openItem }) {
  const [asOf,setAsOf] = useState(()=>Date.now());
  const today = ghanaDate(new Date(asOf));
  const [cadence,setCadence] = useState("monthly");
  const [period,setPeriod] = useState(today.slice(0,7));
  const [projectId,setProjectId] = useState("");
  const [search,setSearch] = useState("");
  const [contributionView,setContributionView] = useState("list");
  const [works,setWorks] = useState([]);
  const [submissions,setSubmissions] = useState([]);
  const [activities,setActivities] = useState([]);
  const [busy,setBusy] = useState(true);
  const [retryToken,setRetryToken] = useState(0);
  const [error,setError] = useState("");
  const [completeLoad,setCompleteLoad] = useState(false);
  const [loadedKey,setLoadedKey] = useState("");
  const safePeriod = /^\d{4}-(0[1-9]|1[0-2])$/.test(period||"") ? period : today.slice(0,7);
  const range = useMemo(() => reportingRange(cadence, safePeriod+"-01"),[cadence,safePeriod]);
  // A previous employee or period must never briefly display as the new report
  // while the new authorised source read has not yet completed.
  const reportKey = `${me.org_id}:${me.id}:${range.start}:${range.end}`;
  const verifiedLoad = completeLoad && loadedKey===reportKey && !busy && !error;
  const preview = useMemo(() => individualAchievementFacts({
    works, submissions, range, projectId:projectId||null, asOf:new Date(asOf)
  }),[works,submissions,range,projectId,asOf]);
  // Revisions may supersede actions from an earlier reporting period.
  // Resolve the complete contributor history BEFORE applying date filters.
  const supersededActivityIds = useMemo(() => new Set(activities.map((a) => a.supersedes_id).filter(Boolean)),[activities]);
  const periodActions = useMemo(() => activities.filter((a) => !supersededActivityIds.has(a.id)
    && a.activity_date >= range.start && a.activity_date <= range.end),[activities,supersededActivityIds,range.start,range.end]);
  const projects = useMemo(() => {
    const seen=new Map();
    for(const row of works) if(row.project_id) seen.set(row.project_id,{
      id:row.project_id,name:row.projects?.name||"Project name unavailable"
    });
    for(const a of periodActions) if(a.source_project_id) seen.set(a.source_project_id,{
      id:a.source_project_id,name:a.source_project?.name||"Previously linked project"
    });
    return [...seen.values()].sort((a,b)=>a.name.localeCompare(b.name));
  },[works,periodActions]);
  const attributableActions = periodActions.filter((a) => !projectId || a.source_project_id === projectId);
  const evidencedWorkIds = new Set(attributableActions.map((action) => action.work_item_id));
  const contributions = works.filter((w) =>
    (preview.contributions.some((entry) => entry.id === w.id)
      && (!projectId || w.project_id === projectId)) || evidencedWorkIds.has(w.id))
    .filter((w) => !search ||
      [w.title,w.ref,w.projects?.name].some((v) => String(v||"").toLocaleLowerCase().includes(search.toLocaleLowerCase())));

  const activityRows = attributableActions.filter((a) =>
    !search || [a.action_summary,a.work_items?.title,a.work_items?.ref,a.source_project?.name]
      .some((value) => String(value || "").toLowerCase().includes(search.toLowerCase())));
  const activeProjectIds = new Set([...preview.projectIds, ...attributableActions.map((a) => a.source_project_id).filter(Boolean)]);

  // A new employee must not inherit another employee's project filter.
  useEffect(() => { setProjectId(""); }, [me.id,me.org_id]);

  // Live overdue indicators must advance after Ghana midnight and timestamped
  // deadlines without requiring a new sign-in or reloading confidential data.
  useEffect(() => {
    const refresh=()=>setAsOf(Date.now());
    window.addEventListener("focus",refresh);
    document.addEventListener("visibilitychange",refresh);
    const interval=window.setInterval(refresh,60000);
    return()=>{
      window.clearInterval(interval);
      window.removeEventListener("focus",refresh);
      document.removeEventListener("visibilitychange",refresh);
    };
  },[]);

  useEffect(() => {
    let alive=true;
    const fetchAll = async (build) => {
      const found=[];
      // Bound pagination. Fail CLOSED on truncation: never show an inaccurate partial total.
      for(let offset=0;offset<10000;offset+=500) {
        const res=await build().range(offset,offset+499);
        if(res.error) throw res.error;
        // A 2xx provider response without a verified array is not proof that
        // the employee had zero work or evidence in this reporting period.
        if(!Array.isArray(res.data)) throw new Error("The report source returned incomplete records.");
        found.push(...res.data);
        if(res.data.length<500)return found;
      }
      throw new Error("Too many records to verify accurately. Contact Administration for a verified report.");
    };
    (async()=>{
      setBusy(true);setError("");setCompleteLoad(false);setLoadedKey("");setWorks([]);setSubmissions([]);setActivities([]);
      try{
        const [work,proof,activity]=await Promise.all([
          fetchAll(()=>supabase.from("work_items")
            .select("id,ref,title,kind,status,created_at,completed_at,original_due_at,due_at,reschedule_count,first_time_approved,origin,visibility,project_id,projects(name)")
            .eq("assignee_id",me.id).order("created_at",{ascending:false}).order("id",{ascending:false})),
          fetchAll(()=>supabase.from("submissions")
            .select("id,work_item_id,profile_id,note,submitted_at")
            .eq("profile_id",me.id)
            .gte("submitted_at",range.start+"T00:00:00+00:00")
            .lt("submitted_at",new Date(new Date(range.end+"T00:00:00Z").getTime()+86400000).toISOString())
            .order("submitted_at",{ascending:false}).order("id",{ascending:false})),
          fetchAll(()=>supabase.from("work_activity_records")
            .select("id,org_id,work_item_id,contributor_id,activity_date,activity_state,action_summary,outcome_note,next_action,duration_minutes,evidence_url,recorded_at,supersedes_id,source_project_id,source_objective_id,source_project:projects!work_activity_records_source_project_id_fkey(name),work_items!inner(id,ref,title,project_id,projects(name))")
            .eq("org_id",me.org_id).eq("contributor_id",me.id)
            .order("recorded_at",{ascending:false}).order("id",{ascending:false})),
        ]);
        if(alive){setWorks(work);setSubmissions(proof);setActivities(activity);setLoadedKey(reportKey);setCompleteLoad(true);}
      }catch(e){if(alive)setError("Report source records could not be verified. Retry records or contact Administration.");}
      finally{if(alive)setBusy(false);}
    })();
    return()=>{alive=false;};
  },[me.org_id,me.id,range.start,range.end,retryToken]);

  const print = () => { if(verifiedLoad) window.print(); };
  return <main className="body s2-achievement report-print" aria-label="My achievements">
    <header className="s2-achievement-heading">
      <div><span className="s2-achievement-eyebrow">MY WORK / PERSONAL ACHIEVEMENTS</span>
        <h1>My achievements</h1>
        <p>Your attributed work and recorded evidence. Factual reporting is separate from confidential Manager appraisal.</p>
      </div>
      <div className="s2-achievement-actions">
        <button type="button" className="s2-achievement-back" onClick={back}>Back to My Hub</button>
        <button type="button" className="s2-achievement-print" disabled={!verifiedLoad} onClick={print}>
          Print / Save as PDF
        </button>
      </div>
    </header>
    <section className="s2-achievement-filters" aria-label="Report filters">
      <label>Period <select value={cadence} onChange={(e)=>setCadence(e.target.value)}>
        <option value="monthly">Monthly</option><option value="quarterly">Quarterly</option>
      </select></label>
      <label>Month <input aria-label="Reporting month" type="month" value={safePeriod} onChange={(e)=>setPeriod(e.target.value)}
        min="2000-01" max="2099-12"/></label>
      <label>Project <select value={projectId} onChange={(e)=>setProjectId(e.target.value)}>
        <option value="">All my linked projects & work</option>
        {verifiedLoad&&projects.map((p)=><option key={p.id} value={p.id}>{p.name}</option>)}
      </select></label>
      <label>Find contribution <input type="search" placeholder="Title, reference or project" value={search} onChange={(e)=>setSearch(e.target.value)}/></label>
    </section>
    <div className="s2-achievement-print-head">
      <strong>{cadence==="monthly"?longMonth(safePeriod):range.label} · Personal achievement</strong>
      <span>Ghana calendar · {range.start} to {range.end} · Live, not an issued snapshot</span>
      <span>Subject: {me.full_name||me.name||"My authorised CEAC account"} · Generated {niceDay(today)}</span>
    </div>
    {busy && <p role="status">Verifying attributable work and supporting evidence…</p>}
    {error && <section role="alert" className="s2-achievement-error">{error}<button type="button" onClick={()=>setRetryToken((v)=>v+1)}>Retry records</button></section>}
    {!busy && !error && !verifiedLoad && <p role="status">Verifying the selected reporting period…</p>}
    {verifiedLoad && <>
      <div className="s2-achievement-metrics" aria-label="Factual indicators">
        {[
          ["Completed in period",preview.completed.length+"", "Self-certified "+preview.selfCertified.length+" · completed "+preview.completedReviewed.length],
          ["Due during period",preview.due.length+"", preview.cancelled.length+" cancelled commitments excluded"],
          ["Contributions recorded",preview.contributions.length+"", preview.submissions.length+" recorded submissions"],
          ["Distinct projects with recorded evidence",activeProjectIds.size+"", "Unique project IDs from work and activity, not membership"],
        ].map(([label,value,explain])=><article key={label}><span>{label}</span><strong>{value}</strong><small>{explain}</small></article>)}
      </div>
      <div className="s2-achievement-layout">
        <section className="s2-achievement-panel">
          <header><div><h2>My recorded contribution</h2><span>{contributions.length} records · {activityRows.length} dated activities</span></div>
            <div className="s2-achievement-actions" role="group" aria-label="Contribution display">
              {[['list','List'],['table','Table']].map(([key,label])=><button type="button" key={key} aria-pressed={contributionView===key} className={contributionView===key?"s2-achievement-print":""} onClick={()=>setContributionView(key)}>{label}</button>)}
            </div>
          </header>
          {!contributions.length && <p className="s2-achievement-empty">No attributable completion or submission is recorded for these filters. This is not evidence of no work.</p>}
          {contributions.length>0 && contributionView === "table" && <div className="s2-achievement-table-scroll" role="region" aria-label="My contribution table" tabIndex="0"><table><thead><tr>
            <th>Work record</th><th>Current project</th><th>Recorded outcome</th><th>State now</th>
          </tr></thead><tbody>{contributions.map((w)=><tr key={w.id}>
            <td><button type="button" onClick={()=>openItem?.(w.id)}>{w.title}<small>{w.ref}</small></button></td>
            <td>{w.projects?.name||"No linked project"}</td>
            <td>{w.completed_at && preview.completed.some((c)=>c.id===w.id)
              ? "Completed "+niceDay(w.completed_at)
              : "Attributable submission; outcome not independently verified"}</td>
            <td>{status(w.status)}{w.status==="self_certified"?" (self-certified)":""}</td>
          </tr>)}</tbody></table></div>}
          {contributions.length>0 && contributionView === "list" && <div className="s2-achievement-evidence" role="list" aria-label="Recorded contributions">
            {contributions.map(w=><article key={w.id} role="listitem">
              <span>{w.ref}<br/>{status(w.status)}</span>
              <span>{w.projects?.name||"No linked project"}</span>
              <p><button type="button" onClick={()=>openItem?.(w.id)}>{w.title}</button><br/>{w.completed_at && preview.completed.some(c=>c.id===w.id) ? "Completed "+niceDay(w.completed_at) : "Submission recorded · outcome not independently verified"}</p>
            </article>)}
          </div>}
        </section>
        <aside className="s2-achievement-panel s2-achievement-insights">
          <header><h2>Outstanding now</h2><span>Not a retrospective snapshot</span></header>
          <dl>
            <div><dt>Open</dt><dd>{preview.open.length}</dd></div>
            <div><dt>Overdue at generation</dt><dd>{preview.overdueNow.length}</dd></div>
            <div><dt>Returned for correction</dt><dd>{preview.returned.length}</dd></div>
            <div><dt>Waiting / In review</dt><dd>{preview.waiting.length} / {preview.inReview.length}</dd></div>
          </dl>
          <h3>On-time delivery evidence</h3><p>{preview.onTimeDisplay}</p>
          <details><summary>About these figures</summary><h3>Attendance and Compliance</h3><p>These are independently authorised factual records. No attendance or Compliance score is inferred by this personal Work summary.</p>
          <h3>Reporting boundary</h3><p>This is a live view of your current authorised records, not a frozen monthly filing, published HR appraisal or verified organisational output.</p></details>
        </aside>
      </div>
      <section className="s2-achievement-panel s2-achievement-evidence">
        <header><h2>Dated work evidence</h2><span>{activityRows.length} activities · {preview.submissions.length} submissions</span></header>
        {!activityRows.length && <p>No dated personal activities were recorded for these filters.</p>}
        {activityRows.map((a)=><article key={a.id}>
          <time dateTime={a.activity_date}>{niceDay(a.activity_date)}</time>
          <span>{a.work_items?.ref||"Authorised work"} · {a.source_project?.name||"No project at action time"} · {status(a.activity_state)} · Self-recorded, not verified</span>
          <p><strong>{a.action_summary}</strong>{a.outcome_note ? " — "+a.outcome_note : ""}</p>
          {a.next_action && <p><b>Next:</b> {a.next_action}</p>}
          {a.duration_minutes != null && <small>{a.duration_minutes} minutes self-reported; not attendance</small>}
          {a.evidence_url && <a href={a.evidence_url} target="_blank" rel="noopener noreferrer">Open source evidence</a>}
        </article>)}
        {!preview.submissions.length && <p>No submission records for the selected period.</p>}
        {preview.submissions.map((s)=><article key={s.id}>
          <time dateTime={s.submitted_at}>{niceDay(s.submitted_at)}</time>
          <span>{works.find((w)=>w.id===s.work_item_id)?.ref||"Authorised work"}</span>
          <p>{s.note||"No accompanying written note"}</p>
        </article>)}
      </section>
      <p className="s2-achievement-disclaimer">Evidence is attributable to the signed-in user and filtered by current Supabase permissions. No employee rating, comparison, salary, misconduct finding or final project outcome is calculated by this page. Current status is not historical period-end status; issued reports require authorised frozen snapshot and validation.</p>
    </>}
  </main>;
}

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { ghanaDate, reportingRange, individualAchievementFacts } from "../lib/stage2AchievementMetrics";
import "./PersonalAchievements.css";

const niceDay = (date) => date ? new Intl.DateTimeFormat("en-GB",
  { timeZone:"Africa/Accra",year:"numeric",month:"short",day:"numeric" })
  .format(date.length === 10 ? new Date(date+"T12:00:00Z") : new Date(date)) : "Not recorded";
const status = (state) => String(state||"Not recorded").replaceAll("_"," ");
const longMonth = (value) => new Intl.DateTimeFormat("en-GB", { month:"long",year:"numeric",timeZone:"Africa/Accra" })
  .format(new Date(value+"-15T12:00:00Z"));

/** Self-only factual print view. No private HR entries are ever loaded into this route. */
export default function PersonalAchievements({ me, back, openItem }) {
  const today = ghanaDate(new Date());
  const [cadence,setCadence] = useState("monthly");
  const [period,setPeriod] = useState(today.slice(0,7));
  const [projectId,setProjectId] = useState("");
  const [search,setSearch] = useState("");
  const [works,setWorks] = useState([]);
  const [submissions,setSubmissions] = useState([]);
  const [busy,setBusy] = useState(true);
  const [error,setError] = useState("");
  const [completeLoad,setCompleteLoad] = useState(false);
  const range = useMemo(() => reportingRange(cadence, period+"-01"),[cadence,period]);
  const preview = useMemo(() => individualAchievementFacts({
    works, submissions, range, projectId:projectId||null
  }),[works,submissions,range,projectId]);
  const projects = useMemo(() => {
    const seen=new Map();
    for(const row of works) if(row.project_id) seen.set(row.project_id,{
      id:row.project_id,name:row.projects?.name||"Project name unavailable"
    });
    return [...seen.values()].sort((a,b)=>a.name.localeCompare(b.name));
  },[works]);
  const contributions = preview.contributions.filter((w) => !search ||
    [w.title,w.ref,w.projects?.name].some((v) => String(v||"").toLocaleLowerCase().includes(search.toLocaleLowerCase())));

  useEffect(() => {
    let alive=true;
    const fetchAll = async (build) => {
      const found=[];
      // Bound pagination. Fail CLOSED on truncation: never show an inaccurate partial total.
      for(let offset=0;offset<10000;offset+=500) {
        const res=await build().range(offset,offset+499);
        if(res.error) throw res.error;
        found.push(...(res.data||[]));
        if((res.data||[]).length<500)return found;
      }
      throw new Error("Too many records to verify accurately. Narrow the report period or contact Administration.");
    };
    (async()=>{
      setBusy(true);setError("");setCompleteLoad(false);setWorks([]);setSubmissions([]);
      try{
        const [work,proof]=await Promise.all([
          fetchAll(()=>supabase.from("work_items")
            .select("id,ref,title,kind,status,created_at,completed_at,original_due_at,due_at,reschedule_count,first_time_approved,origin,visibility,project_id,projects(name)")
            .eq("assignee_id",me.id).order("created_at",{ascending:false})),
          fetchAll(()=>supabase.from("submissions")
            .select("id,work_item_id,profile_id,note,submitted_at")
            .eq("profile_id",me.id)
            .gte("submitted_at",range.start+"T00:00:00+00:00")
            .lt("submitted_at",new Date(new Date(range.end+"T00:00:00Z").getTime()+86400000).toISOString())
            .order("submitted_at",{ascending:false})),
        ]);
        if(alive){setWorks(work);setSubmissions(proof);setCompleteLoad(true);}
      }catch(e){if(alive)setError("Report source records could not be verified. "+String(e.message||"Please retry."));}
      finally{if(alive)setBusy(false);}
    })();
    return()=>{alive=false;};
  },[me.id,range.start,range.end]);

  const print = () => { if(completeLoad && !error && !busy) window.print(); };
  return <main className="body s2-achievement report-print" aria-label="My achievements">
    <header className="s2-achievement-heading">
      <div><span className="s2-achievement-eyebrow">MY WORK / PERSONAL ACHIEVEMENTS</span>
        <h1>My achievements</h1>
        <p>Your attributed work and recorded evidence. Factual reporting is separate from confidential Manager appraisal.</p>
      </div>
      <div className="s2-achievement-actions">
        <button type="button" className="s2-achievement-back" onClick={back}>Back to work</button>
        <button type="button" className="s2-achievement-print" disabled={busy||!!error||!completeLoad} onClick={print}>
          Print / Save as PDF
        </button>
      </div>
    </header>
    <section className="s2-achievement-filters" aria-label="Report filters">
      <label>Period <select value={cadence} onChange={(e)=>setCadence(e.target.value)}>
        <option value="monthly">Monthly</option><option value="quarterly">Quarterly</option>
      </select></label>
      <label>Month <input aria-label="Reporting month" type="month" value={period} onChange={(e)=>setPeriod(e.target.value)}
        min="2000-01" max="2099-12"/></label>
      <label>Project <select value={projectId} onChange={(e)=>setProjectId(e.target.value)}>
        <option value="">All my linked projects & work</option>
        {projects.map((p)=><option key={p.id} value={p.id}>{p.name}</option>)}
      </select></label>
      <label>Find contribution <input type="search" placeholder="Title, reference or project" value={search} onChange={(e)=>setSearch(e.target.value)}/></label>
    </section>
    <div className="s2-achievement-print-head">
      <strong>{cadence==="monthly"?longMonth(period):range.label} · Personal achievement</strong>
      <span>Ghana calendar · {range.start} to {range.end} · Live, not an issued snapshot</span>
      <span>Subject: {me.full_name||me.name||"My authorised CEAC account"} · Generated {niceDay(today)}</span>
    </div>
    {busy && <p role="status">Verifying attributable work and supporting evidence…</p>}
    {error && <section role="alert" className="s2-achievement-error">{error}<button onClick={()=>setPeriod((p)=>p)}>Retry by changing the reporting month</button></section>}
    {!busy && !error && completeLoad && <>
      <div className="s2-achievement-metrics" aria-label="Factual indicators">
        {[
          ["Completed in period",preview.completed.length+"", "Self-certified "+preview.selfCertified.length+" · completed "+preview.completedReviewed.length],
          ["Due during period",preview.due.length+"", preview.cancelled.length+" cancelled commitments excluded"],
          ["Contributions recorded",preview.contributions.length+"", preview.submissions.length+" recorded submissions"],
          ["Distinct projects contributed to",preview.projectIds.length+"", "From attributable evidence, not membership"],
        ].map(([label,value,explain])=><article key={label}><span>{label}</span><strong>{value}</strong><small>{explain}</small></article>)}
      </div>
      <div className="s2-achievement-layout">
        <section className="s2-achievement-panel">
          <header><h2>My recorded contribution</h2><span>{contributions.length} records</span></header>
          {!contributions.length && <p className="s2-achievement-empty">No attributable completion or submission is recorded for these filters. This is not evidence of no work.</p>}
          {contributions.length>0 && <div className="s2-achievement-table-scroll"><table><thead><tr>
            <th>Work record</th><th>Project</th><th>Recorded outcome</th><th>State now</th>
          </tr></thead><tbody>{contributions.map((w)=><tr key={w.id}>
            <td><button type="button" onClick={()=>openItem?.(w.id)}>{w.title}<small>{w.ref}</small></button></td>
            <td>{w.projects?.name||"No linked project"}</td>
            <td>{w.completed_at && preview.completed.some((c)=>c.id===w.id)
              ? "Completed "+niceDay(w.completed_at)
              : "Attributable submission; outcome not independently verified"}</td>
            <td>{status(w.status)}{w.status==="self_certified"?" (self-certified)":""}</td>
          </tr>)}</tbody></table></div>}
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
          <h3>Attendance and Compliance</h3><p>These are independently authorised factual records. No attendance or Compliance score is inferred by this personal Work summary.</p>
          <h3>Reporting boundary</h3><p>This is a live view of your current authorised records, not a frozen monthly filing, published HR appraisal or verified organisational output.</p>
        </aside>
      </div>
      <section className="s2-achievement-panel s2-achievement-evidence">
        <header><h2>Dated work evidence</h2><span>{preview.submissions.length} recorded submissions</span></header>
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

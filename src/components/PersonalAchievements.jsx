import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { reportRange, personalAchievementSummary, accraDate } from "../lib/stage2PerformanceFacts";
import "./PersonalAchievements.css";

function dateNow() { return accraDate(new Date().toISOString()); }
function exportPrint() { window.print(); }

/** RLS-bound self-service factual achievements. Not the formal HR appraisal.
 * Print/PDF is browser-provided; no personal data is transmitted to a PDF service.
 * Live preview is NOT immutable issued-report history.
 */
export default function PersonalAchievements({ me, onOpenWork }) {
  const now = dateNow();
  const [year,setYear] = useState(Number(now.slice(0,4)));
  const [kind,setKind] = useState("month");
  const [index,setIndex] = useState(Number(now.slice(5,7)));
  const [projectId,setProjectId] = useState("");
  const [query,setQuery] = useState("");
  const [rows,setRows] = useState([]);
  const [projects,setProjects] = useState({});
  const [loading,setLoading] = useState(false);
  const [error,setError] = useState("");
  const [truncated,setTruncated] = useState(false);
  const [generatedAt,setGeneratedAt] = useState(new Date().toISOString());
  const range=useMemo(()=>reportRange(year,kind,index),[year,kind,index]);
  useEffect(()=>{
    let valid=true;
    setLoading(true);setError("");setRows([]);setProjects({});setTruncated(false);
    (async()=>{
      try {
        // This is self-reporting, never a privileged people-search/export.
        const response=await supabase.from("work_items")
          .select("id,ref,title,status,kind,origin,visibility,project_id,created_at,due_at,completed_at,first_time_approved,outcome_note,reschedule_count")
          .eq("assignee_id",me.id)
          .order("created_at",{ascending:false}).limit(1001);
        if(response.error) throw response.error;
        const work=response.data||[];
        if(work.length>1000){if(valid)setTruncated(true);return;}
        if(!valid)return;
        setRows(work);
        const ids=[...new Set(work.map(w=>w.project_id).filter(Boolean))];
        if(ids.length){
          const names=await supabase.from("projects").select("id,name").in("id",ids);
          // If project metadata is unavailable, keep the user's RLS-scoped tasks.
          if(valid && !names.error)setProjects(Object.fromEntries((names.data||[]).map(p=>[p.id,p.name])));
        }
        if(valid)setGeneratedAt(new Date().toISOString());
      }catch(e){
        if(valid)setError("Your achievement records could not be verified. No report was generated.");
      }finally{if(valid)setLoading(false);}
    })();
    return()=>{valid=false;};
  },[me.id]);

  const summary=useMemo(()=>truncated?null:personalAchievementSummary(rows,range,{projectId:projectId||null,generatedAt}),[rows,range,projectId,generatedAt,truncated]);
  const view=useMemo()=>summary?.work.filter(x=>
    (x.title||"").toLocaleLowerCase().includes(query.toLocaleLowerCase()) ||
    (x.ref||"").toLocaleLowerCase().includes(query.toLocaleLowerCase()))||[],[summary,query]);
  const c=summary?.counts;
  const projectChoices=[...new Set(rows.map(x=>x.project_id).filter(Boolean))].sort();
  return <section className="s2-achievements" aria-label="My achievements report">
    <div className="s2-achievements-heading">
      <div><span className="s2-achievements-eyebrow">Personal accountability</span>
        <h2>My achievements</h2><p>Explore your recorded responsibilities by month, quarter or linked project. These facts are not a performance rating.</p></div>
      <button type="button" onClick={exportPrint} disabled={loading||Boolean(error)||truncated||!summary} className="s2-achievements-print">Print / Save PDF</button>
    </div>
    <div className="s2-achievements-filters" aria-label="Achievement report controls">
      <label>Period <select value={kind} onChange={e=>{const next=e.target.value;setKind(next);setIndex(next==="month"?Number(now.slice(5,7)):Math.ceil(Number(now.slice(5,7))/3));}}><option value="month">Monthly</option><option value="quarter">Quarterly</option></select></label>
      <label>Year <select value={year} onChange={e=>setYear(Number(e.target.value))}>{[year-2,year-1,year,year+1].filter((v,i,a)=>a.indexOf(v)===i).map(v=><option key={v} value={v}>{v}</option>)}</select></label>
      <label>{kind==="month"?"Month":"Quarter"} <select value={index} onChange={e=>setIndex(Number(e.target.value))}>{Array.from({length:kind==="month"?12:4},(_,i)=>i+1).map(n=><option value={n} key={n}>{kind==="month"?new Date(Date.UTC(2026,n-1,1)).toLocaleDateString("en-GB",{month:"short",timeZone:"UTC"}):"Q"+n}</option>)}</select></label>
      <label>Project <select value={projectId} onChange={e=>setProjectId(e.target.value)}><option value="">All my recorded work</option>{projectChoices.map(id=><option key={id} value={id}>{projects[id]||"Project · "+id.slice(0,8)}</option>)}</select></label>
      <label className="s2-achievements-search">Search work <input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Title or reference" /></label>
    </div>
    {loading&&<p role="status">Loading your authorised records…</p>}
    {error&&<p role="alert">{error}</p>}
    {truncated&&<p role="alert">This account has more than 1,000 records. Totals and export are disabled until complete paginated reporting is available. Open the Work history for the full record.</p>}
    {!loading&&!error&&!truncated&&summary&&<>
      <header className="s2-achievements-print-header"><h3>{me.full_name} — {range.label}</h3>
        <p>CEAC OS · {range.start} to {range.end} · Africa/Accra · Live as of {generatedAt.slice(0,19).replace("T"," ")} UTC</p>
        {projectId&&<p>Project filter: {projects[projectId]||"Authorised linked project"}</p>}
      </header>
      <div className="s2-achievements-facts" aria-label="Recorded work totals">
        <article><small>Completed in period</small><strong>{c.completed}</strong><span>{c.selfCertified} self-certified; {c.firstReviewApproved} first-review approved</span></article>
        <article><small>Work due in period</small><strong>{c.due}</strong><span>{c.onTimeRatio?`${c.onTime} / ${c.due} due items completed by current deadline`:"No dated commitments; percentage not calculated"}</span></article>
        <article><small>Current open / returned</small><strong>{c.currentlyOpen} / {c.currentlyReturned}</strong><span>{c.currentlyOverdue} currently overdue; not a fault finding</span></article>
        <article><small>Linked projects</small><strong>{c.projectsLinked}</strong><span>Work associations, not verified project outcomes</span></article>
      </div>
      <div className="s2-achievements-live"><strong>Live factual preview, not a frozen issued report.</strong> Reopened work, reassignment and corrected deadlines may change historical totals. Complete status history and verified outcomes require independent review.</div>
      <div className="s2-achievements-table-wrap"><table className="s2-achievements-table"><thead><tr><th>Responsibility</th><th>Project</th><th>Due</th><th>Current status</th><th>Completion recorded</th></tr></thead><tbody>
        {view.map(row=><tr key={row.id}><td>{onOpenWork?<button type="button" onClick={()=>onOpenWork(row.id)}>{row.title}</button>:<strong>{row.title}</strong>}<small>{row.ref} · {row.origin==="self"?"Self-created":row.origin||"Origin not recorded"}</small></td>
          <td>{row.project_id?projects[row.project_id]||"Linked project":"—"}</td>
          <td>{accraDate(row.due_at)||"Not dated"}</td>
          <td>{String(row.status||"Not recorded").replaceAll("_"," ")}</td>
          <td>{accraDate(row.completed_at)||"Not recorded"}</td></tr>)}
      </tbody></table>
      {!view.length&&<p className="s2-achievements-empty">No matching responsibilities recorded for this period.</p>}</div>
      <p className="s2-achievements-caution">Source: your authorised CEAC Work records, deduplicated by unique work-item ID. Evidence and historical approval decisions must be checked in the originating records. Project output is never multiplied by participants; this screen does not contain protected HR appraisal or payroll data.</p>
    </>}
  </section>;
}

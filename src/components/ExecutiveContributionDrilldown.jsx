import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { activityRecordsInPeriod } from "../lib/workActivityVersions";
import "./ExecutiveContributionDrilldown.css";

const normalize = (v) => String(v || "").trim().toLocaleLowerCase();

/** Executive factual project -> department -> person -> dated-action detail.
 * No personal HR ratings, private employee activity, or automatic performance scores. */
export default function ExecutiveContributionDrilldown({ me, period, units, openItem }) {
  const [sourceRows, setSourceRows] = useState([]);
  const [completedEvidenceScope, setCompletedEvidenceScope] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [unitId, setUnitId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [personId, setPersonId] = useState("");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [reload, setReload] = useState(0);
  const start = period?.starts_on || "";
  const end = period?.ends_on || "";
  const evidenceScope = `${me.org_id}:${me.id}:${start}:${end}`;
  const evidenceReady = completedEvidenceScope === evidenceScope && !loading && !error && Boolean(start && end);
  const rows = evidenceReady ? sourceRows : [];
  const evidenceChecking = Boolean(start && end) && (loading || completedEvidenceScope !== evidenceScope);
  const activeError = completedEvidenceScope === evidenceScope ? error : "";

  useEffect(() => {
    let current = true;
    setSourceRows([]); setCompletedEvidenceScope(""); setLoading(Boolean(start && end)); setError("");
    setSelectedId(null); setUnitId(""); setProjectId(""); setPersonId(""); setQuery("");
    if (!start || !end) return () => { current = false; };
    (async () => {
      try {
        const collected = [];
        let expected = null;
        const take = 200;
        for (let index=0;index<60;index++) {
          const offset = index*take;
          const response = await supabase.from("work_activity_records")
            .select("id,org_id,work_item_id,contributor_id,activity_date,activity_state,action_summary,outcome_note,next_action,duration_minutes,evidence_url,recorded_at,supersedes_id,source_project_id,source_objective_id,contributor:profiles!work_activity_records_contributor_id_fkey(full_name),source_project:projects!work_activity_records_source_project_id_fkey(name),work_items!inner(id,ref,title,unit_id,visibility,confidential)", { count:"exact" })
            .eq("org_id",me.org_id)
            .order("recorded_at",{ascending:false}).order("id",{ascending:false})
            .range(offset,offset+take-1);
          if (response.error) throw response.error;
          if (!Array.isArray(response.data) || typeof response.count !== "number" || response.count<0)
            throw new Error("Source evidence is incomplete.");
          if (expected!==null && response.count!==expected)
            throw new Error("Source changed during verification. Reload before using this report.");
          expected=response.count;
          collected.push(...response.data);
          if (collected.length===expected) break;
        }
        if (collected.length!==expected)
          throw new Error("The activity history exceeds the verification limit. Contact Administration for a verified report.");
        if (!current) return;
        setSourceRows(activityRecordsInPeriod(collected, start, end));
      } catch (e) {
        if (current) setError(e?.message || "Executive contribution evidence could not be verified.");
      } finally { if (current) { setCompletedEvidenceScope(evidenceScope); setLoading(false); } }
    })();
    return () => { current=false; };
  }, [me.id,me.org_id,start,end,reload]);

  // The unit is the responsibility's unit; the project is frozen at action time.
  const projects = useMemo(() => {
    const map = new Map();
    rows.filter(a => !unitId || a.work_items?.unit_id === unitId).forEach((a) => {
      if (a.source_project_id) map.set(a.source_project_id, {
        id:a.source_project_id, name:a.source_project?.name || "Authorised project"
      });
    });
    return [...map.values()].sort((a,b)=>a.name.localeCompare(b.name));
  },[rows,unitId]);
  const people = useMemo(() => {
    const map = new Map();
    rows.filter(a => (!unitId || a.work_items?.unit_id===unitId)
      && (!projectId || a.source_project_id===projectId))
      .forEach((a) => map.set(a.contributor_id,{id:a.contributor_id,name:a.contributor?.full_name || "Authorised contributor"}));
    return [...map.values()].sort((a,b)=>a.name.localeCompare(b.name));
  },[rows,unitId,projectId]);

  const visible = useMemo(() => rows.filter((a) =>
    (!unitId || a.work_items?.unit_id===unitId)
    && (!projectId || a.source_project_id===projectId)
    && (!personId || a.contributor_id===personId)
    && (!query || [
      a.action_summary,a.outcome_note,a.work_items?.title,a.work_items?.ref,
      a.contributor?.full_name,a.source_project?.name
    ].some(v=>normalize(v).includes(normalize(query))))
  ).sort((a,b)=>b.activity_date.localeCompare(a.activity_date)||b.recorded_at.localeCompare(a.recorded_at)),[rows,unitId,projectId,personId,query]);
  const selected = visible.find(a=>a.id===selectedId)||visible[0]||null;
  const affectedPeople = new Set(visible.map(a=>a.contributor_id));
  const affectedProjects = new Set(visible.map(a=>a.source_project_id).filter(Boolean));
  const workIds = new Set(visible.map(a=>a.work_item_id));
  const unitName = (id) => units.find(u=>u.id===id)?.name || "Authorised unit";

  return <section className="s2-exec-contrib" aria-label="Individual contribution drill-down">
    <header><div><span className="eyebrow">Source-linked ministry work</span>
      <h2>Project and individual contributions</h2>
      <p>Inspect dated contributions by project, department and person. Entries are self-recorded evidence, not automatically approved outcomes, employee ratings or attendance.</p>
    </div><button type="button" className="btn btn-ghost btn-sm" disabled={loading} onClick={()=>setReload(n=>n+1)}>Refresh evidence</button></header>
    {(!start || !end) && <p role="status">Select a reporting period to inspect recorded contributions.</p>}
    {evidenceChecking && <p role="status">Checking source records and permissions…</p>}
    {activeError && <p role="alert" className="flag flag-amber">{activeError} No partial totals are displayed.</p>}
    {evidenceReady&&<>
      <div className="s2-exec-contrib-facts">
        <div><strong>{visible.length}</strong><span>Dated actions recorded</span></div>
        <div><strong>{workIds.size}</strong><span>Distinct responsibilities</span></div>
        <div><strong>{affectedPeople.size}</strong><span>Contributors with evidence</span></div>
        <div><strong>{affectedProjects.size}</strong><span>Projects with evidence</span></div>
      </div>
      <div className="s2-exec-contrib-controls">
        <label>Department <select value={unitId} onChange={e=>{setUnitId(e.target.value);setProjectId("");setPersonId("");}}><option value="">All authorised units</option>
          {units.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}</select></label>
        <label>Project <select value={projectId} onChange={e=>{setProjectId(e.target.value);setPersonId("");}}><option value="">All projects</option>
          {projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
        <label>Contributor <select value={personId} onChange={e=>setPersonId(e.target.value)}><option value="">All contributors</option>
          {people.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
        <label>Find evidence <input type="search" value={query} placeholder="Responsibility or recorded action" onChange={e=>setQuery(e.target.value)} /></label>
      </div>
      <div className="s2-exec-contrib-layout">
        <div className="s2-exec-contrib-list" aria-label="Source-recorded contributions">
          {visible.length===0&&<p>No contributor actions are recorded for these filters. This does not mean no work took place.</p>}
          {visible.map((a)=><button type="button" key={a.id}
            className={selected?.id===a.id?"s2-exec-contrib-row is-selected":"s2-exec-contrib-row"}
            aria-pressed={selected?.id===a.id} onClick={()=>setSelectedId(a.id)}>
            <time dateTime={a.activity_date}>{a.activity_date}</time>
            <strong>{a.action_summary}</strong>
            <small>{a.contributor?.full_name || "Authorised contributor"} · {unitName(a.work_items?.unit_id)}</small>
            <small>{a.source_project?.name||"No project at action time"} · {a.work_items?.ref}</small>
          </button>)}
        </div>
        <aside className="s2-exec-contrib-inspector" aria-label="Contribution evidence detail">
          {!selected?<p>Select a recorded action to examine its source.</p>:<>
            <span className="eyebrow">Recorded contribution · {selected.activity_date}</span>
            <h3>{selected.action_summary}</h3>
            <dl><div><dt>Person</dt><dd>{selected.contributor?.full_name||"Authorised contributor"}</dd></div>
              <div><dt>Department</dt><dd>{unitName(selected.work_items?.unit_id)}</dd></div>
              <div><dt>Original project</dt><dd>{selected.source_project?.name||"Not linked"}</dd></div>
              <div><dt>Responsibility</dt><dd>{selected.work_items?.ref} · {selected.work_items?.title}</dd></div>
              <div><dt>Action state</dt><dd>{selected.activity_state.replaceAll("_"," ")}</dd></div>
            </dl>
            <h4>Reported result</h4><p>{selected.outcome_note||"No outcome recorded"}</p>
            <h4>Next action</h4><p>{selected.next_action||"No next action recorded"}</p>
            {selected.duration_minutes!=null&&<p>{selected.duration_minutes} minutes self-reported; not attendance evidence</p>}
            {selected.evidence_url&&<a href={selected.evidence_url} target="_blank" rel="noopener noreferrer">View submitted evidence ↗</a>}
            {openItem&&<button className="btn btn-ghost btn-sm" type="button" onClick={()=>openItem(selected.work_item_id)}>Open responsibility record →</button>}
          </>}
        </aside>
      </div>
      <p className="s2-exec-contrib-disclaimer">A person contributing to more than one task does not create multiple project achievements. Counts above are distinct source records; any official outcome still requires the established reviewer process.</p>
    </>}
  </section>;
}

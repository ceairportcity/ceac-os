import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

/**
 * Private HR review queue for optional project-close person narratives.
 * This does not publish, approve, score, or expose draft manager remarks
 * to the subject. HR may consider evidence through the existing appraisal flow.
 */
export default function HRProjectContributionQueue({ me, cases = [], cycles = [], onOpenReview }) {
  const [sourceRows, setSourceRows] = useState([]);
  const [completedQueueScope, setCompletedQueueScope] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [filter, setFilter] = useState("");
  const queueScope = `${me.org_id}:${me.id}`;
  const ready = completedQueueScope === queueScope && !loading && !error;
  const rows = ready ? sourceRows : [];
  const checking = loading || completedQueueScope !== queueScope;
  const activeError = completedQueueScope === queueScope ? error : "";
  useEffect(() => {
    let active = true;
    setLoading(true);
    setSourceRows([]); setCompletedQueueScope("");
    setError("");
    (async () => {
      try {
        let all = [];
        let expected = null;
        for (let page=0;page<20;page++) {
          const r = await supabase.from("project_person_contribution_assessments")
            .select("id,org_id,project_id,subject_profile_id,reviewer_id,subject_unit_id,narrative,evidence_note,next_action,period_start,period_end,project_close_id,written_at,project:projects!project_person_contribution_assessments_project_id_fkey(name),subject:profiles!project_person_contribution_assessments_subject_profile_id_fkey(full_name),reviewer:profiles!project_person_contribution_assessments_reviewer_id_fkey(full_name)",{count:"exact"})
            .eq("org_id",me.org_id).order("written_at",{ascending:false}).order("id",{ascending:false})
            .range(page*200,page*200+199);
          if (r.error) throw r.error;
          if (!Array.isArray(r.data) || typeof r.count !== "number" || r.count<0)
            throw new Error("Restricted review history could not be verified.");
          if (expected !== null && expected !== r.count)
            throw new Error("The restricted review history changed while loading. Retry.");
          expected=r.count;
          all=all.concat(r.data);
          if (all.length===expected) break;
        }
        if (all.length !== expected) throw new Error("The review queue is incomplete. Do not rely on partial results.");
        if (active) setSourceRows(all);
      } catch (e) {
        if (active) setError(e?.message || "Restricted review queue is unavailable.");
      } finally { if (active) { setCompletedQueueScope(queueScope); setLoading(false); } }
    })();
    return () => { active=false; };
  },[me.id,me.org_id,reload]);

  const selected=rows.filter(row=>!filter || [
    row.project?.name,row.subject?.full_name,row.reviewer?.full_name
  ].some(v=>String(v||"").toLowerCase().includes(filter.toLowerCase())));
  return <section className="card s2-hr-project-reviews" aria-label="Restricted project contribution reviews">
    <header style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"flex-start"}}>
      <div><span className="eyebrow">HR restricted evidence</span>
        <h2 className="h2" style={{fontSize:19}}>Individual project contribution drafts</h2>
        <p className="screen-note">Manager-authored evidence awaiting independent HR consideration. These remarks have not been published to employees or made into performance ratings.</p></div>
      <button type="button" className="btn btn-ghost btn-sm" disabled={checking} onClick={()=>setReload(n=>n+1)}>Refresh</button>
    </header>
    {checking&&<p role="status">Verifying restricted reviews…</p>}
    {activeError&&<p role="alert" className="flag flag-amber">{activeError}</p>}
    {ready&&<>
      <label style={{display:"grid",gap:5,fontSize:12,marginBottom:12}}>Filter person, project or reviewer
        <input type="search" className="field" value={filter} onChange={e=>setFilter(e.target.value)} placeholder="Find evidence" />
      </label>
      {!selected.length&&<p>No restricted project contribution drafts are available for this filter.</p>}
      {selected.map(row=><details key={row.id} style={{padding:"12px 0",borderBottom:"1px solid #dbe2e9"}}>
        <summary style={{fontSize:13,cursor:"pointer"}}>
          <strong>{row.subject?.full_name||"Authorised staff member"}</strong>
          {" · "}{row.project?.name||"Recorded project"}
          <small style={{display:"block",color:"#64748b"}}>{row.written_at?.slice(0,10)||"Date not recorded"} · Reviewer: {row.reviewer?.full_name||"Authorised manager"}</small>
        </summary>
        <p style={{whiteSpace:"pre-wrap"}}>{row.narrative}</p>
        {row.evidence_note&&<p><b>Evidence reference: </b>{row.evidence_note}</p>}
        {row.next_action&&<p><b>Next action: </b>{row.next_action}</p>}
        <p className="screen-note">Unpublished draft. Independent structured appraisal ratings and HR publication remain separate.</p>
        {cases.filter(review => review.profile_id === row.subject_profile_id).map(review =>
          <button type="button" key={review.id} className="btn btn-ghost btn-sm" onClick={() => onOpenReview?.(review.id)}>
            Open formal review · {cycles.find(cycle => cycle.id === review.cycle_id)?.name || "Recorded period"}
          </button>)}
        {!cases.some(review => review.profile_id === row.subject_profile_id) &&
          <p className="screen-note">No formal review is available for this person. Open an authorised review period before considering publication.</p>}
      </details>)}
    </>}
  </section>;
}

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import "./ProjectPersonAssessments.css";

/**
 * Optional person-specific contribution remarks for a manager's project.
 * This is a private manager/HR draft, never a published appraisal or KPI.
 * Project closure must remain possible without filling in this section.
 */
export default function ProjectPersonAssessments({ me, project, closeId = null }) {
  const [sourcePeople, setSourcePeople] = useState([]);
  const [sourceNotes, setSourceNotes] = useState([]);
  const [verified, setVerified] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [subject, setSubject] = useState("");
  const [narrative, setNarrative] = useState("");
  const [evidence, setEvidence] = useState("");
  const [nextAction, setNextAction] = useState("");
  const [writing, setWriting] = useState(false);
  const [reload, setReload] = useState(0);
  const [completedAssessmentScope, setCompletedAssessmentScope] = useState("");
  const pending = useRef(false);
  const managedUnits = useMemo(() => new Set(
    (me.memberships || []).filter((entry) => entry.role === "manager").map((entry) => entry.unit_id)
      .concat(me.role === "manager" && me.unit_id ? [me.unit_id] : [])
  ), [me.id, me.unit_id, me.role, me.memberships]);

  const managedUnitKey = [...managedUnits].sort().join(",");
  const assessmentScope = `${me.org_id}:${me.id}:${project.id}:${closeId || ""}:${managedUnitKey}`;
  const ready = verified && !loading && !error && completedAssessmentScope === assessmentScope;
  const people = ready ? sourcePeople : [];
  const notes = ready ? sourceNotes : [];
  const checking = loading || completedAssessmentScope !== assessmentScope;
  const activeError = completedAssessmentScope === assessmentScope ? error : "";

  useEffect(() => {
    let current = true;
    setVerified(false); setSourcePeople([]); setSourceNotes([]); setCompletedAssessmentScope("");
    setSubject(""); setNarrative(""); setEvidence(""); setNextAction(""); setLoading(true); setError("");
    async function load() {
      try {
        // Both row sets must be complete. Do not infer missing people are non-contributors.
        const [assigned, contributed, existing] = await Promise.all([
          supabase.from("work_items")
            .select("id,unit_id,assignee_id,profiles!work_items_assignee_id_fkey(id,full_name)", { count: "exact" })
            .eq("org_id", me.org_id).eq("project_id", project.id)
            .neq("visibility", "private").eq("confidential", false).limit(1001),
          supabase.from("work_activity_records")
            .select("id,contributor_id,work_items!inner(unit_id),contributor:profiles!work_activity_records_contributor_id_fkey(id,full_name)", { count: "exact" })
            .eq("org_id", me.org_id).eq("source_project_id", project.id).limit(1001),
          supabase.from("project_person_contribution_assessments")
            .select("id,subject_profile_id,reviewer_id,narrative,evidence_note,next_action,written_at,project_close_id", { count: "exact" })
            .eq("org_id", me.org_id).eq("project_id", project.id)
            .order("written_at", { ascending: false }).limit(1001),
        ]);
        const results = [assigned, contributed, existing];
        for (const r of results) {
          if (r.error) throw r.error;
          if (!Array.isArray(r.data) || typeof r.count !== "number" || r.count !== r.data.length || r.count > 1000)
            throw new Error("Project contribution evidence is incomplete. Assessment is disabled.");
        }
        const byId = new Map();
        assigned.data.forEach((row) => {
          if (row.assignee_id && row.assignee_id !== me.id && managedUnits.has(row.unit_id))
            byId.set(row.assignee_id, { id: row.assignee_id, name: row.profiles?.full_name || "Authorised contributor" });
        });
        contributed.data.forEach((row) => {
          if (row.contributor_id && row.contributor_id !== me.id && managedUnits.has(row.work_items?.unit_id))
            byId.set(row.contributor_id, { id: row.contributor_id, name: row.contributor?.full_name || "Authorised contributor" });
        });
        if (!current) return;
        setSourcePeople([...byId.values()].sort((a, b) => a.name.localeCompare(b.name)));
        setSourceNotes(existing.data);
        setVerified(true);
      } catch (e) {
        if (current) setError(e.message || "Project assessment evidence could not be verified.");
      } finally { if (current) { setCompletedAssessmentScope(assessmentScope); setLoading(false); } }
    }
    void load();
    return () => { current = false; };
  }, [me.id, me.org_id, project.id, closeId, managedUnitKey, reload]);

  async function save(event) {
    event.preventDefault();
    if (!ready || pending.current || !people.some((p) => p.id === subject) ||
      narrative.trim().length < 20 || !managedUnits.size) return;
    pending.current = true; setWriting(true); setError("");
    try {
      const { data, error: rpcError } = await supabase.rpc("stage2_record_project_person_assessment", {
        p_project_id: project.id, p_subject_profile_id: subject, p_narrative: narrative.trim(),
        p_evidence_note: evidence.trim() || null, p_next_action: nextAction.trim() || null,
        p_project_close_id: closeId || null, p_period_start: null, p_period_end: null,
      });
      if (rpcError) throw rpcError;
      if (!data) throw new Error("The assessment submission could not be confirmed.");
      const { data: saved, error: checkError } = await supabase.from("project_person_contribution_assessments")
        .select("id,project_id,subject_profile_id,reviewer_id,narrative")
        .eq("id", data).eq("org_id", me.org_id).maybeSingle();
      if (checkError || !saved || saved.project_id !== project.id || saved.subject_profile_id !== subject
        || saved.reviewer_id !== me.id || saved.narrative !== narrative.trim())
        throw new Error("The assessment might have been recorded, but verification failed. Review history before retrying.");
      setNarrative(""); setEvidence(""); setNextAction(""); setSubject("");
      setReload((n) => n + 1);
    } catch (e) { setError(e.message || "Could not verify the assessment."); }
    finally { pending.current = false; setWriting(false); }
  }

  return <section className="card s2-person-close" aria-label="Optional individual contribution assessment">
    <div className="row-t">Individual project contribution assessments</div>
    <p className="screen-note">Optional private remarks about a person's documented contribution. These are not published employee ratings, do not determine project-close eligibility, and remain subject to independent HR handling.</p>
    {checking && <p role="status">Verifying individual project contributions…</p>}
    {activeError && <p role="alert" className="flag flag-amber">{activeError} <button type="button" className="btn btn-ghost btn-sm" onClick={() => setReload((n) => n + 1)}>Retry</button></p>}
    {ready && !people.length && <p>No other contributor with evidence in your managed department is available to assess.</p>}
    {ready && people.length > 0 && <form onSubmit={save} className="s2-person-close-form">
      <label>Person with recorded project contribution
        <select className="field" value={subject} onChange={(e) => setSubject(e.target.value)} required>
          <option value="">Select contributor</option>
          {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </label>
      <label>Specific contribution and review rationale
        <textarea className="field" minLength={20} maxLength={6000} rows={3} required
          value={narrative} onChange={(e) => setNarrative(e.target.value)}
          placeholder="What did this person contribute, and on what evidence is the assessment based?" />
      </label>
      <label>Evidence reference (optional)
        <textarea className="field" maxLength={3000} rows={2}
          value={evidence} onChange={(e) => setEvidence(e.target.value)} />
      </label>
      <label>Next action (optional)
        <textarea className="field" maxLength={1500} rows={2}
          value={nextAction} onChange={(e) => setNextAction(e.target.value)} />
      </label>
      <button className="btn btn-sm" type="submit" disabled={!ready || writing || !subject || narrative.trim().length < 20}>
        {writing ? "Verifying…" : "Save restricted assessment"}
      </button>
    </form>}
    {ready && <div className="s2-person-close-history" aria-label="My recorded confidential project assessments">
      <strong>{notes.length} visible restricted assessment{notes.length === 1 ? "" : "s"}</strong>
      {notes.map((row) => <details key={row.id}><summary>{people.find((p) => p.id === row.subject_profile_id)?.name || "Restricted contributor"} · {row.written_at?.slice(0, 10) || "Date unavailable"}</summary>
        <p>{row.narrative}</p>
        {row.evidence_note && <p><b>Evidence:</b> {row.evidence_note}</p>}
        {row.next_action && <p><b>Next:</b> {row.next_action}</p>}
        <small>Private draft · author-only/HR visibility · not published</small>
        {row.reviewer_id === me.id && <p><a href={`?tab=performance&reviewPerson=${encodeURIComponent(row.subject_profile_id)}`}>
          Continue in formal review →
        </a></p>}
      </details>)}
    </div>}
  </section>;
}

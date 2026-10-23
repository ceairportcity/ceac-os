import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import "./RoutineOccurrenceReviews.css";

/**
 * Human review belongs to the recorded date, not to the repeating master.
 * No automatic outcomes, HR rating, checklist progress or employee scoring.
 */
export default function RoutineOccurrenceReviews({
  me, item, occurrences, canReview = false, onRecordEvidence,
}) {
  const [sourceHistory, setSourceHistory] = useState([]);
  const [completedReviewScope, setCompletedReviewScope] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selection, setSelection] = useState("");
  const [decision, setDecision] = useState("accepted");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [reload, setReload] = useState(0);
  const sending = useRef(false);
  const ids = occurrences.map((row) => row.id).sort().join(",");
  const reviewScope = `${me.org_id}:${me.id}:${item.id}:${ids}`;
  const ready = completedReviewScope === reviewScope && !loading && !error;
  const history = ready ? sourceHistory : [];
  const checking = loading || completedReviewScope !== reviewScope;
  const activeError = completedReviewScope === reviewScope ? error : "";

  useEffect(() => {
    let current = true;
    setSourceHistory([]); setCompletedReviewScope(""); setError(""); setLoading(true); setSelection("");
    (async () => {
      try {
        if (!ids) { if (current) setSourceHistory([]); return; }
        const all = [];
        let total = null;
        const occurrenceIds = ids.split(",");
        for (let page = 0; page < 15; page++) {
          const offset = page * 200;
          const result = await supabase.from("routine_occurrence_reviews")
            .select("id,org_id,occurrence_id,reviewer_id,decision,note,reviewed_at", { count:"exact" })
            .eq("org_id", me.org_id).in("occurrence_id", occurrenceIds)
            .order("reviewed_at", { ascending:false }).order("id", { ascending:false })
            .range(offset, offset + 199);
          if (result.error) throw result.error;
          if (!Array.isArray(result.data) || typeof result.count !== "number"
              || result.count < 0 || (total !== null && result.count !== total))
            throw new Error("Occurrence review history is incomplete.");
          total = result.count;
          all.push(...result.data);
          if (all.length === total) break;
        }
        if (all.length !== total)
          throw new Error("Occurrence review history exceeds the verification limit.");
        if (current) setSourceHistory(all);
      } catch (cause) {
        if (current) setError(/routine_occurrence_reviews|PGRST205|42P01/.test(String(cause?.message||""))
          ? "Occurrence review is awaiting its authorised database migration."
          : "Occurrence reviews could not be verified; no review state is shown.");
      } finally { if (current) { setCompletedReviewScope(reviewScope); setLoading(false); } }
    })();
    return () => { current = false; };
  }, [me.id, me.org_id, item.id, ids, reload]);

  const latest = new Map();
  for (const row of history) if (!latest.has(row.occurrence_id)) latest.set(row.occurrence_id,row);
  const reviewPermitted = canReview && item.visibility === "unit" && item.confidential !== true;

  async function recordReview(event) {
    event.preventDefault();
    if (sending.current || saving || !ready || !reviewPermitted || !selection) return;
    const occurrence = occurrences.find((row) => row.id === selection);
    if (!occurrence || occurrence.recorded_by === me.id || (decision==="changes_requested" && note.trim().length < 3)) return;
    sending.current = true; setSaving(true); setError("");
    try {
      const result = await supabase.from("routine_occurrence_reviews").insert({
        org_id:me.org_id, occurrence_id:selection, reviewer_id:me.id,
        decision, note:note.trim() || null,
      }).select("id,org_id,occurrence_id,reviewer_id,decision").single();
      if (result.error) throw result.error;
      if (!result.data || result.data.org_id !== me.org_id || result.data.occurrence_id !== selection
        || result.data.reviewer_id !== me.id || result.data.decision !== decision)
        throw new Error("Review saved with uncertain verification. Refresh before trying again.");
      setSelection(""); setNote(""); setDecision("accepted"); setReload((n)=>n+1);
    } catch (cause) { setError(cause?.message || "The review could not be recorded."); }
    finally { sending.current=false; setSaving(false); }
  }

  return <section className="s2-routine-review" aria-label="Routine occurrence review history">
    {checking && <p role="status">Verifying occurrence reviews…</p>}
    {activeError && <p role="alert">{activeError} <button type="button" onClick={()=>setReload(n=>n+1)}>Retry</button></p>}
    {occurrences.map((entry) => {
      const current = latest.get(entry.id);
      const canReviewEntry = reviewPermitted && ready && entry.recorded_by !== me.id;
      return <div className="s2-routine-review-row" key={entry.id}>
        <div className="s2-routine-review-content">
          <strong>{entry.occurred_on}{item?.ref ? " · "+item.ref : ""}</strong>
          <small>{entry.note || "No outcome note recorded"}{entry.value != null ? " · "+entry.value : ""}</small>
          {current && ready && <span className="s2-routine-review-label">
            {current.decision === "accepted" ? "Reviewed · accepted" : "Reviewed · needs more evidence"}
            {current.note ? " · "+current.note : ""}
          </span>}
          {ready && !current && <small>Awaiting independent review</small>}
        </div>
        <div className="s2-routine-review-actions">
          {onRecordEvidence && <button type="button"
            onClick={() => onRecordEvidence(entry.occurred_on)}>Record evidence for {entry.occurred_on}</button>}
          {canReviewEntry && <button type="button" onClick={()=>{
            setSelection(selection===entry.id?"":entry.id);setNote("");setDecision("accepted");
          }}>{selection===entry.id?"Cancel":"Review date"}</button>}
        </div>
        {selection===entry.id && canReviewEntry && <form className="s2-routine-review-form" onSubmit={recordReview}>
          <label>Review outcome <select value={decision} onChange={event=>setDecision(event.target.value)}>
            <option value="accepted">Accept recorded outcome</option>
            <option value="changes_requested">Request further evidence</option>
          </select></label>
          <label>Review note <textarea value={note} maxLength={2500} rows={2}
            placeholder={decision==="changes_requested"?"Explain what further evidence is needed":"Optional factual note"}
            onChange={event=>setNote(event.target.value)} /></label>
          <button type="submit" disabled={saving || decision==="changes_requested" && note.trim().length<3}>
            {saving?"Recording review…":"Record human review"}
          </button>
        </form>}
      </div>;
    })}
  </section>;
}

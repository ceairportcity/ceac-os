import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import {
  HUMAN_RUBRIC_CATEGORIES, HUMAN_RATING_OPTIONS, blankHumanRubric,
  canHumanReview, validateHumanRubric,
} from "../lib/stage2HumanRubric";
import "./StructuredHumanReview.css";

/**
 * One embedded, protected Stage 2 review instrument. It does not create a
 * second appraisal engine. Published visibility is enforced by PostgreSQL RLS.
 * The parent owns HR release and employee response.
 */
export default function StructuredHumanReview({ appraisal, cycle, assessment, evidence, me }) {
  const cadence = cycle?.stage2_cadence;
  const enabled = import.meta.env.VITE_STAGE2_STRUCTURED_RUBRIC === "true";
  const [draft, setDraft] = useState(blankHumanRubric);
  const [versions, setVersions] = useState([]);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const allowedToWrite = canHumanReview({
    reviewerId: me?.id, employeeId: appraisal?.profile_id,
    caseReviewerId: appraisal?.manager_id, caseOpen: appraisal?.status !== "closed",
    cadence,
  });
  const newest = versions[0] || null;
  const validation = useMemo(
    () => validateHumanRubric(draft, { cadence }),
    [draft, cadence],
  );

  useEffect(() => {
    let alive = true;
    setVersions([]); setDraft(blankHumanRubric()); setError(""); setStatus("loading");
    setShowForm(false);
    if (!enabled || !appraisal?.id || !["quarter","month"].includes(cadence)) {
      setStatus("disabled");
      return () => { alive = false; };
    }
    const load = async () => {
      try {
        const result = await supabase.from("appraisal_human_rating_versions")
          .select("id,assessment_entry_id,rubric_version,category_ratings,overall_rating,overall_narrative,strengths,challenges,next_actions,reviewer_id,profile_id,cadence,created_at")
          .eq("appraisal_id", appraisal.id)
          .order("created_at", { ascending:false })
          .order("id", { ascending:false }).limit(30);
        if (result.error) throw result.error;
        if (alive) { setVersions(result.data || []); setStatus("ready"); }
      } catch {
        if (alive) { setError("Protected review ratings could not be verified. Do not submit or publish until the secured records are available."); setStatus("error"); }
      }
    };
    void load();
    return () => { alive = false; };
  }, [appraisal?.id, cadence, enabled]);

  function patchCategory(key, patch) {
    setDraft((v) => ({
      ...v, categories:v.categories.map((row) =>
        row.category === key ? { ...row, ...patch } : row),
    }));
  }

  async function save() {
    if (!allowedToWrite || !assessment?.id || status !== "ready" || !validation.valid || saving) return;
    setSaving(true);setError("");
    try {
      const body = validation.payload;
      const result = await supabase.from("appraisal_human_rating_versions")
        .insert({
          org_id:appraisal.org_id, appraisal_id:appraisal.id,
          assessment_entry_id:assessment.id,profile_id:appraisal.profile_id,
          reviewer_id:me.id,cadence,rubric_version:1,
          category_ratings:Object.fromEntries(body.categories.map(({category,rating,explanation,evidenceIds}) =>
            [category,{rating,reason:explanation,evidenceIds}])),
          overall_rating:body.overallRating,
          overall_narrative:body.overallNarrative,
          strengths:body.strengths,challenges:body.challenges,
          next_actions:`Improvement actions: ${body.improvementActions}\nNext responsibilities: ${body.nextResponsibilities}`,
        })
        .select("id,assessment_entry_id,rubric_version,category_ratings,overall_rating,overall_narrative,strengths,challenges,next_actions,reviewer_id,profile_id,cadence,created_at")
        .single();
      if (result.error) throw result.error;
      setVersions((rows) => [result.data, ...rows]);
      setShowForm(false);
      setDraft(blankHumanRubric());
    } catch (failure) {
      setError(failure?.message || "The structured human review could not be recorded.");
    } finally { setSaving(false); }
  }

  if (!enabled || !["monthly","quarterly"].includes(cadence)) return null;
  return <section className="s2-human-rubric" aria-label="Human-entered performance review">
    <header>
      <div><span>Human assessment · {cadence === "quarter" ? "Required quarterly review" : "Optional monthly review"}</span>
        <h3>Structured Manager ratings</h3>
        <p>Only the assigned authorised reviewer chooses ratings. The system does not calculate an overall score.</p>
      </div>
      {allowedToWrite && status === "ready" && assessment && newest?.assessment_entry_id !== assessment.id && <button type="button" onClick={() => setShowForm((v) => !v)}>
        {showForm ? "Close draft" : newest ? "Record revised ratings" : "Enter ratings"}
      </button>}
    </header>
    {status === "loading" && <p role="status">Verifying the protected rating record…</p>}
    {error && <p role="alert" className="s2-rubric-error">{error}</p>}
    {status === "ready" && !newest && <p className="s2-rubric-empty">No structured rating has been recorded. A quarterly review cannot be submitted for HR publication until the complete human rubric is recorded.</p>}
    {newest && <div className="s2-rubric-summary">
      <div><strong>Latest authorised version</strong><small>{new Date(newest.created_at).toLocaleString("en-GB",{timeZone:"Africa/Accra"})}</small></div>
      <p><strong>Manager-selected overall judgment:</strong> {newest.overall_rating} · {newest.overall_narrative}</p>
      <div className="s2-rubric-ratings">{Object.entries(newest.category_ratings || {}).map(([category,row]) =>
        <article key={category}><span>{HUMAN_RUBRIC_CATEGORIES.find(x=>x.key===category)?.label || category}</span>
          <strong>{row.rating}</strong><small>{row.reason}</small>
          <small>{row.evidenceIds?.length || 0} recorded evidence reference(s)</small></article>)}</div>
      <details><summary>Reviewer’s recorded development guidance</summary>
        <p><b>Strengths:</b> {newest.strengths}</p>
        <p><b>Challenges:</b> {newest.challenges}</p>
        <p><b>Agreed next actions and responsibilities:</b> {newest.next_actions}</p>
      </details>
    </div>}
    {allowedToWrite && !assessment && <p className="s2-rubric-empty">Record the Manager narrative above before entering a structured judgment.</p>}
    {allowedToWrite && assessment && newest?.assessment_entry_id === assessment.id && <p className="s2-rubric-empty">To revise published or pending ratings, first record a revised Manager assessment above. Rating history remains immutable.</p>}
    {showForm && allowedToWrite && assessment && newest?.assessment_entry_id !== assessment.id && <div className="s2-rubric-composer">
      {HUMAN_RUBRIC_CATEGORIES.map(({key,label}) => {
        const row = draft.categories.find((v) => v.category === key);
        return <fieldset key={key}><legend>{label}</legend>
          <label>Human rating
            <select value={row.rating} onChange={(e) => patchCategory(key,{rating:e.target.value})}>
              <option value="">Choose a rating</option>
              {HUMAN_RATING_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label>Specific explanation / N/O reason
            <textarea value={row.explanation} rows={2} maxLength={1500}
              onChange={(e)=>patchCategory(key,{explanation:e.target.value})} />
          </label>
          <div className="s2-rubric-evidence"><b>Recorded evidence</b>
            {!evidence?.length && <small>No evidence has been verified for this case. Use reasoned N/O where appropriate; do not fabricate proof.</small>}
            {(evidence || []).map(item =>
              <label key={item.id}><input type="checkbox"
                checked={row.evidenceIds.includes(item.id)}
                onChange={(e)=>patchCategory(key,{evidenceIds:e.target.checked
                  ? [...row.evidenceIds,item.id]
                  : row.evidenceIds.filter(id=>id!==item.id)})}/>
                <span>{item.label} · {item.category}</span></label>)}
          </div>
        </fieldset>;
      })}
      <label>Overall human-selected judgment
        <select value={draft.overallRating}
          onChange={(e)=>setDraft((v)=>({...v,overallRating:e.target.value}))}>
          <option value="">Choose independently — not an automatic average</option>
          {HUMAN_RATING_OPTIONS.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </label>
      {[
        ["overallNarrative","Overall narrative and evidence basis"],
        ["strengths","Recorded strengths"],
        ["challenges","Recorded challenges"],
        ["improvementActions","Agreed improvement actions"],
        ["nextResponsibilities","Next responsibilities"],
      ].map(([key,label])=><label key={key}>{label}
        <textarea rows={2} maxLength={3000} value={draft[key]}
          onChange={(e)=>setDraft(v=>({...v,[key]:e.target.value}))}/></label>)}
      {!validation.valid && <div role="status" className="s2-rubric-errors">
        <strong>{validation.errors.length} incomplete field(s)</strong>
        <ul>{validation.errors.slice(0,9).map((s)=><li key={s}>{s}</li>)}</ul>
      </div>}
      <button type="button" disabled={saving || !validation.valid} onClick={save}>
        {saving ? "Recording…" : "Record human-authored rating version"}
      </button>
      <small>All ratings remain restricted to the assigned reviewer and authorised HR until independently published. Prior versions are preserved.</small>
    </div>}
  </section>;
}

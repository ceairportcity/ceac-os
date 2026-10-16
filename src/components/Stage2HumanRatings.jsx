import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { HUMAN_RUBRIC, VALID_RATINGS, validateHumanAppraisal } from "../lib/stage2PerformanceFacts";
import "./Stage2HumanRatings.css";

const makeDraft = () => Object.fromEntries(HUMAN_RUBRIC.map((category) => [
  category.key, { rating: "", reason: "", evidenceIds: [] },
]));
const isQuarter = (cycle) => {
  if (!cycle?.starts_on || !cycle?.ends_on) return false;
  if (cycle.cadence === "quarterly") return true;
  const [y, m, d] = cycle.starts_on.split("-").map(Number);
  if (d !== 1 || (m - 1) % 3 !== 0) return false;
  const last = new Date(Date.UTC(y, m + 2, 0)).toISOString().slice(0,10);
  return cycle.ends_on === last;
};

/**
 * Human judgment belongs to the assigned reviewer, not to work-completion
 * counts or time/attendance heuristics. Published versions are read-only.
 */
export default function Stage2HumanRatings({ me, appraisal, cycle, assessment, evidence = [], isReviewer, onSaved }) {
  const [record, setRecord] = useState(null);
  const [categories, setCategories] = useState(makeDraft);
  const [overall, setOverall] = useState("");
  const [narrative, setNarrative] = useState("");
  const [strengths, setStrengths] = useState("");
  const [challenges, setChallenges] = useState("");
  const [actions, setActions] = useState("");
  const [pending, setPending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const quarterly = isQuarter(cycle);
  const periodKind = quarterly ? "quarter" : "month";
  const eligible = Boolean(isReviewer && appraisal?.manager_id === me.id && appraisal.profile_id !== me.id
    && appraisal.status !== "shared" && appraisal.status !== "closed");
  const canRead = Boolean(assessment?.id && appraisal?.id);
  const evidenceChoices = useMemo(() => evidence.filter((x) => x.id).map((x) => ({
    id: x.id, label: x.label || x.category || "Recorded evidence",
  })).slice(0,100), [evidence]);
  const validity = validateHumanAppraisal({
    periodKind, employeeId: appraisal?.profile_id, reviewerId: me.id,
    categories, overall: { rating: overall },
    narrative, strengths, challenges, actions,
  });
  const complete = validity.valid && HUMAN_RUBRIC.every(({key}) => {
    const row = categories[key];
    return row.rating && String(row.reason || "").trim().length >= 8;
  }) && String(narrative||"").trim().length >= 8;

  useEffect(() => {
    let alive = true;
    setRecord(null); setError(""); setNotice(""); setUnavailable(false);
    setCategories(makeDraft()); setOverall(""); setNarrative("");
    setStrengths(""); setChallenges(""); setActions("");
    if (!canRead) return () => { alive=false; };
    (async () => {
      setLoading(true);
      try {
        const { data, error: failure } = await supabase.from("appraisal_structured_ratings")
          .select("id,appraisal_id,assessment_entry_id,rubric_version,categories,overall_rating,overall_explanation,strengths,challenges,next_steps,created_at")
          .eq("appraisal_id", appraisal.id).eq("assessment_entry_id", assessment.id).maybeSingle();
        if (failure) throw failure;
        if (alive) setRecord(data || null);
      } catch {
        if (alive) setUnavailable(true);
      } finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  },[appraisal?.id,assessment?.id]);

  const update = (key, field, value) => setCategories((old) => ({
    ...old, [key]: { ...old[key], [field]: value },
  }));
  async function save() {
    if (!eligible || !assessment?.id || !complete || pending || record) return;
    setPending(true); setError(""); setNotice("");
    try {
      const payload = Object.fromEntries(HUMAN_RUBRIC.map(({key}) => [key,{
        rating: String(categories[key].rating),
        reason: String(categories[key].reason).trim(),
        evidence_refs: categories[key].evidenceIds,
      }]));
      const result = await supabase.from("appraisal_structured_ratings")
        .insert({
          org_id: me.org_id, appraisal_id: appraisal.id,
          assessment_entry_id: assessment.id, rubric_version: 1,
          categories: payload, overall_rating: overall,
          overall_explanation: narrative.trim(), strengths: strengths.trim(),
          challenges: challenges.trim(), next_steps: actions.trim(),
          created_by: me.id,
        }).select("id,appraisal_id,assessment_entry_id,rubric_version,categories,overall_rating,overall_explanation,strengths,challenges,next_steps,created_at").single();
      if (result.error) throw result.error;
      setRecord(result.data);
      setNotice("Your human-entered review is attached to this assessment version. HR publication is still separate.");
      onSaved?.();
    } catch (e) {
      setError("Ratings were not saved. " + String(e?.message || "Review authorization or recorded fields."));
    } finally { setPending(false); }
  }
  return <section className="s2-human-ratings" aria-label="Structured manager appraisal">
    <header>
      <div><span className="s2-human-ratings-eyebrow">Manager judgement · Private appraisal</span>
        <h3>{quarterly ? "Quarterly structured ratings" : "Optional structured ratings"}</h3>
        <p>{quarterly
          ? "Every category and an independently selected overall judgement are required before requesting HR publication."
          : "Monthly structured ratings are optional. Factual indicators do not generate a rating."}</p>
      </div>
      <span className="s2-human-ratings-cadence">{quarterly ? "Required each quarter" : "Optional monthly"}</span>
    </header>
    {!assessment && <p className="s2-human-ratings-note">Record the Manager's independent assessment narrative before attaching ratings.</p>}
    {loading && <p role="status">Checking the latest recorded rating version…</p>}
    {unavailable && !loading && <p role="alert">Structured rating records are not available in this environment. The protected Stage 2 database migration may not be installed; no score has been inferred.</p>}
    {record && <>
      <div className="s2-human-ratings-readonly" aria-label="Previously recorded human ratings">
        <p>Recorded by the assigned reviewer for this exact assessment version, rubric {record.rubric_version}.</p>
        <div className="s2-human-ratings-categories">{HUMAN_RUBRIC.map((item) => <div key={item.key}>
          <strong>{item.label}</strong><b>{record.categories?.[item.key]?.rating || "Not recorded"}</b>
          <p>{record.categories?.[item.key]?.reason || "No reason recorded"}</p>
        </div>)}</div>
        <div className="s2-human-ratings-overall"><strong>Overall human judgement</strong><b>{record.overall_rating}</b>
          <p>{record.overall_explanation}</p><small>Strengths: {record.strengths} · Challenges: {record.challenges} · Next steps: {record.next_steps}</small>
        </div>
      </div>
      <p className="s2-human-ratings-note">No numerical average or ranking is calculated. Changes require a new reviewer assessment version and independent HR release.</p>
    </>}
    {!loading && !record && !unavailable && eligible && assessment && <>
      <div className="s2-human-ratings-categories">
        {HUMAN_RUBRIC.map(({key,label}) => <div key={key}>
          <div className="s2-human-ratings-category-head"><strong>{label}</strong><label>
            <span>Human rating</span><select aria-label={label+" rating"} value={categories[key].rating}
              onChange={(e)=>update(key,"rating",e.target.value)}>
              <option value="">Choose</option>{VALID_RATINGS.map((rating) => <option key={rating} value={rating}>
                {rating === "N/O" ? "N/O · Not observed / applicable" : rating}
              </option>)}
            </select></label></div>
          <label className="s2-human-ratings-reason">Explanation and actual observation
            <textarea aria-label={label+" explanation"} rows={2} maxLength={3000}
              value={categories[key].reason} onChange={(e)=>update(key,"reason",e.target.value)}
              placeholder={categories[key].rating==="N/O" ? "Explain why there was no direct observation or why this did not apply" : "Specific evidence and reason for your selected judgement"}/>
          </label>
          {evidenceChoices.length>0 && <label className="s2-human-ratings-reference">Evidence reference (optional)
            <select aria-label={label+" evidence reference"}
              value={categories[key].evidenceIds[0]||""}
              onChange={(e)=>update(key,"evidenceIds",e.target.value?[e.target.value]:[])}>
              <option value="">No evidence item selected</option>
              {evidenceChoices.map((v)=><option key={v.id} value={v.id}>{v.label}</option>)}
            </select>
          </label>}
        </div>)}
      </div>
      <div className="s2-human-ratings-overall">
        <label>Overall rating · entered independently by the reviewer
          <select aria-label="Independent overall human rating" value={overall} onChange={(e)=>setOverall(e.target.value)}>
            <option value="">Choose your overall judgement</option>{VALID_RATINGS.map((s)=><option key={s} value={s}>{s}</option>)}
          </select></label>
        <label>Overall explanation<textarea aria-label="Overall judgement explanation" rows={3} maxLength={4000}
          value={narrative} onChange={(e)=>setNarrative(e.target.value)}/></label>
        <label>Strengths<textarea aria-label="Review strengths" rows={2} value={strengths} onChange={(e)=>setStrengths(e.target.value)}/></label>
        <label>Challenges<textarea aria-label="Review challenges" rows={2} value={challenges} onChange={(e)=>setChallenges(e.target.value)}/></label>
        <label>Next actions<textarea aria-label="Review next actions" rows={2} value={actions} onChange={(e)=>setActions(e.target.value)}/></label>
      </div>
      {!complete && <p className="s2-human-ratings-note">Choose all five category judgements with reasons, your own overall selection, and a substantive explanation. N/O is permitted with a reason. No score is auto-generated.</p>}
      {error && <p role="alert" className="s2-human-ratings-error">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      <button type="button" disabled={!complete||pending} className="s2-human-ratings-submit" onClick={save}>
        {pending?"Recording reviewer judgement…":"Record structured human assessment"}
      </button>
    </>}
    {!eligible && !record && !loading && !unavailable && assessment &&
      <p className="s2-human-ratings-note">Only the appointed independent reviewer can enter these judgments. Employees see them only after the corresponding HR-approved version is published.</p>}
    {notice && record && <p role="status">{notice}</p>}
  </section>;
}

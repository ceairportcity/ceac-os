import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { dateOnly } from "../lib/time";

export default function Goals({ id, me, back }) {
  const [goal, setGoal] = useState(null);
  const [steps, setSteps] = useState([]);
  const [newStep, setNewStep] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { load(); }, [id]);
  async function load() {
    setError(null);
    const goalResult = await supabase.from("personal_goals").select("*").eq("id", id).single();
    if (goalResult.error) { setError(goalResult.error.message); return; }
    setGoal(goalResult.data);
    const stepResult = await supabase.from("goal_steps").select("*").eq("goal_id", id).order("position");
    if (stepResult.error) { setError(stepResult.error.message); return; }
    setSteps(stepResult.data || []);
  }
  async function addStep() {
    if (!newStep.trim()) return;
    setBusy(true); setError(null);
    const { error: insertError } = await supabase.from("goal_steps").insert({ goal_id: id, label: newStep.trim(), position: steps.length + 1 });
    setBusy(false);
    if (insertError) { setError(insertError.message); return; }
    setNewStep(""); await load();
  }
  async function toggle(step) {
    setError(null);
    const { error: updateError } = await supabase.from("goal_steps").update({ done: !step.done }).eq("id", step.id);
    if (updateError) { setError(updateError.message); return; }
    await load();
  }
  async function markAchieved() {
    setBusy(true); setError(null);
    const { error: updateError } = await supabase.from("personal_goals").update({ status: "achieved", achieved_at: new Date().toISOString() }).eq("id", id);
    setBusy(false);
    if (updateError) { setError(updateError.message); return; }
    back();
  }
  async function setAside() {
    if (!confirm("Set this goal aside?")) return;
    setBusy(true); setError(null);
    const { error: updateError } = await supabase.from("personal_goals").update({ status: "abandoned" }).eq("id", id);
    setBusy(false);
    if (updateError) { setError(updateError.message); return; }
    back();
  }
  if (!goal) return <div className="spin">Loading...</div>;
  const doneCount = steps.filter((s) => s.done).length;
  return (
    <div className="body">
      <button className="back" onClick={back}>← Back</button>
      <div className="eyebrow">Personal goal · only you see this</div>
      {error && <div className="flag flag-brick" style={{ marginTop: 12 }}>{error}</div>}
      <h1 className="h2" style={{ marginTop: 6, fontSize: 22 }}>{goal.title}</h1>
      <div className="screen-note">{goal.target_date ? "By " + dateOnly(goal.target_date) : "No target date"}</div>
      {goal.status === "achieved" && <div className="flag flag-green" style={{ marginTop: 12 }}><h4>Achieved</h4>Well done.</div>}
      <div className="sec"><span>Steps</span><span>{doneCount} of {steps.length}</span></div>
      <div className="card" style={{ padding: "2px 15px" }}>
        {steps.length === 0 && <div style={{ padding: "12px 0", fontSize: 13, color:"var(--appearance-ink-faint)" }}>Break it down into steps. Tick them off as you go.</div>}
        {steps.map((s) => (
          <button key={s.id} className={"ck " + (s.done ? "done" : "")} onClick={() => toggle(s)}>
            <span className={"box " + (s.done ? "on" : "")} />
            <span className="ck-l">{s.label}</span>
          </button>))}
      </div>
      <input className="field" placeholder="Add a step" value={newStep}
        onChange={(e) => setNewStep(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && addStep()} />
      <button className="btn btn-ghost wide-auto" style={{ marginTop: 10 }} onClick={addStep} disabled={busy || !newStep.trim()}>Add step</button>
      {goal.status === "active" && (
        <div style={{ display: "flex", gap: 10, marginTop: 24, flexWrap: "wrap" }}>
          <button className="btn wide-auto" onClick={markAchieved} disabled={busy}>Mark achieved</button>
          <button className="btn btn-ghost wide-auto" onClick={setAside} disabled={busy}>Set aside</button>
        </div>)}
    </div>);
}

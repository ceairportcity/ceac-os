import { useId, useState } from "react";
import { supabase } from "../lib/supabase";

export default function TaskReassignment({ item, onSaved }) {
  const heading = useId();
  const [people, setPeople] = useState(null);
  const [person, setPerson] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function open() {
    setBusy(true);
    setError("");
    const { data, error: failure } = await supabase.from("unit_memberships")
      .select("profiles!unit_memberships_profile_id_fkey!inner(id,full_name,active)")
      .eq("unit_id", item.unit_id).eq("org_id", item.org_id)
      .eq("profiles.active", true).neq("profile_id", item.assignee_id);
    setBusy(false);
    if (failure) {
      setError("Could not load department members. Try again.");
      return;
    }
    setPeople(data.map(row => row.profiles).sort((a, b) => a.full_name.localeCompare(b.full_name)));
  }

  async function save(event) {
    event.preventDefault();
    if (busy || !person || !reason.trim()) return;
    setBusy(true);
    setError("");
    const { error: failure } = await supabase.rpc("reassign_unstarted_task", {
      p_work_item_id: item.id,
      p_expected_assignee: item.assignee_id,
      p_new_assignee: person,
      p_reason: reason.trim(),
    });
    setBusy(false);
    if (failure) {
      setError(failure.message);
      return;
    }
    setPeople(null);
    setPerson("");
    setReason("");
    await onSaved();
  }

  return <section aria-label="Task assignment">
    {people === null ? <button type="button" className="btn btn-ghost btn-sm" onClick={open} disabled={busy}>
      {busy ? "Loading department members…" : "Reassign task"}
    </button> : <form className="s2-work-diary-form" aria-labelledby={heading} onSubmit={save}>
      <h3 id={heading} className="wide">Reassign task</h3>
      <label>New assignee
        <select name="assignee" value={person} onChange={event => setPerson(event.target.value)} disabled={busy} required>
          <option value="">Choose an active department member</option>
          {people.map(profile => <option key={profile.id} value={profile.id}>{profile.full_name}</option>)}
        </select>
      </label>
      <label>Reason
        <input name="reason" value={reason} onChange={event => setReason(event.target.value)} disabled={busy} maxLength={1000} required />
      </label>
      {!people.length && <p role="status">No other active department members are available.</p>}
      <div className="wide">
        <button type="submit" className="btn btn-sm" disabled={busy || !person || !reason.trim()}>{busy ? "Saving…" : "Save reassignment"}</button>
        <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => { setPeople(null); setPerson(""); setReason(""); setError(""); }}>Cancel</button>
      </div>
    </form>}
    {error && <p role="alert">{error}</p>}
  </section>;
}

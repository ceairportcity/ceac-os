import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { Button } from "../experience-v2/components";

const dayInAccra = () => new Intl.DateTimeFormat("en-CA", {
  timeZone: "Africa/Accra", year: "numeric", month: "2-digit", day: "2-digit",
}).format(new Date());
const futureHorizon = () => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 60);
  return d.toISOString().slice(0, 10);
};
const cadenceOptions = [
  ["daily", "Every day"], ["weekdays", "Every weekday"],
  ["weekly", "Every week"], ["monthly", "Every month"],
  ["custom", "Custom interval"],
];
const newForm = (start) => ({
  title: "", details: "", start_date: start || dayInAccra(), planned_time: "",
  cadence: "weekly", interval_count: 1, custom_unit: "days",
  ends_when: "never", end_date: "", occurrence_limit: 10,
});

export default function PersonalRecurringTaskComposer({
  me, selectedDate, ready, onChanged,
}) {
  const [list, setList] = useState([]);
  const [form, setForm] = useState(() => newForm(selectedDate));
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  // Private series are visible/actionable only after a verified read for the
  // currently authenticated actor, never a previous user's stale response.
  const identity = me.org_id + ":" + me.id;
  const currentIdentity = useRef(identity);
  currentIdentity.current = identity;
  const refreshSequence = useRef(0);
  const [verifiedIdentity, setVerifiedIdentity] = useState(null);
  const seriesVerified = ready && !loading && verifiedIdentity === identity;

  async function refresh() {
    const requestedIdentity = identity;
    const requestedRead = ++refreshSequence.current;
    const isLatest = () => currentIdentity.current === requestedIdentity
      && refreshSequence.current === requestedRead;
    if (!ready) { setVerifiedIdentity(null); setList([]); return false; }
    setLoading(true); setVerifiedIdentity(null);
    try {
      const { data, error: failure, count } = await supabase.from("personal_task_series")
        .select("id,title,details,start_date,planned_time,cadence,interval_count,custom_unit,ends_when,end_date,occurrence_limit,is_active", { count: "exact" })
        .eq("org_id", me.org_id).eq("profile_id", me.id)
        .order("created_at", { ascending: false });
      if (!isLatest()) return false;
      if (failure) throw failure;
      if (!Array.isArray(data) || typeof count !== "number" || count !== data.length) {
        throw new Error("Private recurring-task history is incomplete. No series changes are allowed.");
      }
      setList(data); setError("");
      setVerifiedIdentity(requestedIdentity);
      return true;
    } catch {
      if (isLatest()) {
        setList([]); setNotice("");
        setError("Private recurring tasks could not be verified. Refresh before changing a series.");
        setVerifiedIdentity(null);
      }
      return false;
    } finally {
      if (isLatest()) setLoading(false);
    }
  }

  useEffect(() => {
    setList([]); setShowForm(false); setEditing(null); setVerifiedIdentity(null);
    void refresh();
    return () => { refreshSequence.current += 1; };
  },
    [me.id, me.org_id, ready]);

  function startNew() {
    if (!seriesVerified || busy) return;
    setEditing(null);
    setForm(newForm(selectedDate));
    setError("");
    setNotice("");
    setShowForm(true);
  }
  function edit(series) {
    if (!seriesVerified || busy) return;
    setEditing(series.id);
    setForm({
      title: series.title, details: series.details || "",
      start_date: series.start_date, planned_time: (series.planned_time || "").slice(0, 5),
      cadence: series.cadence, interval_count: series.interval_count,
      custom_unit: series.custom_unit || "days", ends_when: series.ends_when,
      end_date: series.end_date || "", occurrence_limit: series.occurrence_limit || 10,
    });
    setError("");
    setShowForm(true);
  }
  function set(key, value) { setForm(current => ({ ...current, [key]: value })); }

  async function save() {
    const title = form.title.trim();
    const count = Number(form.interval_count);
    const afterCount = Number(form.occurrence_limit);
    if (!seriesVerified || loading || busy || !title || title.length > 220
      || (editing === null && (
        !form.start_date || !Number.isInteger(count) || count < 1 || count > 365
        || (form.ends_when === "on_date" && (!form.end_date || form.end_date < form.start_date))
        || (form.ends_when === "after_count" && (!Number.isInteger(afterCount) || afterCount < 1 || afterCount > 5000))
      ))) return;
    setBusy(true); setError(""); setNotice("");
    try {
      if (editing) {
        // Editing title/details/time alters only future newly materialised rows;
        // existing and completed occurrences are never silently rewritten.
        const { data: changed, error: failure } = await supabase.from("personal_task_series")
          .update({ title, details: form.details.trim() || null, planned_time: form.planned_time || null })
          .eq("id", editing).eq("org_id", me.org_id).eq("profile_id", me.id)
          .select("id").single();
        if (failure || changed?.id !== editing)
          throw new Error("Private series edit was not confirmed by the server.");
        setNotice("Series details updated. Recorded occurrences are unchanged. Stop this series and create a new one to change its schedule.");
      } else {
        const payload = {
          org_id: me.org_id, profile_id: me.id, title,
          details: form.details.trim() || null,
          start_date: form.start_date, planned_time: form.planned_time || null,
          cadence: form.cadence, interval_count: form.cadence === "weekdays" ? 1 : count,
          custom_unit: form.cadence === "custom" ? form.custom_unit : null,
          ends_when: form.ends_when, end_date: form.ends_when === "on_date" ? form.end_date : null,
          occurrence_limit: form.ends_when === "after_count" ? afterCount : null,
        };
        const { data, error: failure } = await supabase.from("personal_task_series")
          .insert(payload).select("id").single();
        if (failure) throw failure;
        const { error: generateFailure } = await supabase.rpc("personal_materialize_task_series", {
          p_series_id: data.id, p_through_date: futureHorizon(),
        });
        if (generateFailure) throw generateFailure;
        setNotice("Private recurring task saved. Overdue instances remain visible until you complete them.");
      }
      setShowForm(false); setEditing(null);
      await refresh(); await onChanged?.();
    } catch {
      // An insert may have committed before materialisation/read-back failed.
      // Close the composer and demand a verified reread, not duplicate Create.
      setShowForm(false); setEditing(null); setList([]); setVerifiedIdentity(null);
      setError("The recurring task action could not be confirmed. Verify your existing series before trying again.");
    } finally { setBusy(false); }
  }

  async function changeStatus(series, remove = false) {
    if (busy || !seriesVerified || loading) return;
    if (remove && !window.confirm(
      "Delete this repetition and all future incomplete instances? Past completed tasks will be preserved."
    )) return;
    setBusy(true); setError(""); setNotice("");
    try {
      if (remove) {
        const { error: futureFailure } = await supabase.from("personal_day_tasks")
          .delete().eq("org_id", me.org_id).eq("profile_id", me.id).eq("series_id", series.id)
          .gte("plan_date", dayInAccra()).is("completed_at", null);
        if (futureFailure) throw futureFailure;
        const { data: removed, error: removeFailure } = await supabase.from("personal_task_series")
          .delete().eq("id", series.id).eq("org_id", me.org_id).eq("profile_id", me.id)
          .select("id").single();
        if (removeFailure || removed?.id !== series.id)
          throw new Error("Private recurrence deletion was not confirmed by the server.");
        setNotice("Repetition deleted. Earlier recorded instances remain intact.");
      } else {
        const { data: changed, error: failure } = await supabase.from("personal_task_series")
          .update({ is_active: !series.is_active })
          .eq("id", series.id).eq("org_id", me.org_id).eq("profile_id", me.id)
          // Compare-and-set rejects another tab's intervening pause/resume.
          .eq("is_active", series.is_active)
          .select("id,is_active").single();
        if (failure || changed?.id !== series.id || changed.is_active !== !series.is_active)
          throw new Error("Private series state change was not confirmed by the server.");
        setNotice(series.is_active ? "Repetition paused; recorded instances remain." : "Repetition resumed.");
        if (!series.is_active) {
          const { error: generateFailure } = await supabase.rpc("personal_materialize_task_series", {
            p_series_id: series.id, p_through_date: futureHorizon(),
          });
          if (generateFailure) throw generateFailure;
        }
      }
      await refresh(); await onChanged?.();
    } catch {
      setList([]); setVerifiedIdentity(null);
      setError("The repetition change could not be confirmed. Verify your existing series before trying again.");
    } finally { setBusy(false); }
  }

  if (!ready) return <section className="phase6-day-block" aria-label="Private recurring tasks">
    <h3>Repeating tasks</h3>
    <p className="screen-note">Private repetition becomes operational after its reviewed database migration. No repetition is being simulated.</p>
  </section>;

  return <section className="phase6-day-block" aria-label="Private recurring tasks">
    <div className="phase6-day-block-head">
      <h3>Repeating tasks</h3>
      <Button variant="secondary" size="sm" disabled={busy||!seriesVerified} onClick={startNew}>New repetition</Button>
    </div>
    <p className="screen-note">Only you can see these tasks. A missed instance stays overdue; changing a template never silently alters recorded completed tasks.</p>
    {error && <p role="alert">{error}</p>}
    {notice && <p role="status">{notice}</p>}
    {loading && <p role="status">Loading your private repetitions…</p>}
    {ready && !loading && !seriesVerified && <Button variant="secondary" size="sm" disabled={busy} onClick={() => void refresh()}>Verify private series</Button>}
    {seriesVerified && list.length === 0 && <p className="phase6-day-empty">No repeating private tasks recorded yet.</p>}
    {(seriesVerified ? list : []).map(series => <div className="phase6-private-task-card" key={series.id}>
      <strong>{series.title}</strong>
      <small>{series.cadence === "custom" ? `Every ${series.interval_count} ${series.custom_unit}` : cadenceOptions.find(option => option[0] === series.cadence)?.[1]}
        {" · "}Starts {series.start_date}
        {" · "}{series.ends_when === "never" ? "No ending" : series.ends_when === "on_date" ? `Ends ${series.end_date}` : `Ends after ${series.occurrence_limit} occurrences`}
        {!series.is_active ? " · Paused" : ""}
      </small>
      <div className="phase6-private-task-actions">
        <Button size="sm" variant="secondary" disabled={busy} onClick={() => edit(series)}>Edit details</Button>
        <Button size="sm" variant="secondary" disabled={busy} onClick={() => changeStatus(series)}>
          {series.is_active ? "Pause" : "Resume"}
        </Button>
        <Button size="sm" variant="quiet" disabled={busy} onClick={() => changeStatus(series, true)}>Delete repetition</Button>
      </div>
    </div>)}

    {showForm && seriesVerified && <div className="phase6-private-task-compose" style={{gridTemplateColumns:"minmax(0,1fr)"}}>
      <h4>{editing ? "Edit repeating task details" : "Create private repetition"}</h4>
      <label style={{display:"grid",gap:6,minWidth:0}}>Task title
        <input className="field" aria-label="Recurring task title" maxLength={220}
          value={form.title} onChange={e => set("title", e.target.value)} />
      </label>
      <label style={{display:"grid",gap:6,minWidth:0}}>Details (optional)
        <textarea className="field" aria-label="Recurring task details"
          maxLength={4000} value={form.details} onChange={e => set("details", e.target.value)} />
      </label>
      <label style={{display:"grid",gap:6,minWidth:0}}>Time (optional)
        <input className="field" aria-label="Recurring task time" type="time"
          value={form.planned_time} onChange={e => set("planned_time", e.target.value)} />
      </label>
      {!editing && <>
        <label style={{display:"grid",gap:6,minWidth:0}}>First occurrence
          <input className="field" aria-label="Recurring task starts" type="date"
            value={form.start_date} onChange={e => set("start_date", e.target.value)} />
        </label>
        <label style={{display:"grid",gap:6,minWidth:0}}>Repeat
          <select className="field" aria-label="Recurring task frequency"
            value={form.cadence} onChange={e => set("cadence", e.target.value)}>
            {cadenceOptions.map(([key,label]) => <option key={key} value={key}>{label}</option>)}
          </select>
        </label>
        {form.cadence === "custom" && <div className="phase6-composer-grid">
          <label style={{display:"grid",gap:6,minWidth:0}}>Every
            <input className="field" aria-label="Recurring task interval" type="number"
              min={1} max={365} value={form.interval_count}
              onChange={e => set("interval_count", e.target.value)} />
          </label>
          <label style={{display:"grid",gap:6,minWidth:0}}>Interval
            <select className="field" aria-label="Recurring task interval unit"
              value={form.custom_unit} onChange={e => set("custom_unit", e.target.value)}>
              <option value="days">Days</option><option value="weeks">Weeks</option>
              <option value="months">Months</option>
            </select>
          </label>
        </div>}
        <label style={{display:"grid",gap:6,minWidth:0}}>Repetition ends
          <select className="field" aria-label="Recurring task ending"
            value={form.ends_when} onChange={e => set("ends_when", e.target.value)}>
            <option value="never">Never</option>
            <option value="on_date">On a date</option>
            <option value="after_count">After a number of occurrences</option>
          </select>
        </label>
        {form.ends_when === "on_date" && <label style={{display:"grid",gap:6,minWidth:0}}>Last date
          <input className="field" aria-label="Recurring task end date" type="date"
            min={form.start_date} value={form.end_date} onChange={e => set("end_date", e.target.value)} />
        </label>}
        {form.ends_when === "after_count" && <label style={{display:"grid",gap:6,minWidth:0}}>Number of occurrences
          <input className="field" aria-label="Recurring task occurrence count" type="number"
            min={1} max={5000} value={form.occurrence_limit}
            onChange={e => set("occurrence_limit", e.target.value)} />
        </label>}
      </>}
      {editing && <p className="screen-note">Existing instances, including completed ones, keep their history. To change the schedule, pause this series and start a new repetition.</p>}
      <div className="phase6-private-task-actions">
        <Button disabled={busy} variant="secondary" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
        <Button disabled={busy || !seriesVerified || !form.title.trim()} size="sm" onClick={save}>
          {busy ? "Saving…" : editing ? "Save details" : "Start repetition"}
        </Button>
      </div>
    </div>}
  </section>;
}

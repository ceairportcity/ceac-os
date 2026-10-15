import { useState } from "react";
import { supabase } from "../lib/supabase";
import { Sheet } from "./bits";
import { Button } from "../experience-v2/components";

const timeAt = (iso) => iso ? new Date(iso).toLocaleTimeString("en-GB", {
  timeZone:"Africa/Accra", hour:"2-digit", minute:"2-digit", hourCycle:"h23",
}) : "";
const dateAt = (iso) => iso ? new Intl.DateTimeFormat("en-CA", {
  timeZone:"Africa/Accra", year:"numeric", month:"2-digit", day:"2-digit",
}).format(new Date(iso)) : "";
const toAccraIso = (date,time) =>
  date && time ? new Date(`${date}T${time}:00Z`).toISOString() : null;

export default function PersonalPlanningEditor({ me, item, onClose, onChanged }) {
  const kind = item.kind;
  const [title,setTitle] = useState(item.title || "");
  const [details,setDetails] = useState(item.details || item.body || "");
  const [date,setDate] = useState(kind === "event" ? dateAt(item.starts_at) : item.plan_date || "");
  const [time,setTime] = useState(kind === "event" ? timeAt(item.starts_at) : (item.planned_time || "").slice(0,5));
  const [endTime,setEndTime] = useState(kind === "event" ? timeAt(item.ends_at) : "");
  const [location,setLocation] = useState(item.location || "");
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState("");

  const table = kind === "task" ? "personal_day_tasks"
    : kind === "event" ? "personal_calendar_events"
    : "personal_day_notes";

  const valid = Boolean(
    kind === "note" ? details.trim() : title.trim()
  ) && (kind !== "event" || (date && time && (!endTime || endTime >= time)));
  async function finish(result) {
    if (result.error) throw result.error;
    await onChanged?.();
    onClose?.();
  }
  async function save() {
    if (!valid || busy) return;
    setBusy(true);setError("");
    try {
      let values;
      if (kind === "task") {
        values = { title:title.trim(), details:details.trim() || null,
          plan_date:date || null, planned_time:date ? time || null : null };
      } else if (kind === "event") {
        values = { title:title.trim(), details:details.trim() || null,
          starts_at:toAccraIso(date,time), ends_at:endTime ? toAccraIso(date,endTime) : null,
          location:location.trim() || null };
      } else values = { title:item.note_kind === "daily" ? null : title.trim() || null, body:details };
      await finish(await supabase.from(table).update(values)
        .eq("id",item.id).eq("profile_id",me.id));
    } catch {
      setError("This private change could not be confirmed. Refresh before retrying.");
    } finally { setBusy(false); }
  }
  async function remove() {
    if (busy || !window.confirm(
      kind === "task" && item.series_id
        ? "Remove only this instance? Other occurrences and completed history remain unchanged."
        : "Delete this private item? This action cannot be undone."
    )) return;
    setBusy(true);setError("");
    try {
      // Keep series' unique date key when one occurrence is deleted, so the
      // server never resurrects that date during later materialisation.
      const operation = kind === "task" && item.series_id
        ? supabase.from(table).update({ dismissed_at:new Date().toISOString() })
        : supabase.from(table).delete();
      await finish(await operation.eq("id",item.id).eq("profile_id",me.id));
    } catch {
      setError("Deletion could not be confirmed. Refresh before retrying.");
    } finally { setBusy(false); }
  }

  return <Sheet onClose={() => { if(!busy)onClose?.(); }}>
    <div className="phase6-planning-composer">
      <div><span className="eyebrow">Private planning</span>
        <h2>Edit {kind}</h2><p className="screen-note">Only you can view or change this record. Organisation work, Manager reports and HR records are separate.</p>
      </div>
      {kind !== "note" && <label>Title
        <input className="field" aria-label="Edit private item title" maxLength={220}
          value={title} onChange={e=>setTitle(e.target.value)}/>
      </label>}
      {kind === "task" && <div className="phase6-composer-grid">
        <label>Planned date (optional)
          <input type="date" className="field" aria-label="Edit private task date" value={date}
            onChange={e=>setDate(e.target.value)} />
        </label>
        <label>Time (optional)
          <input type="time" className="field" aria-label="Edit private task time"
            value={time} onChange={e=>setTime(e.target.value)}/>
        </label>
      </div>}
      {kind === "event" && <div className="phase6-composer-grid">
        <label>Date
          <input type="date" className="field" aria-label="Edit private event date"
            value={date} onChange={e=>setDate(e.target.value)}/>
        </label>
        <label>Start time
          <input type="time" className="field" aria-label="Edit private event time"
            value={time} onChange={e=>setTime(e.target.value)}/>
        </label>
        <label>End time (optional)
          <input type="time" className="field" aria-label="Edit private event end time"
            value={endTime} onChange={e=>setEndTime(e.target.value)}/>
        </label>
        <label>Location (optional)
          <input className="field" aria-label="Edit private event location"
            value={location} onChange={e=>setLocation(e.target.value)}/>
        </label>
      </div>}
      {kind === "task" && item.series_id && <p className="screen-note">Editing this occurrence does not change the recurrence schedule or any completed occurrence.</p>}
      <label>{kind === "note" ? "Note" : "Details (optional)"}
        <textarea className="field" aria-label="Edit private item details"
          maxLength={kind === "note" ? 12000 : 4000} rows={5} value={details}
          onChange={e=>setDetails(e.target.value)} />
      </label>
      {error && <p role="alert">{error}</p>}
      <div className="phase6-composer-actions">
        <Button variant="quiet" disabled={busy} onClick={remove}>Delete {kind}</Button>
        <Button variant="secondary" disabled={busy} onClick={onClose}>Cancel</Button>
        <Button disabled={busy || !valid} onClick={save}>{busy ? "Saving…" : "Save changes"}</Button>
      </div>
    </div>
  </Sheet>;
}

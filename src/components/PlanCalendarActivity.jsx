import "../guide/guide.css";
import { useEffect, useRef, useState } from "react";
import { FieldGroup, ProductNotice } from "./bits";
import { Button, ComposerDrawer } from "../experience-v2/components";
import { supabase } from "../lib/supabase";
import { calendarDay, calendarDate } from "../lib/calendarPlanning";

export default function PlanCalendarActivity({ me, unitId, unitName, date, onClose, onSaved }) {
  const [units, setUnits] = useState([]);
  const [projects, setProjects] = useState([]);
  const [audience, setAudience] = useState(unitId || "");
  const [title, setTitle] = useState("");
  const [type, setType] = useState("other");
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("10:00");
  const [allDay, setAllDay] = useState(false);
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [project, setProject] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [optionsError, setOptionsError] = useState("");
  const request = useRef(null);
  const writing = useRef(false);
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const [orgUnits, projectList] = await Promise.all([
          unitId ? Promise.resolve({ data:[{ id:unitId, name:unitName }] }) : supabase.from("units")
            .select("id,name").eq("org_id", me.org_id).eq("active", true).order("name"),
          supabase.from("projects").select("id,name,lead_unit_id,project_units(unit_id)")
            .eq("org_id", me.org_id).order("name"),
        ]);
        if (!active) return;
        if (orgUnits.error) throw orgUnits.error;
        setUnits(orgUnits.data || []);
        if (projectList.error) setOptionsError("Projects could not load. You can still save an activity without a project.");
        else setProjects(projectList.data || []);
      } catch {
        if (active) setOptionsError("Calendar audiences could not load. Close and reopen this form to try again.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [me.org_id, unitId, unitName]);

  const availableProjects = projects.filter((item) => item.lead_unit_id === audience || item.project_units?.some((unit) => unit.unit_id === audience));
  const valid = title.trim() && audience && (allDay || start && end && start < end);

  async function save(event) {
    event.preventDefault();
    if (!valid || loading || writing.current) return;
    const nextDay = calendarDate(date);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);
    const payload = {
      org_id: me.org_id, unit_id: audience, project_id: project || null,
      title: title.trim(), kind: type, scope: "unit", is_unit_plan: true, all_day: allDay,
      starts_at: `${date}T${allDay ? "00:00" : start}:00Z`,
      ends_at: allDay ? `${calendarDay(nextDay)}T00:00:00Z` : `${date}T${end}:00Z`,
      location: location.trim() || null, notes: notes.trim() || null, created_by: me.id,
    };
    const signature = JSON.stringify(payload);
    if (request.current?.signature !== signature) request.current = { signature, id:crypto.randomUUID() };
    const id = request.current.id;
    writing.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await supabase.from("ministry_events").insert({ ...payload, id }).select("id,title").single();
      let saved = result.data;
      if (result.error?.code === "23505") {
        const verified = await supabase.from("ministry_events").select("id,title")
          .eq("id", id).eq("created_by", me.id).maybeSingle();
        if (verified.error) throw verified.error;
        saved = verified.data;
      } else if (result.error) throw result.error;
      if (saved?.id !== id) throw new Error("Save could not be confirmed.");
      onSaved(saved.title);
    } catch {
      setError("CEAC could not confirm this activity. Your entries are still here. Retry the same form to check the original save.");
    } finally {
      writing.current = false;
      setBusy(false);
    }
  }

  return <ComposerDrawer open title="Plan activity" description={`Shared unit activity · ${date} · Accra time`}
    onClose={() => !busy && onClose()} footer={<>
      <Button variant="secondary" disabled={busy} onClick={onClose}>Cancel</Button>
      <Button type="submit" form="ceac-activity-form" busy={busy} disabled={!valid || loading}>Save activity</Button>
    </>}>
    <form id="ceac-activity-form" onSubmit={save}>
      <fieldset disabled={busy} className="ceac-activity-fields">
        <FieldGroup label="Activity name"><input className="field" required value={title} maxLength={160} onChange={(event) => setTitle(event.target.value)} /></FieldGroup>
        {unitId ? <p>Audience <strong>{unitName}</strong></p> : <FieldGroup label="Unit audience">
          <select className="field" required value={audience} onChange={(event) => { setAudience(event.target.value); setProject(""); }}>
            <option value="">Choose a unit</option>
            {units.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}
          </select>
        </FieldGroup>}
        <FieldGroup label="Activity type"><select className="field" value={type} onChange={(event) => setType(event.target.value)}>
          <option value="other">Activity or rehearsal</option><option value="training">Training</option>
          <option value="outreach">Outreach</option><option value="service">Service</option><option value="convention">Convention</option>
        </select></FieldGroup>
        <label><input type="checkbox" checked={allDay} onChange={(event) => setAllDay(event.target.checked)} /> All day</label>
        {!allDay && <div className="ceac-activity-times">
          <FieldGroup label="Starts"><input className="field" type="time" required value={start} onChange={(event) => setStart(event.target.value)} /></FieldGroup>
          <FieldGroup label="Ends"><input className="field" type="time" required value={end} onChange={(event) => setEnd(event.target.value)} /></FieldGroup>
        </div>}
        <FieldGroup label="Location"><input className="field" value={location} maxLength={200} onChange={(event) => setLocation(event.target.value)} /></FieldGroup>
        <FieldGroup label="Project (optional)"><select className="field" value={project} disabled={loading} onChange={(event) => setProject(event.target.value)}>
          <option value="">No project</option>
          {availableProjects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select></FieldGroup>
        <FieldGroup label="Planning notes"><textarea className="field" rows={3} value={notes} maxLength={2000} onChange={(event) => setNotes(event.target.value)} /></FieldGroup>
      </fieldset>
      {optionsError && <ProductNotice tone="attention">{optionsError}</ProductNotice>}
      {error && <ProductNotice tone="error">{error}</ProductNotice>}
    </form>
  </ComposerDrawer>;
}

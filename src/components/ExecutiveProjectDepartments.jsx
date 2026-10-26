import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { FieldGroup, ProductNotice, LoadingState } from "./bits";
import { ComposerDrawer } from "../experience-v2/components";

export default function ExecutiveProjectDepartments({ me, project, onSaved }) {
  const [open, setOpen] = useState(false);
  const [units, setUnits] = useState([]);
  const [unitId, setUnitId] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);
  useEffect(() => {
    let current = true;
    if (open) {
      setReady(false); setUnits([]); setUnitId(""); setReason(""); setError(null);
      supabase.from("units").select("id,name", {count:"exact"}).eq("org_id",me.org_id).eq("active",true).order("name").then(result => {
        if (!current) return;
        if (result.error || !Array.isArray(result.data) || result.data.length !== result.count) setError("Departments could not be completely loaded.");
        else { setUnits(result.data); setReady(true); }
      });
    }
    return () => { current = false; };
  }, [open,me.id,me.org_id,project.id]);
  if (!me.is_exec || !["planned","active"].includes(project.status)) return null;
  const linked = new Set([project.lead_unit_id, ...project.participants.map(row => row.unit_id)]);
  async function save(event) {
    event.preventDefault();
    if (busy || !units.some(unit => unit.id === unitId && !linked.has(unit.id)) || !reason.trim()) return;
    setBusy(true); setError(null);
    try {
      const result = await supabase.rpc("executive_assign_project_department", {p_project_id:project.id,p_unit_id:unitId,p_reason:reason.trim()});
      if (result.error) throw result.error;
      const check = await supabase.from("project_units").select("project_id,unit_id").eq("project_id",project.id).eq("unit_id",unitId).single();
      if (check.error || check.data?.project_id !== project.id || check.data?.unit_id !== unitId) throw new Error("The saved department could not be verified. Reopen the project before trying again.");
      setUnitId(""); setReason(""); setOpen(false); onSaved?.();
    } catch { setError("The department assignment could not be confirmed. Check the project before retrying."); }
    finally { setBusy(false); }
  }
  return <><button type="button" className="btn btn-ghost" onClick={() => setOpen(true)}>Assign department</button>
    {open && <ComposerDrawer open title="Assign department to project" description={project.name} onClose={() => {if (!busy) setOpen(false);}}>
      <p className="screen-note">The department will participate in this project. Its staff will see the shared project records allowed by their roles.</p>
      {error && <ProductNotice tone="error" title="Department assignment unavailable">{error}</ProductNotice>}
      {!ready ? !error && <LoadingState label="Loading departments…" /> : <form onSubmit={save}>
        {!units.some(unit => !linked.has(unit.id)) && <p role="status">All active departments already participate in this project.</p>}
        <FieldGroup label="Department"><select className="field" aria-label="Project department" value={unitId} disabled={busy} required onChange={e => setUnitId(e.target.value)}><option value="">Choose a department</option>{units.filter(unit => !linked.has(unit.id)).map(unit => <option key={unit.id} value={unit.id}>{unit.name}</option>)}</select></FieldGroup>
        <FieldGroup label="Reason"><textarea className="field" aria-label="Department assignment reason" required value={reason} disabled={busy} onChange={e => setReason(e.target.value)} /></FieldGroup>
        <div className="exec-directory-actions"><button className="btn" type="submit" disabled={busy || !unitId || !reason.trim()}>{busy ? "Saving…" : "Assign department"}</button><button className="btn btn-ghost" type="button" disabled={busy} onClick={() => setOpen(false)}>Cancel</button></div>
      </form>}
    </ComposerDrawer>}
  </>;
}

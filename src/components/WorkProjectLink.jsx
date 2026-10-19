import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { FieldGroup, Sheet } from "./bits";

/** Change the linked project of one's own open, organisational self-created work.
 * A server RPC enforces project/unit permissions and writes an immutable audit. */
export default function WorkProjectLink({ me, item, onLinked }) {
  const [open, setOpen] = useState(false);
  const [projectId, setProjectId] = useState(item.project_id || "");
  const [objectiveId, setObjectiveId] = useState(item.objective_id || "");
  const [phaseId, setPhaseId] = useState(item.phase_id || "");
  const [projects, setProjects] = useState([]);
  const [objectives, setObjectives] = useState([]);
  const [phases, setPhases] = useState([]);
  const [search, setSearch] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const submitting = useRef(false);

  const isOwner = item.assignee_id === me.id && item.origin === "self_created"
    && item.visibility === "unit"
    && !["completed","self_certified","cancelled","in_review"].includes(item.status);
  useEffect(() => {
    if (!open || !isOwner) return;
    let current = true;
    setLoading(true);
    setError("");
    supabase.from("projects")
      .select("id,name,status,lead_unit_id,project_units(unit_id)")
      .eq("org_id", me.org_id).in("status", ["planned","active"]).order("name")
      .then(({data,error:readError}) => {
        if (!current) return;
        if (readError) setError("Authorised projects could not be loaded. No link has been changed.");
        else setProjects((data || []).filter((p) =>
          p.lead_unit_id === item.unit_id ||
          (p.project_units || []).some((row) => row.unit_id === item.unit_id)
        ));
        setLoading(false);
      });
    return () => { current = false; };
  }, [open, me.id, me.org_id, item.id, item.unit_id, isOwner]);

  useEffect(() => {
    if (!open || !projectId) { setObjectives([]); setPhases([]); return; }
    let current = true;
    setLoading(true);
    Promise.all([
      supabase.from("objectives").select("id,name,ref,unit_id")
        .eq("project_id",projectId).eq("unit_id",item.unit_id),
      supabase.from("project_phases").select("id,name")
        .eq("project_id",projectId).order("position"),
    ]).then(([o,p]) => {
      if (!current) return;
      if (o.error || p.error) setError("Project objectives or phases could not be verified.");
      else { setError(""); setObjectives(o.data || []); setPhases(p.data || []); }
      setLoading(false);
    });
    return () => { current = false; };
  }, [open, projectId, item.unit_id]);

  async function save(e) {
    e.preventDefault();
    if (!isOwner || submitting.current || loading || busy || reason.trim().length < 6 || error) return;
    submitting.current = true;
    setBusy(true);
    setError("");
    try {
      const request = {
        p_work_item_id: item.id, p_project_id: projectId || null,
        p_objective_id: projectId && objectiveId ? objectiveId : null,
        p_phase_id: projectId && phaseId ? phaseId : null,
        p_reason: reason.trim(),
      };
      const result = await supabase.rpc("stage2_relink_own_work", request);
      if (result.error) throw result.error;
      const check = await supabase.from("work_items")
        .select("id,org_id,assignee_id,project_id,objective_id,phase_id")
        .eq("id",item.id).eq("org_id",me.org_id).eq("assignee_id",me.id).maybeSingle();
      if (check.error || !check.data
        || (check.data.project_id || null) !== request.p_project_id
        || (check.data.objective_id || null) !== request.p_objective_id
        || (check.data.phase_id || null) !== request.p_phase_id)
        throw new Error("The updated project link could not be verified. Check the work detail before retrying.");
      setOpen(false);
      onLinked?.();
    } catch (e) {
      setError(e?.message || "This project link could not be saved.");
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  if (!isOwner) return null;
  return <div className="s2-work-project-link">
    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(true)}>
      {item.project_id ? "Change linked project" : "Link to a project"} →
    </button>
    {open && <Sheet onClose={() => { if (!busy) setOpen(false); }}>
      <div className="eyebrow">Responsibility attribution</div>
      <h2 className="h2">Change linked project</h2>
      <p className="screen-note">Only your own open self-created work can change its project. Previous links and your reason stay in the audit history.</p>
      {error && <p role="alert" className="flag flag-amber">{error}</p>}
      <form onSubmit={save}>
        <FieldGroup label="Search authorised projects">
          <input className="field" type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Find project by name" />
        </FieldGroup>
        <FieldGroup label="Project">
          <select className="field" value={projectId} disabled={loading}
            onChange={(e) => {setProjectId(e.target.value);setObjectiveId("");setPhaseId("");setError("");}}>
            <option value="">No project linked</option>
            {projects.filter((p) => !search || p.name.toLowerCase().includes(search.toLowerCase()))
              .map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            {projectId && !projects.some((p) => p.id === projectId) && <option value={projectId}>Current project (not available for changes)</option>}
          </select>
        </FieldGroup>
        {projectId && <>
          <FieldGroup label="Objective (optional)">
            <select className="field" value={objectiveId} disabled={loading} onChange={(e) => setObjectiveId(e.target.value)}>
              <option value="">No objective</option>
              {objectives.map((o) => <option value={o.id} key={o.id}>{o.ref} · {o.name}</option>)}
            </select>
          </FieldGroup>
          <FieldGroup label="Phase (optional)">
            <select className="field" value={phaseId} disabled={loading} onChange={(e) => setPhaseId(e.target.value)}>
              <option value="">No phase</option>
              {phases.map((p) => <option value={p.id} key={p.id}>{p.name}</option>)}
            </select>
          </FieldGroup>
        </>}
        <FieldGroup label="Why is this link changing?">
          <textarea className="field" rows={3} value={reason} onChange={(e) => setReason(e.target.value)}
            minLength={6} maxLength={1200} required placeholder="Explain the correction for the record" />
        </FieldGroup>
        <button type="submit" className="btn" disabled={busy||loading||Boolean(error)||reason.trim().length<6}>
          {busy ? "Verifying..." : "Save project link"}
        </button>
      </form>
    </Sheet>}
  </div>;
}

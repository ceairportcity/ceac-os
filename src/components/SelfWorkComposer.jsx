import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { FieldGroup, Sheet } from "./bits";
import { ComposerDrawer } from "../experience-v2/components";
import OrganisationalRepeatFields, { initialOrganisationalRepeat, organisationalRepeatDetails } from "./OrganisationalRepeatFields";

/**
 * First-class self-created organisational work for Manager, Administration,
 * Executive and other employed roles. The existing production RPC authorises
 * the real actor's membership, project and optional objective/phase.
 * This form cannot impersonate Staff or approve its own achievement.
 */
export default function SelfWorkComposer({ me, onClose, onCreated }) {
  const [executiveUnits, setExecutiveUnits] = useState([]);
  const [unitsError, setUnitsError] = useState("");
  const [unitsReload, setUnitsReload] = useState(0);
  const [unitsScope, setUnitsScope] = useState("");
  const actorScope = `${me.org_id}:${me.id}`;
  const memberships = me.is_exec ? (unitsScope === actorScope ? executiveUnits : []) : (me.memberships || []).filter((member) => member.unit_id);
  useEffect(() => {
    let current = true;
    setExecutiveUnits([]); setUnitsError(""); setUnitsScope("");
    if (me.is_exec) supabase.from("units").select("id,name", { count:"exact" }).eq("org_id",me.org_id).eq("active",true).order("name").then(result => {
      if (!current) return;
      if (result.error || !Array.isArray(result.data) || result.count !== result.data.length) setUnitsError("Departments could not be loaded. Try again.");
      else { setExecutiveUnits(result.data.map(unit => ({unit_id:unit.id,unit_name:unit.name}))); setUnitsScope(actorScope); }
    });
    return () => { current = false; };
  }, [me.id,me.org_id,me.is_exec,unitsReload]);
  const [unitId, setUnitId] = useState(
    me.is_exec ? (me.unit_id || "") : memberships.some((member) => member.unit_id === me.unit_id)
      ? me.unit_id : (memberships[0]?.unit_id || "")
  );
  const [title, setTitle] = useState("");
  const [purpose, setPurpose] = useState("");
  const [outcome, setOutcome] = useState("");
  const [due, setDue] = useState("");
  const [repeat, setRepeat] = useState(initialOrganisationalRepeat);
  const [projectId, setProjectId] = useState("");
  const [projectQuery, setProjectQuery] = useState("");
  const [objectiveId, setObjectiveId] = useState("");
  const [phaseId, setPhaseId] = useState("");
  const [steps, setSteps] = useState([""]);
  const [noSteps, setNoSteps] = useState(false);
  const [projects, setProjects] = useState([]);
  const [objectives, setObjectives] = useState([]);
  const [phases, setPhases] = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [loadingRelations, setLoadingRelations] = useState(false);
  const [projectError, setProjectError] = useState("");
  const [error, setError] = useState("");
  const [relationsError, setRelationsError] = useState("");
  const [relationsReload, setRelationsReload] = useState(0);
  const [saving, setSaving] = useState(false);
  const submitting = useRef(false);

  useEffect(() => {
    let current = true;
    setProjectId("");
    setObjectiveId("");
    setPhaseId("");
    setProjects([]);
    setObjectives([]);
    setPhases([]);
    setProjectError("");
    if (!unitId) { setLoadingProjects(false); return () => { current = false; }; }
    setLoadingProjects(true);
    supabase.from("projects")
      .select("id,name,status,lead_unit_id,project_units(unit_id)")
      .eq("org_id", me.org_id)
      .in("status", ["planned", "active"])
      .order("name")
      .then(({ data, error: readError }) => {
        if (!current) return;
        if (readError) setProjectError("Authorised projects could not be loaded. You can still create unlinked work.");
        else setProjects((data || []).filter((project) =>
          me.is_exec || project.lead_unit_id === unitId ||
          (project.project_units || []).some((entry) => entry.unit_id === unitId)
        ));
        setLoadingProjects(false);
      });
    return () => { current = false; };
  }, [me.id, me.org_id, unitId]);

  useEffect(() => {
    let current = true;
    setObjectiveId("");
    setPhaseId("");
    setObjectives([]);
    setPhases([]);
    setError("");
    setRelationsError("");
    if (!projectId || !unitId) { setLoadingRelations(false); return () => { current = false; }; }
    setLoadingRelations(true);
    setRelationsError("");
    Promise.all([
      supabase.from("objectives")
        .select("id,project_id,unit_id,ref,name").eq("project_id", projectId).eq("unit_id", unitId),
      supabase.from("project_phases")
        .select("id,project_id,name").eq("project_id", projectId).order("position"),
    ]).then(([objectivesRead, phasesRead]) => {
      if (!current) return;
      if (objectivesRead.error || phasesRead.error) {
        setRelationsError("Project objectives or phases could not be verified. Select no project or retry.");
      } else {
        setError("");
        setRelationsError("");
        setObjectives(objectivesRead.data || []);
        setPhases(phasesRead.data || []);
      }
      setLoadingRelations(false);
    });
    return () => { current = false; };
  }, [me.id,me.org_id,unitId,projectId,relationsReload]);

  const cleanSteps = noSteps ? [] : steps.map((step) => step.trim()).filter(Boolean);
  const canSubmit = Boolean(memberships.some(member => member.unit_id === unitId) && !unitsError && title.trim() && outcome.trim() && (noSteps || cleanSteps.length))
    && !saving && !loadingRelations && !relationsError;

  async function submit(event) {
    event.preventDefault();
    if (!canSubmit || submitting.current) return;
    submitting.current = true;
    setSaving(true);
    setError("");
    try {
      let data;
      if (repeat.enabled) {
        const created = await supabase.rpc("create_typed_work", {
          p_kind: "routine", p_unit_id: unitId, p_assignee_id: me.id, p_title: title.trim(),
          p_expected_outcome: outcome.trim(), p_purpose: purpose.trim() || null, p_project_id: projectId || null,
          p_objective_id: objectiveId || null, p_phase_id: phaseId || null, p_visibility: "unit",
          p_details: organisationalRepeatDetails(repeat, cleanSteps),
        });
        if (created.error) throw created.error;
        if (!created.data) throw new Error("Creation is uncertain. Check My work before retrying.");
        const receipt = await supabase.from("work_items").select("id,ref").eq("id",created.data).single();
        if (receipt.error) throw new Error("Creation could not be verified. Check My work before retrying.");
        data = receipt.data;
      } else {
      const { data: taskData, error: writeError } = await supabase.rpc("create_task_with_checklist", {
        p_unit_id: unitId,
        p_assignee_id: me.id,
        p_title: title.trim(),
        p_expected_outcome: outcome.trim(),
        p_sub_team_id: null,
        p_project_id: projectId || null,
        p_objective_id: projectId && objectiveId ? objectiveId : null,
        p_phase_id: projectId && phaseId ? phaseId : null,
        p_purpose: purpose.trim() || null,
        p_instructions: null,
        p_due_at: due ? new Date(due).toISOString() : null,
        p_origin: "self_created",
        p_visibility: "unit",
        p_steps: cleanSteps,
      });
      if (writeError) throw writeError;
      data = taskData;
      }
      if (!data?.id || typeof data?.ref !== "string" || !data.ref.trim())
        throw new Error("Creation is uncertain. Check your work before trying again.");
      // Do not treat an acknowledgement alone as proof of an authorised write.
      const check = await supabase.from("work_items")
        .select("id,kind,org_id,unit_id,assignee_id,ref,origin,visibility,project_id,objective_id,phase_id")
        .eq("id", data.id).eq("org_id", me.org_id).eq("assignee_id", me.id).maybeSingle();
      const saved = check.data;
      if (check.error || !saved || saved.kind !== (repeat.enabled ? "routine" : "task") || saved.ref !== data.ref || saved.origin !== "self_created"
        || saved.visibility !== "unit" || saved.unit_id !== unitId
        || (saved.project_id || null) !== (projectId || null)
        || (saved.objective_id || null) !== (objectiveId || null)
        || (saved.phase_id || null) !== (phaseId || null)) {
        throw new Error("The save outcome could not be verified. Check My work before retrying.");
      }
      onCreated?.(saved);
      onClose?.();
    } catch (e) {
      setError(e?.message || "The responsibility could not be saved.");
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  }

  const WorkSheet = me.is_exec ? ComposerDrawer : Sheet;
  return <WorkSheet open title={me.is_exec ? "Add my work" : undefined} panelClassName={me.is_exec ? "reference-composer" : undefined} onClose={() => { if (!saving) onClose?.(); }}>
    <div className="eyebrow">My responsibilities</div>
    {!me.is_exec && <h2 className="h2">Add my work</h2>}
    <p className="screen-note">Record a responsibility you personally carry. It is not an approved result until reviewed under CEAC's existing rules.</p>
    {!me.is_exec && !memberships.length && <p role="alert">No authorised department membership is recorded for this account. Administration must assign membership before creating organisational work.</p>}
    {unitsError && <div role="alert">{unitsError}<button type="button" className="btn btn-ghost" onClick={() => setUnitsReload(n=>n+1)}>Retry departments</button></div>}
    {me.is_exec && <p className="screen-note">Choose the department this responsibility supports. Your Executive role does not require department membership.</p>}
    {projectError && <p role="status">{projectError}</p>}
    {me.is_exec && projectId && projects.some(project => project.id === projectId && project.lead_unit_id !== unitId && !(project.project_units || []).some(row => row.unit_id === unitId)) && <p role="status" className="flag flag-amber">Saving this work will also add the selected department to the project. Its staff will see shared project records allowed by their roles.</p>}
    {(relationsError || error) && <div role="alert" className="flag flag-amber">{relationsError || error}{relationsError && <button type="button" className="btn btn-ghost" onClick={() => setRelationsReload(n=>n+1)}>Retry project details</button>}</div>}
    <form onSubmit={submit}>
      {(me.is_exec || memberships.length > 1) && <FieldGroup label="Department">
        <select className="field" aria-label="Department for my work" value={unitId}
          onChange={(e) => setUnitId(e.target.value)}>
          <option value="">Choose a department</option>
          {memberships.map((m) => <option key={m.unit_id} value={m.unit_id}>{m.unit_name || "Authorised department"}</option>)}
        </select>
      </FieldGroup>}
      <FieldGroup label="Responsibility *">
        <input className="field" aria-label="My responsibility title" value={title}
          onChange={(e) => setTitle(e.target.value)} placeholder="What are you responsible for?" required />
      </FieldGroup>
      <FieldGroup label="Expected result *">
        <textarea className="field" aria-label="Expected result" rows={2} value={outcome}
          onChange={(e) => setOutcome(e.target.value)} placeholder="What outcome are you working towards?" required />
      </FieldGroup>
      <FieldGroup label="Purpose (optional)">
        <textarea className="field" rows={2} value={purpose} onChange={(e) => setPurpose(e.target.value)} />
      </FieldGroup>
      <FieldGroup label="Find an authorised project">
        <input className="field" type="search" aria-label="Search projects for my work" value={projectQuery}
          onChange={(e)=>setProjectQuery(e.target.value)} placeholder="Search by project name" />
      </FieldGroup>
      <FieldGroup label="Project (optional)">
        <select className="field" aria-label="Link my work to project" value={projectId}
          disabled={loadingProjects} onChange={(e) => setProjectId(e.target.value)}>
          <option value="">Not linked to a project</option>
          {projects.filter((p) => !projectQuery || p.name.toLowerCase().includes(projectQuery.toLowerCase()) || p.id === projectId).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </FieldGroup>
      {projectId && <>
        <FieldGroup label="Project objective (optional)">
          <select className="field" value={objectiveId} disabled={loadingRelations}
            onChange={(e) => setObjectiveId(e.target.value)}>
            <option value="">No objective selected</option>
            {objectives.map((o) => <option value={o.id} key={o.id}>{o.ref} · {o.name}</option>)}
          </select>
        </FieldGroup>
        <FieldGroup label="Project phase (optional)">
          <select className="field" value={phaseId} disabled={loadingRelations}
            onChange={(e) => setPhaseId(e.target.value)}>
            <option value="">No phase selected</option>
            {phases.map((p) => <option value={p.id} key={p.id}>{p.name}</option>)}
          </select>
        </FieldGroup>
      </>}
      <OrganisationalRepeatFields value={repeat} onChange={setRepeat} disabled={saving} />
      {!repeat.enabled && <FieldGroup label="Due date (optional)">
        <input className="field" type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} />
      </FieldGroup>}
      <div className="card small">
        <label><input type="checkbox" checked={noSteps} onChange={(e) => setNoSteps(e.target.checked)} /> No steps needed yet</label>
        {!noSteps && <>
          <p>{repeat.enabled ? "Steps to repeat each time" : "Completion steps"}</p>
          {steps.map((step, index) => <div key={index} className="inline-step">
            <input className="field" aria-label={`Step ${index+1}`} value={step}
              onChange={(e) => setSteps((current) => current.map((v,i) => i===index ? e.target.value : v))}
              placeholder="What action is needed?" />
            {steps.length>1 && <button type="button" className="btn btn-ghost btn-sm"
              onClick={() => setSteps((current) => current.filter((_,i) => i!==index))}>Remove</button>}
          </div>)}
          {steps.length<12 && <button type="button" className="btn btn-ghost btn-sm"
            onClick={() => setSteps((current) => [...current, ""])}>Add step</button>}
        </>}
      </div>
      <button type="submit" className="btn" disabled={!canSubmit}>{saving ? "Saving..." : "Add my work"}</button>
    </form>
  </WorkSheet>;
}

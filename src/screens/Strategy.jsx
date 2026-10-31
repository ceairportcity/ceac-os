import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { EmptyState, FieldGroup, LoadingState, ProductNotice, Sheet } from "../components/bits";
import { ComposerDrawer } from "../experience-v2/components";
import { humanError } from "../lib/productLanguage";
import "./premium-ministry.css";

const FORM_LABELS = { ministry_direction: "ministry priority", ministry_objective: "ministry goal", unit_objective: "department goal" };

const TYPE_LABELS = {
  ministry_direction: "Ministry Direction",
  ministry_objective: "Ministry Objective",
  unit_objective: "Unit Objective",
};

function displayNumber(value) {
  if (value === null || value === undefined || value === "") return "not recorded";
  return Number(value).toLocaleString("en-GB", { maximumFractionDigits: 2 });
}

function blankForm(type, parentId = "", unitId = "") {
  return {
    id: "",
    nodeType: type,
    parentId,
    unitId,
    name: "",
    statement: "",
    measurementKind: "descriptive",
    measureLabel: "",
    targetValue: "",
    targetUnit: "",
    currentValue: "",
    startsOn: "",
    targetOn: "",
    status: "active",
    reason: "",
  };
}

export default function Strategy({ me, createRequest = null, onCreateHandled, onOpenProject = null }) {
  const [nodes, setNodes] = useState([]);
  const [links, setLinks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [units, setUnits] = useState([]);
  const [form, setForm] = useState(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [linkForm, setLinkForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  const capabilities = me.capabilities || [];
  const canGlobal = Boolean(me.is_exec || capabilities.includes("strategy.manage"));
  const managedUnitIds = useMemo(
    () => (me.memberships || []).filter((membership) => membership.role === "manager").map((membership) => membership.unit_id),
    [me.memberships],
  );

  useEffect(() => { load(); }, [me.id]);
  useEffect(() => {
    if (createRequest === "ministry_objective" && canGlobal) {
      setError(null);
      setNotice(null);
      setShowAdvanced(false);
      setForm(blankForm("ministry_objective"));
      onCreateHandled?.();
    }
  }, [createRequest, canGlobal]);

  async function load() {
    setLoading(true);
    setError(null);
    const [nodesResult, linksResult, projectsResult, unitsResult] = await Promise.all([
      supabase.from("strategy_nodes").select("*").eq("org_id", me.org_id).order("created_at"),
      supabase.from("strategy_delivery_links").select("*").eq("org_id", me.org_id).order("created_at"),
      supabase.from("projects").select("id,name,lead_unit_id,status").eq("org_id", me.org_id).order("name"),
      supabase.from("units").select("id,name,code").eq("org_id", me.org_id).eq("active", true).order("name"),
    ]);
    const firstError = nodesResult.error || linksResult.error || projectsResult.error || unitsResult.error;
    if (firstError) {
      setError(humanError(firstError, "Strategy could not load."));
      setLoading(false);
      return;
    }
    setNodes(nodesResult.data || []);
    setLinks(linksResult.data || []);
    setProjects(projectsResult.data || []);
    setUnits(unitsResult.data || []);
    setLoading(false);
  }

  const directions = nodes.filter((node) => node.node_type === "ministry_direction");
  const ministriesByParent = useMemo(() => {
    const out = {};
    nodes.filter((node) => node.node_type === "ministry_objective").forEach((node) => {
      (out[node.parent_id] = out[node.parent_id] || []).push(node);
    });
    return out;
  }, [nodes]);
  const unitsByParent = useMemo(() => {
    const out = {};
    nodes.filter((node) => node.node_type === "unit_objective").forEach((node) => {
      (out[node.parent_id] = out[node.parent_id] || []).push(node);
    });
    return out;
  }, [nodes]);

  function canEdit(node) {
    if (canGlobal) return true;
    return node.node_type === "unit_objective" && managedUnitIds.includes(node.unit_id);
  }

  function openCreate(nodeType, parentId = "", unitId = "") {
    setError(null);
    setNotice(null);
    setShowAdvanced(false);
    setForm(blankForm(nodeType, parentId, unitId || (nodeType === "unit_objective" && managedUnitIds.length === 1 ? managedUnitIds[0] : "")));
  }

  function openEdit(node) {
    setShowAdvanced(true);
    setError(null);
    setNotice(null);
    setForm({
      id: node.id,
      nodeType: node.node_type,
      parentId: node.parent_id || "",
      unitId: node.unit_id || "",
      name: node.name,
      statement: node.statement,
      measurementKind: node.measurement_kind,
      measureLabel: node.measure_label || "",
      targetValue: node.target_value ?? "",
      targetUnit: node.target_unit || "",
      currentValue: node.current_value ?? "",
      startsOn: node.starts_on || "",
      targetOn: node.target_on || "",
      status: node.status,
      reason: "",
    });
  }

  async function saveNode() {
    if (!form || !form.name.trim() || !form.statement.trim() || !form.reason.trim()) return;
    if (form.nodeType !== "ministry_direction" && !form.parentId) return;
    if (form.nodeType === "unit_objective" && !form.unitId) return;
    if (form.measurementKind === "numeric" && (form.targetValue === "" || !form.targetUnit.trim())) return;

    setBusy(true);
    setError(null);
    setNotice(null);

    const payload = {
      org_id: me.org_id,
      node_type: form.nodeType,
      parent_id: form.nodeType === "ministry_direction" ? null : form.parentId,
      unit_id: form.nodeType === "unit_objective" ? form.unitId : null,
      name: form.name.trim(),
      statement: form.statement.trim(),
      measurement_kind: form.measurementKind,
      measure_label: form.measureLabel.trim() || null,
      target_value: form.measurementKind === "numeric" ? Number(form.targetValue) : null,
      target_unit: form.measurementKind === "numeric" ? form.targetUnit.trim() : null,
      current_value: form.measurementKind === "numeric" && form.currentValue !== "" ? Number(form.currentValue) : null,
      starts_on: form.startsOn || null,
      target_on: form.targetOn || null,
      status: form.status,
      change_reason: form.reason.trim(),
      updated_by: me.id,
    };

    let result;
    if (form.id) {
      result = await supabase.from("strategy_nodes").update(payload).eq("id", form.id);
    } else {
      result = await supabase.from("strategy_nodes").insert({ ...payload, created_by: me.id });
    }

    setBusy(false);
    if (result.error) {
      setError(humanError(result.error, "The strategy record could not be saved."));
      return;
    }

    setForm(null);
    setNotice(form.id ? "Strategy change recorded." : "Strategy record created.");
    await load();
  }

  async function saveLink() {
    if (!linkForm?.nodeId || !linkForm.projectId || !linkForm.reason.trim()) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    const { error: linkError } = await supabase.from("strategy_delivery_links").insert({
      org_id: me.org_id,
      strategy_node_id: linkForm.nodeId,
      project_id: linkForm.projectId,
      status: "active",
      change_reason: linkForm.reason.trim(),
      created_by: me.id,
      updated_by: me.id,
    });
    setBusy(false);
    if (linkError) {
      setError(humanError(linkError, "The project could not be linked to this Unit Objective."));
      return;
    }
    setLinkForm(null);
    setNotice("Project linked to Unit Objective.");
    await load();
  }

  async function withdrawLink(link) {
    const reason = window.prompt("Why is this project no longer linked to this Unit Objective?");
    if (!reason || reason.trim().length < 3) return;
    setBusy(true);
    setError(null);
    const { error: linkError } = await supabase.from("strategy_delivery_links")
      .update({ status: "withdrawn", change_reason: reason.trim(), updated_by: me.id })
      .eq("id", link.id);
    setBusy(false);
    if (linkError) {
      setError(humanError(linkError, "The project link could not be withdrawn."));
      return;
    }
    setNotice("Project link withdrawn. Its history remains on record.");
    await load();
  }

  function measurementLine(node) {
    if (node.measurement_kind === "descriptive") return <div className="small">Progress for this goal is described in words.</div>;
    return <div className="small">
      {node.measure_label ? node.measure_label + " · " : ""}
      current {displayNumber(node.current_value)} {node.target_unit} · target {displayNumber(node.target_value)} {node.target_unit}
    </div>;
  }

  function unitName(id) {
    return units.find((unit) => unit.id === id)?.name || "Unit";
  }

  function projectName(id) {
    return projects.find((project) => project.id === id)?.name || "Project";
  }

  function NodeActions({ node, allowChild }) {
    return <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
      {canEdit(node) && <button className="btn btn-ghost btn-sm" onClick={() => openEdit(node)}>Edit</button>}
      {allowChild === "ministry" && canGlobal && <button className="btn btn-ghost btn-sm" onClick={() => openCreate("ministry_objective", node.id)}>Add ministry goal</button>}
      {allowChild === "unit" && (canGlobal || managedUnitIds.length > 0) && <button className="btn btn-ghost btn-sm" onClick={() => openCreate("unit_objective", node.id)}>Add department goal</button>}
      {node.node_type === "unit_objective" && canEdit(node) && <button className="btn btn-ghost btn-sm" onClick={() => setLinkForm({ nodeId: node.id, projectId: "", reason: "" })}>Link project</button>}
    </div>;
  }

  if (loading) return <div className="body"><LoadingState label="Loading strategy…" /></div>;

  const executiveSurface=Boolean(me.is_exec);
  return <div className={executiveSurface ? "body ev2-executive-ministry ceac-premium-ministry" : "body"}>
    <div className={executiveSurface ? "ev2ex-ministry-head" : ""} style={executiveSurface ? undefined : { paddingTop: 26 }}>
      <div className={executiveSurface ? "ev2ex-ministry-head-copy" : ""}>
        <div className="eyebrow">{executiveSurface ? "Leadership priorities" : "Goals & strategy"}</div>
        <h1 className="h1">{executiveSurface ? "Ministry goals" : "Strategy"}</h1>
        <p className="screen-note">{executiveSurface ? "Set what CEAC wants to achieve. Departments turn these goals into action, and Projects shows the work being delivered." : "Ministry Direction → Ministry Objective → Unit Objective. Descriptive goals stay descriptive; numeric goals always show the result beside its target."}</p>
      </div>
      {canGlobal && executiveSurface && <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button className="btn" onClick={() => openCreate(directions.length ? "ministry_objective" : "ministry_direction")}>{directions.length ? "Add ministry goal" : "Set first ministry priority"}</button>
        <button className="btn btn-ghost" onClick={() => openCreate("ministry_direction")}>Add another priority</button>
      </div>}
    </div>

    {error && <ProductNotice tone="error" title="Strategy">{error}</ProductNotice>}
    {notice && <ProductNotice tone="success" title="Strategy">{notice}</ProductNotice>}

    {canGlobal && !executiveSurface && <div style={{ marginTop: 16 }}>
      <button className="btn wide-auto" onClick={() => openCreate("ministry_direction")}>Add Ministry Direction</button>
    </div>}

    {executiveSurface && <section className="ceac-ministry-guide" aria-label="How ministry goals work">
      <header><h2>From direction to results</h2><p>Use this page to decide what matters. Use Projects to manage the work that delivers it.</p></header>
      <div className="ceac-ministry-guide-grid">
        <div><span>01</span><strong>Set the priority</strong><p>What should CEAC focus on?</p></div>
        <div><span>02</span><strong>Agree on the goal</strong><p>What would a good result look like?</p></div>
        <div><span>03</span><strong>Follow the work</strong><p>Which departments and projects are making it happen?</p></div>
      </div>
    </section>}

    {executiveSurface && <section className="ev2ex-ministry-facts" aria-label="Recorded ministry direction and delivery">
       <div className="ev2p-summary" role="group" aria-label="Ministry priorities">
         <div><strong>{directions.filter((d) => d.status !== "closed").length}</strong><span>Current priorities</span></div>
         <div><strong>{nodes.filter((n) => n.node_type === "ministry_objective" && n.status !== "closed").length}</strong><span>Ministry goals</span></div>
         <div><strong>{nodes.filter((n) => n.status === "at_risk" || n.status === "not_met").length}</strong><span>Need attention</span></div>
         <div><strong>{new Set(links.filter((l) => l.status === "active").map((l) => l.project_id)).size}</strong><span>Projects linked to goals</span></div>
       </div>
       <p className="screen-note">This is the bigger picture. Open Projects to see tasks and delivery dates. These counts come from recorded work, not automatic scores.</p>
     </section>}
     <div className={executiveSurface ? "sec ev2ex-ministry-section-title" : "sec"}><span>{executiveSurface ? "Priorities and goals" : "Strategic hierarchy"}</span><span>{nodes.length}</span></div>
    {directions.length === 0 && <EmptyState title="No ministry priorities yet">{executiveSurface ? "Start with one priority for CEAC. Then add goals for departments to work towards." : "An authorised strategy owner can record the first Ministry Direction without inventing a numeric score."}</EmptyState>}

    {directions.map((direction) => <section className={executiveSurface ? "card ev2ex-ministry-direction" : "card"} key={direction.id} style={executiveSurface ? undefined : { padding: 18, marginBottom: 14 }}>
      <div className="eyebrow">{TYPE_LABELS[direction.node_type]} · {direction.status.replaceAll("_", " ")}</div>
      <h2 className="h2" style={{ marginTop: 5 }}>{direction.name}</h2>
      <p className="screen-note">{direction.statement}</p>
      {measurementLine(direction)}
      <NodeActions node={direction} allowChild="ministry" />

      {(ministriesByParent[direction.id] || []).map((ministry) => <div className={executiveSurface ? "ev2ex-ministry-objective" : ""} key={ministry.id} style={executiveSurface ? undefined : { marginTop: 18, paddingTop: 16, borderTop: "1px solid var(--line-soft)" }}>
        <div className="eyebrow">{TYPE_LABELS[ministry.node_type]} · {ministry.status.replaceAll("_", " ")}</div>
        <h3 className="h2" style={{ marginTop: 4 }}>{ministry.name}</h3>
        <p className="screen-note">{ministry.statement}</p>
        {measurementLine(ministry)}
        <NodeActions node={ministry} allowChild="unit" />

        {(unitsByParent[ministry.id] || []).map((unitObjective) => {
          const activeLinks = links.filter((link) => link.strategy_node_id === unitObjective.id && link.status === "active");
          return <div className={executiveSurface ? "row ev2ex-unit-objective" : "row"} key={unitObjective.id} style={executiveSurface ? undefined : { marginTop: 12 }}>
            <div className="row-t">{unitName(unitObjective.unit_id)} · {unitObjective.name}</div>
            <div className="row-m">{unitObjective.statement}</div>
            <div style={{ marginTop: 7 }}>{measurementLine(unitObjective)}</div>
            <div className="small" style={{ marginTop: 5 }}>Status: {unitObjective.status.replaceAll("_", " ")}</div>
            {activeLinks.length > 0 && <div style={{ marginTop: 9 }}>
              <div className="small" style={{ fontWeight: 650 }}>Delivery projects</div>
              {activeLinks.map((link) => <div key={link.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: 5 }}>
                {onOpenProject ? <button type="button" className="text-action" onClick={() => onOpenProject(link.project_id)}>{projectName(link.project_id)}</button> : <span className="small">{projectName(link.project_id)}</span>}
                {canEdit(unitObjective) && <button className="text-action" disabled={busy} onClick={() => withdrawLink(link)}>Withdraw link</button>}
              </div>)}
            </div>}
            <NodeActions node={unitObjective} />
          </div>;
        })}
      </div>)}
    </section>)}

    {form && <ComposerDrawer
      open
      onClose={() => { if (!busy) setForm(null); }}
      title={form.id ? `Edit ${FORM_LABELS[form.nodeType]}` : `Add ${FORM_LABELS[form.nodeType]}`}
      description="Write what you want to achieve and why it matters. You can add a target and dates when you have them."
      panelClassName="reference-composer reference-objective-composer"
      footer={<button className="btn" disabled={busy || !form.name.trim() || !form.statement.trim() || !form.reason.trim() || (form.nodeType !== "ministry_direction" && !form.parentId) || (form.nodeType === "unit_objective" && !form.unitId) || (form.measurementKind === "numeric" && (form.targetValue === "" || !form.targetUnit.trim()))} onClick={saveNode}>
        {busy ? "Saving…" : form.id ? "Save changes" : `Add ${FORM_LABELS[form.nodeType]}`}
      </button>}
    >
            {form.nodeType === "ministry_objective" && <FieldGroup label="Which ministry priority is this goal part of? *">
        <select className="field" aria-label="Strategy parent direction" value={form.parentId}
          onChange={(event) => setForm({ ...form, parentId: event.target.value })} disabled={Boolean(form.id)}>
          <option value="">Choose the direction this objective supports</option>
          {directions.filter((direction) => direction.status !== "closed").map((direction) => <option key={direction.id} value={direction.id}>{direction.name}</option>)}
        </select>
      </FieldGroup>}
      {form.nodeType === "unit_objective" && <FieldGroup label="Responsible department *">
        <select className="field" aria-label="Strategy unit" value={form.unitId}
          onChange={(event) => setForm({ ...form, unitId: event.target.value })} disabled={Boolean(form.id)}>
          <option value="">Choose responsible department</option>
          {units.filter((unit) => canGlobal || managedUnitIds.includes(unit.id)).map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}
        </select>
      </FieldGroup>}
<FieldGroup label={form.nodeType === "ministry_direction" ? "Priority name *" : "Goal name *"}><input className="field" aria-label="Strategy name" placeholder="Name the specific ministry priority" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></FieldGroup>
      <FieldGroup label="What should this achieve? *"><textarea className="field" aria-label="Strategy statement" rows="4" placeholder="What are we trying to achieve?" value={form.statement} onChange={(event) => setForm({ ...form, statement: event.target.value })} /></FieldGroup>
      <button type="button" className="btn btn-ghost btn-sm" aria-expanded={showAdvanced}
        onClick={() => setShowAdvanced(value => !value)}>{showAdvanced ? "Hide additional planning details" : "Add measure, dates or status"}</button>
      {showAdvanced && <div className="reference-measurement-group">
      <FieldGroup label="Measurement *">
        <select className="field" aria-label="Strategy measurement" value={form.measurementKind} onChange={(event) => setForm({ ...form, measurementKind: event.target.value, targetValue: "", targetUnit: "", currentValue: "" })}>
          <option value="descriptive">Descriptive (no percentage)</option>
          <option value="numeric">Numeric result and target</option>
        </select>
      </FieldGroup>
      {form.measurementKind === "numeric" && <div className="ocr-composer-group reference-measurement-group">
        <FieldGroup label="What are we measuring?"><input className="field" aria-label="Strategy measure label" value={form.measureLabel} onChange={(event) => setForm({ ...form, measureLabel: event.target.value })} /></FieldGroup>
        <div className="ocr-composer-two">
          <FieldGroup label="Target"><input className="field" aria-label="Strategy target value" inputMode="decimal" value={form.targetValue} onChange={(event) => setForm({ ...form, targetValue: event.target.value.replace(/[^0-9.-]/g, "") })} /></FieldGroup>
          <FieldGroup label="Unit"><input className="field" aria-label="Strategy target unit" value={form.targetUnit} onChange={(event) => setForm({ ...form, targetUnit: event.target.value })} placeholder="people, outcomes…" /></FieldGroup>
        </div>
        <FieldGroup label="Current recorded result"><input className="field" aria-label="Strategy current value" inputMode="decimal" value={form.currentValue} onChange={(event) => setForm({ ...form, currentValue: event.target.value.replace(/[^0-9.-]/g, "") })} /></FieldGroup>
      </div>}
      <div className="ocr-composer-two">
        <FieldGroup label="Starts on"><input className="field" aria-label="Strategy start date" type="date" value={form.startsOn} onChange={(event) => setForm({ ...form, startsOn: event.target.value })} /></FieldGroup>
        <FieldGroup label="Target date"><input className="field" aria-label="Strategy target date" type="date" value={form.targetOn} onChange={(event) => setForm({ ...form, targetOn: event.target.value })} /></FieldGroup>
      </div>
      <FieldGroup label="Status">
        <select className="field" aria-label="Strategy status" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
          <option value="draft">Draft</option>
          <option value="active">Active</option>
          <option value="met">Met</option>
          <option value="closed">Closed</option>
        </select>
      </FieldGroup>

      </div>}
      <FieldGroup label="Why are you adding or changing this? *">
        <textarea className="field" aria-label="Strategy change reason" rows="2"
          placeholder="Why is this priority being recorded or revised?"
          value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} />
      </FieldGroup>
    </ComposerDrawer>}

    {linkForm && <Sheet onClose={() => { if (!busy) setLinkForm(null); }}>
      <div className="eyebrow">Strategy delivery</div>
      <div className="h2">Link project</div>
      <p className="screen-note">Connect an existing project to this objective so leadership can follow the work and its recorded outcomes.</p>
      <FieldGroup label="Project">
        <select className="field" aria-label="Strategy delivery project" value={linkForm.projectId} onChange={(event) => setLinkForm({ ...linkForm, projectId: event.target.value })}>
          <option value="">Choose visible project</option>
          {projects.filter((project) => project.status !== "closed").map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
        </select>
      </FieldGroup>
      <FieldGroup label="Reason / context"><textarea className="field" aria-label="Strategy delivery reason" rows="3" value={linkForm.reason} onChange={(event) => setLinkForm({ ...linkForm, reason: event.target.value })} /></FieldGroup>
      <button className="btn" style={{ marginTop: 14 }} disabled={busy || !linkForm.projectId || !linkForm.reason.trim()} onClick={saveLink}>{busy ? "Linking…" : "Link project"}</button>
    </Sheet>}
  </div>;
}

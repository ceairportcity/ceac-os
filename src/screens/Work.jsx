import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import AssignedRoutineOccurrences from "../components/AssignedRoutineOccurrences";
import OrganisationalRepeatFields, { initialOrganisationalRepeat, organisationalRepeatDetails } from "../components/OrganisationalRepeatFields";
import WorkRegisterLayout from "../components/WorkRegisterInspector";
import ResponsibilityRegister from "../components/ResponsibilityRegister";
import { humanError } from "../lib/productLanguage";
import { Sheet, FieldGroup, ProductNotice, LoadingState } from "../components/bits";
import {
  WorkActionStrip,
  WorkPageHeader,
  WorkTabs,
} from "../experience-v2/work-family/WorkFamilyV2";

const MODES = [
  ["all", "My work"],
  ["assigned", "Assigned"],
  ["agreed", "Created by me"],
  ["private", "Private"],
];

const BRAND_BOOK_DASHBOARD_CSS = `.fpg-brandbook-dashboard{display:grid;grid-template-columns:1.05fr .9fr 1fr;gap:10px;margin:12px 0 18px}
.fpg-brandbook-card{min-width:0;min-height:190px;padding:14px;border:1px solid var(--ev2-line);border-radius:14px;background:var(--ev2-surface);box-shadow:0 8px 24px rgba(29,42,64,.04)}
.fpg-brandbook-card>header{display:flex;justify-content:space-between;gap:10px;align-items:center;margin-bottom:12px}
.fpg-brandbook-card>header span{font-size:14px;font-weight:720}.fpg-brandbook-card>header small{color:var(--ev2-text-tertiary);font-size:12px}
.fpg-brandbook-schedule-list{display:grid;gap:7px}.fpg-brandbook-schedule-list>div{display:grid;grid-template-columns:34px minmax(0,1fr);gap:8px;align-items:center;padding:7px 0;border-top:1px solid var(--ev2-line)}
.fpg-brandbook-schedule-list>div:first-child{border-top:0}.fpg-brandbook-schedule-list b{display:grid;place-items:center;width:32px;height:32px;border:1px solid var(--ev2-line);border-radius:8px;font-size:12px}
.fpg-brandbook-schedule-list span{display:grid;gap:1px;min-width:0}.fpg-brandbook-schedule-list strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px}.fpg-brandbook-schedule-list small,.fpg-brandbook-schedule-list p{color:var(--ev2-text-secondary);font-size:12px}
.fpg-brandbook-hours>strong{display:block;margin:18px 0 10px;font-size:28px;letter-spacing:-.04em}.fpg-brandbook-hours-bars{height:76px;display:grid;grid-template-columns:repeat(7,1fr);gap:5px;align-items:end}
.fpg-brandbook-hours-bars>span{height:100%;display:grid;grid-template-rows:1fr 17px;align-items:end;gap:3px}.fpg-brandbook-hours-bars i{display:block;min-height:4px;border-radius:4px 4px 1px 1px;background:var(--ev2-action)}.fpg-brandbook-hours-bars small{text-align:center;color:var(--ev2-text-tertiary);font-size:12px}
.fpg-brandbook-hours>p{margin:9px 0 0;color:var(--ev2-text-secondary);font-size:12px;line-height:1.4}.fpg-brandbook-note{background:#f7d765;border-color:#e8c54c}.fpg-brandbook-note>p{min-height:88px;margin:16px 0;color:#3e3520;font-size:14px;line-height:1.5}.fpg-brandbook-note>footer{color:#6d5a24;font-size:12px}
.fpg-brandbook-context-warning{margin:-8px 0 14px;color:var(--ev2-text-tertiary);font-size:12px}
@media(max-width:820px){.fpg-brandbook-dashboard{grid-template-columns:1fr 1fr}.fpg-brandbook-note{grid-column:1/-1}}
@media(max-width:560px){.fpg-brandbook-dashboard{grid-template-columns:1fr}.fpg-brandbook-note{grid-column:auto}.fpg-brandbook-card{min-height:0}}`;

function ghanaDayKey(value) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Accra", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(value);
}

function minutesLabel(value) {
  const minutes = Math.max(0, Math.round(Number(value) || 0));
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours ? `${hours}h ${rest}m` : `${rest}m`;
}

export default function Work({ me, isManager = false, openItem }) {
  const viewKey = `ceac-work-view:v2:${me.id}`;
  let savedView = null;
  try { savedView = JSON.parse(sessionStorage.getItem(viewKey) || "null"); } catch { savedView = null; }
  const [mode, setMode] = useState(MODES.some(([value]) => value === savedView?.mode) ? savedView.mode : "all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [items, setItems] = useState([]);
  const [selectedWorkId, setSelectedWorkId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [projects, setProjects] = useState([]);
  const [proposals, setProposals] = useState([]);
  const [sheet, setSheet] = useState(null);
  const [createVisibility, setCreateVisibility] = useState("unit");
  const [projectId, setProjectId] = useState("");
  const [projectQuery, setProjectQuery] = useState("");
  const [objectiveId, setObjectiveId] = useState("");
  const [phaseId, setPhaseId] = useState("");
  const [objectives, setObjectives] = useState([]);
  const [phases, setPhases] = useState([]);
  const [projectContextLoading, setProjectContextLoading] = useState(false);
  const [projectContextError, setProjectContextError] = useState("");
  const [verifiedProjectId, setVerifiedProjectId] = useState("");
  const [title, setTitle] = useState("");
  const [purpose, setPurpose] = useState("");
  const [expectedOutcome, setExpectedOutcome] = useState("");
  const [due, setDue] = useState("");
  const [repeat, setRepeat] = useState(initialOrganisationalRepeat);
  const [steps, setSteps] = useState([""]);
  const [noStepsNeeded, setNoStepsNeeded] = useState(false);
  const [busy, setBusy] = useState(false);
  // Blocks two synchronous create clicks before React renders the busy state.
  const ownCreatePending = useRef(false);
  const [notice, setNotice] = useState(null);
  const loadSerial = useRef(0);
  const [proposalName, setProposalName] = useState("");
  const [proposalPurpose, setProposalPurpose] = useState("");
  const [proposalStart, setProposalStart] = useState("");
  const [proposalEnd, setProposalEnd] = useState("");
  const [brandbookContext, setBrandbookContext] = useState({ meetings: [], sessions: [], feedback: null });
  const [brandbookLoading, setBrandbookLoading] = useState(true);
  const [brandbookError, setBrandbookError] = useState(false);

  useEffect(() => { load(); return () => { loadSerial.current += 1; }; }, [mode, statusFilter, me.id, isManager]);
  useEffect(() => { loadProjects(); loadProposals(); }, [me.id, me.unit_id]);
  useEffect(() => {
    let current = true;
    setObjectiveId(""); setPhaseId(""); setObjectives([]); setPhases([]);
    setProjectContextError(""); setVerifiedProjectId("");
    if (sheet !== "self" || createVisibility !== "unit" || !projectId) {
      setProjectContextLoading(false);
      return () => { current = false; };
    }
    setProjectContextLoading(true);
    Promise.all([
      supabase.from("objectives")
        .select("id,ref,name,project_id,unit_id")
        .eq("project_id", projectId).eq("unit_id", me.unit_id),
      supabase.from("project_phases")
        .select("id,name,project_id").eq("project_id", projectId).order("position"),
    ]).then(([objectiveRead, phaseRead]) => {
      if (!current) return;
      if (objectiveRead.error || phaseRead.error) {
        setProjectContextError("The selected project's objectives or phases could not be verified. Select another project or reopen this form.");
        return;
      }
      setObjectives(objectiveRead.data || []);
      setPhases(phaseRead.data || []);
      setVerifiedProjectId(projectId);
    }).catch(() => {
      if (current) setProjectContextError("Project context could not be verified. Reopen this form to retry.");
    }).finally(() => {
      if (current) setProjectContextLoading(false);
    });
    return () => { current = false; };
  }, [sheet, createVisibility, projectId, me.org_id, me.unit_id]);
  useEffect(() => { loadBrandbookContext(); }, [me.id]);
  useEffect(() => {
    try { sessionStorage.setItem(viewKey, JSON.stringify({ mode })); } catch { /* Storage may be unavailable. */ }
  }, [viewKey, mode, statusFilter]);

  async function load(nextMode = mode, nextStatusFilter = statusFilter) {
    const serial = ++loadSerial.current;
    setLoading(true);
    setLoadError(null);
    setItems([]);

    let query = supabase.from("work_items")
      .select("id,ref,title,kind,status,due_at,visibility,origin,created_at,expected_outcome,project_id,unit_id,projects(name)")
      .eq("assignee_id", me.id);

    if (nextMode === "all") query = query.neq("visibility", "private");
    if (nextMode === "assigned") query = query.eq("visibility", "unit").in("origin", ["assigned", "assigned_by_exec"]);
    if (nextMode === "agreed") query = query.eq("visibility", "unit").eq("origin", "self_created");
    if (nextMode === "private") query = query.eq("visibility", "private");

    if (nextStatusFilter === "active") query = query.in("status", ["not_started", "in_progress", "returned"]);
    else if (nextStatusFilter === "completed") query = query.in("status", ["completed", "self_certified"]);
    else if (nextStatusFilter !== "all") query = query.eq("status", nextStatusFilter);

    const { data, error } = await query.order("due_at", { ascending: true, nullsFirst: false }).order("id");
    if (serial !== loadSerial.current) return;
    if (error) {
      setLoadError(error.message);
      setLoading(false);
      return;
    }
    setItems(data || []);
    setLoading(false);
  }

  async function loadBrandbookContext() {
    setBrandbookLoading(true);
    setBrandbookError(false);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);
    const recentWeek = new Date(today);
    recentWeek.setDate(recentWeek.getDate() - 6);

    const [meetingResult, sessionResult, feedbackResult] = await Promise.all([
      supabase.from("meeting_sessions")
        .select("id,title,starts_at,ends_at,status")
        .gte("starts_at", today.toISOString()).lt("starts_at", nextWeek.toISOString())
        .neq("status", "cancelled").order("starts_at").limit(8),
      supabase.from("work_sessions")
        .select("id,started_at,ended_at")
        .eq("profile_id", me.id).gte("started_at", recentWeek.toISOString())
        .lt("started_at", nextWeek.toISOString()).order("started_at"),
      supabase.from("feedback_notes")
        .select("id,note,created_at,profiles!feedback_notes_author_id_fkey(full_name)")
        .eq("profile_id", me.id).order("created_at", { ascending: false }).limit(1),
    ]);

    setBrandbookContext({
      meetings: meetingResult.error ? [] : (meetingResult.data || []),
      sessions: sessionResult.error ? [] : (sessionResult.data || []),
      feedback: feedbackResult.error ? null : (feedbackResult.data?.[0] || null),
    });
    setBrandbookError(Boolean(meetingResult.error || sessionResult.error || feedbackResult.error));
    setBrandbookLoading(false);
  }

  async function loadProjects() {
    if (!me.unit_id) return;
    const { data, error } = await supabase.from("projects")
      .select("id,name,lead_unit_id,project_units(unit_id)")
      .in("status", ["planned", "active"])
      .order("name");
    if (error) { setLoadError(error.message); return; }
    setProjects((data || []).filter((project) =>
      project.lead_unit_id === me.unit_id || (project.project_units || []).some((unit) => unit.unit_id === me.unit_id)
    ));
  }

  async function loadProposals() {
    if (!me.unit_id) return;
    const { data, error } = await supabase.from("project_proposals")
      .select("id,name,purpose,starts_on,ends_on,state,project_id,review_note,created_at")
      .eq("proposed_by", me.id)
      .order("created_at", { ascending: false })
      .limit(12);
    if (error) {
      if (!String(error.message || "").includes("project_proposals")) setLoadError(error.message);
      return;
    }
    setProposals(data || []);
  }

  function openProjectProposal() {
    setProposalName("");
    setProposalPurpose("");
    setProposalStart("");
    setProposalEnd("");
    setNotice(null);
    setSheet("proposal");
  }

  async function createProjectProposal() {
    if (!proposalName.trim() || !proposalPurpose.trim()) return;
    setBusy(true); setLoadError(null); setNotice(null);
    try {
      const { error } = await supabase.from("project_proposals").insert({
        org_id: me.org_id,
        unit_id: me.unit_id,
        proposed_by: me.id,
        name: proposalName.trim(),
        purpose: proposalPurpose.trim(),
        starts_on: proposalStart || null,
        ends_on: proposalEnd || null,
      });
      if (error) throw error;
      setSheet(null);
      setNotice("Project proposed. Your Unit Head must confirm it before it becomes a project.");
      await loadProposals();
    } catch (error) {
      setLoadError(humanError(error, "The project proposal could not be submitted."));
    } finally {
      setBusy(false);
    }
  }

  function openCreate(visibility) {
    setCreateVisibility(visibility);
    setProjectId(""); setProjectQuery("");
    setObjectiveId(""); setPhaseId(""); setObjectives([]); setPhases([]);
    setVerifiedProjectId(""); setProjectContextError("");
    setTitle("");
    setPurpose("");
    setExpectedOutcome("");
    setDue("");
    setRepeat(initialOrganisationalRepeat());
    setSteps([""]);
    setNoStepsNeeded(false);
    setNotice(null);
    setSheet("self");
  }

  async function createOwnTask() {
    if (busy || ownCreatePending.current) return;
    const clean = noStepsNeeded ? [] : steps.map((step) => step.trim()).filter(Boolean);
    if (!title.trim() || !expectedOutcome.trim() || (!noStepsNeeded && !clean.length)) return;
    if (createVisibility === "unit" && projectId &&
        (projectContextLoading || projectContextError || verifiedProjectId !== projectId
          || !projects.some(project => project.id === projectId)
          || (objectiveId && !objectives.some(objective => objective.id === objectiveId))
          || (phaseId && !phases.some(phase => phase.id === phaseId)))) {
      setLoadError("The selected project context is not verified. Refresh the work form before saving.");
      return;
    }
    const linkedProjectId = createVisibility === "unit" ? projectId || null : null;
    const linkedObjectiveId = linkedProjectId && objectiveId ? objectiveId : null;
    const linkedPhaseId = linkedProjectId && phaseId ? phaseId : null;

    ownCreatePending.current = true;
    setBusy(true);
    setLoadError(null);
    setNotice(null);
    try {
      const dueIso = due ? new Date(due).toISOString() : null;
      let created;
      if (repeat.enabled && createVisibility === "unit") {
        const result = await supabase.rpc("create_typed_work", {
          p_kind: "routine", p_unit_id: me.unit_id, p_assignee_id: me.id, p_title: title.trim(),
          p_expected_outcome: expectedOutcome.trim(), p_purpose: purpose.trim() || null, p_project_id: linkedProjectId,
          p_objective_id: linkedObjectiveId, p_phase_id: linkedPhaseId,
          p_visibility: "unit", p_details: organisationalRepeatDetails(repeat, clean),
        });
        if (result.error) throw result.error;
        if (!result.data) throw new Error("Creation is uncertain. Check My work before retrying.");
        const receipt = await supabase.from("work_items").select("id,ref").eq("id",result.data).single();
        if (receipt.error) throw new Error("Creation could not be verified. Check My work before retrying.");
        created = receipt.data;
      } else {
      const { data: taskData, error: createError } = await supabase.rpc("create_task_with_checklist", {
        p_unit_id: me.unit_id,
        p_assignee_id: me.id,
        p_title: title.trim(),
        p_expected_outcome: expectedOutcome.trim(),
        p_sub_team_id: null,
        p_project_id: linkedProjectId,
        p_objective_id: linkedObjectiveId,
        p_phase_id: linkedPhaseId,
        p_purpose: purpose.trim() || null,
        p_instructions: null,
        p_due_at: dueIso,
        p_origin: "self_created",
        p_visibility: createVisibility,
        p_steps: clean,
      });
      if (createError) throw createError;
      created = taskData;
      }
      // The server may have committed despite an incomplete client response.
      // Never claim a successful task or encourage a blind duplicate retry.
      if (typeof created?.ref !== "string" || !created.ref.trim()) {
        setSheet(null);
        throw new Error("The work creation outcome is uncertain. Check your existing work before creating another task.");
      }
      const confirmation = await supabase.from("work_items")
        .select("id,kind,ref,org_id,assignee_id,origin,visibility,project_id,objective_id,phase_id")
        .eq("ref", created.ref).eq("org_id", me.org_id)
        .eq("assignee_id", me.id).maybeSingle();
      if (confirmation.error || !confirmation.data?.id
          || confirmation.data.kind !== (repeat.enabled && createVisibility === "unit" ? "routine" : "task")
          || confirmation.data.origin !== "self_created"
          || confirmation.data.visibility !== createVisibility
          || (confirmation.data.project_id || null) !== linkedProjectId
          || (confirmation.data.objective_id || null) !== linkedObjectiveId
          || (confirmation.data.phase_id || null) !== linkedPhaseId) {
        setSheet(null);
        throw new Error("The new work record could not be independently verified. Check your work list before creating another task.");
      }

      setSheet(null);
      setSelectedWorkId(confirmation.data.id);
      setMode(createVisibility === "private" ? "private" : "agreed");
      setStatusFilter("all");
      setNotice(createVisibility === "private"
        ? `${created.ref} added as private work. Only you can see it.`
        : `${created.ref} added to My work. It appears immediately in your record.`);
      await load(createVisibility === "private" ? "private" : "agreed", "all");
    } catch (error) {
      setLoadError(humanError(error, "The work could not be added."));
    } finally {
      ownCreatePending.current = false;
      setBusy(false);
    }
  }

  const visibleItems = [...items].sort((left, right) => {
    const a = left.due_at ? new Date(left.due_at).getTime() : Number.MAX_SAFE_INTEGER;
    const b = right.due_at ? new Date(right.due_at).getTime() : Number.MAX_SAFE_INTEGER;
    return a - b || left.title.localeCompare(right.title);
  });
  const selectedInView = selectedWorkId === "none" ? null : (visibleItems.some((item) => item.id === selectedWorkId) ? selectedWorkId : (visibleItems[0]?.id || null));

  const sessionDays = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - (6 - index));
    return { date, key: ghanaDayKey(date), minutes: 0 };
  });
  const sessionByDay = new Map(sessionDays.map((row) => [row.key, row]));
  brandbookContext.sessions.forEach((row) => {
    if (!row.started_at || !row.ended_at) return;
    const start = new Date(row.started_at);
    const end = new Date(row.ended_at);
    const minutes = Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
    const day = sessionByDay.get(ghanaDayKey(start));
    if (day) day.minutes += minutes;
  });
  const totalSessionMinutes = sessionDays.reduce((sum, row) => sum + row.minutes, 0);
  const maxSessionMinutes = Math.max(1, ...sessionDays.map((row) => row.minutes));
  const feedback = brandbookContext.feedback;

  return <div className="body staff-work ev2-work-page ev2-work-staff">
    <style data-fpg-brandbook-dashboard>{BRAND_BOOK_DASHBOARD_CSS}</style>
    <WorkPageHeader
      eyebrow={me.unit_name}
      title="Work"
      description="Plan, record, and finish your work. Keep every contribution connected to the right project."
      actionLabel="Add my work"
      onAction={() => openCreate("unit")}
    />

    {notice && <ProductNotice tone="success" title="Work updated">{notice}</ProductNotice>}
    {proposals.length > 0 && <details className="finance-section ev2w-inline-panel">
      <summary><span>My project proposals</span><b>{proposals.length}</b></summary>
      <div className="finance-section-body">
        {proposals.map((proposal) => <div className="row" key={proposal.id}>
          <div className="row-t">{proposal.name}</div>
          <div className="row-m">{proposal.state === "submitted" ? "Waiting for Unit Head confirmation" : proposal.state === "approved" ? "Confirmed as a project" : "Not approved"}</div>
          {proposal.review_note && <div className="row-note">{proposal.review_note}</div>}
        </div>)}
      </div>
    </details>}


    {loadError && <ProductNotice tone="error" title="Could not load your work">{loadError}</ProductNotice>}
    {loading && <LoadingState label="Loading your work…" />}
    {!loading && !loadError && <WorkRegisterLayout me={me} selectedId={selectedInView}
      onClose={() => setSelectedWorkId("none")} openItem={openItem} recordCount={visibleItems.length}
      tabs={<WorkTabs items={MODES} value={mode} onChange={nextMode=>{setMode(nextMode);setStatusFilter("all");}} ariaLabel="Work source" />}>
      <ResponsibilityRegister key={mode} rows={visibleItems} selectedId={selectedInView}
        onSelect={setSelectedWorkId} onAdd={()=>openCreate(mode === "private" ? "private" : "unit")} />
    </WorkRegisterLayout>}
    <WorkActionStrip actions={[
      {label:"Add private work",icon:"lock",onClick:()=>openCreate("private")},
      {label:"Propose project",icon:"projects",onClick:openProjectProposal},
    ]} />
    {(mode === "all" || mode === "assigned") && !loading && !loadError && <AssignedRoutineOccurrences me={me} onOpen={openItem} />}

    <details className="s2-work-context"><summary>Schedule and recorded work context</summary>
    <section className="fpg-brandbook-dashboard" aria-label="Recorded work context">
      <article className="fpg-brandbook-card fpg-brandbook-schedule">
        <header><span>Weekly schedule</span><small>Next 7 days</small></header>
        <div className="fpg-brandbook-schedule-list">
          {brandbookContext.meetings.slice(0,4).map((meeting) => {
            const start = new Date(meeting.starts_at);
            return <div key={meeting.id}>
              <b>{start.toLocaleDateString("en-GB", { timeZone:"Africa/Accra", day:"2-digit" })}</b>
              <span><strong>{meeting.title}</strong><small>{start.toLocaleDateString("en-GB", { timeZone:"Africa/Accra", weekday:"short", month:"short" })} · {start.toLocaleTimeString("en-GB", { timeZone:"Africa/Accra", hour:"2-digit", minute:"2-digit" })}</small></span>
            </div>;
          })}
          {!brandbookLoading && !brandbookContext.meetings.length && <p>No meetings are recorded for the next 7 days.</p>}
          {brandbookLoading && <p>Loading recorded schedule…</p>}
        </div>
      </article>

      <article className="fpg-brandbook-card fpg-brandbook-hours">
        <header><span>Recorded work sessions</span><small>Last 7 days</small></header>
        <strong>{minutesLabel(totalSessionMinutes)}</strong>
        <div className="fpg-brandbook-hours-bars" aria-label="Recorded work-session time by day">
          {sessionDays.map((row) => <span key={row.key} title={minutesLabel(row.minutes)}>
            <i style={{height: `${Math.max(5, Math.round(row.minutes / maxSessionMinutes * 100))}%`}} />
            <small>{row.date.toLocaleDateString("en-GB", { weekday:"narrow" })}</small>
          </span>)}
        </div>
        <p>Ended session records only. This is not payroll or performance time.</p>
      </article>

      <article className="fpg-brandbook-card fpg-brandbook-note">
        <header><span>Latest feedback note</span><small>{feedback?.created_at ? new Date(feedback.created_at).toLocaleDateString("en-GB", { day:"numeric", month:"short" }) : "Text record"}</small></header>
        <p>{feedback?.note || (brandbookLoading ? "Loading recorded note…" : "No feedback note is recorded yet.")}</p>
        <footer>{feedback?.profiles?.full_name || "CEAC record"} · {feedback ? "text only · audio not recorded" : "no audio record"}</footer>
      </article>
    </section>
    {brandbookError && <p className="fpg-brandbook-context-warning">Some recorded work context is unavailable. No missing value has been inferred.</p>}

    </details>

    {sheet === "proposal" && <Sheet onClose={() => !busy && setSheet(null)}>
      <div className="eyebrow">Project proposal</div>
      <div className="h2" style={{ marginTop: 5 }}>Propose a project</div>
      <p className="screen-note">Suggest the project and its purpose. It does not become an official CEAC project until your Unit Head confirms it.</p>
      <FieldGroup label="Project name"><input className="field" aria-label="Proposed project name" value={proposalName} onChange={(event) => setProposalName(event.target.value)} /></FieldGroup>
      <FieldGroup label="Purpose"><textarea className="field" aria-label="Proposed project purpose" rows={3} value={proposalPurpose} onChange={(event) => setProposalPurpose(event.target.value)} /></FieldGroup>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
        <FieldGroup label="Starts (optional)"><input className="field" aria-label="Proposed project start" type="date" value={proposalStart} onChange={(event) => setProposalStart(event.target.value)} /></FieldGroup>
        <FieldGroup label="Ends (optional)"><input className="field" aria-label="Proposed project end" type="date" min={proposalStart || undefined} value={proposalEnd} onChange={(event) => setProposalEnd(event.target.value)} /></FieldGroup>
      </div>
      <button className="btn" style={{ marginTop: 14 }} disabled={busy || !proposalName.trim() || !proposalPurpose.trim() || (proposalStart && proposalEnd && proposalEnd < proposalStart)} onClick={createProjectProposal}>
        {busy ? "Submitting..." : "Send proposal"}
      </button>
    </Sheet>}

    {sheet === "self" && <Sheet onClose={() => !busy && setSheet(null)}>
      <div className="eyebrow">{createVisibility === "private" ? "Only you can see this" : "Your agreed CEAC work"}</div>
      <div className="h2" style={{ marginTop: 5 }}>{createVisibility === "private" ? "Add private work" : "Add my work"}</div>
      <p className="screen-note">
        {createVisibility === "private"
          ? "Use this for work or planning you want to keep to yourself."
          : "Record work you already agreed to carry. You can attach it to a project, but you do not have to."}
      </p>

      <FieldGroup label="Work to carry"><input className="field" placeholder="What are you doing?" value={title} onChange={(event) => setTitle(event.target.value)} /></FieldGroup>
      <FieldGroup label="Why it matters" hint="Optional context."><textarea className="field" rows={2} placeholder="Why it matters" value={purpose} onChange={(event) => setPurpose(event.target.value)} /></FieldGroup>
      <FieldGroup label="Finished result"><textarea className="field" rows={3} placeholder="What should be true when this is finished?" value={expectedOutcome} onChange={(event) => setExpectedOutcome(event.target.value)} /></FieldGroup>

      {createVisibility === "unit" && <FieldGroup label="Linked project (optional)">
        <input className="field" type="search" aria-label="Search authorised projects"
          placeholder="Search authorised projects" value={projectQuery}
          onChange={(event) => setProjectQuery(event.target.value)} />
        <select className="field" aria-label="Linked project" value={projectId}
          onChange={(event) => {
            setProjectId(event.target.value); setObjectiveId(""); setPhaseId("");
            setObjectives([]); setPhases([]); setVerifiedProjectId("");
          }}>
          <option value="">No project attached</option>
          {projects.filter((project) => project.id === projectId || project.name.toLowerCase().includes(projectQuery.trim().toLowerCase()))
            .map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
        </select>
      </FieldGroup>}
      {createVisibility === "unit" && projectId && <>
        {projectContextLoading && <p role="status">Checking authorised project details…</p>}
        {projectContextError && <p role="alert">{projectContextError}</p>}
        {verifiedProjectId === projectId && <details className="reference-disclosure">
          <summary>Project objective and phase (optional)</summary>
          <div className="reference-disclosure-body">
            <FieldGroup label="Project objective">
              <select className="field" aria-label="Project objective" value={objectiveId} onChange={(event) => setObjectiveId(event.target.value)}>
                <option value="">No objective selected</option>
                {objectives.map((objective) => <option key={objective.id} value={objective.id}>{objective.ref} · {objective.name}</option>)}
              </select>
            </FieldGroup>
            <FieldGroup label="Project phase">
              <select className="field" aria-label="Project phase" value={phaseId} onChange={(event) => setPhaseId(event.target.value)}>
                <option value="">No phase selected</option>
                {phases.map((phase) => <option key={phase.id} value={phase.id}>{phase.name}</option>)}
              </select>
            </FieldGroup>
          </div>
        </details>}
      </>}

      {createVisibility === "unit" && <OrganisationalRepeatFields value={repeat} onChange={setRepeat} disabled={busy} />}
      {!repeat.enabled && <><label className="field-label">Due date (optional)</label>
      <input className="field" type="datetime-local" value={due} onChange={(event) => setDue(event.target.value)} /></>}

      <label className="card small no-steps-option">
        <input type="checkbox" checked={noStepsNeeded} onChange={(event) => setNoStepsNeeded(event.target.checked)} />
        <span>No steps needed — I will determine the method.</span>
      </label>

      {!noStepsNeeded && <>
        <div className="small" style={{ marginTop: 12 }}>{repeat.enabled ? "Steps to repeat each time" : "Completion steps"}</div>
        {steps.map((step, index) => <div className="inline-step" key={index}>
          <input
            className="field"
            placeholder={index === 0 ? "What must be done?" : "Another step (optional)"}
            value={step}
            onChange={(event) => setSteps((current) => current.map((value, i) => i === index ? event.target.value : value))}
          />
          {steps.length > 1 && <button type="button" className="text-action" onClick={() => setSteps((current) => current.filter((_, i) => i !== index))}>Remove</button>}
        </div>)}
        {steps.length < 6 && <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 8 }}
          disabled={!steps[steps.length - 1]?.trim()}
          onClick={() => setSteps((current) => [...current, ""])}>Add another step</button>}
      </>}

      <button
        className="btn"
        style={{ marginTop: 16 }}
        disabled={busy || !title.trim() || !expectedOutcome.trim() || (!noStepsNeeded && !steps.some((step) => step.trim()))
          || (createVisibility === "unit" && Boolean(projectId) &&
            (projectContextLoading || Boolean(projectContextError) || verifiedProjectId !== projectId))}
        onClick={createOwnTask}
      >{busy ? "Adding..." : createVisibility === "private" ? "Add private work" : "Add to my work"}</button>
    </Sheet>}
  </div>;
}

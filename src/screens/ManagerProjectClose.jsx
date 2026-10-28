import { useEffect, useMemo, useRef, useState } from "react";
import AssistiveTextarea from "../components/AssistiveTextarea";
import ProjectPersonAssessments from "../components/ProjectPersonAssessments";
import { supabase } from "../lib/supabase";
import { Pill, Sheet } from "../components/bits";

const OUTCOMES = [["met","Met"],["partly_met","Partly met"],["not_met","Not met"]];

function money(currency, amountMinor) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency, currencyDisplay: "code" })
    .format(Number(amountMinor) / 100);
}

function latestSubmission(item) {
  return [...(item.submissions || [])].sort((a, b) => String(b.submitted_at).localeCompare(String(a.submitted_at)))[0] || null;
}

export default function ManagerProjectClose({ me, project, objectives, work, costs, onRefresh, projectUnitId = me.unit_id }) {
  const [closes, setCloses] = useState([]);
  const [readiness, setReadiness] = useState([]);
  const [lastReopenedAt, setLastReopenedAt] = useState(null);
  const [sheet, setSheet] = useState(null);
  const [deliverablesNote, setDeliverablesNote] = useState("");
  const [selectedDeliverables, setSelectedDeliverables] = useState([]);
  const [objectiveRows, setObjectiveRows] = useState({});
  const [challenges, setChallenges] = useState("");
  const [doDifferently, setDoDifferently] = useState("");
  const [overallCosts, setOverallCosts] = useState([]);
  const [lifecycle, setLifecycle] = useState(null);
  const [reopenReason, setReopenReason] = useState("");
  const [historyClose, setHistoryClose] = useState(null);
  const [busy, setBusy] = useState(false);
  // Versioned project-close mutations must not dispatch twice in one render.
  const closeMutationPending = useRef(false);
  const [error, setError] = useState(null);
  const projectScope = [project.id, me.org_id, me.id, me.unit_id].join(":") + ":" + projectUnitId;
  const currentProjectScope = useRef(projectScope);
  currentProjectScope.current = projectScope;
  const closeReadSequence = useRef(0);
  const [verifiedScope, setVerifiedScope] = useState(null);
  const [evidenceLoading, setEvidenceLoading] = useState(true);
  const closeEvidenceVerified = verifiedScope === projectScope && !evidenceLoading;

  const isLead = project.lead_unit_id === projectUnitId;
  const ownObjectives = objectives.filter((row) => row.unit_id === projectUnitId);
  const deliveredWork = work.filter((row) => ["completed", "self_certified"].includes(row.status));
  const deliverablesFor = (scope) => scope === "unit"
    ? deliveredWork.filter((row) => row.unit_id === projectUnitId)
    : deliveredWork;
  const unitClose = closes.find((row) => row.scope === "unit" && row.unit_id === projectUnitId && row.status === "submitted");
  const overallClose = closes.find((row) => row.scope === "overall" && row.status === "submitted");
  const overallCloseCurrentCycle = Boolean(overallClose) && (
    !lastReopenedAt || new Date(overallClose.submitted_at).getTime() > new Date(lastReopenedAt).getTime()
  );

  useEffect(() => {
    setSheet(null); setLifecycle(null); setHistoryClose(null);
    void load();
    return () => { closeReadSequence.current += 1; };
  }, [project.id, me.org_id, me.id, projectUnitId]);

  async function load() {
    const requestedScope = projectScope;
    const requestedRead = ++closeReadSequence.current;
    const stillCurrent = () => currentProjectScope.current === requestedScope
      && closeReadSequence.current === requestedRead;
    setVerifiedScope(null); setEvidenceLoading(true); setError(null);
    setCloses([]); setReadiness([]); setLastReopenedAt(null);
    try {
      const [closeResult, reopenResult] = await Promise.all([
        supabase.from("project_closes")
          .select("id,scope,unit_id,version,status,deliverables_note,challenges,do_differently,submitted_at", { count: "exact" })
          .eq("project_id", project.id)
          .order("version", { ascending: false }),
        supabase.from("activity_events")
          .select("at")
          .eq("object_type", "project")
          .eq("object_id", project.id)
          .eq("verb", "reopened")
          .order("at", { ascending: false })
          .limit(1),
      ]);
      if (closeResult.error || reopenResult.error || !Array.isArray(reopenResult.data))
        throw (closeResult.error || reopenResult.error || new Error("Project reopen history is incomplete."));
      if (typeof closeResult.count !== "number"
        || closeResult.count !== (closeResult.data || []).length) {
        throw new Error("Project close history was truncated. No close authority can be verified.");
      }
      let verifiedReadiness = [];
      if (isLead) {
        const readyResult = await supabase.rpc("project_close_readiness", { p_project_id: project.id });
        if (readyResult.error) throw readyResult.error;
        if (!Array.isArray(readyResult.data)) throw new Error("Project readiness evidence is incomplete.");
        verifiedReadiness = readyResult.data;
      }
      if (!stillCurrent()) return false;
      setCloses(closeResult.data || []);
      setLastReopenedAt(reopenResult.data?.[0]?.at || null);
      setReadiness(verifiedReadiness);
      setVerifiedScope(requestedScope);
      return true;
    } catch {
      if (stillCurrent()) {
        setCloses([]); setReadiness([]); setLastReopenedAt(null);
        setError("Project close history or readiness could not be verified. Retry before recording a close.");
      }
      return false;
    } finally {
      if (stillCurrent()) setEvidenceLoading(false);
    }
  }

  async function buildOverallCosts() {
    const latestByUnit = new Map();
    closes
      .filter((row) => row.scope === "unit" && row.status === "submitted" && row.unit_id)
      .forEach((row) => {
        const current = latestByUnit.get(row.unit_id);
        if (!current || Number(row.version) > Number(current.version)) latestByUnit.set(row.unit_id, row);
      });
    const submittedUnits = [...latestByUnit.values()];
    if (!submittedUnits.length) { setOverallCosts([]); return []; }
    const costResult = await supabase.from("project_close_costs")
      .select("close_id,currency,planned_amount_minor,actual_amount_minor", { count: "exact" })
      .in("close_id", submittedUnits.map((row) => row.id));
    if (costResult.error || !Array.isArray(costResult.data) ||
      typeof costResult.count !== "number" || costResult.count !== costResult.data.length)
      throw new Error("Overall project cost snapshots could not be verified.");
    const grouped = new Map();
    costResult.data.forEach((row) => {
      const current = grouped.get(row.currency) || { currency: row.currency, planned: 0, actual: 0 };
      current.planned += Number(row.planned_amount_minor);
      current.actual += Number(row.actual_amount_minor);
      grouped.set(row.currency, current);
    });
    const rows = [...grouped.values()].sort((a, b) => a.currency.localeCompare(b.currency));
    setOverallCosts(rows);
    return rows;
  }

  async function openClose(scope) {
    if (!closeEvidenceVerified) return;
    const requestedScope = projectScope;
    setError(null);
    const relevantObjectives = scope === "overall" ? objectives : ownObjectives;
    const prefilled = {};
    relevantObjectives.forEach((objective) => {
      prefilled[objective.id] = {
        outcome: ["met", "partly_met", "not_met"].includes(objective.status) ? objective.status : "",
        note: objective.closed_note || "",
      };
    });
    setObjectiveRows(prefilled);
    setSelectedDeliverables(deliverablesFor(scope).map((item) => item.id));
    setDeliverablesNote("");
    setChallenges("");
    setDoDifferently("");
    if (scope === "overall") {
      try { await buildOverallCosts(); }
      catch (err) { setError(err.message || "Could not prepare project costs."); return; }
    } else {
      setOverallCosts([]);
    }
    if (currentProjectScope.current !== requestedScope) return;
    setSheet({ scope });
  }

  function toggleDeliverable(id) {
    setSelectedDeliverables((current) => current.includes(id)
      ? current.filter((itemId) => itemId !== id)
      : [...current, id]);
  }

  function setObjective(id, field, value) {
    setObjectiveRows((current) => ({ ...current, [id]: { ...(current[id] || {}), [field]: value } }));
  }

  const currentObjectives = useMemo(
    () => sheet?.scope === "overall" ? objectives : ownObjectives,
    [sheet?.scope, objectives, ownObjectives]
  );
  const currentDeliverables = sheet ? deliverablesFor(sheet.scope) : [];
  const currentCosts = sheet?.scope === "overall" ? overallCosts : costs;
  const completeCosts = currentCosts.filter((row) => row.planned !== null && row.actual !== null);
  const incompleteCosts = currentCosts.filter((row) => row.planned === null || row.actual === null);
  const missingObjective = currentObjectives.some((objective) => {
    const row = objectiveRows[objective.id];
    return !row?.outcome || !row?.note?.trim();
  });
  const noDeliverable = selectedDeliverables.length === 0 && !deliverablesNote.trim();

  async function submitClose() {
    if (busy || closeMutationPending.current) return;
    if (!closeEvidenceVerified) return;
    if (missingObjective || noDeliverable || !challenges.trim() || !doDifferently.trim()) return;
    closeMutationPending.current = true;
    setBusy(true); setError(null);
    try {
      const objectivePayload = currentObjectives.map((objective) => ({
        objective_id: objective.id,
        outcome: objectiveRows[objective.id].outcome,
        note: objectiveRows[objective.id].note.trim(),
      }));
      const deliverablePayload = selectedDeliverables.map((workItemId, index) => {
        const item = currentDeliverables.find((row) => row.id === workItemId);
        const submission = latestSubmission(item || {});
        return {
          work_item_id: item?.id || null,
          submission_id: submission?.id || null,
          description: item?.title || "Recorded deliverable",
          position: index + 1,
        };
      });
      const costPayload = completeCosts.map((row) => ({
        currency: row.currency,
        planned_amount_minor: Number(row.planned),
        actual_amount_minor: Number(row.actual),
      }));

      const { error: submitError } = await supabase.rpc("save_and_submit_project_close", {
        p_project_id: project.id,
        p_scope: sheet.scope,
        p_unit_id: sheet.scope === "unit" ? projectUnitId : null,
        p_deliverables_note: deliverablesNote.trim() || null,
        p_challenges: challenges.trim(),
        p_do_differently: doDifferently.trim(),
        p_objectives: objectivePayload,
        p_deliverables: deliverablePayload,
        p_costs: costPayload,
      });
      if (submitError) throw submitError;

      setSheet(null);
      await load();
      if (onRefresh) await onRefresh();
    } catch (err) {
      // A network error after a server commit can leave the outcome
      // uncertain; do not assert that no version was saved.
      setError(err.message || "The project return could not be confirmed. Refresh the project-close history before trying again.");
    } finally {
      closeMutationPending.current = false;
      setBusy(false);
    }
  }

  async function closeProject() {
    if (busy || closeMutationPending.current) return;
    if (!closeEvidenceVerified) return;
    if (!overallCloseCurrentCycle) {
      setLifecycle(null);
      setError("Submit a new overall close for this reopened project before closing it again.");
      return;
    }
    closeMutationPending.current = true;
    setBusy(true); setError(null);
    try {
      const { error: closeError } = await supabase.rpc("close_project", { p_project_id: project.id });
      if (closeError) throw closeError;
      setLifecycle(null);
      await load();
      if (onRefresh) await onRefresh();
    } catch (err) {
      setError(err.message || "The project close result is uncertain. Refresh its status before repeating the action.");
    } finally {
      closeMutationPending.current = false;
      setBusy(false);
    }
  }

  async function openCloseHistory(close) {
    if (!closeEvidenceVerified) return;
    const requestedScope = projectScope;
    setHistoryClose(null); setBusy(true); setError(null);
    try {
      const [objectiveResult, deliverableResult, costResult] = await Promise.all([
        supabase.from("project_close_objectives")
          .select("objective_id,outcome,note,objectives(ref,name)", { count: "exact" })
          .eq("close_id", close.id),
        supabase.from("project_close_deliverables")
          .select("id,description,work_item_id,submission_id", { count: "exact" })
          .eq("close_id", close.id)
          .order("position"),
        supabase.from("project_close_costs")
          .select("currency,planned_amount_minor,actual_amount_minor", { count: "exact" })
          .eq("close_id", close.id)
          .order("currency"),
      ]);
      const complete = (result) => !result.error && Array.isArray(result.data)
        && typeof result.count === "number" && result.count === result.data.length;
      if (![objectiveResult, deliverableResult, costResult].every(complete))
        throw new Error("The selected close version was incomplete.");
      if (currentProjectScope.current !== requestedScope) return;
      setHistoryClose({
        ...close,
        objectives: objectiveResult.data,
        deliverables: deliverableResult.data,
        costs: costResult.data,
      });
    } catch (err) {
      setError(err.message || "That close version could not be loaded.");
    } finally {
      setBusy(false);
    }
  }

  async function reopenProject() {
    if (busy || closeMutationPending.current) return;
    if (!closeEvidenceVerified) return;
    if (!reopenReason.trim()) return;
    closeMutationPending.current = true;
    setBusy(true); setError(null);
    try {
      const { error: reopenError } = await supabase.rpc("reopen_project", {
        p_project_id: project.id,
        p_reason: reopenReason.trim(),
      });
      if (reopenError) throw reopenError;
      setLifecycle(null);
      setReopenReason("");
      await load();
      if (onRefresh) await onRefresh();
    } catch (err) {
      setError(err.message || "The project reopen result is uncertain. Refresh its status before repeating the action.");
    } finally {
      closeMutationPending.current = false;
      setBusy(false);
    }
  }

  if (!closeEvidenceVerified) return <section aria-label="Project close verification">
    <div className="sec"><span>Project close</span></div>
    {evidenceLoading ? <p role="status">Verifying project close history and authority…</p>
      : <p role="alert">{error || "Project close history is not verified."}</p>}
    <button type="button" className="btn btn-ghost btn-sm"
      disabled={evidenceLoading || busy} onClick={() => void load()}>Retry project-close verification</button>
  </section>;

  return <>
    <div className="sec"><span>Project close</span></div>
    {error && <div className="flag flag-brick"><h4>Could not complete project close</h4>{error}</div>}

    <div className="card">
      <div className="row-t">{me.is_admin?"Lead department return":"Your unit return"}</div>
      <div className="row-m">{unitClose ? `Latest submitted · version ${unitClose.version}` : "Not submitted"}</div>
      {project.status !== "closed" && <button className="btn btn-sm" style={{ marginTop: 10 }} onClick={() => openClose("unit")}>
        {unitClose ? "Prepare revised unit return" : "Prepare unit return"}
      </button>}
      {project.status === "closed" && <div className="hint">This submitted return is preserved with the closed project.</div>}
      {closes.filter((row) => row.scope === "unit" && row.unit_id === projectUnitId && row.status === "submitted").length > 0 && <div style={{ marginTop: 10 }}>{closes.filter((row) => row.scope === "unit" && row.unit_id === projectUnitId && row.status === "submitted").map((close) => <button key={close.id} className="btn btn-ghost btn-sm" style={{ marginRight: 6, marginBottom: 6 }} onClick={() => openCloseHistory(close)}>Version {close.version}</button>)}</div>}
    </div>

    {isLead && <div className="card" style={{ marginTop: 10 }}>
      <div className="row-t">Overall project close</div>
      <div className="row-m">{overallClose ? `Latest submitted · version ${overallClose.version}` : "Not submitted"}</div>
      {readiness.length > 0 && <div style={{ marginTop: 8 }}>
        {readiness.map((row) => <div className="row-note" key={row.unit_id}>
          {row.filed ? `${row.unit_name} filed` : `${row.unit_name} did not file a return`}
        </div>)}
      </div>}
      {project.status !== "closed" && !overallCloseCurrentCycle && <>
        <button className="btn btn-sm" style={{ marginTop: 10 }} onClick={() => openClose("overall")}>
          {overallClose && lastReopenedAt ? "Prepare new overall close" : "Prepare overall close"}
        </button>
        {overallClose && lastReopenedAt && <div className="hint">This project was reopened after version {overallClose.version}. Submit a new overall close before closing it again.</div>}
      </>}
      {project.status !== "closed" && overallCloseCurrentCycle && <>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => openClose("overall")}>Prepare revised close</button>
          <button className="btn btn-sm" onClick={() => setLifecycle("close")}>Close project</button>
        </div>
        <div className="hint">Closing keeps the submitted close report. The lead unit can reopen the project later with a reason; the close history is not deleted.</div>
      </>}
      {project.status === "closed" && <>
        <div className="hint">Closed. Every submitted close version is preserved.</div>
        <button className="btn btn-ghost btn-sm" style={{ marginTop: 10 }} onClick={() => setLifecycle("reopen")}>Reopen project</button>
      </>}
      {closes.filter((row) => row.scope === "overall" && row.status === "submitted").length > 0 && <div style={{ marginTop: 10 }}>
        {closes.filter((row) => row.scope === "overall" && row.status === "submitted").map((close) => <button key={close.id} className="btn btn-ghost btn-sm" style={{ marginRight: 6, marginBottom: 6 }} onClick={() => openCloseHistory(close)}>Version {close.version}</button>)}
      </div>}
    </div>}

    <ProjectPersonAssessments me={me} project={project} closeId={unitClose?.id || overallClose?.id || null} />

    {historyClose && <Sheet onClose={() => !busy && setHistoryClose(null)}>
      <div className="eyebrow">{historyClose.scope === "overall" ? "Overall project close" : "Unit return"} · version {historyClose.version}</div>
      <div className="h2" style={{ marginTop: 5 }}>Submitted close record</div>
      <p className="screen-note">{historyClose.submitted_at ? new Date(historyClose.submitted_at).toLocaleString("en-GB") : "Submission date not recorded"}</p>

      <div className="sec"><span>Deliverables</span><span>{historyClose.deliverables.length}</span></div>
      {historyClose.deliverables.map((row) => <div className="row" key={row.id}><div className="row-t">{row.description}</div></div>)}
      {historyClose.deliverables_note && <div className="card small">{historyClose.deliverables_note}</div>}
      {!historyClose.deliverables.length && !historyClose.deliverables_note && <div className="card small">No deliverable detail recorded.</div>}

      <div className="sec"><span>Objectives</span><span>{historyClose.objectives.length}</span></div>
      {historyClose.objectives.map((row) => <div className="row" key={row.objective_id}>
        <div className="row-t">{row.objectives?.ref || "Objective"} · {row.objectives?.name || "Recorded objective"}</div>
        <div style={{ marginTop: 6 }}><Pill tone={row.outcome === "not_met" ? "brick" : row.outcome === "partly_met" ? "amber" : "green"}>{row.outcome.replaceAll("_", " ")}</Pill></div>
        <div className="row-note">{row.note}</div>
      </div>)}

      <div className="sec"><span>Cost snapshot</span><span>{historyClose.costs.length}</span></div>
      {historyClose.costs.map((row) => <div className="row" key={row.currency}>
        <div className="row-t">{row.currency}</div>
        <div className="row-m">{money(row.currency, row.planned_amount_minor)} planned · {money(row.currency, row.actual_amount_minor)} actual</div>
      </div>)}
      {historyClose.costs.length === 0 && <div className="card small">No complete cost snapshot was stored.</div>}

      <div className="sec"><span>Challenges</span></div>
      <div className="card small">{historyClose.challenges || "No challenge note recorded."}</div>
      <div className="sec"><span>What to do differently</span></div>
      <div className="card small">{historyClose.do_differently || "No next-time note recorded."}</div>
      <button className="btn btn-ghost" style={{ marginTop: 14 }} onClick={() => setHistoryClose(null)}>Close</button>
    </Sheet>}

    {lifecycle === "close" && <Sheet onClose={() => !busy && setLifecycle(null)}>
      <div className="h2">Close this project?</div>
      <p className="screen-note">The submitted overall close becomes the formal record for this project. Nothing is deleted. The lead unit can reopen the project later with a reason, and any later close is saved as a new version.</p>
      <button className="btn" style={{ marginTop: 14 }} disabled={busy} onClick={closeProject}>{busy ? "Closing..." : "Close project"}</button>
      <button className="btn btn-ghost" style={{ marginTop: 8 }} disabled={busy} onClick={() => setLifecycle(null)}>Keep project open</button>
    </Sheet>}

    {lifecycle === "reopen" && <Sheet onClose={() => !busy && setLifecycle(null)}>
      <div className="h2">Reopen this project</div>
      <p className="screen-note">The project returns to active. Previous close reports stay unchanged and visible. A later close will be saved as a new version.</p>
      <AssistiveTextarea className="field" rows={3} placeholder="Why is this project being reopened?" value={reopenReason} onChange={(event) => setReopenReason(event.target.value)} />
      <button className="btn" style={{ marginTop: 14 }} disabled={busy || !reopenReason.trim()} onClick={reopenProject}>{busy ? "Reopening..." : "Reopen project"}</button>
    </Sheet>}

    {sheet && <Sheet onClose={() => !busy && setSheet(null)}>
      <div className="h2">{sheet.scope === "overall" ? "Overall project close" : "Your unit return"}</div>
      <p className="screen-note">This is the manager submission: what was produced, whether objectives were met, cost, challenges, and what should change next time.</p>

      <div className="sec"><span>1 · Deliverables</span></div>
      {currentDeliverables.map((item) => <button className={"ck " + (selectedDeliverables.includes(item.id) ? "done" : "")} key={item.id} onClick={() => toggleDeliverable(item.id)}>
        <span className={"box " + (selectedDeliverables.includes(item.id) ? "on" : "")} />
        <span className="ck-l">{item.ref} · {item.title}</span>
      </button>)}
      {currentDeliverables.length === 0 && <div className="card small">No completed work is available to attach as a deliverable.</div>}
      <AssistiveTextarea className="field" rows={2} placeholder="Other deliverables produced (optional if selected above)" value={deliverablesNote} onChange={(event) => setDeliverablesNote(event.target.value)} />

      <div className="sec"><span>2 · Objectives</span></div>
      {currentObjectives.map((objective) => <div className="card" key={objective.id} style={{ marginBottom: 10 }}>
        <div className="row-t">{objective.ref} · {objective.name}</div>
        {objective.statement && <div className="row-note">{objective.statement}</div>}
        <select className="field" value={objectiveRows[objective.id]?.outcome || ""} onChange={(event) => setObjective(objective.id, "outcome", event.target.value)}>
          <option value="">Choose outcome</option>
          {OUTCOMES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <AssistiveTextarea className="field" rows={2} placeholder="Why this outcome?" value={objectiveRows[objective.id]?.note || ""} onChange={(event) => setObjective(objective.id, "note", event.target.value)} />
      </div>)}
      {currentObjectives.length === 0 && <div className="card small">No objectives are recorded for this close scope.</div>}

      <div className="sec"><span>3 · Cost</span></div>
      {currentCosts.map((row) => <div className="row" key={row.currency}>
        <div className="row-t">{row.currency}</div>
        <div className="row-m">{row.planned === null ? "No planned amount recorded" : `${money(row.currency, row.planned)} planned`}</div>
        <div className="row-m">{row.actual === null ? "No actual spend recorded" : `${money(row.currency, row.actual)} actual`}</div>
      </div>)}
      {currentCosts.length === 0 && <div className="card small">{sheet.scope === "overall" ? "No filed unit return contains a complete cost snapshot yet." : "No project cost is recorded for your unit."}</div>}
      {incompleteCosts.length > 0 && <div className="hint">A currency with a missing planned or actual figure is shown above but is not stored as zero in the close snapshot.</div>}
      {sheet.scope === "overall" && readiness.some((row) => !row.filed) && <div className="hint">Overall cost is based on the unit returns filed so far. Units that did not file are recorded separately rather than silently treated as zero.</div>}

      <div className="sec"><span>4 · Challenges</span></div>
      <AssistiveTextarea className="field" rows={3} placeholder="What got in the way?" value={challenges} onChange={(event) => setChallenges(event.target.value)} />

      <div className="sec"><span>5 · What to do differently next time</span></div>
      <AssistiveTextarea className="field" rows={3} placeholder="What should change next time?" value={doDifferently} onChange={(event) => setDoDifferently(event.target.value)} />

      <button className="btn" style={{ marginTop: 14 }} disabled={busy || missingObjective || noDeliverable || !challenges.trim() || !doDifferently.trim()} onClick={submitClose}>
        {busy ? "Submitting..." : "Submit close"}
      </button>
      {missingObjective && <div className="hint">Give every objective an outcome and note.</div>}
      {noDeliverable && <div className="hint">Record at least one deliverable.</div>}
      {(!challenges.trim() || !doDifferently.trim()) && <div className="hint">Complete the challenges and next-time sections.</div>}
    </Sheet>}
  </>;
}

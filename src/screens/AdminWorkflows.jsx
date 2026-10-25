import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { FieldGroup, LoadingState, ProductNotice } from "../components/bits";
import { Button, DataPanel, QueueRow, SegmentedControl, StatePanel, StatusBadge } from "../experience-v2/components";
import { humanError } from "../lib/productLanguage";
import { byOldest } from "../components/primitives";

function stamp(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-GB", {
    timeZone: "Africa/Accra",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function humanize(value = "") {
  return String(value).replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function AdminWorkflows({ me }) {
  const [definitions, setDefinitions] = useState([]);
  const [runs, setRuns] = useState([]);
  const [steps, setSteps] = useState([]);
  const [people, setPeople] = useState({});
  const [selectedStepId, setSelectedStepId] = useState(null);
  const [outcome, setOutcome] = useState("reviewed");
  const [note, setNote] = useState("");
  const [filter, setFilter] = useState("ready");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  useEffect(() => { load(); }, [me.id]);

  async function load() {
    setLoading(true);
    setError(null);
    const [definitionsResult, runsResult, stepsResult] = await Promise.all([
      supabase.from("workflow_definitions")
        .select("id,workflow_key,label,description,trigger_event_type,version,active")
        .eq("active", true),
      supabase.from("workflow_runs")
        .select("id,workflow_definition_id,source_event_id,subject_profile_id,aggregate_type,aggregate_id,state,started_at,completed_at")
        .eq("org_id", me.org_id)
        .order("started_at", { ascending: false })
        .limit(200),
      supabase.from("workflow_run_steps")
        .select("id,workflow_run_id,position,step_key,label,step_type,required_capability,state,completed_by,completed_at,outcome,note,created_at")
        .eq("org_id", me.org_id)
        .order("created_at", { ascending: false })
        .limit(400),
    ]);

    const firstError = definitionsResult.error || runsResult.error || stepsResult.error;
    if (firstError) {
      setError(humanError(firstError, "Pending decisions could not load."));
      setLoading(false);
      return;
    }

    const runRows = runsResult.data || [];
    const stepRows = stepsResult.data || [];
    const profileIds = [...new Set([
      ...runRows.map((run) => run.subject_profile_id),
      ...stepRows.map((step) => step.completed_by),
    ].filter(Boolean))];

    let profileMap = {};
    if (profileIds.length) {
      const { data: profileRows, error: profileError } = await supabase
        .from("profiles")
        .select("id,full_name")
        .in("id", profileIds);
      if (profileError) {
        setError(humanError(profileError, "Workflow people could not be resolved."));
        setLoading(false);
        return;
      }
      profileMap = Object.fromEntries((profileRows || []).map((person) => [person.id, person.full_name]));
    }

    setDefinitions(definitionsResult.data || []);
    setRuns(runRows);
    setSteps(stepRows);
    setPeople(profileMap);
    setLoading(false);
  }

  const definitionsById = useMemo(
    () => Object.fromEntries(definitions.map((definition) => [definition.id, definition])),
    [definitions]
  );
  const runsById = useMemo(
    () => Object.fromEntries(runs.map((run) => [run.id, run])),
    [runs]
  );

  const shownSteps = byOldest(steps.filter((step) => {
    if (filter === "ready") return step.state === "ready";
    if (filter === "completed") return step.state === "completed";
    return true;
  }), "created_at");

  const selectedStep = steps.find((step) => step.id === selectedStepId) || null;
  const selectedRun = selectedStep ? runsById[selectedStep.workflow_run_id] : null;
  const selectedDefinition = selectedRun ? definitionsById[selectedRun.workflow_definition_id] : null;

  async function completeStep(decision = null) {
    const resolvedOutcome = decision || outcome.trim();
    if (!selectedStep || !resolvedOutcome) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    const { error: completeError } = await supabase.rpc("complete_workflow_step", {
      p_run_step_id: selectedStep.id,
      p_outcome: resolvedOutcome,
      p_note: note.trim() || null,
    });
    setBusy(false);
    if (completeError) {
      setError(humanError(completeError, "The check could not be updated."));
      return;
    }
    setSelectedStepId(null);
    setNote("");
    setNotice(resolvedOutcome === "not_approved" ? "Check not approved. The remaining checks in this run were cancelled." : "Check completed.");
    await load();
  }

  if (loading) return <div className="body"><LoadingState label="Loading workflows…" /></div>;

  return <div className="body">
    <div style={{ paddingTop: 26 }}>
      <div className="eyebrow">Administration</div>
      <h1 className="h1">Pending decisions</h1>
      <p className="screen-note">Review requests waiting for a decision or confirmation. Oldest requests appear first.</p>
    </div>

    {error && <ProductNotice tone="error" title="Checks">{error}</ProductNotice>}
    {notice && <ProductNotice tone="success" title="Check updated">{notice}</ProductNotice>}

    <div className="split" style={{ marginTop: 18 }}>
      <div className="main-col">
        <DataPanel
          eyebrow="Decision queue"
          title="Waiting for a decision"
          supporting="Only recorded workflow checks appear here; completing a check preserves the attributable outcome."
          action={<StatusBadge tone={filter==="ready"&&shownSteps.length?"warning":"neutral"} icon={false}>{shownSteps.length} shown</StatusBadge>}
        >
          <SegmentedControl
            ariaLabel="Check state"
            value={filter}
            onChange={setFilter}
            items={[
              {value:"ready",label:"Waiting"},
              {value:"completed",label:"Completed"},
              {value:"all",label:"All"},
            ]}
          />
          {shownSteps.map((step) => {
            const run = runsById[step.workflow_run_id];
            const definition = run ? definitionsById[run.workflow_definition_id] : null;
            const subject = run?.subject_profile_id ? people[run.subject_profile_id] || "Person" : humanize(run?.aggregate_type || "record");
            return <QueueRow
              key={step.id}
              icon={step.state==="ready"?"warning":"checkCircle"}
              title={step.label}
              meta={`${definition?.label || "Check"} · ${subject}`}
              status={step.state==="ready"?"Waiting":step.outcome||"Completed"}
              statusTone={step.state==="ready"?"warning":"success"}
              onClick={() => setSelectedStepId(step.id)}
            />;
          })}
          {shownSteps.length === 0 && <StatePanel
            state="empty"
            title={filter === "ready" ? "No check is waiting" : "No checks match"}
            description="New decisions will appear here when CEAC reaches a point that needs an authorised person."
          />}
        </DataPanel>
      </div>

      <div className="side-col">
        <DataPanel eyebrow="Record" title="Check" supporting="Inspect the decision and its recorded context before completing it.">
          {!selectedStep && <StatePanel state="info" title="Choose a check" description="Select a queue item to inspect the decision and its context." />}
          {selectedStep && <>
            <strong>{selectedDefinition?.label || "Check"}</strong>
            <p className="small" style={{ lineHeight: 1.5 }}>{selectedDefinition?.description || "Review what CEAC is asking you to decide."}</p>
            <div className="small">Decision: {selectedStep.label}</div>
            <div className="small">Who can decide: {selectedStep.required_capability ? humanize(selectedStep.required_capability) : "Signed-in user"}</div>
            <div className="small">State: {humanize(selectedStep.state)}</div>
            {selectedStep.state === "ready" && <>
              <FieldGroup label="Decision / result"><input className="field" aria-label="Check outcome" value={outcome} onChange={(event) => setOutcome(event.target.value)} /></FieldGroup>
              <FieldGroup label="Reason / context"><textarea className="field" aria-label="Check review note" rows="3" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Optional context for the record" /></FieldGroup>
              <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginTop:12 }}>
                <Button busy={busy} disabled={!outcome.trim()} onClick={() => completeStep()}>{busy ? "Saving…" : "Complete check"}</Button>
                <Button variant="secondary" disabled={busy} onClick={() => completeStep("not_approved")}>No — I did not approve this</Button>
              </div>
            </>}
            {selectedStep.state === "completed" && <p className="small" style={{ lineHeight: 1.5 }}>Outcome: {selectedStep.outcome || "Completed"}{selectedStep.note ? " · " + selectedStep.note : ""}</p>}
          </>}
        </DataPanel>

        <DataPanel eyebrow="Context" title="How decisions are recorded" supporting="Each decision records who acted and when. Requests are not approved automatically.">
          <p className="small" style={{ lineHeight: 1.6, margin: 0 }}>CEAC opens a Check when a recorded change reaches a point that needs a human decision. Completing a Check can move the process forward. Choosing “No — I did not approve this” stops that run and keeps the decision in history.</p>
        </DataPanel>
      </div>
    </div>
  </div>;
}

import { WorkPageHeader } from "../experience-v2/work-family/WorkFamilyV2";
import { useEffect, useMemo, useRef, useState } from "react";
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
  const [contextVerified,setContextVerified] = useState(null);
  const [note, setNote] = useState("");
  const [filter, setFilter] = useState("ready");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [readError, setReadError] = useState(null);
  const [notice, setNotice] = useState(null);
  const readGeneration=useRef(0);

  useEffect(() => {
    setSelectedStepId(null);setContextVerified(null);setRuns([]);setSteps([]);setPeople({});
    void load();
    return ()=>{readGeneration.current += 1;};
  }, [me.id,me.org_id]);

  async function load() {
    const generation=++readGeneration.current;
    setLoading(true);
    setError(null);
    setReadError(null);
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

    if(generation !== readGeneration.current)return;
    const firstError = definitionsResult.error || runsResult.error || stepsResult.error;
    if (firstError) {
      setReadError(humanError(firstError, "Pending decisions could not load."));
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
      if(generation !== readGeneration.current)return;
      if (profileError) {
        setReadError(humanError(profileError, "Workflow people could not be resolved."));
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
  const reviewCapabilities=[...(me.capabilities || [])].sort().join("|");
  // A restored permission starts a fresh verification, even if its values
  // match an earlier grant. The object token cannot revive an old read.
  const reviewScope=useMemo(()=>({key:`${me.org_id}:${me.id}:${reviewCapabilities}:${selectedStep?.id || ""}`}),
    [me.org_id,me.id,reviewCapabilities,selectedStep?.id]);
  const canReview = selectedStep && (!selectedStep.required_capability || (me.capabilities || []).includes(selectedStep.required_capability));

  async function completeStep(decision = null) {
    const resolvedOutcome = decision || "reviewed";
    if (busy || readError || !canReview || !selectedStep || contextVerified !== reviewScope || selectedStep.state !== "ready" || !resolvedOutcome) return;
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
    setNotice(resolvedOutcome === "not_approved" ? "Flagged for follow-up. This review process was stopped; the underlying recorded change has not been reversed." : "Check completed.");
    await load();
  }

  if (loading) return <div className="body"><LoadingState label="Loading workflows…" /></div>;

  return <div className="body">
    <WorkPageHeader eyebrow="Administration" title="Pending decisions" description="Review requests waiting for a decision or confirmation. Oldest requests appear first." />

    {readError && <StatePanel state="error" title="Checks could not load" description={readError} actionLabel="Try again" onAction={load} />}
    {error && <ProductNotice tone="error" title="Checks">{error}</ProductNotice>}
    {notice && <ProductNotice tone="success" title="Check updated">{notice}</ProductNotice>}

    {!readError && <div className="split" style={{ marginTop: 18 }}>
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
          <div role="region" aria-label="Decision queue" tabIndex={0} style={{maxHeight:560,overflow:"auto",overscrollBehavior:"contain"}}>
          {shownSteps.map((step) => {
            const run = runsById[step.workflow_run_id];
            const definition = run ? definitionsById[run.workflow_definition_id] : null;
            const subject = run?.subject_profile_id ? people[run.subject_profile_id] || "Person" : humanize(run?.aggregate_type || "record");
            return <QueueRow
              key={step.id}
              icon={step.state==="ready"?"warning":"checkCircle"}
              title={step.label}
              meta={`${definition?.label || "Check"} · ${subject}`}
              status={step.state==="ready"?"Waiting":step.state==="completed"?(step.outcome ? humanize(step.outcome) : "Completed"):humanize(step.state)}
              statusTone={step.state==="ready"?"warning":step.state==="completed"&&step.outcome!=="not_approved"?"success":"neutral"}
              onClick={() => { setSelectedStepId(step.id); setContextVerified(null); setNote(""); setError(null); }}
            />;
          })}
          </div>
          {shownSteps.length === 0 && <StatePanel
            state="empty"
            title={filter === "ready" ? "No check is waiting" : "No checks match"}
            description="New decisions will appear here when CEAC reaches a point that needs an authorised person."
          />}
        </DataPanel>
      </div>

      <div className="side-col">
        <DataPanel eyebrow="Selected request" title={selectedStep ? people[selectedRun?.subject_profile_id] || "Recorded change" : "Review a change"} supporting="Read the recorded change before confirming your review.">
          {!selectedStep && <StatePanel state="info" title="Choose a check" description="Select a queue item to inspect the decision and its context." />}
          {selectedStep && <>
            <strong>{selectedStep.label}</strong>
            <p className="screen-note">Requested {stamp(selectedStep.created_at)} · {selectedStep.state === "ready" ? "Waiting for your review" : humanize(selectedStep.state)}</p>
            <WorkflowChangeContext key={reviewScope.key} me={me} run={selectedRun} onVerified={()=>setContextVerified(reviewScope)} />
            {selectedStep.state === "ready" && canReview && <>
              <FieldGroup label="Comment (optional)"><textarea className="field" aria-label="Check review note" rows="3" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Optional context for the record" /></FieldGroup>
              <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginTop:12 }}>
                <Button busy={busy} disabled={contextVerified !== reviewScope} onClick={() => completeStep()}>{busy ? "Saving…" : "Confirm review"}</Button>
                <Button variant="secondary" disabled={busy || contextVerified !== reviewScope} onClick={() => completeStep("not_approved")}>Flag for follow-up</Button>
              </div>
            </>}
            {selectedStep.state === "ready" && !canReview && <p className="screen-note">An authorised colleague must record this review.</p>}
            {selectedStep.state === "completed" && <p className="small" style={{ lineHeight: 1.5 }}>Outcome: {selectedStep.outcome || "Completed"}{selectedStep.note ? " · " + selectedStep.note : ""}</p>}
          </>}
        </DataPanel>

        <DataPanel eyebrow="Context" title="How decisions are recorded" supporting="Each decision records who acted and when. Requests are not approved automatically.">
          <p className="small" style={{ lineHeight: 1.6, margin: 0 }}>CEAC opens a Check when a recorded change reaches a point that needs a human decision. Completing a Check can move the process forward. Confirm review records your acknowledgement. Flag for follow-up stops this review process and preserves the issue in history; it does not reverse the underlying change.</p>
        </DataPanel>
      </div>
    </div>}
  </div>;
}


function WorkflowChangeContext({me,run,onVerified}) {
  const [context,setContext]=useState(null);
  const [error,setError]=useState("");
  useEffect(()=>{
    let active=true;
    (async()=>{
      try {
        if(!run?.source_event_id) throw new Error("The original change is unavailable. Leave this review open until its source can be verified.");
        const result=await supabase.from("platform_events").select("id,event_type,actor_id,payload,idempotency_key,occurred_at").eq("org_id",me.org_id).eq("id",run.source_event_id).single();
        if(result.error || !result.data) throw new Error("The original change could not be loaded. Leave this review open and try again later.");
        const event=result.data;
        let snapshot=null,previous=null;
        if(event.event_type === "employment.changed") {
          const response=await supabase.rpc("admin_employment_detail",{p_profile_id:run.subject_profile_id});
          if(response.error) throw new Error("The employment history could not be verified. No review has been recorded.");
          const id=event.idempotency_key?.startsWith("employment:") ? event.idempotency_key.slice(11) : null;
          const history=[...(response.data?.history || [])].sort((a,b)=>new Date(a.created_at)-new Date(b.created_at));
          const index=history.findIndex(item=>item.id===id);
          if(index<0) throw new Error("The original employment change was not found in this person's history. Leave this review open for investigation.");
          snapshot=history[index];previous=history[index-1] || null;
        }
        let actor="Recorded user";
        if(event.actor_id){const response=await supabase.from("profiles").select("full_name").eq("id",event.actor_id).eq("org_id",me.org_id).maybeSingle();actor=response.data?.full_name || actor;}
        if(active){setContext({event,snapshot,previous,actor});onVerified();}
      } catch(failure){if(active)setError(failure.message);}
    })();
    return ()=>{active=false;};
  },[me.id,me.org_id,run?.source_event_id]);
  if(error)return <ProductNotice tone="attention" title="Change details unavailable">{error}</ProductNotice>;
  if(!context)return <p role="status">Loading the original change…</p>;
  const {event,snapshot,previous,actor}=context;
  const fields=[["employment_type","Employment type"],["job_title","Job title"],["unit_name","Unit"],["manager_name","Manager"],["membership_role","Responsibility"],["employment_status","Employment status"],["joined_on","Start date"],["exited_on","Exit date"]];
  const changes=snapshot?fields.filter(([key])=>!previous || snapshot[key]!==previous[key]):[];
  return <section aria-label="Original change" style={{marginBlock:16}}>
    <p><strong>{snapshot?humanize(snapshot.change_type):humanize(event.event_type.replaceAll("."," "))}</strong><br/>Recorded by {snapshot?.actor_name || actor} · {stamp(snapshot?.created_at || event.occurred_at)}</p>
    {snapshot&&<><p>Effective {snapshot.effective_on}</p>
      <div style={{overflow:"auto"}}><table className="tbl"><thead><tr><th>Detail</th><th>Before</th><th>Recorded change</th></tr></thead><tbody>{changes.map(([key,label])=><tr key={key}><th scope="row">{label}</th><td>{previous ? humanize(previous[key] || "Not recorded") : "No earlier record"}</td><td>{humanize(snapshot[key] || "Not recorded")}</td></tr>)}</tbody></table></div>
      {!changes.length&&<p>No change to the listed employment details. Review the recorded reason and employment history.</p>}
      {snapshot.reason&&<p><strong>Reason:</strong> {snapshot.reason}</p>}
    </>}
    {!snapshot&&<p>Permission: {event.payload?.capability || "Not recorded"}<br/>Scope: {event.payload?.scope_unit_id ? "A specific unit" : "Organisation"}</p>}
    <p className="screen-note">This change has already been recorded. Confirm that you reviewed it, or flag it for follow-up. Your decision does not undo the original change.</p>
  </section>;
}

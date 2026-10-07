import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { FieldGroup, LoadingState, ProductNotice } from "../components/bits";
import { Button, ComposerDrawer, DataPanel, QueueRow, StatePanel, StatusBadge } from "../experience-v2/components";
import { humanError } from "../lib/productLanguage";

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

export default function AdminLifecycle({ me, initialProfileId = null, initialType = null, onInitialHandled }) {
  const [people,setPeople]=useState([]);
  const [cases,setCases]=useState([]);
  const [steps,setSteps]=useState([]);
  const [profileId,setProfileId]=useState("");
  const [type,setType]=useState("onboarding");
  const [effectiveOn,setEffectiveOn]=useState(new Date().toISOString().slice(0,10));
  const [reason,setReason]=useState("");
  const [selectedCaseId,setSelectedCaseId]=useState(null);
  const [note,setNote]=useState("");
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState(null);
  const [notice,setNotice]=useState(null);
  const [createOpen,setCreateOpen]=useState(false);

  useEffect(()=>{ load(); },[me.id]);
  useEffect(()=>{
    if(!initialProfileId) return;
    setProfileId(initialProfileId);
    if(initialType==="onboarding"||initialType==="offboarding") setType(initialType);
    setCreateOpen(true);
    onInitialHandled?.();
  },[initialProfileId,initialType]);

  async function load(){
    setLoading(true); setError(null);
    const [p,c,s]=await Promise.all([
      supabase.from("profiles").select("id,full_name,email,job_title,active").eq("org_id",me.org_id).order("full_name"),
      supabase.from("employee_lifecycle_cases").select("*").eq("org_id",me.org_id).order("started_at",{ascending:false}).limit(200),
      supabase.from("employee_lifecycle_steps").select("*").eq("org_id",me.org_id).order("created_at",{ascending:false}).limit(800),
    ]);
    const first=p.error||c.error||s.error;
    if(first){ setError(humanError(first,"Employee lifecycle could not load.")); setLoading(false); return; }
    setPeople(p.data||[]); setCases(c.data||[]); setSteps(s.data||[]);
    if(!profileId&&p.data?.length) setProfileId(p.data[0].id);
    if(!selectedCaseId&&c.data?.length) setSelectedCaseId(c.data[0].id);
    setLoading(false);
  }

  const peopleById=useMemo(()=>Object.fromEntries(people.map(p=>[p.id,p])),[people]);
  const selectedCase=cases.find(c=>c.id===selectedCaseId)||null;
  const caseSteps=steps.filter(s=>s.lifecycle_case_id===selectedCaseId).sort((a,b)=>a.position-b.position);
  const readyStep=caseSteps.find(s=>s.state==="ready")||null;

  async function startCase(){
    if(!profileId||!reason.trim()||!effectiveOn) return;
    setBusy(true); setError(null); setNotice(null);
    const {data,error:e}=await supabase.from("employee_lifecycle_cases").insert({
      org_id:me.org_id,
      profile_id:profileId,
      lifecycle_type:type,
      planned_effective_on:effectiveOn,
      reason:reason.trim(),
      state:"active",
      created_by:me.id,
    }).select("id").single();
    setBusy(false);
    if(e){ setError(humanError(e,"The employee lifecycle case could not be started.")); return; }
    setReason("");
    setSelectedCaseId(data?.id||null);
    setCreateOpen(false);
    setNotice("Employee lifecycle case started.");
    await load();
  }

  async function completeReadyStep(){
    if(!readyStep) return;
    setBusy(true); setError(null); setNotice(null);
    const {error:e}=await supabase.from("employee_lifecycle_steps").update({
      state:"completed",
      completed_by:me.id,
      completed_at:new Date().toISOString(),
      note:note.trim()||null,
    }).eq("id",readyStep.id);
    setBusy(false);
    if(e){ setError(humanError(e,"The lifecycle step could not be completed.")); return; }
    setNote("");
    setNotice("Lifecycle step completed.");
    await load();
  }

  if(loading) return <div className="body"><LoadingState label="Loading employee lifecycle…" /></div>;

  return <div className="body">
    <div style={{paddingTop:26}}>
      <div className="eyebrow">People operations</div>
      <h1 className="h1">Employee lifecycle</h1>
      <p className="screen-note">Controlled onboarding and offboarding with ordered steps, employment history, events and audit. Completing offboarding is the authoritative path that deactivates operational access.</p>
    </div>

    {error&&<ProductNotice tone="error" title="Employee lifecycle">{error}</ProductNotice>}
    {notice&&<ProductNotice tone="success" title="Employee lifecycle">{notice}</ProductNotice>}

    <div className="split" style={{marginTop:18}}>
      <div className="main-col">
        <DataPanel
          eyebrow="Queue"
          title="Lifecycle cases"
          supporting="Open and completed onboarding or offboarding records. Select a case to inspect its ordered steps."
          action={<Button size="compact" onClick={()=>setCreateOpen(true)}>Start lifecycle case</Button>}
        >
          {cases.map((item)=>{
            const person=peopleById[item.profile_id];
            const caseStepRows=steps.filter(s=>s.lifecycle_case_id===item.id);
            const done=caseStepRows.filter(s=>s.state==="completed").length;
            return <QueueRow
              key={item.id}
              icon="people"
              title={`${person?.full_name||"Employee"} · ${humanize(item.lifecycle_type)}`}
              meta={`${humanize(item.state)} · effective ${item.planned_effective_on} · ${done}/${caseStepRows.length} steps · ${item.reason}`}
              status={humanize(item.state)}
              statusTone={item.state==="completed"?"success":item.state==="active"?"action":"neutral"}
              onClick={()=>setSelectedCaseId(item.id)}
            />;
          })}
          {!cases.length&&<StatePanel state="empty" title="No lifecycle cases" description="Start an onboarding or offboarding case when an employee lifecycle event is required." />}
        </DataPanel>
      </div>

      <div className="side-col">
        <DataPanel
          eyebrow="Record"
          title="Case detail"
          supporting="Ordered steps and the currently actionable authority state."
          action={selectedCase?<StatusBadge tone={selectedCase.state==="completed"?"success":"action"} icon={false}>{humanize(selectedCase.state)}</StatusBadge>:null}
        >
          {!selectedCase&&<StatePanel state="info" title="Choose a lifecycle case" description="Select a case from the queue to inspect its ordered steps." />}
          {selectedCase&&<>
            <strong>{peopleById[selectedCase.profile_id]?.full_name||"Employee"} · {humanize(selectedCase.lifecycle_type)}</strong>
            <p className="small" style={{lineHeight:1.5}}>Effective {selectedCase.planned_effective_on} · {selectedCase.reason}</p>
            {caseSteps.map(step=><QueueRow
              key={step.id}
              icon={step.state==="completed"?"checkCircle":"clock"}
              title={`${step.position}. ${step.label}`}
              meta={`Required authority: ${humanize(step.required_capability)}${step.completed_at?` · completed ${stamp(step.completed_at)}${step.note?" · "+step.note:""}`:""}`}
              status={humanize(step.state)}
              statusTone={step.state==="completed"?"success":step.state==="ready"?"warning":"neutral"}
            />)}
            {!caseSteps.length&&<StatePanel state="empty" title="No case steps recorded" description="This case has no ordered lifecycle steps." />}
            {readyStep?<>
              <FieldGroup label="Completion note"><textarea className="field" aria-label="Lifecycle completion note" rows="3" value={note} onChange={e=>setNote(e.target.value)} /></FieldGroup>
              <Button busy={busy} onClick={completeReadyStep}>{busy?"Completing…":"Complete current step"}</Button>
            </>:<p className="small">{selectedCase.state==="completed"?"This lifecycle case is complete.":"No step is currently ready."}</p>}
          </>}
        </DataPanel>
      </div>
    </div>

    <ComposerDrawer
      open={createOpen}
      onClose={()=>!busy&&setCreateOpen(false)}
      title="Start lifecycle case"
      description="Create an attributable onboarding or offboarding case. Existing lifecycle authority is unchanged."
      footer={<>
        <Button variant="secondary" disabled={busy} onClick={()=>setCreateOpen(false)}>Cancel</Button>
        <Button busy={busy} disabled={!profileId||!reason.trim()||!effectiveOn} onClick={startCase}>{busy?"Starting…":"Start lifecycle case"}</Button>
      </>}
    >
      <FieldGroup label="Employee">
        <select className="field" aria-label="Lifecycle employee" value={profileId} onChange={e=>setProfileId(e.target.value)}>
          {people.map(p=><option key={p.id} value={p.id}>{p.full_name} · {p.email}</option>)}
        </select>
      </FieldGroup>
      <FieldGroup label="Lifecycle type">
        <select className="field" aria-label="Lifecycle type" value={type} onChange={e=>setType(e.target.value)}>
          <option value="onboarding">Onboarding</option>
          <option value="offboarding">Offboarding</option>
        </select>
      </FieldGroup>
      <FieldGroup label="Effective date"><input className="field" aria-label="Lifecycle effective date" type="date" value={effectiveOn} onChange={e=>setEffectiveOn(e.target.value)} /></FieldGroup>
      <FieldGroup label="Reason"><textarea className="field" aria-label="Lifecycle reason" rows="3" value={reason} onChange={e=>setReason(e.target.value)} /></FieldGroup>
    </ComposerDrawer>
  </div>;
}

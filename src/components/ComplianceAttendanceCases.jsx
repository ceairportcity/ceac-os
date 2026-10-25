import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { EmptyState, FieldGroup, ProductNotice } from "./bits";

const CATEGORIES = [
  ["missing_evidence","Missing attendance evidence"],
  ["disputed_attendance","Disputed attendance"],
  ["schedule_discrepancy","Working-pattern discrepancy"],
  ["other","Other attendance observation"],
];
const STATES = ["open","referred","disputed","resolved"];
const pretty = (value) => String(value || "").replaceAll("_"," ").replace(/\b\w/g,(ch)=>ch.toUpperCase());
const stamp = (value) => value ? new Date(value).toLocaleString("en-GB", { timeZone:"Africa/Accra",dateStyle:"medium",timeStyle:"short" }) : "Not recorded";

/** Review-only Compliance casework. Writes go exclusively through the
 * existing-account, tenant-checked human observation RPCs, never to sessions,
 * schedules, employee authority, payroll or scores. */
export default function ComplianceAttendanceCases({
  me, canManage, overviewDate, attendanceRows = [], onOpenOverview, initialCaseId = "", initialCreate = false,
}) {
  const scope = `${me.org_id}:${me.id}:${canManage}`;
  const generation = useRef(0);
  const writePending = useRef(false);
  const [verifiedScope,setVerifiedScope] = useState("");
  const [rows,setRows] = useState([]);
  const [loading,setLoading] = useState(true);
  const [busy,setBusy] = useState(false);
  const attendanceRead = useRef(0);
  const [dayEvidence,setDayEvidence] = useState({scope:"",loading:false,row:null,error:""});
  const [error,setError] = useState("");
  const [notice,setNotice] = useState("");
  const [selectedId,setSelectedId] = useState(initialCaseId);
  const [statusFilter,setStatusFilter] = useState("all");
  const [search,setSearch] = useState("");
  const [creating,setCreating] = useState(canManage && initialCreate);
  const [employeeId,setEmployeeId] = useState("");
  const [date,setDate] = useState(overviewDate);
  const [category,setCategory] = useState("missing_evidence");
  const [facts,setFacts] = useState("");
  const [interpretation,setInterpretation] = useState("");
  const [evidence,setEvidence] = useState("");
  const [action,setAction] = useState("respond");
  const [explanation,setExplanation] = useState("");
  const [actionEvidence,setActionEvidence] = useState("");
  const [referralTarget,setReferralTarget] = useState("manager");

  useEffect(() => { void load(); return () => { generation.current += 1; }; }, [scope]);
  useEffect(() => {
    const seq=++attendanceRead.current, context=`${scope}:${date}:${employeeId}`;
    setDayEvidence({scope:"",loading:Boolean(employeeId && date),row:null,error:""});
    if (!canManage || !employeeId || !date) return () => {attendanceRead.current+=1;};
    (async()=>{
      try {
        const response=await supabase.rpc("attendance_day_evidence",{p_date:date});
        if (response.error || !Array.isArray(response.data)) throw new Error("Attendance evidence could not be verified.");
        if (seq!==attendanceRead.current) return;
        const row=response.data.find(item=>item.employee_id===employeeId);
        setDayEvidence({scope:context,loading:false,row:row||null,
          error:row?"":"This employee is outside the authorised attendance evidence for the selected date."});
      } catch {
        if (seq===attendanceRead.current) setDayEvidence({scope:context,loading:false,row:null,
          error:"The selected day's authorised attendance evidence could not be verified."});
      }
    })();
    return ()=>{attendanceRead.current+=1;};
  },[scope,employeeId,date,canManage]);
  async function load(selectId) {
    const expected = scope, seq = ++generation.current;
    const current = () => generation.current === seq && expected === scope;
    setLoading(true);setVerifiedScope("");setError("");setRows([]);
    try {
      const result = await supabase.rpc("compliance_attendance_case_register", {
        p_date_from:null,p_date_to:null,
      });
      if (result.error || !Array.isArray(result.data))
        throw new Error("The attendance observation history could not be verified.");
      if (!current()) return false;
      setRows(result.data);setVerifiedScope(expected);
      setSelectedId((old) => selectId || (result.data.some(c => c.id === old) ? old : result.data[0]?.id || ""));
      return true;
    } catch {
      if (current()) setError("Attendance observation history is unavailable or incomplete. Retry to verify records; no empty result is assumed.");
      return false;
    } finally { if (current()) setLoading(false); }
  }
  const ready = verifiedScope === scope && !loading && !error;
  const filtered = useMemo(() => ready ? rows.filter(row =>
    (statusFilter === "all" || row.status === statusFilter)
    && (!search.trim() || [row.employee_name,row.category,row.work_date].some(v =>
      String(v || "").toLowerCase().includes(search.trim().toLowerCase())))
  ) : [],[rows,ready,statusFilter,search]);
  const selected = filtered.find(row => row.id === selectedId) || filtered[0] || null;
  const canRespond = selected && selected.status !== "resolved";
  const dayScope=`${scope}:${date}:${employeeId}`;
  const selectedAttendance=dayEvidence.scope===dayScope && !dayEvidence.error && !dayEvidence.loading ? dayEvidence.row : null;
  const ownCase = Boolean(selected?.profile_id && selected.profile_id === me.id);
  const mayReview = Boolean(me.is_admin || me.role === "manager");
  const canRefer = canManage && selected && selected.status !== "resolved";

  async function submitObservation(event) {
    event.preventDefault();
    if (!ready || !canManage || !selectedAttendance || writePending.current || !employeeId || !date ||
      facts.trim().length < 8 || interpretation.trim().length < 8) return;
    writePending.current = true;setBusy(true);setError("");setNotice("");
    try {
      const response = await supabase.rpc("compliance_record_attendance_observation", {
        p_employee_id:employeeId,p_work_date:date,p_category:category,
        p_factual_note:facts.trim(),p_interpretation_note:interpretation.trim(),
        p_evidence_reference:evidence.trim() || null,
      });
      if (response.error || !response.data) throw new Error("Observation was not confirmed.");
      if (await load(response.data)) {
        setCreating(false);setFacts("");setInterpretation("");setEvidence("");
        setNotice("Observation recorded. Attendance and schedules are unchanged.");
      } else setError("Observation save acknowledgement was received, but source readback is not verified. Reload before submitting again.");
    } catch {
      setError("The observation was not confirmed. Check the register before retrying; do not create a duplicate.");
    } finally {writePending.current=false;setBusy(false);}
  }

  async function submitAction(event) {
    event.preventDefault();
    if (!ready || !selected || !canRespond || writePending.current || explanation.trim().length < 8) return;
    const caseId=selected.id, previous=selected.status;
    writePending.current=true;setBusy(true);setError("");setNotice("");
    try {
      const response = await supabase.rpc("compliance_attendance_case_action",{
        p_case_id:caseId,p_expected_status:previous,p_action:action,
        p_explanation:explanation.trim(),p_evidence_reference:actionEvidence.trim() || null,
        p_referral_target:action === "refer" ? referralTarget : null,
      });
      if (response.error || !response.data)
        throw new Error("Case update was not confirmed.");
      if (await load(caseId)) {
        setExplanation("");setActionEvidence("");
        setNotice("Attributable case history recorded. This is not an attendance correction or HR disciplinary decision.");
      } else setError("The change needs verified case readback before further action.");
    } catch {
      setError("The case action could not be confirmed. Reload before attempting another write.");
    } finally {writePending.current=false;setBusy(false);}
  }

  return <section aria-label="Attendance observation and resolution register">
    <div className="sec"><span>Attendance observations</span>
      <div className="compliance-actions">
        {canManage && <button type="button" className="btn btn-sm" disabled={!ready || busy} onClick={()=>setCreating(v=>!v)}>
          {creating ? "Close observation" : "Record observation"}
        </button>}
        <button type="button" className="btn btn-ghost btn-sm" disabled={loading || busy} onClick={()=>void load()}>Refresh cases</button>
      </div>
    </div>
    <p className="screen-note">Observed facts, officer interpretation, responses and authorised resolution remain distinct from recorded attendance, working schedules, payroll, misconduct findings and human performance ratings.</p>
    {error && <ProductNotice tone="error" title="Attendance review">{error}</ProductNotice>}
    {notice && <ProductNotice tone="success" title="Attendance review">{notice}</ProductNotice>}
    {!ready && !error && <p role="status">Verifying authorised case history…</p>}

    {canManage && ready && creating && <form onSubmit={submitObservation} className="card">
      <h3>Record an attendance observation</h3>
      <FieldGroup label="Employee"><select className="field" aria-label="Observation employee" required value={employeeId} onChange={event=>setEmployeeId(event.target.value)}>
        <option value="">Select from authorised attendance evidence</option>
        {attendanceRows.filter(row=>row.employee_id).map(row=>
          <option key={row.employee_id} value={row.employee_id}>{row.name}</option>)}
      </select></FieldGroup>
      <FieldGroup label="Attendance date"><input className="field" aria-label="Observation date" type="date" value={date} onChange={e=>setDate(e.target.value)} required /></FieldGroup>
      {employeeId && dayEvidence.loading && <p role="status">Checking the selected date's authorised attendance…</p>}
      {employeeId && dayEvidence.scope===dayScope && dayEvidence.error && <p role="alert">{dayEvidence.error}</p>}
      {selectedAttendance && <div className="screen-note">
        <p>Expected: {selectedAttendance.expected_today == null ? "No verified schedule" : selectedAttendance.expected_today ? "Session expected" : "No session expected"} ·
          {selectedAttendance.expected_start || "Start not configured"}–{selectedAttendance.expected_end || "End not configured"} ·
          Day type: {selectedAttendance.day_type || "Not configured"}</p>
        <p>Actual recorded sessions: {(selectedAttendance.sessions || []).length} ·
          Approved leave records: {(selectedAttendance.approved_leave || []).length} ·
          Recorded notices: {(selectedAttendance.notices || []).length}</p>
        {(selectedAttendance.sessions || []).map(item=><p key={item.id}>
          Start: {item.started_at ? stamp(item.started_at) : "Not recorded"} ·
          End: {item.ended_at ? stamp(item.ended_at) : "Not recorded"} ·
          Location: {item.start_lat != null && item.start_lng != null ? `${item.start_lat}, ${item.start_lng}` : "No authorised start coordinates"} ·
          Place: {item.place || "Not recorded"}
        </p>)}
        <p>The evidence is historical, not live employee tracking. Missing records or schedules do not establish misconduct, lateness, absence or pay adjustments.</p>
      </div>}
      <FieldGroup label="Observation category"><select className="field" value={category} onChange={e=>setCategory(e.target.value)}>
        {CATEGORIES.map(([value,label])=><option value={value} key={value}>{label}</option>)}
      </select></FieldGroup>
      <FieldGroup label="Observed facts"><textarea className="field" value={facts} onChange={e=>setFacts(e.target.value)} maxLength={4000} rows={3} required /></FieldGroup>
      <FieldGroup label="Officer interpretation (separate)"><textarea className="field" value={interpretation} onChange={e=>setInterpretation(e.target.value)} maxLength={4000} rows={3} required /></FieldGroup>
      <FieldGroup label="Evidence reference (optional)"><input className="field" value={evidence} onChange={e=>setEvidence(e.target.value)} maxLength={2000} placeholder="Existing CEAC record or authorised evidence reference" /></FieldGroup>
      <button type="submit" className="btn" disabled={busy || !selectedAttendance || facts.trim().length < 8 || interpretation.trim().length < 8}>Record attributed observation</button>
    </form>}

    {ready && <div className="card">
      <div className="workforce-setup-actions">
        <FieldGroup label="Case status"><select className="field" value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}>
          <option value="all">All states</option>{STATES.map(status=><option key={status} value={status}>{pretty(status)}</option>)}
        </select></FieldGroup>
        <FieldGroup label="Search"><input type="search" className="field" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Employee, date or category" /></FieldGroup>
      </div>
      <div className="ev2p-link-list">
        {filtered.map(row=><button type="button" key={row.id} className="ev2p-link-row"
          aria-pressed={selected?.id === row.id} onClick={()=>setSelectedId(row.id)}>
          <span className="ev2p-link-row-main"><strong>{row.employee_name} · {row.work_date}</strong>
            <span>{pretty(row.category)} · {pretty(row.status)} · opened {stamp(row.opened_at)}</span>
          </span><span className="ev2p-link-row-tail">Review</span></button>)}
      </div>
      {!filtered.length && <EmptyState compact title="No observations in this verified view">
        Change the filter to inspect other authorised cases. No case is inferred from missing attendance alone.
      </EmptyState>}
    </div>}
    {ready && selected && <article className="card" aria-label="Selected attendance observation">
      <h3>{selected.employee_name} · {selected.work_date}</h3>
      <p><b>Status:</b> {pretty(selected.status)} · <b>Category:</b> {pretty(selected.category)}</p>
      {canManage && <button className="btn btn-ghost btn-sm" type="button" onClick={()=>onOpenOverview?.(selected.work_date)}>
        Inspect the dated attendance evidence
      </button>}
      <div className="ev2p-admin-history-list">
        {(selected.events || []).map(item=><div className="ev2p-admin-history-row" key={item.id}>
          <div><strong>{pretty(item.event_type)} · {stamp(item.created_at)}</strong>
            <span>Attributed actor: {item.actor_id}</span>
            {item.factual_note && <p><b>Officer-observed facts:</b> {item.factual_note}</p>}
            {item.interpretation_note && <p><b>Officer interpretation:</b> {item.interpretation_note}</p>}
            {item.explanation && <p><b>Explanation / outcome:</b> {item.explanation}</p>}
            {item.referral_target && <p>Referred to {pretty(item.referral_target)} authority</p>}
            {item.evidence_reference && <p>Evidence reference: {item.evidence_reference}</p>}
          </div>
        </div>)}
      </div>
      {canRespond && <form onSubmit={submitAction}>
        <FieldGroup label="Recorded action"><select className="field" value={action} onChange={e=>setAction(e.target.value)}>
          <option value="respond">Record response or further evidence</option>
          {(ownCase || mayReview) && <option value="dispute">Dispute observation</option>}
          {canRefer && <option value="refer">Refer to Manager or HR</option>}
          {mayReview && ["referred","disputed"].includes(selected.status) && <option value="resolve">Record authorised resolution</option>}
        </select></FieldGroup>
        {action === "refer" && <FieldGroup label="Referral authority"><select className="field" value={referralTarget} onChange={e=>setReferralTarget(e.target.value)}>
          <option value="manager">Authorised unit Manager</option><option value="hr">Human Resources</option>
        </select></FieldGroup>}
        <FieldGroup label="Attributable explanation"><textarea className="field" rows={3} maxLength={4000} value={explanation} onChange={e=>setExplanation(e.target.value)} required /></FieldGroup>
        <FieldGroup label="Supporting evidence reference"><input className="field" value={actionEvidence} onChange={e=>setActionEvidence(e.target.value)} maxLength={2000} /></FieldGroup>
        <button type="submit" className="btn" disabled={busy || explanation.trim().length < 8}>Record action and preserve history</button>
      </form>}
      {selected.status === "resolved" && <p role="status">This case is resolved. Its recorded history remains available; later facts require a new attributed observation.</p>}
    </article>}
  </section>;
}

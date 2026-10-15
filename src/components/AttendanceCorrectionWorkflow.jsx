import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";

const correctionKinds = [
  ["context_note","Missing check-in / attendance context"],
  ["start_time","Recorded start time"],
  ["end_time","Recorded end time"],
  ["day_type","Scheduled duty day"],
  ["administrative_finding","Other factual correction"],
];
const isPendingSchema = (error) =>
  ["42P01","PGRST205"].includes(error?.code) &&
  /attendance_correction_requests|attendance_correction_audits/i.test(String(error?.message || ""));

export default function AttendanceCorrectionWorkflow({ me }) {
  const [requests,setRequests] = useState([]);
  const [audits,setAudits] = useState([]);
  const [ready,setReady] = useState(false);
  const [unavailable,setUnavailable] = useState(false);
  const [error,setError] = useState("");
  const [notice,setNotice] = useState("");
  const [busy,setBusy] = useState(false);
  const [date,setDate] = useState("");
  const [kind,setKind] = useState("context_note");
  const [details,setDetails] = useState("");
  const [reason,setReason] = useState("");
  const [notes,setNotes] = useState({});
  const [auditOutcomes,setAuditOutcomes] = useState({});
  const generation = useRef(0);
  const writeLock = useRef(false);
  const isManager = me.role === "manager" || Boolean(me.managed_units?.length);
  const isHR = Boolean(me.is_admin) && (me.capabilities || []).includes("attendance.correct");

  async function reload() {
    const token=++generation.current;
    setReady(false);
    const [list, reviews] = await Promise.all([
      supabase.from("attendance_correction_requests")
        .select("id,profile_id,work_date,correction_type,requested_context,reason,status,requested_by,requested_at,decided_by,decided_at,decision_note,correction_id,profiles!attendance_correction_requests_profile_id_fkey(full_name)")
        .eq("org_id",me.org_id).order("requested_at",{ascending:false}).limit(75),
      supabase.from("attendance_correction_audits")
        .select("id,request_id,outcome,note,audited_at,audited_by")
        .eq("org_id",me.org_id).order("audited_at",{ascending:false}).limit(75),
    ]);
    if (token !== generation.current) return false;
    setReady(true);
    const failure=list.error||reviews.error;
    if (failure) {
      setUnavailable(isPendingSchema(failure));
      setError(isPendingSchema(failure) ? "" : "Attendance correction records could not be verified. Existing attendance remains unchanged.");
      return false;
    }
    setRequests(list.data || []);
    setAudits(reviews.data || []);
    setUnavailable(false);
    setError("");
    return true;
  }

  useEffect(() => {
    generation.current += 1;
    writeLock.current = false;
    setRequests([]);
    setAudits([]);
    setReady(false);
    setUnavailable(false);
    setNotes({});
    setError("");
    setNotice("");
    setDate("");
    setDetails("");
    setReason("");
    void reload();
    return () => { generation.current += 1; };
  }, [me.id,me.org_id]);

  async function perform(request, verify, success) {
    if (writeLock.current || !ready || unavailable) return;
    writeLock.current=true;
    setBusy(true);
    setError("");
    setNotice("");
    const token=generation.current;
    let confirmed=false;
    try {
      const {data,error:failure}=await request();
      if (failure) throw failure;
      if (!verify(data)) throw new Error("The recorded action could not be confirmed.");
      confirmed=true;
      if (token !== generation.current) return;
      setNotice(success);
      try {
        const ok=await reload();
        if (!ok && token===generation.current-1)
          setError("The change was recorded, but the updated history could not be loaded.");
      } catch {
        if (token===generation.current-1)
          setError("The change was recorded, but the updated history could not be loaded.");
      }
    } catch {
      if (token === generation.current)
        setError(confirmed
          ? "The action was recorded but its state cannot be refreshed."
          : "The action outcome is unconfirmed. Refresh the request history before retrying; duplicate corrections must not be created.");
    } finally {
      writeLock.current=false;
      setBusy(false);
    }
  }

  async function submit() {
    if (!date || !reason.trim() || details.trim().length<8) return;
    const args={
      p_profile_id:me.id,p_work_date:date,
      p_correction_type:kind,
      p_context:{ note:details.trim() },
      p_reason:reason.trim(),p_session_id:null,
    };
    await perform(
      ()=>supabase.rpc("attendance_request_correction",args),
      data=>typeof data==="string" && data.length>=30,
      "Attendance correction requested for your manager to review. No original work session was changed."
    );
  }

  async function decide(requestId, approved) {
    const note=(notes[requestId] || "").trim();
    if (note.length<8) return;
    await perform(
      ()=>supabase.rpc("attendance_manager_decide_correction",{
        p_request_id:requestId,p_approve:approved,p_note:note,
      }),
      data=>data?.request_id===requestId && data?.approved===approved,
      approved
        ? "Manager correction approved. It is recorded as separate evidence and now awaits HR audit."
        : "Manager declined the correction request with a recorded reason."
    );
  }

  async function audit(requestId) {
    const note=(notes[requestId] || "").trim();
    if (note.length<8) return;
    await perform(
      ()=>supabase.rpc("attendance_hr_audit_correction",{
        p_request_id:requestId,
        p_outcome:auditOutcomes[requestId] || "confirmed",
        p_note:note,
      }),
      data=>typeof data==="string" && data.length>=30,
      "HR audit recorded. The original work session and manager decision remain preserved."
    );
  }

  const validRequest=Boolean(date) && details.trim().length>=8
    && reason.trim().length>=8 && reason.trim().length<=1000;
  const forManager=requests.filter(row=>row.status==="pending" && row.profile_id!==me.id);
  const forHR=requests.filter(row=>row.status==="manager_approved"
    && !audits.some(a=>a.request_id===row.id));
  const myRequests=requests.filter(row=>row.profile_id===me.id);
  return <section aria-labelledby="attendance-correction-workflow" className="ev2wf-correction-workflow">
    <h3 id="attendance-correction-workflow">Missed check-in and attendance corrections</h3>
    <p className="screen-note">Request an attributable explanation of a missing or incorrect attendance record. The manager approves the correction; HR audits approved corrections afterward. The original work session is never replaced.</p>
    {!ready && <p role="status">Loading attendance correction requests...</p>}
    {unavailable && <p className="screen-note">Manager-approved correction workflow is not yet activated on this database. Existing attendance history remains available.</p>}
    {error && <p role="alert">{error}</p>}
    {notice && <p role="status">{notice}</p>}
    {ready && !unavailable && <>
      <div className="form-grid two">
        <label>Attendance date
          <input className="field" type="date" aria-label="Correction work date"
            value={date} onChange={e=>setDate(e.target.value)} />
        </label>
        <label>Correction topic
          <select className="field" value={kind} aria-label="Correction kind"
            onChange={e=>setKind(e.target.value)}>
            {correctionKinds.map(([value,label])=><option key={value} value={value}>{label}</option>)}
          </select>
        </label>
      </div>
      <label>What needs correction?
        <textarea className="field" rows={2} aria-label="Correction context"
          maxLength={1800} value={details} onChange={e=>setDetails(e.target.value)}
          placeholder="Explain what happened. Do not include private medical records." />
      </label>
      <label>Reason and supporting context
        <textarea className="field" rows={2} aria-label="Correction reason"
          maxLength={1000} value={reason} onChange={e=>setReason(e.target.value)} />
      </label>
      <button type="button" className="btn" disabled={busy || !validRequest} onClick={submit}>
        {busy ? "Processing..." : "Request manager review"}
      </button>

      <h4>Your requests</h4>
      {myRequests.length===0 && <p className="screen-note">No attendance correction requests recorded for you.</p>}
      {myRequests.slice(0,15).map(row=><div key={row.id} className="admin-evidence-row">
        <strong>{row.work_date} · {row.correction_type.replaceAll("_"," ")}</strong>
        <span>{row.status.replaceAll("_"," ")} · {row.reason}</span>
        {audits.some(a=>a.request_id===row.id) && <span>HR audit recorded</span>}
      </div>)}

      {isManager && <div>
        <h4>Manager decisions</h4>
        {forManager.length===0 && <p className="screen-note">No pending corrections are visible in your authorised scope.</p>}
        {forManager.map(row=><div className="admin-evidence-row" key={row.id}>
          <strong>{row.profiles?.full_name || "Staff member"} · {row.work_date}</strong>
          <span>{row.correction_type.replaceAll("_"," ")} · {row.reason}</span>
          <span>{row.requested_context?.note || ""}</span>
          <textarea className="field" rows={2} aria-label={"Manager decision note "+row.id}
            maxLength={1000} placeholder="Document the review and evidence"
            value={notes[row.id] || ""} disabled={busy}
            onChange={e=>setNotes(current=>({...current,[row.id]:e.target.value}))}/>
          <div className="workforce-setup-actions">
            <button className="btn" type="button" disabled={busy || (notes[row.id] || "").trim().length<8}
              onClick={()=>decide(row.id,true)}>Approve correction</button>
            <button className="btn btn-ghost" type="button" disabled={busy || (notes[row.id] || "").trim().length<8}
              onClick={()=>decide(row.id,false)}>Decline with reason</button>
          </div>
        </div>)}
      </div>}

      {isHR && <div>
        <h4>HR audit of manager-approved corrections</h4>
        {forHR.length===0 && <p className="screen-note">No approved corrections are waiting for HR audit.</p>}
        {forHR.map(row=><div className="admin-evidence-row" key={row.id}>
          <strong>{row.profiles?.full_name || "Employee"} · {row.work_date}</strong>
          <span>{row.reason} · Manager decision: {row.decision_note}</span>
          <select className="field" aria-label={"HR audit outcome "+row.id}
            disabled={busy} value={auditOutcomes[row.id] || "confirmed"}
            onChange={e=>setAuditOutcomes(current=>({...current,[row.id]:e.target.value}))}>
            <option value="confirmed">Confirmed after review</option>
            <option value="requires_follow_up">Further follow-up required</option>
          </select>
          <textarea className="field" rows={2} aria-label={"HR audit note "+row.id}
            maxLength={1000} value={notes[row.id] || ""} disabled={busy}
            onChange={e=>setNotes(current=>({...current,[row.id]:e.target.value}))}/>
          <button className="btn" type="button" disabled={busy || (notes[row.id] || "").trim().length<8}
            onClick={()=>audit(row.id)}>Record HR audit</button>
        </div>)}
      </div>}
    </>}
  </section>;
}

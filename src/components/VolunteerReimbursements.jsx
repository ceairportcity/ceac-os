import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";

const displayAmount = value => "GHS " + (Number(value || 0)/100).toFixed(2);
export default function VolunteerReimbursements({ me, financeMode = false }) {
  const [requests,setRequests] = useState([]);
  const [employment,setEmployment] = useState(null);
  const [ready,setReady] = useState(false);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState("");
  const [notice,setNotice] = useState("");
  const [kind,setKind] = useState("transport_support");
  const [amount,setAmount] = useState("");
  const [context,setContext] = useState("");
  const [reason,setReason] = useState("");
  const [notes,setNotes] = useState({});
  const generation = useRef(0);
  const writing = useRef(false);
  const hr = !!me.is_admin && (me.capabilities || []).includes("people.manage");
  const manager = me.role === "manager" || !!me.managed_units?.length;
  const volunteer = employment?.employment_type === "volunteer"
    && employment?.employment_status === "active";

  async function refresh() {
    const token = ++generation.current;
    setReady(false);
    const [staff,queue] = await Promise.all([
      supabase.from("employment_records").select("employment_type,employment_status")
        .eq("org_id",me.org_id).eq("profile_id",me.id).maybeSingle(),
      supabase.from("volunteer_reimbursement_requests")
        .select("id,volunteer_id,unit_id,kind,amount_minor,currency,activity_context,reason,status,requested_at,manager_confirmed_by,manager_note,hr_consulted_by,hr_note,finance_consulted_by,finance_note,authorised_by,authorization_note")
        .eq("org_id",me.org_id).order("requested_at",{ascending:false}).limit(80),
    ]);
    if(token!==generation.current) return;
    setReady(true);
    if(staff.error || queue.error) {
      setError(queue.error?.code==="42P01" || queue.error?.code==="PGRST205"
        ? "Volunteer reimbursement review is awaiting the accepted database migration."
        : "Volunteer reimbursement records could not be verified. No payment was made.");
      return;
    }
    setEmployment(staff.data);
    setRequests(queue.data || []);
    setError("");
  }

  useEffect(()=>{
    generation.current+=1;
    writing.current=false;
    setRequests([]);
    setEmployment(null);
    setError("");
    setNotice("");
    void refresh();
    return ()=>{generation.current+=1;};
  },[me.id,me.org_id]);

  async function submit() {
    const minor = Math.round(Number(amount)*100);
    if(writing.current || !volunteer || !Number.isSafeInteger(minor) || minor<=0
       || context.trim().length<10 || reason.trim().length<8) return;
    writing.current=true;setBusy(true);setError("");setNotice("");
    const token=generation.current;
    try {
      const {data,error:failure} = await supabase.rpc("volunteer_reimbursement_request",{
        p_kind:kind,p_amount_minor:minor,
        p_activity_context:context.trim(),p_reason:reason.trim(),
      });
      if(failure || !data) throw failure || new Error("Unconfirmed request");
      if(token!==generation.current) return;
      setAmount("");setContext("");setReason("");
      setNotice("Expense request recorded for manager confirmation. This is not salary or a payment.");
      await refresh();
    } catch {
      if(token===generation.current) setError("Request outcome unconfirmed. Review history before retrying.");
    } finally {writing.current=false;setBusy(false);}
  }

  async function act(row,action) {
    const note=(notes[row.id] || "").trim();
    if(writing.current || note.length<8) return;
    writing.current=true;setBusy(true);setError("");setNotice("");
    const token=generation.current;
    try {
      const {data,error:failure}=await supabase.rpc("volunteer_reimbursement_review",{
        p_request_id:row.id,p_action:action,p_note:note,
      });
      if(failure || data?.request_id!==row.id || data?.action!==action)
        throw failure || new Error("Review unconfirmed");
      if(token!==generation.current) return;
      setNotes(current=>({...current,[row.id]:""}));
      setNotice(action==="authorise"
        ? "Expense authorisation recorded. No payment has been executed."
        : "Your review was recorded with its reason.");
      await refresh();
    } catch {
      if(token===generation.current) setError("Review outcome unconfirmed. Refresh records before retrying.");
    } finally {writing.current=false;setBusy(false);}
  }

  if(!ready && !error) return <p role="status">Loading volunteer expenses...</p>;
  return <section className="ev2wf-volunteer-expenses" aria-label="Volunteer transport and reimbursement">
    <h3>Volunteer transport and task reimbursement</h3>
    <p className="screen-note">Volunteers are unsalaried. Manager verifies the assigned activity, HR and Finance record consultations, and either may authorise reimbursement. Authorisation does not transfer money.</p>
    {error && <p role="alert">{error}</p>}
    {notice && <p role="status">{notice}</p>}
    {volunteer && <div className="form-grid two">
      <label>Request type
        <select className="field" value={kind} onChange={e=>setKind(e.target.value)}>
          <option value="transport_support">Approved programme transport</option>
          <option value="task_expense">Reimbursement of task expense</option>
        </select>
      </label>
      <label>Actual amount (GHS)
        <input className="field" type="number" min="0.01" step="0.01" value={amount}
          onChange={e=>setAmount(e.target.value)}/>
      </label>
      <label>Assigned activity and circumstances
        <textarea className="field" maxLength={1200} value={context}
          onChange={e=>setContext(e.target.value)}/>
      </label>
      <label>Explanation
        <textarea className="field" maxLength={1200} value={reason}
          onChange={e=>setReason(e.target.value)}/>
      </label>
      <button type="button" className="btn" disabled={busy || context.trim().length<10 || reason.trim().length<8 || !(Number(amount)>0)}
        onClick={submit}>Request reimbursement review</button>
    </div>}
    {requests.length===0 && <p className="screen-note">No volunteer reimbursements are visible in your authorised scope.</p>}
    {requests.map(row=><article key={row.id} className="admin-evidence-row">
      <strong>{row.kind==="transport_support"?"Transport":"Task reimbursement"} · {displayAmount(row.amount_minor)}</strong>
      <span>{row.status.replaceAll("_"," ")} · {row.activity_context}</span>
      <p>{row.reason}</p>
      <small>Manager: {row.manager_confirmed_by?"confirmed":"not confirmed"} · HR: {row.hr_consulted_by?"consulted":"pending"} · Finance: {row.finance_consulted_by?"consulted":"pending"}</small>
      {row.status==="authorised" && <p>Authorised for reimbursement; payment not yet recorded.</p>}
      {row.status!=="authorised" && row.status!=="declined" && (manager || hr || financeMode) && <>
        <textarea className="field" rows={2} maxLength={1200}
          aria-label={"Consultation reason "+row.id} value={notes[row.id] || ""}
          onChange={e=>setNotes(current=>({...current,[row.id]:e.target.value}))}/>
        <div className="workforce-setup-actions">
          {manager && row.status==="requested" &&
            <button className="btn" disabled={busy || (notes[row.id]||"").trim().length<8}
              onClick={()=>act(row,"manager_confirm")}>Confirm assignment</button>}
          {hr && row.status==="manager_confirmed" && !row.hr_consulted_by &&
            <button className="btn" disabled={busy || (notes[row.id]||"").trim().length<8}
              onClick={()=>act(row,"hr_consult")}>Record HR consultation</button>}
          {financeMode && row.status==="manager_confirmed" && !row.finance_consulted_by &&
            <button className="btn" disabled={busy || (notes[row.id]||"").trim().length<8}
              onClick={()=>act(row,"finance_consult")}>Record Finance consultation</button>}
          {(hr || financeMode) && row.status==="manager_confirmed" && row.hr_consulted_by && row.finance_consulted_by && <>
            <button className="btn" disabled={busy || (notes[row.id]||"").trim().length<8}
              onClick={()=>act(row,"authorise")}>Authorise reimbursement</button>
            <button className="btn btn-ghost" disabled={busy || (notes[row.id]||"").trim().length<8}
              onClick={()=>act(row,"decline")}>Decline with reason</button>
          </>}
        </div>
      </>}
    </article>)}
    <button type="button" className="btn btn-ghost" disabled={busy} onClick={()=>void refresh()}>Refresh reimbursement requests</button>
  </section>;
}

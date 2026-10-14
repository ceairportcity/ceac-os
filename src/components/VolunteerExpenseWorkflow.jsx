import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";

// Voluntary reimbursement is separate from salary and employee payroll.
// "Approved" is not "paid": Finance records a payment reference separately.
const STATES = {
  requested: "Awaiting manager duty confirmation",
  manager_confirmed: "Manager confirmed · HR and Finance review",
  approved: "Approved · payment not yet recorded",
  declined: "Declined with an attributable decision",
  paid: "Finance recorded payment",
};
const moneyMinor = (text) => {
  const match = /^(\d{1,9})(?:\.(\d{1,2}))?$/.exec(String(text).trim());
  if (!match) return null;
  const value = Number(match[1]) * 100 + Number((match[2] || "").padEnd(2,"0"));
  return Number.isSafeInteger(value) && value > 0 ? value : null;
};
const pendingSchema = (error) =>
  ["42P01","PGRST205","42883"].includes(error?.code) &&
  /volunteer_expense/i.test(error?.message || "");

export default function VolunteerExpenseWorkflow({ me, view = "self" }) {
  const [assignments,setAssignments] = useState([]);
  const [records,setRecords] = useState([]);
  const [consultations,setConsultations] = useState([]);
  const [names,setNames] = useState({});
  const [available,setAvailable] = useState(false);
  const [ready,setReady] = useState(false);
  const [error,setError] = useState("");
  const [notice,setNotice] = useState("");
  const [busy,setBusy] = useState(false);
  const [input,setInput] = useState({unit:"",type:"task_reimbursement",dutyDate:"",
    amount:"",description:"",receipt:""});
  const [notes,setNotes] = useState({});
  const [recommendations,setRecommendations] = useState({});
  const [paymentRefs,setPaymentRefs] = useState({});
  const generation = useRef(0);
  const writeLock = useRef(false);
  const submitKey = useRef(null);
  const isSelf = view === "self";
  const isHR = view === "hr" && Boolean(me.is_admin) &&
    (me.capabilities || []).includes("people.manage");
  const isManager = view === "manager";
  const isFinance = view === "finance";

  async function refresh() {
    const version = ++generation.current;
    setReady(false);
    const [claims,reviews,units] = await Promise.all([
      supabase.from("volunteer_expense_requests")
        .select("id,unit_id,volunteer_profile_id,category,duty_date,amount_minor,currency,description,receipt_reference,requested_by,requested_at,state,manager_note,manager_confirmed_by,decided_by,decision_note,payment_reference,paid_at")
        .eq("org_id",me.org_id).order("requested_at",{ascending:false}).limit(80),
      supabase.from("volunteer_expense_consultations")
        .select("id,request_id,authority,recommendation,note,reviewed_at,reviewer_id")
        .eq("org_id",me.org_id).order("reviewed_at",{ascending:false}).limit(150),
      isSelf ? supabase.rpc("volunteer_expense_my_assignments")
        : Promise.resolve({data:[],error:null}),
    ]);
    if (version !== generation.current) return false;
    setReady(true);
    const failure=claims.error || reviews.error || units.error;
    if (failure) {
      setAvailable(false);
      setError(pendingSchema(failure) ? "" : "Volunteer expense records could not be verified.");
      return false;
    }
    setRecords(claims.data || []);
    setConsultations(reviews.data || []);
    setAssignments(Array.isArray(units.data) ? units.data : []);
    setAvailable(true);
    setError("");
    const ids=[...new Set((claims.data || []).map(r=>r.volunteer_profile_id))];
    if (ids.length) {
      const {data}=await supabase.from("profiles").select("id,full_name").in("id",ids).eq("org_id",me.org_id);
      if (version !== generation.current) return true;
      setNames(Object.fromEntries((data || []).map(item=>[item.id,item.full_name])));
    } else setNames({});
    return true;
  }

  useEffect(()=>{
    generation.current+=1;
    writeLock.current=false;
    setAssignments([]);setRecords([]);setConsultations([]);setNames({});
    setReady(false);setAvailable(false);setError("");setNotice("");setNotes({});
    submitKey.current=null;
    void refresh();
    return ()=>{generation.current+=1;};
  },[me.id,me.org_id,view]);

  async function submitAction(action,confirm,message,rotateKey=false) {
    if (writeLock.current || !ready || !available) return;
    writeLock.current=true;
    setBusy(true);setError("");setNotice("");
    const ticket=generation.current;
    let accepted=false;
    try {
      const {data,error:failure}=await action();
      if (failure) throw failure;
      if (!confirm(data)) throw new Error("The operation was not confirmed.");
      accepted=true;
      if (ticket !== generation.current) return;
      if (rotateKey) submitKey.current=null;
      setNotice(message);
      const ok=await refresh();
      if (!ok && ticket===generation.current-1) setError("The update was recorded, but current status could not be reloaded.");
    } catch {
      if (ticket===generation.current) setError(accepted
        ? "The operation was recorded, but its latest status is unconfirmed."
        : "The operation outcome is unconfirmed. Refresh first; do not repeat an expense request blindly.");
    } finally {
      writeLock.current=false;
      setBusy(false);
    }
  }

  async function createRequest() {
    const amount=moneyMinor(input.amount);
    if (!amount || !assignments.some(a=>a.unit_id===input.unit)
      || input.description.trim().length<8 || !input.dutyDate) return;
    const key=submitKey.current || crypto.randomUUID();
    submitKey.current=key;
    await submitAction(
      ()=>supabase.rpc("volunteer_expense_request",{
        p_client_key:key,p_volunteer_profile_id:me.id,p_unit_id:input.unit,
        p_category:input.type,p_duty_date:input.dutyDate,
        p_amount_minor:amount,p_currency:"GHS",
        p_description:input.description.trim(),
        p_receipt_reference:input.receipt.trim() || null,
      }),
      data=>typeof data==="string" && data.length>=30,
      "Your volunteer expense was requested. Your manager must confirm the actual duty before HR and Finance review.",
      true
    );
  }

  const noteFor=(id)=>notes[id] || "";
  const setNote=(id,value)=>setNotes(previous=>({...previous,[id]:value}));
  const consulted=(id,authority)=>consultations.find(c=>c.request_id===id&&c.authority===authority);
  const statusList=records.filter(r=>!isSelf || r.volunteer_profile_id===me.id);
  if (isSelf && ready && available && assignments.length===0) return null;
  if (view==="hr" && !isHR) return null;

  return <section aria-labelledby={"volunteer-expense-heading-"+view} className="ev2wf-volunteer-expenses">
    <h3 id={"volunteer-expense-heading-"+view}>Volunteer reimbursements and transport support</h3>
    <p className="screen-note">Volunteers are unsalaried. This is for authorised duty-related expenses and transport assistance, not payroll. HR and Finance each document consultation; either can record one final approval. Approval does not mean payment was made.</p>
    {!ready && <p role="status">Loading volunteer expense records...</p>}
    {ready && !available && <p className="screen-note">{error || "This workflow is not yet activated on the live database."}</p>}
    {notice && <p role="status">{notice}</p>}
    {ready && available && error && <p role="alert">{error}</p>}
    {ready && available && isSelf && <div className="card">
      <div className="form-grid two">
        <label>Approved volunteer assignment
          <select className="field" value={input.unit} onChange={e=>setInput(old=>({...old,unit:e.target.value}))}>
            <option value="">Choose your duty unit</option>
            {assignments.map(a=><option key={a.unit_id} value={a.unit_id}>{a.unit_name}</option>)}
          </select>
        </label>
        <label>Support type
          <select className="field" value={input.type} onChange={e=>setInput(old=>({...old,type:e.target.value}))}>
            <option value="task_reimbursement">Approved task expense reimbursement</option>
            <option value="transport_support">Transport support</option>
          </select>
        </label>
        <label>Duty date
          <input className="field" type="date" value={input.dutyDate}
            onChange={e=>setInput(old=>({...old,dutyDate:e.target.value}))}/>
        </label>
        <label>Amount (GHS)
          <input className="field" inputMode="decimal" placeholder="0.00" value={input.amount}
            onChange={e=>setInput(old=>({...old,amount:e.target.value}))}/>
        </label>
      </div>
      <label>What was the duty-related expense?
        <textarea className="field" rows={2} value={input.description}
          maxLength={1500} onChange={e=>setInput(old=>({...old,description:e.target.value}))}/>
      </label>
      <label>Receipt/evidence reference (optional)
        <input className="field" value={input.receipt} maxLength={500}
          placeholder="Finance receipt or document reference"
          onChange={e=>setInput(old=>({...old,receipt:e.target.value}))}/>
      </label>
      <button type="button" className="btn"
        disabled={busy || !moneyMinor(input.amount) || !input.unit || !input.dutyDate || input.description.trim().length<8}
        onClick={createRequest}>{busy ? "Recording..." : "Request reimbursement or transport support"}</button>
    </div>}
    {ready && available && statusList.length===0 &&
      <p className="screen-note">No volunteer expense records are visible in your authorised scope.</p>}
    {ready && available && statusList.map(row=>{
      const hr=consulted(row.id,"hr"),fin=consulted(row.id,"finance");
      const pending=row.state==="manager_confirmed";
      const canFinalise=pending && (isHR || isFinance);
      const bothReady=hr?.recommendation==="support" && fin?.recommendation==="support";
      return <article key={row.id} className="card">
        <strong>{names[row.volunteer_profile_id] || (row.volunteer_profile_id===me.id ? "Your request" : "Volunteer")}</strong>
        <p>{row.description}</p>
        <p className="screen-note">{row.duty_date} · {row.category.replaceAll("_"," ")} · {row.currency} {(row.amount_minor/100).toFixed(2)} · {STATES[row.state] || row.state}</p>
        {row.manager_note && <p className="screen-note">Manager: {row.manager_note}</p>}
        {hr && <p className="screen-note">HR consultation: {hr.recommendation} · {hr.note}</p>}
        {fin && <p className="screen-note">Finance consultation: {fin.recommendation} · {fin.note}</p>}
        {row.decision_note && <p className="screen-note">Decision: {row.decision_note}</p>}
        {row.state==="paid" && <p className="screen-note">Finance payment reference: {row.payment_reference}</p>}
        {((isManager && row.state==="requested") || (pending && (isHR || isFinance)) ||
          (isFinance && row.state==="approved")) && <label>Review note
          <textarea className="field" rows={2} maxLength={1000} value={noteFor(row.id)}
            onChange={e=>setNote(row.id,e.target.value)} />
        </label>}
        {isManager && row.state==="requested" && <div className="guided-actions">
          <button type="button" className="btn" disabled={busy || noteFor(row.id).trim().length<8}
            onClick={()=>submitAction(
              ()=>supabase.rpc("volunteer_expense_manager_confirm",{p_request_id:row.id,p_confirm:true,p_note:noteFor(row.id).trim()}),
              d=>d?.request_id===row.id && d?.confirmed===true,
              "Manager confirmed the volunteer's assignment. HR and Finance can now review.")}>
            Confirm volunteer duty</button>
          <button type="button" className="btn btn-ghost" disabled={busy || noteFor(row.id).trim().length<8}
            onClick={()=>submitAction(
              ()=>supabase.rpc("volunteer_expense_manager_confirm",{p_request_id:row.id,p_confirm:false,p_note:noteFor(row.id).trim()}),
              d=>d?.request_id===row.id && d?.confirmed===false,
              "Manager declined the expense request with a reason.")}>Decline request</button>
        </div>}
        {pending && ((isHR && !hr) || (isFinance && !fin)) && <div>
          <label>Consultation recommendation
            <select className="field" value={recommendations[row.id] || "support"}
              onChange={e=>setRecommendations(old=>({...old,[row.id]:e.target.value}))}>
              <option value="support">Support after review</option>
              <option value="hold">Hold / requires clarification</option>
            </select>
          </label>
          <button type="button" className="btn btn-ghost" disabled={busy || noteFor(row.id).trim().length<8}
            onClick={()=>submitAction(
              ()=>supabase.rpc("volunteer_expense_consult",{
                p_request_id:row.id,p_authority:isHR?"hr":"finance",
                p_recommendation:recommendations[row.id] || "support",p_note:noteFor(row.id).trim()}),
              d=>d?.request_id===row.id && d?.consulted===true,
              "Consultation documented. No payment was authorised by this step.")}>
            Record {isHR?"HR":"Finance"} consultation</button>
        </div>}
        {canFinalise && <div className="guided-actions">
          <button type="button" className="btn" disabled={busy || !bothReady || noteFor(row.id).trim().length<8}
            onClick={()=>submitAction(
              ()=>supabase.rpc("volunteer_expense_finalize",{p_request_id:row.id,p_approve:true,p_note:noteFor(row.id).trim()}),
              d=>d?.request_id===row.id && d?.approved===true,
              "Reimbursement was approved by HR or Finance. Actual payment is not yet recorded.")}>
            Finalise approval</button>
          <button type="button" className="btn btn-ghost" disabled={busy || (!hr && !fin) || noteFor(row.id).trim().length<8}
            onClick={()=>submitAction(
              ()=>supabase.rpc("volunteer_expense_finalize",{p_request_id:row.id,p_approve:false,p_note:noteFor(row.id).trim()}),
              d=>d?.request_id===row.id && d?.approved===false,
              "Reimbursement was declined with a documented reason.")}>Decline after review</button>
        </div>}
        {isFinance && row.state==="approved" && <div>
          <label>Actual payment reference
            <input className="field" maxLength={300}
              value={paymentRefs[row.id] || ""} onChange={e=>setPaymentRefs(old=>({...old,[row.id]:e.target.value}))}/>
          </label>
          <button type="button" className="btn" disabled={busy || (paymentRefs[row.id] || "").trim().length<6}
            onClick={()=>submitAction(
              ()=>supabase.rpc("volunteer_expense_record_payment",{p_request_id:row.id,p_payment_reference:(paymentRefs[row.id] || "").trim()}),
              d=>d?.request_id===row.id && d?.paid_recorded===true,
              "Finance recorded the actual payment reference.")}>Record payment made</button>
        </div>}
      </article>;
    })}
    {ready && available && <button type="button" className="btn btn-ghost" disabled={busy}
      onClick={()=>void refresh()}>Refresh reimbursement status</button>}
  </section>;
}

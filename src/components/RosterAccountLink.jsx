import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { FieldGroup, ProductNotice } from "./bits";

/** Independent HR identity reconciliation, not fuzzy person matching.
 * Only a verified existing profile, finalised employee document, matching
 * operational unit, full email confirmation and locked employee revision can link.
 */
export default function RosterAccountLink({ me, employee, documents = [], onLinked }) {
  const previousProfileId = employee.profile_id || null;
  const correcting = Boolean(previousProfileId);
  const context = `${me.org_id}:${me.id}:${employee.id}:${previousProfileId || ""}`;
  const [showCorrection, setShowCorrection] = useState(false);
  const [scopeReady,setScopeReady] = useState("");
  const [accounts,setAccounts] = useState([]);
  const [revision,setRevision] = useState(null);
  const [selectedId,setSelectedId] = useState("");
  const [fileId,setFileId] = useState("");
  const [confirmedEmail,setConfirmedEmail] = useState("");
  const [reason,setReason] = useState("");
  const [confirmed,setConfirmed] = useState(false);
  const [busy,setBusy] = useState(false);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState("");
  const [notice,setNotice] = useState("");
  const seq = useRef(0);
  const pendingWrite = useRef(false);
  const allowed = Boolean(me.is_admin && employee.id);
  const formOpen = allowed && (!correcting || showCorrection);

  useEffect(()=>{
    const current=++seq.current;
    setScopeReady("");setSelectedId("");setRevision(null);
    setAccounts([]);setLoading(true);setError("");setNotice("");
    if (!formOpen) { setLoading(false);return () => {seq.current+=1;}; }
    (async()=>{
      try {
        const [people,roster,record] = await Promise.all([
          supabase.from("profiles").select("id,full_name,email,active",{count:"exact"})
            .eq("org_id",me.org_id).eq("active",true).limit(500),
          supabase.rpc("admin_employee_roster_summary"),
          supabase.from("employee_roster").select("id,profile_id,updated_at",{count:"exact"})
            .eq("org_id",me.org_id).eq("id",employee.id).limit(2),
        ]);
        if (people.error || !Array.isArray(people.data)
          || people.count !== people.data.length || people.count>500
          || roster.error || !Array.isArray(roster.data)
          || record.error || record.count!==1 || record.data?.length!==1
          || record.data[0].profile_id !== previousProfileId) {
          throw new Error("Existing identity records cannot be verified.");
        }
        if (current!==seq.current) return;
        const used=new Set(roster.data.map(row=>row.profile_id).filter(Boolean));
        setAccounts(people.data.filter(row=>!used.has(row.id)));
        setRevision(record.data[0].updated_at);
        setScopeReady(context);
      } catch {
        if (current===seq.current)
          setError("The existing employee/account directory is incomplete. No identity link can be proposed.");
      } finally {if (current===seq.current)setLoading(false);}
    })();
    return()=>{seq.current+=1;};
  },[context,formOpen,previousProfileId]);
  const available = formOpen && !loading && scopeReady===context && !error;
  const candidate = accounts.find(profile=>profile.id===selectedId);
  const evidence = documents.filter(file=>file.state==="active" && file.storage_bucket==="ceac-operational-private");
  const canSubmit = available && candidate && revision && evidence.some(file=>file.id===fileId)
    && confirmedEmail.trim().toLowerCase()===String(candidate.email||"").trim().toLowerCase()
    && reason.trim().length>=12 && confirmed && !busy;

  async function submit(event) {
    event.preventDefault();
    if (!canSubmit || pendingWrite.current) return;
    pendingWrite.current=true;setBusy(true);setError("");setNotice("");
    try {
      const action = correcting ? "admin_correct_roster_account_link" : "admin_confirm_existing_roster_account_link";
      const response=await supabase.rpc(action,{
        p_employee_id:employee.id,p_profile_id:candidate.id,
        ...(correcting ? { p_previous_profile_id: previousProfileId } : {}),
        p_expected_updated_at:revision,p_evidence_file_id:fileId,
        p_confirmed_account_email:confirmedEmail.trim(),
        p_independently_verified:true,p_reason:reason.trim(),
      });
      if (response.error || !response.data?.linked)
        throw new Error(response.error?.message || "The account link could not be verified.");
      const readback=await supabase.rpc("admin_employee_roster_detail",{p_employee_id:employee.id});
      if (readback.error || readback.data?.employee?.profile_id!==candidate.id)
        throw new Error("Link may be recorded but its authoritative readback is unavailable.");
      setNotice(correcting ? "Employee login link corrected." : "Existing employee and login identity confirmed.");
      onLinked?.(candidate.id);
    } catch (failure) {
      setScopeReady("");
      setError(`${failure.message || "The account link could not be verified."} Reopen the employee record to check the current link before retrying.`);
    } finally {pendingWrite.current=false;setBusy(false);}
  }

  if (!allowed) return null;
  if (correcting && !showCorrection) return <div className="workforce-setup-actions">
    <button type="button" className="btn btn-ghost" onClick={()=>setShowCorrection(true)}>Correct linked login</button>
  </div>;
  return <section className="ev2p-admin-schedule" aria-label="Verify existing employee account link">
    <h3>{correcting ? "Replace the linked employee login" : "Match existing employee to an existing login"}</h3>
    {correcting ? <p className="screen-note">Current login {employee.email || "Email unavailable"}. This links the same employee record and its schedules to the verified replacement login. Roles, work assignments and account access status are managed separately.</p>
      : <p className="screen-note">HR must verify the person and login using a finalised private employee document and matching CEAC unit membership.</p>}
    {loading && <p role="status">Verifying the existing employee and account directory…</p>}
    {error && <ProductNotice tone="error" title="Identity reconciliation">{error}</ProductNotice>}
    {notice && <ProductNotice tone="success" title="Identity reconciliation">{notice}</ProductNotice>}
    {available && <form onSubmit={submit}>
      <FieldGroup label="Existing confirmed login account">
        <select className="field" aria-label="Existing account for this employee" value={selectedId}
          onChange={e=>{setSelectedId(e.target.value);setConfirmedEmail("");setConfirmed(false);}} required>
          <option value="">Select an existing account (do not match by name alone)</option>
          {accounts.map(entry=><option key={entry.id} value={entry.id}>
            {entry.full_name} · {entry.email || "No verified email visible"}
          </option>)}
        </select>
      </FieldGroup>
      <FieldGroup label="Employee documentary identity evidence">
        <select className="field" value={fileId} onChange={e=>setFileId(e.target.value)} required>
          <option value="">Select a finalised private employee document</option>
          {evidence.map(file=><option key={file.id} value={file.id}>{file.filename}</option>)}
        </select>
      </FieldGroup>
      {!evidence.length && <p className="screen-note">First upload the approved documentary proof to this person's existing Documents section; then return to Account & Access.</p>}
      <FieldGroup label="Independently confirmed existing account email">
        <input className="field" type="email" value={confirmedEmail} autoComplete="off"
          onChange={e=>setConfirmedEmail(e.target.value)} placeholder="Type exact verified existing account email" required />
      </FieldGroup>
      <FieldGroup label="HR reason, evidence and identity verification method">
        <textarea className="field" rows={3} maxLength={2000} value={reason}
          onChange={e=>setReason(e.target.value)} required />
      </FieldGroup>
      <label><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)} />
        I independently verified this employee, the confirmed CEAC login, the private document and matching operational unit.
      </label>
      <div className="workforce-setup-actions">
        <button type="submit" className="btn" disabled={!canSubmit}>
          {busy ? "Verifying link…" : correcting ? "Replace linked login" : "Confirm verified existing identity"}
        </button>
        {correcting && <button type="button" className="btn btn-ghost" disabled={busy} onClick={()=>setShowCorrection(false)}>Cancel</button>}
      </div>
      <p className="screen-note">The server independently checks active employee/account, exact verified email, private file finalisation, same-unit membership, unique profile and optimistic record version. Conflicts are refused.</p>
    </form>}
  </section>;
}

import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { humanError } from "../lib/productLanguage";

// Support can request/attest bounded assistance, NEVER perform a business
// grant through this component. Database RLS + trigger enforce each transition.
export default function SupportAccessCaseActions({ item, me, onLedgerChange }) {
  const [record, setRecord] = useState(null);
  const [history, setHistory] = useState([]);
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [ledgerVerified, setLedgerVerified] = useState(false);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [action, setAction] = useState("account_recovery_assistance");
  const [unitId, setUnitId] = useState("");
  const [result, setResult] = useState("");
  const [reference, setReference] = useState("");
  const [reload, setReload] = useState(0);
  const activeGeneration = useRef(0);
  const busyRef = useRef(false);
  const scope = `${me.org_id}:${me.id}:${item.id}`;
  const [loadedScope, setLoadedScope] = useState(null);
  const visible = scope === loadedScope ? record : null;
  const claimed = item.assigned_to === me.id;

  useEffect(() => {
    const gen = ++activeGeneration.current;
    setRecord(null); setHistory([]); setUnits([]); setError(null);
    setLoading(true); setLoadedScope(null); setLedgerVerified(false); busyRef.current = false; setBusy(false);
    onLedgerChange(null);
    async function load() {
      const [ledger, events, unitList] = await Promise.all([
        supabase.from("support_access_requests")
          .select("id,org_id,case_id,requested_action,target_profile_id,target_unit_id,access_object,required_approver,state,approved_by,decided_at,executed_by,executed_at,execution_result,execution_reference,version,updated_at")
          .eq("org_id", me.org_id).eq("case_id", item.id).maybeSingle(),
        supabase.from("support_access_events")
          .select("id,action,note,occurred_at").eq("org_id", me.org_id)
          .eq("case_id", item.id).order("occurred_at", { ascending: false }).limit(30),
        supabase.from("units").select("id,name").eq("org_id", me.org_id).order("name").limit(100),
      ]);
      if (activeGeneration.current !== gen) return;
      if (ledger.error) setError("Access approval and execution cannot be verified. No action can be confirmed.");
      else {
        setLedgerVerified(true);
        setRecord(ledger.data || null);
        onLedgerChange(ledger.data || null);
      }
      if (!events.error) setHistory(events.data || []);
      if (!unitList.error) setUnits(unitList.data || []);
      setLoading(false); setLoadedScope(scope);
    }
    void load();
    return () => { activeGeneration.current++; };
  }, [me.id, me.org_id, item.id, reload]);

  async function change(kind) {
    if (busyRef.current || busy || loading || loadedScope !== scope || !ledgerVerified) return;
    if (!claimed) { setError("Take this support case before recording technical actions."); return; }
    const label = action === "unit_access_assistance" ? "Unit workspace access troubleshooting"
      : action === "invitation_delivery_assistance" ? "Invitation delivery troubleshooting"
      : "Account access recovery assistance";
    const note = result.trim(), proof = reference.trim();
    if (kind === "request" && action === "unit_access_assistance" && !unitId) {
      setError("Select the relevant organisational unit for manager approval."); return;
    }
    if (kind === "execute" && (note.length < 10 || proof.length < 8)) {
      setError("Record what was actually done and an attributable evidence reference."); return;
    }
    busyRef.current = true; setBusy(true); setError(null);
    const gen = activeGeneration.current;
    try {
      let response;
      if (kind === "request") {
        response = await supabase.from("support_access_requests").insert({
          org_id: me.org_id, case_id: item.id,
          requested_action: action,
          target_profile_id: item.affected_profile_id || item.reported_by,
          target_unit_id: action === "unit_access_assistance" ? unitId : null,
          requested_by: me.id,
          required_approver: action === "unit_access_assistance" ? "unit_manager" : "people_administration",
          access_object: label, state: "pending",
        }).select("id,state,version").single();
      } else {
        if (!visible || visible.state !== "approved") throw new Error("There is no currently approved request to execute.");
        response = await supabase.from("support_access_requests")
          .update({ state: "executed", execution_result: note, execution_reference: proof })
          .eq("id", visible.id).eq("org_id", me.org_id).eq("case_id", item.id)
          .eq("version", visible.version).eq("state", "approved")
          .select("id,state,version").maybeSingle();
        if (!response.error && !response.data) throw new Error("The approval changed since you opened it. Refresh before acting.");
      }
      if (response.error) throw response.error;
      if (gen !== activeGeneration.current) return;
      setResult(""); setReference("");
      setReload((value) => value + 1);
    } catch (failure) {
      if (gen === activeGeneration.current) setError(humanError(failure,
        "The technical access action was not confirmed. Refresh before retrying; do not assume any access was changed."));
    } finally {
      if (gen === activeGeneration.current) { busyRef.current = false; setBusy(false); }
    }
  }

  return <section className="ceac-support-access-ledger" aria-labelledby="support-access-ledger-title">
    <h3 id="support-access-ledger-title">Business approval and technical execution</h3>
    <p className="screen-note">Business owners decide. Technical Support may only record approved assistance and what actually happened. This workflow does not create accounts or grant permissions.</p>
    {loading && <p role="status">Checking recorded business approval...</p>}
    {error && <p className="ceac-support-error" role="alert">{error}</p>}
    {!loading && <button className="btn btn-ghost" type="button" disabled={busy}
      onClick={() => setReload((value) => value + 1)}>Refresh approval record</button>}
    {!loading && ledgerVerified && !visible && <div className="ceac-support-form">
      <label>Requested technical assistance
        <select value={action} disabled={!claimed || busy} onChange={(event) => { setAction(event.target.value); setError(null); }}>
          <option value="account_recovery_assistance">Account recovery assistance · People Administration approval</option>
          <option value="invitation_delivery_assistance">Invitation delivery assistance · People Administration approval</option>
          <option value="unit_access_assistance">Unit access assistance · Unit Manager approval</option>
        </select>
      </label>
      {action === "unit_access_assistance" && <label>Unit requiring approval
        <select value={unitId} disabled={!claimed || busy || !units.length}
          onChange={(event) => { setUnitId(event.target.value); setError(null); }}>
          <option value="">Select the actual organisational unit</option>
          {units.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}
        </select>
      </label>}
      <p className="screen-note">Only the selected reviewed action, person and unit are included in the business-approval record. Keep confidential case details out of decision notes.</p>
      <button type="button" className="btn" disabled={!claimed || busy}
        onClick={() => change("request")}>Request business approval</button>
    </div>}
    {visible && <div className="ceac-support-approval-item">
      <strong>{visible.requested_action.replaceAll("_", " ")}</strong>
      <p>{visible.access_object}</p>
      <p role="status">Approval state: {visible.state.replaceAll("_", " ")}</p>
      {visible.state === "pending" && <p className="screen-note">Waiting for the designated {visible.required_approver === "unit_manager" ? "Unit Manager" : "People Administration"} to decide. Technical Support cannot decide its own request.</p>}
      {visible.state === "declined" && <p className="screen-note">The business request was declined. Do not execute it or report it as completed.</p>}
      {visible.state === "approved" && <div className="ceac-support-form">
        <p className="screen-note">Approval recorded. Only the assigned technician with the separate approved execution capability may attest an action. Do not mark an access grant as completed merely because this ledger is approved.</p>
        <label>Technical action actually completed
          <textarea rows={2} maxLength={1000} value={result} disabled={!claimed || busy}
            onChange={(e) => { setResult(e.target.value); setError(null); }}
            placeholder="Record the verified assistance provided, not a promised change." />
        </label>
        <label>Evidence reference
          <input maxLength={180} value={reference} disabled={!claimed || busy}
            onChange={(e) => { setReference(e.target.value); setError(null); }}
            placeholder="Existing approved system ticket or attributable activity reference" />
        </label>
        <button type="button" className="btn" disabled={!claimed || busy || !me.capabilities?.includes("support.access.apply_approved")}
          onClick={() => change("execute")}>Record technical execution evidence</button>
      </div>}
      {visible.state === "executed" && <p className="screen-note">Approved assistance recorded as executed with reference {visible.execution_reference}. This is not proof that CEAC permissions were independently changed.</p>}
    </div>}
    {history.length > 0 && <div className="ceac-support-history">
      <h3>Access decision and execution history</h3>
      <ol className="ceac-support-history-list">
        {history.map((event) => <li key={event.id}>
          <strong>{event.action}</strong>
          <time dateTime={event.occurred_at}>{new Date(event.occurred_at).toLocaleString("en-GB", { timeZone: "Africa/Accra" })}</time>
          <p>{event.note}</p>
        </li>)}
      </ol>
    </div>}
  </section>;
}

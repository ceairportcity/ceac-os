import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { humanError } from "../lib/productLanguage";
import { isMissingTechnicalSupportStageSchema } from "../lib/stage1SchemaCompatibility";
import "../role-styles/technical-support.css";

// An inbox for existing business authorities, never for Technical Support.
// SQL RLS and the state-machine trigger, not this component, decide who
// may approve. No support capability or new role is granted by an approval.
export default function SupportAccessApprovals({ me, authority, compact = false }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [stagePending, setStagePending] = useState(false);
  const [notice, setNotice] = useState(null);
  const [notes, setNotes] = useState({});
  const [busy, setBusy] = useState(false);
  const [loadedScope, setLoadedScope] = useState(null);
  const generation = useRef(0);
  const busyRef = useRef(false);
  // A person can retain the same auth identity while losing a Manager unit,
  // changing role or having a privileged grant revoked. Invalidate the
  // previously fetched approval queue as soon as the refreshed identity
  // exposes a different authority state; the database still remains final.
  const membershipSignature = (me.memberships || [])
    .map((membership) => `${membership.unit_id}:${membership.role}`).sort().join("|");
  const capabilitySignature = (me.capability_grants || [])
    .map((grant) => `${grant.id || ""}:${grant.capability}:${grant.scope_unit_id || ""}:${grant.expires_at || ""}`)
    .sort().join("|");
  const scope = `${me.org_id}:${me.id}:${me.unit_id || ""}:${authority}:${membershipSignature}:${capabilitySignature}`;
  const verified = loadedScope === scope;
  const visible = verified && !loadFailed ? rows : [];

  async function refresh() {
    if (busyRef.current) return;
    const id = ++generation.current;
    setRows([]); setLoadedScope(null); setError(null); setLoadFailed(false); setStagePending(false);
    setLoading(true); setNotice(null);
    try {
      if (!me.id || !me.org_id) throw new Error("Missing verified business identity.");
      const { data, error: failure } = await supabase.from("support_access_requests")
        .select("id,requested_action,access_object,required_approver,target_unit_id,state,version,created_at")
        .eq("org_id", me.org_id).eq("required_approver", authority)
        .eq("state", "pending").order("created_at", { ascending: true }).limit(30);
      if (failure) throw failure;
      if (generation.current === id) setRows(data || []);
    } catch (failure) {
      if (generation.current === id) {
        if (isMissingTechnicalSupportStageSchema(failure)) {
          setStagePending(true);
        } else {
          setLoadFailed(true);
          setError("Business approval records could not be verified. Refresh before taking any action.");
        }
      }
    } finally {
      if (generation.current === id) {
        setLoadedScope(scope); setLoading(false);
      }
    }
  }

  useEffect(() => {
    setNotes({}); setError(null); setNotice(null);
    busyRef.current = false; setBusy(false);
    void refresh();
    return () => { generation.current++; };
  }, [scope]);

  async function decide(request, decision) {
    if (busyRef.current || busy || !verified || loadFailed || loading) return;
    const reason = String(notes[request.id] || "").trim();
    if (reason.length < 10) {
      setError("Add a reason of at least 10 characters before approving or declining.");
      return;
    }
    busyRef.current = true; setBusy(true); setError(null); setNotice(null);
    const id = generation.current;
    try {
      const { data, error: failure } = await supabase.from("support_access_requests")
        .update({ state: decision, decision_reason: reason })
        .eq("id", request.id).eq("org_id", me.org_id).eq("version", request.version)
        .eq("state", "pending").select("id,state,version").maybeSingle();
      if (failure) throw failure;
      if (!data) throw new Error("The request changed or another authorised person decided it. Refresh before acting.");
      if (id === generation.current) {
        setRows((items) => items.filter((item) => item.id !== request.id));
        setNotes((old) => ({ ...old, [request.id]: "" }));
        setNotice("Business decision recorded. Technical Support must separately verify and record the approved action.");
      }
    } catch (failure) {
      if (id === generation.current) setError(humanError(failure, "Business decision not recorded. Refresh and confirm its status before retrying."));
    } finally {
      if (id === generation.current) { busyRef.current = false; setBusy(false); }
    }
  }

  const explanation = <p className="screen-note">Your business decision authorises a bounded support action. It does not itself create an account, membership or permission. Technical Support must separately record what was actually done.</p>;

  return <section className="card ceac-support-approvals" aria-label="Business approvals for Technical Support">
    <h2>Technical access approvals</h2>
    {compact ? <details><summary>What this approval authorises</summary>{explanation}</details> : explanation}
    {loading && <p role="status">Checking pending business decisions...</p>}
    {verified && stagePending && <p className="screen-note" role="status">Technical access approvals are not enabled in Stage 1. Existing Manager and Administration work remains available; no support-access decision can be recorded until the separately reviewed Technical Support migrations are approved.</p>}
    {verified && !stagePending && <button type="button" className="btn btn-ghost" disabled={busy}
      onClick={() => void refresh()}>Refresh approval requests</button>}
    {verified && error && <p className="ceac-support-error" role="alert">{error}</p>}
    {verified && notice && <p className="ceac-support-success" role="status">{notice}</p>}
    {verified && !loadFailed && !stagePending && !loading && !visible.length && <p className="screen-note">No pending access-assistance decisions in the first 30 authorised records.</p>}
    {verified && !loadFailed && visible.length === 30 && <p className="screen-note">Showing the oldest 30 pending requests. More may exist.</p>}
    {visible.map((item) => <div key={item.id} className="ceac-support-approval-item">
      <strong>{item.requested_action.replaceAll("_", " ")}</strong>
      <p>{item.access_object}</p>
      <small>Requested {new Date(item.created_at).toLocaleString("en-GB", { timeZone: "Africa/Accra" })}</small>
      <label>Reason for the business decision
        <textarea rows={2} maxLength={1000} value={notes[item.id] || ""}
          onChange={(e) => { setNotes((old) => ({ ...old, [item.id]: e.target.value })); setError(null); }}
          placeholder="Record the organisational reason. Do not include credentials or protected employee records." />
      </label>
      <div className="ceac-support-section-actions">
        <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => decide(item, "declined")}>Decline</button>
        <button type="button" className="btn" disabled={busy} onClick={() => decide(item, "approved")}>Approve support action</button>
      </div>
    </div>)}
  </section>;
}

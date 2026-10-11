import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { humanError } from "../lib/productLanguage";
import "../role-styles/technical-support.css";

// An inbox for existing business authorities, never for Technical Support.
// SQL RLS and the state-machine trigger, not this component, decide who
// may approve. No support capability or new role is granted by an approval.
export default function SupportAccessApprovals({ me, authority }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notes, setNotes] = useState({});
  const [busy, setBusy] = useState(false);
  const [loadedScope, setLoadedScope] = useState(null);
  const generation = useRef(0);
  const busyRef = useRef(false);
  const scope = `${me.org_id}:${me.id}:${authority}`;
  const visible = loadedScope === scope ? rows : [];

  useEffect(() => {
    const id = ++generation.current;
    setRows([]); setLoadedScope(null); setNotes({}); setError(null); setLoading(true);
    busyRef.current = false; setBusy(false);
    if (!me.id || !me.org_id) return;
    async function load() {
      const { data, error: failure } = await supabase.from("support_access_requests")
        .select("id,requested_action,access_object,required_approver,target_unit_id,state,version,created_at")
        .eq("org_id", me.org_id).eq("required_approver", authority)
        .eq("state", "pending").order("created_at", { ascending: true }).limit(30);
      if (generation.current !== id) return;
      if (failure) setError("Support access approvals could not be verified. Nothing has been approved.");
      else setRows(data || []);
      setLoadedScope(scope); setLoading(false);
    }
    void load();
    return () => { generation.current++; };
  }, [me.id, me.org_id, authority]);

  async function decide(request, decision) {
    if (busyRef.current || busy) return;
    const reason = String(notes[request.id] || "").trim();
    if (reason.length < 10) {
      setError("Add a reason of at least 10 characters before approving or declining.");
      return;
    }
    busyRef.current = true; setBusy(true); setError(null);
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
      }
    } catch (failure) {
      if (id === generation.current) setError(humanError(failure, "Business decision not recorded. Refresh and confirm its status before retrying."));
    } finally {
      if (id === generation.current) { busyRef.current = false; setBusy(false); }
    }
  }

  return <section className="card ceac-support-approvals" aria-label="Business approvals for Technical Support">
    <h2>Technical access approvals</h2>
    <p className="screen-note">Your business decision authorises a bounded support action. It does not itself create an account, membership or permission. Technical Support must separately record what was actually done.</p>
    {loading && <p role="status">Checking pending business decisions...</p>}
    {error && <p className="ceac-support-error" role="alert">{error}</p>}
    {!loading && !error && !visible.length && <p className="screen-note">No pending access-assistance decisions assigned to this business authority.</p>}
    {visible.map((item) => <div key={item.id} className="ceac-support-approval-item">
      <strong>{item.requested_action.replaceAll("_", " ")}</strong>
      <p>{item.access_object}</p>
      <small>Requested {new Date(item.created_at).toLocaleString("en-GB", { timeZone: "Africa/Accra" })}</small>
      <label>Reason for the business decision
        <textarea rows={2} maxLength={1000} value={notes[item.id] || ""}
          onChange={(e) => setNotes((old) => ({ ...old, [item.id]: e.target.value }))}
          placeholder="Record the organisational reason. Do not include credentials or protected employee records." />
      </label>
      <div className="ceac-support-section-actions">
        <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => decide(item, "declined")}>Decline</button>
        <button type="button" className="btn" disabled={busy} onClick={() => decide(item, "approved")}>Approve support action</button>
      </div>
    </div>)}
  </section>;
}

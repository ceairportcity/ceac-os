import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { Button, DataPanel } from "../experience-v2/components";
import { humanError } from "../lib/productLanguage";

// People Administration only. Membership is never a unit-manager role,
// employment relationship or capability grant. Migrations 133/134/136 remain
// the authority for actor identity, active-state and automatic capability end.
export default function SupportTeamMemberships({ me, people, units }) {
  const [rows, setRows] = useState([]);
  const [history, setHistory] = useState([]);
  const [selected, setSelected] = useState("");
  const [unitId, setUnitId] = useState("");
  const [role, setRole] = useState("member");
  const [reason, setReason] = useState("");
  const [ending, setEnding] = useState(null);
  const [endReason, setEndReason] = useState("");
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [verifiedLoad, setVerifiedLoad] = useState(false);
  const [scopeRead, setScopeRead] = useState(null);
  const generation = useRef(0);
  const busyRef = useRef(false);
  const scope = `${me.org_id}:${me.id}`;
  const visible = scopeRead === scope ? rows : [];
  const unavailable = !loading && !verifiedLoad;

  async function refresh() {
    const id = ++generation.current;
    setRows([]); setHistory([]); setScopeRead(null); setLoading(true); setVerifiedLoad(false);
    setError(null);
    const [members, events] = await Promise.all([
      supabase.from("support_team_memberships")
        .select("id,profile_id,role,active,started_at,associated_unit_id,ended_at")
        .eq("org_id", me.org_id).order("started_at", { ascending: false }).limit(150),
      supabase.from("support_membership_events")
        .select("id,profile_id,action,reason,occurred_at")
        .eq("org_id", me.org_id).order("occurred_at", { ascending: false }).limit(100),
    ]);
    if (id !== generation.current) return;
    if (members.error || events.error) {
      setError("Technical Support membership history is not available or authorised. No membership was changed.");
    } else {
      setVerifiedLoad(true);
      setRows(members.data || []); setHistory(events.data || []);
    }
    setScopeRead(scope); setLoading(false);
  }

  useEffect(() => {
    generation.current++;
    setRows([]); setHistory([]); setScopeRead(null);
    setSelected(""); setUnitId(""); setReason("");
    setEnding(null); setEndReason(""); setNotice(null); setError(null);
    busyRef.current = false; setBusy(false);
    void refresh();
    return () => { generation.current++; };
  }, [me.id, me.org_id]);

  async function save(type) {
    if (busyRef.current || busy || loading || !verifiedLoad || scopeRead !== scope) return;
    if (type === "add" && (!selected || !unitId || reason.trim().length < 8)) {
      setError("Choose an existing active person, the associated Media & Technical unit and a reason of at least 8 characters."); return;
    }
    if (type === "end" && (!ending || endReason.trim().length < 8)) {
      setError("Record why this Technical Support membership is ending."); return;
    }
    busyRef.current = true; setBusy(true); setError(null); setNotice(null);
    const id = generation.current;
    try {
      let res;
      if (type === "add") {
        if (visible.some((item) => item.profile_id === selected && item.active)) {
          throw new Error("This person already has an active Technical Support membership.");
        }
        res = await supabase.from("support_team_memberships").insert({
          org_id: me.org_id, profile_id: selected, associated_unit_id: unitId,
          role, added_by: me.id, reason: reason.trim(), active: true,
        }).select("id,profile_id,active").single();
      } else {
        res = await supabase.from("support_team_memberships")
          .update({ active: false, ended_by: me.id, ended_at: new Date().toISOString(), end_reason: endReason.trim() })
          .eq("id", ending.id).eq("org_id", me.org_id).eq("active", true)
          .select("id,profile_id,active").maybeSingle();
        if (!res.error && !res.data) throw new Error("This membership has already ended. Refresh the current history.");
      }
      if (res.error) throw res.error;
      if (id !== generation.current) return;
      setNotice(type === "add"
        ? "Membership recorded. No Support capability or business authority was granted."
        : "Membership ended with its own reason. Server-side Support capability revocation is recorded without deleting history.");
      setReason(""); setSelected(""); setUnitId(""); setEnding(null); setEndReason("");
      // refresh() increments generation; release the synchronous busy latch
      // before it does so or the new generation would retain a stuck action.
      busyRef.current = false; setBusy(false);
      await refresh();
    } catch (failure) {
      if (id === generation.current) setError(humanError(failure, "The membership transition was not verified. Refresh its history before retrying."));
    } finally {
      if (id === generation.current) { busyRef.current = false; setBusy(false); }
    }
  }

  const active = visible.filter((item) => item.active);
  const nameFor = (id) => people.find((p) => p.id === id)?.full_name || "Existing CEAC person";
  return <DataPanel eyebrow="Autonomous technical team" title="Technical Support membership"
    supporting="People Administration records who is on the technical team; membership is separate from capability grants, employee status and unit management."
    className="phase5-access-panel">
    {loading && <p role="status">Verifying Support membership history...</p>}
    {error && <p role="alert" className="ceac-support-error">{error}</p>}
    {notice && <p role="status" className="ceac-support-success">{notice}</p>}
    <div className="phase5-access-form-grid">
      <label>Existing active CEAC person
        <select className="field" value={selected} disabled={busy || loading || unavailable}
          onChange={(e) => { setSelected(e.target.value); setError(null); }}>
          <option value="">Select person</option>
          {people.filter((person) => person.active).map((person) => <option key={person.id} value={person.id}>{person.full_name}</option>)}
        </select>
      </label>
      <label>Team membership
        <select className="field" value={role} disabled={busy || loading || unavailable}
          onChange={(e) => setRole(e.target.value)}>
          <option value="member">Member</option>
          <option value="lead">Support Lead</option>
        </select>
      </label>
      <label>Media & Technical association (context only)
        <select className="field" value={unitId} disabled={busy || loading || unavailable}
          onChange={(e) => { setUnitId(e.target.value); setError(null); }}>
          <option value="">Choose the authorised associated unit</option>
          {units.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}
        </select>
      </label>
      <label>Reason for team membership
        <textarea className="field" rows={2} maxLength={700} value={reason}
          disabled={busy || loading || unavailable} onChange={(e) => { setReason(e.target.value); setError(null); }}
          placeholder="Record who authorised this placement and why." />
      </label>
    </div>
    <p className="screen-note">Adding a member does not automatically grant case, integration, recovery, HR or Payroll authority. Any Support capability requires the separate approved authority process and privileged MFA where applicable.</p>
    <Button disabled={busy || loading || !verifiedLoad || !selected || !unitId || reason.trim().length < 8}
      onClick={() => save("add")}>Record Support membership</Button>
    <h3>Current team</h3>
    {active.length === 0 && !loading && verifiedLoad && <p className="screen-note">No active Support memberships in the authorised records.</p>}
    <div className="phase5-access-memberships">
      {active.map((item) => <div className="phase5-access-membership" key={item.id}>
        <div><strong>{nameFor(item.profile_id)}</strong><span>{item.role === "lead" ? "Support Lead" : "Support member"}</span></div>
        <Button variant="quiet" size="compact" disabled={busy || loading}
          onClick={() => { setEnding(item); setEndReason(""); }}>End membership</Button>
      </div>)}
    </div>
    {ending && <div className="phase5-access-revoke" role="dialog" aria-modal="true" aria-labelledby="end-support-title">
      <div className="phase5-access-revoke-card">
        <h3 id="end-support-title">End Technical Support membership?</h3>
        <p className="screen-note">End the active membership of {nameFor(ending.profile_id)}? Existing CEAC identity, employee status and historical case attribution remain intact. All current Support-only capability grants are revoked by the database in the same transition.</p>
        <label>Reason for ending this role
          <textarea className="field" rows={3} maxLength={700} value={endReason}
            onChange={(e) => { setEndReason(e.target.value); setError(null); }} />
        </label>
        <div className="phase5-access-actions">
          <Button variant="secondary" disabled={busy} onClick={() => setEnding(null)}>Keep membership</Button>
          <Button disabled={busy || endReason.trim().length < 8}
            onClick={() => save("end")}>End with recorded reason</Button>
        </div>
      </div>
    </div>}
    <h3>Membership changes</h3>
    {history.length === 0 && !loading && verifiedLoad && <p className="screen-note">No recorded membership transitions.</p>}
    <ol className="ceac-support-history-list">
      {history.map((ev) => <li key={ev.id}>
        <strong>{ev.action === "added" ? "Added" : "Ended"} · {nameFor(ev.profile_id)}</strong>
        <time dateTime={ev.occurred_at}>{new Date(ev.occurred_at).toLocaleString("en-GB",{timeZone:"Africa/Accra"})}</time>
        <p>{ev.reason}</p>
      </li>)}
    </ol>
  </DataPanel>;
}

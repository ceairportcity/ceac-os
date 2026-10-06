import { useEffect, useState } from "react";
import { supabase, inviteByEmail, resendStaffInvitation } from "../lib/supabase";
import { FieldGroup, ProductNotice, LoadingState } from "./bits";

export default function PeopleAccess({ me, go, onBack }) {
  const [snapshot, setSnapshot] = useState(null);
  const [mode, setMode] = useState("invite");
  const [form, setForm] = useState({ name: "", email: "", person: "", unit: "", role: "staff", reason: "", lane: "" });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const [error, setError] = useState(null);
  const canManage = (me.capability_grants || []).some((g) => g.capability === "people.manage" && !g.scope_unit_id);
  useEffect(() => { if (canManage) load(); }, [me.id, canManage]);
  async function load() {
    setError(null);
    const results = await Promise.all([
      supabase.from("profiles").select("id,full_name,email,active").eq("org_id", me.org_id).order("full_name"),
      supabase.from("units").select("id,name").eq("org_id", me.org_id).eq("active", true).order("name"),
      supabase.from("unit_memberships").select("id,profile_id,unit_id,role").eq("org_id", me.org_id),
      supabase.from("sub_teams").select("id,name,unit_id").eq("org_id", me.org_id).eq("active", true),
      supabase.rpc("admin_access_invitations"),
    ]);
    const failure = results.find((r) => r.error);
    if (failure) { setError(failure.error.message); return; }
    setSnapshot({ people: results[0].data || [], units: results[1].data || [], memberships: results[2].data || [], lanes: results[3].data || [], invitations: results[4].data || [] });
  }
  async function action(work, success) {
    setBusy(true); setError(null); setNotice(null);
    try { await work(); setNotice(success); await load(); }
    catch (e) { setError(e.message || "This change could not be recorded."); }
    finally { setBusy(false); }
  }
  async function saveResponsibility(operation = "add", membership = null) {
    const { error: failure } = await supabase.rpc("admin_record_unit_responsibility", {
      p_profile_id: form.person, p_unit_id: membership?.unit_id || form.unit,
      p_role: membership?.role || form.role, p_action: operation, p_reason: form.reason,
    });
    if (failure) throw failure;
  }
  const set = (key) => (event) => setForm((f) => ({ ...f, [key]: event.target.value, ...(key === "unit" ? { lane: "" } : {}) }));
  if (!canManage) return <ProductNotice tone="attention" title="People administration required">This account does not hold organisation-wide People access.</ProductNotice>;
  return <section className="body ev2-people-page">
    <button type="button" className="back" onClick={onBack}>← Control Center</button>
    <h1 className="h1">People &amp; Access</h1>
    <p className="screen-note">Invite a new person or manage responsibilities under their existing CEAC account.</p>
    {error && <ProductNotice tone="error" title="People & Access">{error}</ProductNotice>}
    {notice && <ProductNotice tone="success" title="Recorded">{notice}</ProductNotice>}
    {!snapshot ? error ? <button className="btn" onClick={load}>Try again</button> : <LoadingState label="Loading People & Access…" /> : <>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button className="btn" onClick={() => setMode("invite")}>Add new person</button>
        <button className="btn btn-ghost" onClick={() => setMode("responsibility")}>Add responsibility</button>
        <button className="btn btn-ghost" onClick={() => go("people")}>Employment / Manager / access status</button>
        <button className="btn btn-ghost" onClick={() => go("units")}>Unit Head assignment</button>
        <button className="btn btn-ghost" onClick={() => go("lifecycle")}>Onboarding / offboarding</button>
      </div>
      <div className="card" style={{ marginTop: 16 }}>
        <h2 className="h2">{mode === "invite" ? "Add new person" : "Existing person’s responsibilities"}</h2>
        {mode === "invite" ? <>
          <FieldGroup label="Full name"><input className="field" aria-label="Full name" value={form.name} onChange={set("name")} /></FieldGroup>
          <FieldGroup label="Email"><input className="field" type="email" aria-label="Invitation email" value={form.email} onChange={set("email")} /></FieldGroup>
          <p className="screen-note">New accounts start as Staff. They verify their email and create their own password. Existing people receive additional responsibilities without another invitation.</p>
        </> : <FieldGroup label="Existing person"><select className="field" aria-label="Existing person" value={form.person} onChange={set("person")}>
          <option value="">Choose a person</option>{snapshot.people.filter((p) => p.active).map((p) => <option key={p.id} value={p.id}>{p.full_name} · {p.email}</option>)}
        </select></FieldGroup>}
        <FieldGroup label="Unit"><select className="field" aria-label="Responsibility unit" value={form.unit} onChange={set("unit")}>
          <option value="">Choose a unit</option>{snapshot.units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select></FieldGroup>
        {mode === "invite" ? <button className="btn" disabled={busy || !form.name.trim() || !form.email.trim() || !form.unit} onClick={() => action(() => inviteByEmail({ email: form.email, fullName: form.name, unitId: form.unit }), "Invitation sent. Email verification and personal password setup are required.")}>{busy ? "Sending…" : "Send Staff invitation"}</button> : <>
          <FieldGroup label="Responsibility"><select className="field" aria-label="Responsibility role" value={form.role} onChange={set("role")}><option value="staff">Staff</option><option value="sub_team_lead">Team lead</option><option value="manager">Unit Head</option></select></FieldGroup>
          <FieldGroup label="Reason"><textarea className="field" aria-label="Responsibility reason" value={form.reason} onChange={set("reason")} /></FieldGroup>
          <button className="btn" disabled={busy || !form.person || !form.unit || !form.reason.trim()} onClick={() => action(() => saveResponsibility(), "Responsibility recorded. Other unit memberships are preserved.")}>Record responsibility</button>
          <p className="screen-note">Additional unit membership does not transfer the primary unit or grant organisation capabilities.</p>
          {snapshot.memberships.filter((m) => m.profile_id === form.person).map((m) => <div className="row" key={m.id}>
            <strong>{snapshot.units.find((u) => u.id === m.unit_id)?.name || "Unit"} · {m.role.replaceAll("_", " ")}</strong>
            <button className="btn btn-ghost btn-sm" disabled={busy || !form.reason.trim()} onClick={() => action(() => saveResponsibility("remove", m), "Membership ended with its audit history preserved.")}>End membership</button>
          </div>)}
          <FieldGroup label="Team / sub-team"><select className="field" aria-label="Work lane" value={form.lane} onChange={set("lane")}><option value="">Choose a work lane</option>{snapshot.lanes.filter((l) => l.unit_id === form.unit).map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></FieldGroup>
          {[true, false].map((member) => <button key={String(member)} className="btn btn-ghost" disabled={busy || !form.person || !form.lane || !form.reason.trim()} onClick={() => action(async () => { const r = await supabase.rpc("admin_set_work_lane_membership", { p_profile_id: form.person, p_sub_team_id: form.lane, p_member: member, p_reason: form.reason }); if (r.error) throw r.error; }, "Work-lane membership recorded.")}>{member ? "Add to work lane" : "Remove from work lane"}</button>)}
        </>}
      </div>
      <h2 className="h2" style={{ marginTop: 24 }}>Invitations</h2>
      <p className="screen-note">Email verification and invitation status are recorded separately from employment. A verified account can use password recovery.</p>
      {!snapshot.invitations.length && <p>No invitations recorded.</p>}
      {snapshot.invitations.map((i) => <div className="row" key={i.id}>
        <strong>{i.full_name}</strong><div className="row-m">{i.email} · {snapshot.units.find((u) => u.id === i.unit_id)?.name || "Unit"} · {i.activation_state.replaceAll("_", " ")}</div>
        <time dateTime={i.invited_at}>{new Date(i.invited_at).toLocaleString("en-GB")}</time>
        {!i.revoked_at && i.activation_state !== "verified" && <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => action(() => resendStaffInvitation(i.id), "Activation email requested. Check the newest email link.")}>Resend invitation</button>
          <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => { const reason = window.prompt("Why is this invitation being cancelled?"); if (reason?.trim()) action(async () => { const r = await supabase.rpc("admin_revoke_staff_invitation", { p_invitation_id: i.id, p_reason: reason }); if (r.error) throw r.error; }, "Invitation cancelled; operational access cannot activate through it."); }}>Cancel invitation</button>
        </div>}
      </div>)}
    </>}
  </section>;
}

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase, inviteByEmail, resendStaffInvitation } from "../lib/supabase";
import { invitationEmailConflicts, isPlausibleInvitationEmail } from "../lib/invitationSafety";
import { FieldGroup, ProductNotice, LoadingState } from "./bits";
import { Button, DataPanel, StatusBadge } from "../experience-v2/components";
import SupportTeamMemberships from "./SupportTeamMemberships";
import SupportAccessApprovals from "./SupportAccessApprovals";
import VolunteerActivationApprovals from "./VolunteerActivationApprovals";

const ACCESS_MODES = [
  ["invite", "Invite"],
  ["responsibility", "Responsibilities"],
  ["invitations", "Invitations"],
  ["technical-support", "Technical Support"],
];

function invitationTone(state, revokedAt) {
  if (revokedAt) return "neutral";
  if (state === "verified") return "success";
  if (state === "expired") return "warning";
  return "action";
}

export default function PeopleAccess({ me, go, onBack, embedded = false, onOpenPerson, onChanged, onLifecycle, initialProfileId = null, initialUnitId = null, initialMode = null, initialInviteRoster = null }) {
  const [snapshot, setSnapshot] = useState(null);
  const [snapshotScope, setSnapshotScope] = useState(null);
  const [mode, setMode] = useState("invite");
  const [invitationFilter,setInvitationFilter]=useState("all");
  const [form, setForm] = useState({ name: "", email: "", person: "", unit: "", role: "staff", reason: "", lane: "" });
  const inviteDraft = useRef(form);
  inviteDraft.current = form;
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const [error, setError] = useState(null);
  const [revokeTarget, setRevokeTarget] = useState(null);
  const [endMembershipTarget, setEndMembershipTarget] = useState(null);
  const [revokeReason, setRevokeReason] = useState("");
  const loadGeneration = useRef(0);
  const identityGeneration = useRef(0);
  const actionBusyRef = useRef(false);
  const scopeKey = `${me.org_id}:${me.id}`;
  const canManage = (me.capability_grants || []).some((grant) => grant.capability === "people.manage" && !grant.scope_unit_id);

  useEffect(() => {
    // A change of authenticated identity or organisation immediately invalidates
    // the previous account's sensitive directory and membership records.
    loadGeneration.current += 1;
    identityGeneration.current += 1;
    actionBusyRef.current = false;
    setBusy(false);
    setSnapshot(null);
    setSnapshotScope(null);
    setError(null);
    setNotice(null);
    setRevokeTarget(null);
    setEndMembershipTarget(null);
    setRevokeReason("");
    setInvitationFilter("all");
    setForm({ name: "", email: "", person: "", unit: "", role: "staff", reason: "", lane: "" });
    if (canManage) void load();
    return () => { loadGeneration.current += 1; identityGeneration.current += 1; actionBusyRef.current = false; };
  }, [me.id, me.org_id, canManage]);
  useEffect(() => {
    if (!initialProfileId && !initialUnitId && !initialMode) return;
    setForm((current) => ({
      ...current,
      person: initialProfileId || current.person,
      unit: initialUnitId || current.unit,
      ...(initialUnitId ? { lane: "" } : {}),
    }));
    if (initialMode === "invite" || initialMode === "responsibility" || initialMode === "invitations") setMode(initialMode);
    else if (initialProfileId) setMode("responsibility");
  }, [initialProfileId, initialUnitId, initialMode]);

  useEffect(() => {
    // Selected roster context is not proof of a verified account; prefill,
    // but never send or change roles without a direct human action.
    if (!initialInviteRoster?.employeeId || !canManage) return;
    setForm(current => ({
      ...current,
      name: initialInviteRoster.name || "",
      email: initialInviteRoster.contactEmail || "",
      unit: initialInviteRoster.unitId || "",
      person: "",
    }));
    setMode("invite");
  }, [initialInviteRoster?.employeeId, me.id, me.org_id, canManage]);

  async function load() {
    const generation = ++loadGeneration.current;
    setSnapshot(null);
    setSnapshotScope(null);
    setError(null);
    try {
      const results = await Promise.all([
      supabase.from("profiles").select("id,full_name,email,active").eq("org_id", me.org_id).order("full_name"),
      supabase.from("units").select("id,name").eq("org_id", me.org_id).eq("active", true).order("name"),
      supabase.from("unit_memberships").select("id,profile_id,unit_id,role").eq("org_id", me.org_id),
      supabase.from("sub_teams").select("id,name,unit_id").eq("org_id", me.org_id).eq("active", true),
      supabase.rpc("admin_access_invitations"),
      supabase.from("sub_team_members").select("sub_team_id,profile_id"),
    ]);
    if (generation !== loadGeneration.current) return false;
    const failure = results.find((result) => result.error);
    if (failure) {
      setError(failure.error.message);
      return false;
    }
    setSnapshotScope(scopeKey);
    setSnapshot({
      people: results[0].data || [],
      units: results[1].data || [],
      memberships: results[2].data || [],
      lanes: results[3].data || [],
      invitations: results[4].data || [],
      laneMemberships: results[5].data || [],
    });
    return true;
    } catch (loadFailure) {
      if (generation === loadGeneration.current) {
        setError("People & Access could not load verified records. Retry before making changes.");
      }
      return false;
    }
  }

  async function action(work, success) {
    // React state updates are asynchronous; the ref closes the double-click
    // window before a second database mutation can be scheduled.
    if (actionBusyRef.current || busy || !canManage || snapshotScope !== scopeKey) return false;
    const identity = identityGeneration.current;
    const sameIdentity = () => identity === identityGeneration.current;
    actionBusyRef.current = true;
    setBusy(true);
    setError(null);
    setNotice(null);
    let recorded = false;
    try {
      await work();
      recorded = true;
      // A response from an account that has since changed must never update
      // the current person's access controls, notices or directory state.
      if (!sameIdentity()) return true;
      setNotice(success);
      const refreshed = await load();
      if (!sameIdentity()) return true;
      if (!refreshed) throw new Error("The latest records could not be loaded.");
      if (onChanged) await onChanged();
      return true;
    } catch (actionError) {
      if (!sameIdentity()) return recorded || Boolean(actionError?.invitationRecorded);
      if (actionError?.invitationRecorded) {
        // Invitation preparation was saved even though email dispatch failed.
        // Do not present the pending identity as an entirely failed write.
        await load();
        if (!sameIdentity()) return true;
      }
      // A successful server write paired with a failed refresh is not a
      // fully confirmed screen state; do not show a green success notice
      // alongside a partial-failure message.
      setNotice(null);
      setError(recorded
        ? "The change was recorded, but the page could not refresh. Reload before repeating this action."
        : actionError?.message || "The operation could not be confirmed. Review current records before retrying.");
      return recorded || Boolean(actionError?.invitationRecorded);
    } finally {
      if (sameIdentity()) {
        actionBusyRef.current = false;
        setBusy(false);
      }
    }
  }

  async function sendInvitation() {
    const submitted = inviteDraft.current;
    const identity = identityGeneration.current;
    const recorded = await action(
      () => inviteByEmail({ email: submitted.email, fullName: submitted.name, unitId: submitted.unit }),
      "Invitation recorded and activation email requested. Delivery has not been independently confirmed."
    );
    // Clear only a confirmed, unchanged create draft. A failed send, an unknown
    // outcome, newer typing or another account must keep its current values.
    if (recorded && identity === identityGeneration.current) {
      setForm(current => current === submitted
        ? { ...current, name: "", email: "", unit: "", lane: "" }
        : current);
    }
  }

  async function saveResponsibility(operation = "add", membership = null, profileId = form.person, reason = form.reason) {
    const { error: failure } = await supabase.rpc("admin_record_unit_responsibility", {
      p_profile_id: profileId,
      p_unit_id: membership?.unit_id || form.unit,
      p_role: membership?.role || form.role,
      p_action: operation,
      p_reason: reason,
    });
    if (failure) throw failure;
  }

  async function saveLane(member) {
    const result = await supabase.rpc("admin_set_work_lane_membership", {
      p_profile_id: form.person,
      p_sub_team_id: form.lane,
      p_member: member,
      p_reason: form.reason,
    });
    if (result.error) throw result.error;
  }

  async function revokeInvitation() {
    if (!revokeTarget || !revokeReason.trim()) return;
    const target = revokeTarget;
    const recorded = await action(async () => {
      const result = await supabase.rpc("admin_revoke_staff_invitation", {
        p_invitation_id: target.id,
        p_reason: revokeReason.trim(),
      });
      if (result.error) throw result.error;
    }, "Invitation cancelled; operational access cannot activate through it.");
    // Keep the confirmation open on failure; do not discard the operator's reason.
    if (recorded) {
      setRevokeTarget(null);
      setRevokeReason("");
    }
  }

  const set = (key) => (event) => setForm((current) => {
    const value = event.target.value;
    // For a person with exactly one current unit responsibility, use
    // that known context rather than asking Administration to select it again.
    const peopleUnits = key === "person" && snapshot
      ? [...new Set(snapshot.memberships.filter((row) => row.profile_id === value
        && snapshot.units.some((unit) => unit.id === row.unit_id)).map((row) => row.unit_id))]
      : [];
    return {
      ...current,
      [key]: value,
      ...(key === "unit" ? { lane: "" } : {}),
      ...(key === "person" ? {
        // Several distinct roles in one unit still constitute one unit.
        unit: peopleUnits.length === 1 ? peopleUnits[0] : "",
        lane: "",
      } : {}),
    };
  });

  const selectedPerson = useMemo(
    () => snapshot?.people.find((person) => person.id === form.person) || null,
    [snapshot, form.person]
  );
  const selectedMemberships = useMemo(
    () => snapshot?.memberships.filter((membership) => membership.profile_id === form.person) || [],
    [snapshot, form.person]
  );
  const alreadyHasResponsibility = selectedMemberships.some((member) =>
    member.unit_id === form.unit && member.role === form.role);
  const belongsToSelectedUnit = selectedMemberships.some((member) => member.unit_id === form.unit);
  const selectedLaneMemberships = snapshot?.laneMemberships.filter((member) => member.profile_id === form.person) || [];
  const belongsToSelectedLane = selectedLaneMemberships.some((member) => member.sub_team_id === form.lane);
  const pendingInvitationCount = snapshot?.invitations.filter((invitation) =>
    !invitation.revoked_at && invitation.activation_state !== "verified" && invitation.activation_state !== "expired"
  ).length || 0;
  const visibleInvitations=(snapshot?.invitations||[]).filter(invitation=>{
    const state=invitation.revoked_at?"cancelled":invitation.activation_state==="verified"?"verified":invitation.activation_state==="expired"?"expired":"pending";
    return invitationFilter==="all"||state===invitationFilter;
  });
  // The roster is not proof that every account is activated, but an identical
  // email must not be invited blindly a second time.
  const { accountExists: existingAccountEmail, invitationPending: existingInvitationEmail } =
    invitationEmailConflicts(form.email, snapshot?.people, snapshot?.invitations);

  if (!canManage) return <ProductNotice tone="attention" title="People administration required">This account does not hold organisation-wide People access.</ProductNotice>;

  return <section className={"phase5-people-access" + (embedded ? " is-embedded" : "")}>
    {!embedded && onBack ? <button type="button" className="back" onClick={onBack}>← Control Center</button> : null}

    <header className="phase5-access-header">
      <div>
        <span className="eyebrow">People &amp; access</span>
        <h2 className="h2">{embedded ? "Access administration" : "People & Access"}</h2>
        <p className="screen-note">Invite Staff, manage unit and team responsibilities, and review account activation without creating duplicate identities.</p>
      </div>
      <div className="phase5-access-header-actions">
        <Button variant="quiet" size="compact" onClick={() => {
          if (form.person && onLifecycle) onLifecycle(form.person, "offboarding");
          else go?.("lifecycle");
        }}>Lifecycle &amp; offboarding</Button>
        <Button variant="quiet" size="compact" onClick={() => go?.("units")}>Units</Button>
      </div>
    </header>

    {error && <ProductNotice tone="error" title="People & Access">{error}</ProductNotice>}
    {notice && <ProductNotice tone="success" title="Recorded">{notice}</ProductNotice>}

    {!snapshot || snapshotScope !== scopeKey ? error
      ? <Button onClick={load}>Try again</Button>
      : <LoadingState label="Loading People & Access…" />
      : <>
        <div className="phase5-access-tabs" role="tablist" aria-label="People and access actions">
          {ACCESS_MODES.map(([key, label]) => <button
            key={key}
            type="button"
            role="tab"
            aria-selected={mode === key}
            className={mode === key ? "is-selected" : ""}
            onClick={() => setMode(key)}
          >
            <span>{label}</span>
            {key === "invitations" && pendingInvitationCount ? <b>{pendingInvitationCount}</b> : null}
          </button>)}
        </div>

        {mode === "invite" && <DataPanel
          eyebrow="New account"
          title="Invite a Staff member"
          supporting="New accounts always begin as Staff. Authority is assigned separately after activation; job title never grants application authority."
          className="phase5-access-panel"
        >
          {initialInviteRoster?.employeeId && <div className="phase5-access-callout" role="note">
            <strong>Existing employee record selected</strong>
            <span>{initialInviteRoster.name || "Selected employee"} · Verify the recipient email and primary unit before inviting. The HR contact address is not proof of an activated account. An invitation never links this employee automatically; after activation, HR must independently verify and link the existing identity under that person's Account &amp; Access record.</span>
          </div>}
          <div className="phase5-access-form-grid">
            <FieldGroup label="Full name"><input className="field" aria-label="Full name" value={form.name} onChange={set("name")} /></FieldGroup>
            <FieldGroup label="Work email"><input className="field" type="email" autoCapitalize="none" aria-label="Invitation email" value={form.email} onChange={set("email")} /></FieldGroup>
            <FieldGroup label="Primary unit">
              <select className="field" aria-label="Invitation unit" value={form.unit} onChange={set("unit")}>
                <option value="">Choose a unit</option>
                {snapshot.units.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}
              </select>
            </FieldGroup>
          </div>
          <div className="phase5-access-callout">
            <strong>Existing identity?</strong>
            <span>Do not invite again. Use Responsibilities below so the existing CEAC identity keeps one account and gains the authorised organisational responsibility.</span>
          </div>
          {form.email.trim() && !isPlausibleInvitationEmail(form.email) && <p className="screen-note" role="status">Enter an email address in the form person@example.org before recording an invitation.</p>}
          {existingAccountEmail && <ProductNotice tone="attention" title="Account already exists">
            This email is already associated with a CEAC identity. Use Responsibilities or review that person's existing account instead of sending a second invitation.
          </ProductNotice>}
          {!existingAccountEmail && existingInvitationEmail && <ProductNotice tone="attention" title="Invitation already recorded">
            This email already has an outstanding invitation. Review Invitations to resend or cancel the existing record rather than creating another.
          </ProductNotice>}
          <div className="phase5-access-actions">
            <Button
              busy={busy}
              disabled={busy || form.name.trim().length < 2 || !isPlausibleInvitationEmail(form.email) || !form.unit || existingAccountEmail || existingInvitationEmail}
              onClick={sendInvitation}
            >Send Staff invitation</Button>
          </div>
        </DataPanel>}

        {mode === "responsibility" && <div className="phase5-access-responsibility-grid">
          <DataPanel
            eyebrow="Existing identity"
            title="Organisational responsibility"
            supporting="Add or end a unit responsibility without replacing the person’s identity or silently removing other memberships."
            className="phase5-access-panel"
          >
            <div className="phase5-access-form-grid">
              <FieldGroup label="Person">
                <select className="field" aria-label="Existing person" value={form.person} onChange={set("person")}>
                  <option value="">Choose a person</option>
                  {snapshot.people.filter((person) => person.active).map((person) => <option key={person.id} value={person.id}>{person.full_name} · {person.email}</option>)}
                </select>
              </FieldGroup>
              <FieldGroup label="Unit">
                <select className="field" aria-label="Responsibility unit" value={form.unit} onChange={set("unit")}>
                  <option value="">Choose a unit</option>
                  {snapshot.units.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}
                </select>
              </FieldGroup>
              <FieldGroup label="Responsibility">
                <select className="field" aria-label="Responsibility role" value={form.role} onChange={set("role")}>
                  <option value="staff">Staff</option>
                  <option value="sub_team_lead">Team lead</option>
                  <option value="manager">Unit Head</option>
                </select>
              </FieldGroup>
              <FieldGroup label="Reason">
                <textarea className="field" rows="3" aria-label="Responsibility reason" value={form.reason} onChange={set("reason")} placeholder="Why this responsibility is being recorded" />
              </FieldGroup>
            </div>
            <div className="phase5-access-actions">
              <Button
                busy={busy}
                disabled={busy || !form.person || !form.unit || alreadyHasResponsibility || !form.reason.trim()}
                onClick={() => action(() => saveResponsibility(), "Responsibility recorded. Other unit memberships are preserved.")}
              >Record responsibility</Button>
              {selectedPerson && onOpenPerson ? <Button variant="secondary" onClick={() => onOpenPerson(selectedPerson.id)}>Open employee record</Button> : null}
            </div>
            {alreadyHasResponsibility && <p className="screen-note" role="status">This person already has that responsibility in the selected unit. The existing membership will not be duplicated.</p>}
            <p className="screen-note">Use the employee record for primary-unit transfer, Manager/reporting-line changes and employment status. Those changes preserve employment history.</p>
          </DataPanel>

          <DataPanel
            eyebrow="Current placement"
            title={selectedPerson ? selectedPerson.full_name : "Choose a person"}
            supporting={selectedPerson ? selectedPerson.email : "Current unit responsibilities and team placement will appear here."}
            className="phase5-access-panel phase5-access-current"
            action={selectedPerson ? <StatusBadge tone={selectedPerson.active ? "success" : "neutral"}>{selectedPerson.active ? "Active" : "Inactive"}</StatusBadge> : null}
          >
            {!selectedPerson ? <div className="phase5-access-empty">Select an active person to review current responsibilities.</div> : <>
              <div className="phase5-access-memberships">
                {selectedMemberships.map((membership) => {
                  const unit = snapshot.units.find((entry) => entry.id === membership.unit_id);
                  const stillInUnitTeam = selectedLaneMemberships.some((entry) =>
                    snapshot.lanes.some((lane) => lane.id === entry.sub_team_id && lane.unit_id === membership.unit_id));
                  return <div className="phase5-access-membership" key={membership.id}>
                    <div>
                      <strong>{unit?.name || "Unit"}</strong>
                      <span>{membership.role.replaceAll("_", " ")}</span>
                    </div>
                    <Button
                      variant="quiet"
                      size="compact"
                      disabled={busy || !form.reason.trim()}
                      onClick={() => setEndMembershipTarget({ membership, personId: form.person, personName: selectedPerson?.full_name || "this person", unitName: unit?.name || "unit", reason: form.reason.trim() })}
                    >End membership</Button>
                    {stillInUnitTeam && <span className="screen-note" role="status">Ending this unit responsibility also clears its team placements through the authorised database action.</span>}
                  </div>;
                })}
                {!selectedMemberships.length ? <div className="phase5-access-empty">No active unit responsibility is returned for this person.</div> : null}
              </div>

              <div className="phase5-access-lane">
                <div className="phase5-access-memberships" aria-label="Recorded team placements">
                  <strong>Current team placements</strong>
                  {selectedLaneMemberships.length ? selectedLaneMemberships.map((member) => {
                    const lane = snapshot.lanes.find((item) => item.id === member.sub_team_id);
                    const unit = snapshot.units.find((item) => item.id === lane?.unit_id);
                    return <div className="phase5-access-membership" key={member.sub_team_id}>
                      <div><strong>{lane?.name || "Team not returned"}</strong>
                        <span>{unit?.name || "Unit not returned"}</span></div>
                    </div>;
                  }) : <div className="phase5-access-empty">No team placement is recorded for this person.</div>}
                </div>
                <FieldGroup label="Team / sub-team">
                  <select className="field" aria-label="Work lane" value={form.lane} onChange={set("lane")}>
                    <option value="">Choose a team / sub-team</option>
                    {snapshot.lanes.filter((lane) => lane.unit_id === form.unit).map((lane) => <option key={lane.id} value={lane.id}>{lane.name}</option>)}
                  </select>
                </FieldGroup>
                {!belongsToSelectedUnit && form.unit ? <p className="screen-note" role="status">Assign an authorised unit responsibility before adding this person to one of its teams.</p> : null}
                <div className="phase5-access-actions">
                  <Button variant="secondary" size="compact" disabled={busy || !form.person || !form.lane || !belongsToSelectedUnit || belongsToSelectedLane || !form.reason.trim()} onClick={() => action(() => saveLane(true), "Team / sub-team membership recorded.")}>Add to team</Button>
                  <Button variant="quiet" size="compact" disabled={busy || !form.person || !form.lane || !belongsToSelectedLane || !form.reason.trim()} onClick={() => action(() => saveLane(false), "Team / sub-team membership ended.")}>Remove from team</Button>
                </div>
              </div>
            </>}
          </DataPanel>
        </div>}

        {mode === "technical-support" && <><SupportAccessApprovals me={me} authority="people_administration" /><SupportTeamMemberships me={me} people={snapshot.people} units={snapshot.units} /></>}

        {mode === "invitations" && <DataPanel
          eyebrow="Account activation"
          title="Invitations"
          supporting="Outstanding and expired invitations require follow-up. Resending only requests an activation email; it does not independently prove delivery. Cancelling prevents activation through that invitation."
          className="phase5-access-panel"
          action={<StatusBadge tone={pendingInvitationCount ? "action" : "success"}>{pendingInvitationCount ? String(pendingInvitationCount) + " to review" : "No outstanding"}</StatusBadge>}
        >
          <FieldGroup label="Invitation status"><select className="field" aria-label="Invitation status" style={{maxWidth:280}} value={invitationFilter} onChange={e=>setInvitationFilter(e.target.value)}>
            <option value="all">All invitations</option><option value="pending">Awaiting activation</option><option value="expired">Expired</option><option value="verified">Activated</option><option value="cancelled">Cancelled</option>
          </select></FieldGroup>
          <p className="screen-note">{visibleInvitations.length} of {snapshot.invitations.length} invitations</p>
          {!visibleInvitations.length ? <div className="phase5-access-empty">{snapshot.invitations.length?"No invitations match this status.":"No invitations are recorded."}</div> : <div className="phase5-invitation-list">
            {visibleInvitations.map((invitation) => {
              const unit = snapshot.units.find((entry) => entry.id === invitation.unit_id);
              const cancellable = !invitation.revoked_at && invitation.activation_state !== "verified";
              return <article className="phase5-invitation-row" key={invitation.id}>
                <div className="phase5-invitation-main">
                  <strong>{invitation.full_name}</strong>
                  <span>{invitation.email}</span>
                  <small>{unit?.name || "Unit not returned"} · Invited {new Date(invitation.invited_at).toLocaleString("en-GB", { timeZone: "Africa/Accra" })}</small>
                </div>
                <StatusBadge tone={invitationTone(invitation.activation_state, invitation.revoked_at)} icon={false}>
                  {invitation.revoked_at ? "Cancelled" : invitation.activation_state.replaceAll("_", " ")}
                </StatusBadge>
                {cancellable ? <div className="phase5-invitation-actions">
                  <Button variant="quiet" size="compact" disabled={busy} onClick={() => action(() => resendStaffInvitation(invitation.id), "Another activation email was requested. Delivery is not yet independently confirmed.")}>Resend</Button>
                  <Button variant="quiet" size="compact" disabled={busy} onClick={() => { setRevokeTarget(invitation); setRevokeReason(""); }}>Cancel</Button>
                </div> : null}
              </article>;
            })}
          </div>}
        </DataPanel>}
        {mode === "invitations" && <VolunteerActivationApprovals me={me} />}

        {endMembershipTarget ? <div className="phase5-access-revoke" role="dialog" aria-modal="true" aria-labelledby="end-unit-title">
          <div className="phase5-access-revoke-card">
            <span className="eyebrow">Responsibility change</span>
            <h3 className="h2" id="end-unit-title">End unit responsibility?</h3>
            <p className="screen-note">End {endMembershipTarget.personName}'s responsibility in {endMembershipTarget.unitName}? The server also removes all team placements for that unit and records the change.</p>
            <p className="screen-note">Recorded reason: {endMembershipTarget.reason}</p>
            <div className="phase5-access-actions">
              <Button variant="secondary" disabled={busy} onClick={() => setEndMembershipTarget(null)}>Keep responsibility</Button>
              <Button busy={busy} onClick={async () => {
                const target = endMembershipTarget;
                const ok = await action(() => saveResponsibility("remove", target.membership, target.personId, target.reason), "Unit responsibility and its team placements ended with audit history.");
                if (ok) setEndMembershipTarget(null);
              }}>End responsibility and teams</Button>
            </div>
          </div>
        </div> : null}

        {revokeTarget ? <div className="phase5-access-revoke" role="dialog" aria-modal="true" aria-labelledby="phase5-revoke-title">
          <div className="phase5-access-revoke-card">
            <span className="eyebrow">Invitation control</span>
            <h3 className="h2" id="phase5-revoke-title">Cancel invitation</h3>
            <p className="screen-note">Cancel the invitation for {revokeTarget.full_name}. This does not delete an existing employee record or active identity.</p>
            <FieldGroup label="Reason"><textarea className="field" rows="3" autoFocus value={revokeReason} onChange={(event) => setRevokeReason(event.target.value)} /></FieldGroup>
            <div className="phase5-access-actions">
              <Button variant="secondary" onClick={() => { setRevokeTarget(null); setRevokeReason(""); }} disabled={busy}>Keep invitation</Button>
              <Button onClick={revokeInvitation} busy={busy} disabled={!revokeReason.trim()}>Cancel invitation</Button>
            </div>
          </div>
        </div> : null}
      </>}
  </section>;
}

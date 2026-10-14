import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { authRedirect } from "../lib/authRedirect";

// HR approval is the authority event. An email provider accepting an OTP
// request is not proof that the invitation was delivered or that email is verified.
const canonical = (value) => JSON.stringify(value || {}, Object.keys(value || {}).sort());
const approvedForCurrentVersion = (invite, approvals) => approvals.some((a) =>
  a.invitation_id === invite.id &&
  a.invited_at === invite.invited_at &&
  a.approved_unit_id === invite.unit_id &&
  canonical(a.approved_pattern) === canonical(invite.engagement_working_pattern)
);
const expectedSchemaMissing = (error) =>
  ["42P01","PGRST205"].includes(error?.code) &&
  /volunteer_invitation_approvals|engagement_type/i.test(String(error?.message || ""));

export default function VolunteerActivationApprovals({ me }) {
  const [invitations, setInvitations] = useState([]);
  const [approvals, setApprovals] = useState([]);
  const [reasons, setReasons] = useState({});
  const [busy, setBusy] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [ready, setReady] = useState(false);
  const [pendingSchema, setPendingSchema] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const generation = useRef(0);
  const writing = useRef(false);

  async function reload() {
    const token = ++generation.current;
    setReady(false);
    const [request, approved] = await Promise.all([
      supabase.from("pending_invitations")
        .select("id,full_name,email,unit_id,engagement_type,engagement_working_pattern,invited_at,expires_at,revoked_at,resolved_at,units(name)")
        .eq("org_id",me.org_id).eq("engagement_type","volunteer")
        .is("resolved_at",null).is("revoked_at",null)
        .gt("expires_at",new Date().toISOString())
        .order("invited_at",{ascending:false}),
      supabase.from("volunteer_invitation_approvals")
        .select("invitation_id,invited_at,approved_unit_id,approved_pattern,approved_at")
        .eq("org_id",me.org_id),
    ]);
    if (token !== generation.current) return;
    const failed = request.error || approved.error;
    if (failed) {
      setPendingSchema(expectedSchemaMissing(failed));
      setError(expectedSchemaMissing(failed) ? "" : "Volunteer approvals could not be loaded. No activation was authorised.");
      setReady(true);
      return;
    }
    setInvitations(request.data || []);
    setApprovals(approved.data || []);
    setPendingSchema(false);
    setError("");
    setReady(true);
  }

  useEffect(() => {
    generation.current += 1;
    writing.current = false;
    setInvitations([]);
    setApprovals([]);
    setReady(false);
    setReasons({});
    setError("");
    setNotice("");
    void reload();
    return () => { generation.current += 1; };
  }, [me.id, me.org_id]);

  async function authoriseAndRequestEmail(invite) {
    if (writing.current) return;
    const reason = reasons[invite.id] || "";
    writing.current = true;
    const token = generation.current;
    setBusy(true);
    setBusyId(invite.id);
    setError("");
    setNotice("");
    let confirmedApproval = approvedForCurrentVersion(invite, approvals);
    try {
      if (!confirmedApproval) {
        if (reason.trim().length < 8) {
          setError("Record a reason of at least eight characters for HR approval.");
          return;
        }
        const { data, error: approvalFailure } =
          await supabase.rpc("volunteer_approve_invitation", {
            p_invitation_id:invite.id, p_reason:reason.trim(),
          });
        if (approvalFailure) throw approvalFailure;
        if (!data?.approved || data.invitation_id !== invite.id || data.email !== invite.email) {
          throw new Error("Volunteer HR approval could not be confirmed.");
        }
        confirmedApproval = true;
      }
      if (token !== generation.current) return;
      const { error: emailFailure } = await supabase.auth.signInWithOtp({
        email:invite.email,
        options:{ shouldCreateUser:true, emailRedirectTo:authRedirect("/activate") },
      });
      if (emailFailure) {
        setNotice("HR approval was recorded, but the activation email request was not accepted. Check the current account and invitation status before retrying.");
      } else {
        setNotice("HR approval is recorded. The activation email was requested; actual delivery and account verification remain unconfirmed.");
      }
      setReasons((current) => {
        const next = { ...current };
        delete next[invite.id];
        return next;
      });
      try { await reload(); } catch {
        setError("Approval was recorded but the latest invitation list could not be loaded.");
      }
    } catch (failure) {
      if (token === generation.current) {
        setError(confirmedApproval
          ? "HR approval may be recorded, but the activation outcome is unconfirmed. Review invitation status before retrying."
          : "HR approval could not be confirmed. Review the invitation before trying again.");
      }
    } finally {
      writing.current = false;
      setBusy(false);
      setBusyId("");
    }
  }

  return <section aria-labelledby="volunteer-activation-heading" className="phase5-access-panel">
    <h3 id="volunteer-activation-heading">Volunteer activation — HR approval</h3>
    <p className="screen-note">Managers request volunteer onboarding. HR must approve the current invitation, unit and working arrangement before the volunteer may activate. Approving does not give a volunteer an employee salary or privileged role.</p>
    {!ready && <p role="status">Loading volunteer approvals...</p>}
    {pendingSchema && <p className="screen-note">Volunteer HR approval is not enabled on this database. Existing staff invitations remain available.</p>}
    {error && <p role="alert">{error}</p>}
    {notice && <p role="status">{notice}</p>}
    {ready && !pendingSchema && !error && invitations.length === 0 && <p className="screen-note">No pending volunteer invitations require HR action.</p>}
    {ready && !pendingSchema && invitations.map((invite) => {
      const isApproved = approvedForCurrentVersion(invite, approvals);
      return <article className="phase5-invitation-row" key={invite.id}>
        <div className="phase5-invitation-main">
          <strong>{invite.full_name}</strong>
          <span>{invite.email}</span>
          <small>{invite.units?.name || "Unit"} · {isApproved ? "HR approved" : "Awaiting HR"} · {invite.engagement_working_pattern?.kind || "Working arrangement to confirm"}</small>
        </div>
        {!isApproved && <label>HR approval reason
          <textarea className="field" rows={2} aria-label={"Volunteer approval reason for "+invite.full_name}
            disabled={busy} value={reasons[invite.id] || ""}
            onChange={(event)=>setReasons((current)=>({ ...current,[invite.id]:event.target.value }))} />
        </label>}
        <button type="button" className="btn btn-ghost" disabled={busy || (!isApproved && (reasons[invite.id] || "").trim().length < 8)}
          onClick={() => authoriseAndRequestEmail(invite)}>
          {busyId === invite.id ? "Processing..." : isApproved ? "Request activation email again" : "HR approve and request activation"}
        </button>
      </article>;
    })}
    <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => void reload()}>Refresh approval status</button>
  </section>;
}

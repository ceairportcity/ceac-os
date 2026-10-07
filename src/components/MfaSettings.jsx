import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { humanError } from "../lib/productLanguage";
import { isPrivilegedIdentity, verifiedMfaFactors } from "../lib/mfaPolicy";
import {
  PersonalBoundary,
  PersonalEmpty,
  PersonalRecordRow,
  PersonalSection,
} from "../experience-v2/personal-family/PersonalFamilyV2";

function factorName(factor, index) {
  if (factor?.friendly_name) return factor.friendly_name;
  return `Authenticator ${index + 1}`;
}

export default function MfaSettings({ me }) {
  const [factors, setFactors] = useState([]);
  const [pendingFactors, setPendingFactors] = useState([]);
  const [level, setLevel] = useState(null);
  const [enforcementEnabled, setEnforcementEnabled] = useState(false);
  const [setup, setSetup] = useState(null);
  const [setupCode, setSetupCode] = useState("");
  const [removeTarget, setRemoveTarget] = useState(null);
  const [removeCode, setRemoveCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  const privileged = isPrivilegedIdentity(me);
  const currentIsVerified = level?.currentLevel === "aal2";
  const lastFactorLocked = privileged && enforcementEnabled && factors.length <= 1;

  useEffect(() => {
    load();
  }, [me?.id, me?.org_id]);

  async function load() {
    setLoading(true);
    setError(null);

    const [listed, assurance, organisation] = await Promise.all([
      supabase.auth.mfa.listFactors(),
      supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
      me?.org_id
        ? supabase.from("organisations")
          .select("privileged_mfa_enforced")
          .eq("id", me.org_id)
          .single()
        : Promise.resolve({ data: null, error: null }),
    ]);

    if (listed.error) {
      setError(humanError(listed.error, "Two-step verification status could not be loaded."));
    } else {
      const verified = verifiedMfaFactors(listed.data);
      const verifiedIds = new Set(verified.map((factor) => factor.id));
      const all = Array.isArray(listed.data?.all)
        ? listed.data.all
        : [...(listed.data?.totp || []), ...(listed.data?.phone || []), ...(listed.data?.webauthn || [])];

      setFactors(verified.filter((factor) => factor.factor_type === "totp"));
      setPendingFactors(all.filter((factor) =>
        factor?.factor_type === "totp"
        && factor?.id
        && !verifiedIds.has(factor.id)
      ));
    }

    if (!assurance.error) setLevel(assurance.data || null);
    if (!organisation.error) {
      setEnforcementEnabled(Boolean(organisation.data?.privileged_mfa_enforced));
    }

    setLoading(false);
  }

  async function beginSetup() {
    if (busy || setup || pendingFactors.length) return;
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      const enrolled = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: `CEAC Authenticator ${factors.length + 1}`,
      });
      if (enrolled.error) throw enrolled.error;
      setSetup({
        id: enrolled.data.id,
        qrCode: enrolled.data.totp?.qr_code || null,
      });
      setSetupCode("");
    } catch (e) {
      setError(humanError(e, "CEAC could not start two-step verification setup."));
    } finally {
      setBusy(false);
    }
  }

  async function cancelSetup() {
    if (!setup || busy) return;
    setBusy(true);
    setError(null);
    try {
      const removed = await supabase.auth.mfa.unenroll({ factorId: setup.id });
      if (removed.error) throw removed.error;
      setSetup(null);
      setSetupCode("");
      await load();
    } catch (e) {
      setError(humanError(e, "That unfinished verification setup could not be cancelled."));
    } finally {
      setBusy(false);
    }
  }

  async function verifySetup() {
    if (!setup || !setupCode.trim() || busy) return;
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      const challenge = await supabase.auth.mfa.challenge({ factorId: setup.id });
      if (challenge.error) throw challenge.error;
      const verified = await supabase.auth.mfa.verify({
        factorId: setup.id,
        challengeId: challenge.data.id,
        code: setupCode.trim(),
      });
      if (verified.error) throw verified.error;
      setSetup(null);
      setSetupCode("");
      setMessage("Two-step verification is on. Other signed-in sessions were revoked and may take a short time to lose access.");
      await load();
    } catch (e) {
      setError(humanError(e, "That verification code could not be accepted. Check the code and try again."));
    } finally {
      setBusy(false);
    }
  }

  async function removePendingFactor(factor) {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      const removed = await supabase.auth.mfa.unenroll({ factorId: factor.id });
      if (removed.error) throw removed.error;
      setMessage("Unfinished verification setup removed.");
      await load();
    } catch (e) {
      setError(humanError(e, "That unfinished verification setup could not be removed."));
    } finally {
      setBusy(false);
    }
  }

  function beginRemoveFactor(factor) {
    if (busy) return;
    if (lastFactorLocked) {
      setError("Add and verify a replacement before removing the only verification method on this privileged account.");
      return;
    }
    setMessage(null);
    setError(null);
    setRemoveTarget(factor);
    setRemoveCode("");
  }

  async function removeVerifiedFactor() {
    if (!removeTarget || busy) return;
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      if (!currentIsVerified) {
        if (!removeCode.trim()) {
          setError("Enter a current authenticator code before removing a verified method.");
          return;
        }
        const challenge = await supabase.auth.mfa.challenge({ factorId: removeTarget.id });
        if (challenge.error) throw challenge.error;
        const verified = await supabase.auth.mfa.verify({
          factorId: removeTarget.id,
          challengeId: challenge.data.id,
          code: removeCode.trim(),
        });
        if (verified.error) throw verified.error;
      }

      const removed = await supabase.auth.mfa.unenroll({ factorId: removeTarget.id });
      if (removed.error) throw removed.error;
      setRemoveTarget(null);
      setRemoveCode("");
      setMessage("Verification method removed.");
      await load();
    } catch (e) {
      setError(humanError(e, "That verification method could not be removed."));
    } finally {
      setBusy(false);
    }
  }

  const status = useMemo(() => {
    if (loading) return "Checking…";
    if (!factors.length) return "Not set up";
    return currentIsVerified ? "Verified for this session" : "Set up";
  }, [loading, factors.length, currentIsVerified]);

  return <PersonalSection
    eyebrow="Account protection"
    title="Two-step verification"
    description="Use an authenticator app so a password alone is not enough to open your CEAC account."
  >
    {privileged ? <PersonalBoundary title={enforcementEnabled ? "Privileged account protection is active" : "Required before privileged go-live"}>
      {enforcementEnabled
        ? "This account is under privileged two-step enforcement. Keep at least one verified authenticator on the account."
        : "This account has privileged CEAC authority. Two-step verification will be required before final production onboarding. It is not being forced during the active test phase."}
    </PersonalBoundary> : null}

    {error ? <div className="flag flag-brick ev2pf-partial-error"><h4>Security change was not completed</h4>{error}</div> : null}
    {message ? <div className="flag flag-green"><h4>Account security updated</h4>{message}</div> : null}

    <PersonalRecordRow
      title="Protection status"
      meta={status}
      detail={factors.length ? `${factors.length} verified authenticator${factors.length === 1 ? "" : "s"} on this account` : "No verified authenticator is recorded yet."}
    />

    {!loading && factors.length === 0 && !setup ? <PersonalEmpty
      title="Two-step verification is not set up"
      description="Add an authenticator app now, or complete it before privileged production onboarding if this account has elevated access."
    /> : null}

    {pendingFactors.map((factor, index) => <PersonalRecordRow
      key={factor.id}
      title={factorName(factor, index)}
      meta="Setup not finished"
      detail="This authenticator has not been verified and does not protect sign-in yet."
      action={<button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => removePendingFactor(factor)}>
        Remove unfinished setup
      </button>}
    /> )}

    {factors.map((factor, index) => <PersonalRecordRow
      key={factor.id}
      title={factorName(factor, index)}
      meta="Verified"
      detail="Authenticator app"
      action={<button type="button" className="btn btn-ghost btn-sm" disabled={busy || lastFactorLocked} onClick={() => beginRemoveFactor(factor)}>
        Remove
      </button>}
    /> )}

    {removeTarget ? <div className="flag ev2pf-account-warning">
      <h4>Remove {factorName(removeTarget, 0)}?</h4>
      {!currentIsVerified ? <>
        <p>Supabase requires an AAL2 session before a verified MFA method can be removed. Enter a current code from this authenticator first.</p>
        <label className="auth-field">
          <span>Verification code</span>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={removeCode}
            onChange={(event) => setRemoveCode(event.target.value.replace(/\s/g, ""))}
          />
        </label>
      </> : <p>This session is already verified at AAL2.</p>}
      <div className="ev2pf-inline-actions">
        <button type="button" className="btn btn-sm" disabled={busy || (!currentIsVerified && !removeCode.trim())} onClick={removeVerifiedFactor}>
          {busy ? "Checking…" : "Remove authenticator"}
        </button>
        <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => { setRemoveTarget(null); setRemoveCode(""); }}>
          Cancel
        </button>
      </div>
    </div> : null}

    {!setup && pendingFactors.length > 0 ? <PersonalBoundary title="Finish or remove the unfinished setup">
      Remove the unfinished authenticator above before starting another one. This prevents abandoned verification methods from accumulating on your account.
    </PersonalBoundary> : null}

    {setup ? <div className="flag ev2pf-account-warning">
      <h4>Finish authenticator setup</h4>
      <p>Scan this code with your authenticator app, then enter the current code below.</p>
      {setup.qrCode ? <img src={setup.qrCode} width="180" height="180" alt="Authenticator setup QR code" /> : null}
      <label className="auth-field">
        <span>Verification code</span>
        <input
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="Enter the current code"
          value={setupCode}
          onChange={(event) => setSetupCode(event.target.value.replace(/\s/g, ""))}
          onKeyDown={(event) => event.key === "Enter" && verifySetup()}
        />
      </label>
      <div className="ev2pf-inline-actions">
        <button type="button" className="btn btn-sm" disabled={busy || !setupCode.trim()} onClick={verifySetup}>
          {busy ? "Checking…" : "Verify"}
        </button>
        <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={cancelSetup}>Cancel</button>
      </div>
    </div> : <button type="button" className="btn wide-auto" disabled={busy || loading || pendingFactors.length > 0} onClick={beginSetup}>
      Add authenticator app
    </button>}
  </PersonalSection>;
}

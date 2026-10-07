import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { humanError } from "../lib/productLanguage";
import {
  PersonalBoundary,
  PersonalEmpty,
  PersonalRecordRow,
  PersonalSection,
} from "../experience-v2/personal-family/PersonalFamilyV2";

function factorList(data) {
  const source = Array.isArray(data?.all)
    ? data.all
    : [...(data?.totp || []), ...(data?.phone || [])];
  const seen = new Set();
  return source.filter((factor) => {
    if (!factor?.id || seen.has(factor.id)) return false;
    seen.add(factor.id);
    return factor.status === "verified";
  });
}

function factorName(factor, index) {
  if (factor?.friendly_name) return factor.friendly_name;
  if (factor?.factor_type === "phone") return factor.phone ? `Phone ending ${String(factor.phone).slice(-4)}` : "Phone verification";
  return `Authenticator ${index + 1}`;
}

export default function MfaSettings({ me }) {
  const [factors, setFactors] = useState([]);
  const [level, setLevel] = useState(null);
  const [setup, setSetup] = useState(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  const privileged = Boolean(me?.is_admin || me?.is_exec || (me?.capability_grants || []).length);
  const currentIsVerified = level?.currentLevel === "aal2";

  useEffect(() => { load(); }, [me?.id]);

  async function load() {
    setLoading(true);
    setError(null);
    const [listed, assurance] = await Promise.all([
      supabase.auth.mfa.listFactors(),
      supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
    ]);
    if (listed.error) setError(humanError(listed.error, "Two-step verification status could not be loaded."));
    else setFactors(factorList(listed.data));
    if (!assurance.error) setLevel(assurance.data || null);
    setLoading(false);
  }

  async function beginSetup() {
    if (busy || setup) return;
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
        secret: enrolled.data.totp?.secret || null,
      });
      setCode("");
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
      setCode("");
    } catch (e) {
      setError(humanError(e, "That unfinished verification setup could not be cancelled."));
    } finally {
      setBusy(false);
    }
  }

  async function verifySetup() {
    if (!setup || !code.trim() || busy) return;
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      const challenge = await supabase.auth.mfa.challenge({ factorId: setup.id });
      if (challenge.error) throw challenge.error;
      const verified = await supabase.auth.mfa.verify({
        factorId: setup.id,
        challengeId: challenge.data.id,
        code: code.trim(),
      });
      if (verified.error) throw verified.error;
      setSetup(null);
      setCode("");
      setMessage("Two-step verification is on. Other signed-in sessions were revoked and may take a short time to lose access.");
      await load();
    } catch (e) {
      setError(humanError(e, "That verification code could not be accepted. Check the code and try again."));
    } finally {
      setBusy(false);
    }
  }

  async function removeFactor(factor) {
    if (busy) return;
    if (privileged && factors.length <= 1) {
      setError("Add and verify a replacement before removing the only verification method on a privileged account.");
      return;
    }
    if (!confirm(`Remove ${factorName(factor, 0)} from your account?`)) return;
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      const removed = await supabase.auth.mfa.unenroll({ factorId: factor.id });
      if (removed.error) throw removed.error;
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
    {privileged ? <PersonalBoundary title="Required before privileged go-live">
      This account has privileged CEAC authority. Two-step verification will be required before final production onboarding. It is not being forced during the active test phase.
    </PersonalBoundary> : null}

    {error ? <div className="flag flag-brick ev2pf-partial-error"><h4>Security change was not completed</h4>{error}</div> : null}
    {message ? <div className="flag flag-green"><h4>Account security updated</h4>{message}</div> : null}

    <PersonalRecordRow
      title="Protection status"
      meta={status}
      detail={factors.length ? `${factors.length} verified method${factors.length === 1 ? "" : "s"} on this account` : "No verified second step is recorded yet."}
    />

    {!loading && factors.length === 0 && !setup ? <PersonalEmpty
      title="Two-step verification is not set up"
      description="Add an authenticator app now, or complete it before privileged production onboarding if this account has elevated access."
    /> : null}

    {factors.map((factor, index) => <PersonalRecordRow
      key={factor.id}
      title={factorName(factor, index)}
      meta="Verified"
      detail={factor.factor_type === "phone" ? "Phone verification" : "Authenticator app"}
      action={<button type="button" className="btn btn-ghost btn-sm" disabled={busy || (privileged && factors.length <= 1)} onClick={() => removeFactor(factor)}>
        Remove
      </button>}
    />)}

    {setup ? <div className="flag ev2pf-account-warning">
      <h4>Finish authenticator setup</h4>
      <p>Scan this code with your authenticator app, then enter the current code below.</p>
      {setup.qrCode ? <img src={setup.qrCode} width="180" height="180" alt="Authenticator setup QR code" /> : null}
      {setup.secret ? <p className="screen-note">Manual setup code: <code>{setup.secret}</code></p> : null}
      <label className="auth-field">
        <span>Verification code</span>
        <input
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="Enter the current code"
          value={code}
          onChange={(event) => setCode(event.target.value.replace(/\s/g, ""))}
          onKeyDown={(event) => event.key === "Enter" && verifySetup()}
        />
      </label>
      <div className="ev2pf-inline-actions">
        <button type="button" className="btn btn-sm" disabled={busy || !code.trim()} onClick={verifySetup}>
          {busy ? "Checking…" : "Verify"}
        </button>
        <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={cancelSetup}>Cancel</button>
      </div>
    </div> : <button type="button" className="btn wide-auto" disabled={busy || loading} onClick={beginSetup}>
      Add authenticator app
    </button>}
  </PersonalSection>;
}

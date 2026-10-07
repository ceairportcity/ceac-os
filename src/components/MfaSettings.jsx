import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { humanError } from "../lib/productLanguage";
import { isPrivilegedIdentity } from "../lib/mfaPolicy";
import {
  PersonalBoundary,
  PersonalEmpty,
  PersonalRecordRow,
  PersonalSection,
} from "../experience-v2/personal-family/PersonalFamilyV2";

function collectFactors(data) {
  const source = [];
  for (const [type, list] of Object.entries({
    totp: data?.totp,
    phone: data?.phone,
    webauthn: data?.webauthn,
  })) {
    for (const factor of Array.isArray(list) ? list : []) {
      source.push({ ...factor, factor_type: factor.factor_type || type });
    }
  }
  for (const factor of Array.isArray(data?.all) ? data.all : []) {
    source.push(factor);
  }

  const seen = new Set();
  return source.filter((factor) => {
    if (!factor?.id || seen.has(factor.id)) return false;
    seen.add(factor.id);
    return true;
  });
}

function factorName(factor, index) {
  if (factor?.friendly_name) return factor.friendly_name;
  return `Authenticator ${index + 1}`;
}

export default function MfaSettings({ me }) {
  const [factors, setFactors] = useState([]);
  const [pendingFactors, setPendingFactors] = useState([]);
  const [otherVerified, setOtherVerified] = useState([]);
  const [level, setLevel] = useState(null);
  const [leadStatus, setLeadStatus] = useState("checking");
  const [setup, setSetup] = useState(null);
  const [setupCode, setSetupCode] = useState("");
  const [sessionCode, setSessionCode] = useState("");
  const [sessionFactorId, setSessionFactorId] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  const basePrivileged = isPrivilegedIdentity(me);
  const privileged = basePrivileged || leadStatus === "yes";
  const removalSafetyPrivileged = basePrivileged || leadStatus !== "no";
  const currentIsVerified = level?.currentLevel === "aal2";
  const lastFactorLocked = removalSafetyPrivileged && factors.length <= 1;

  useEffect(() => {
    load();
  }, [me?.id]);

  async function load() {
    setLoading(true);
    setError(null);

    const leadPromise = basePrivileged
      ? Promise.resolve({ data: [], error: null, skipped: true })
      : supabase.from("sub_teams")
        .select("id")
        .eq("lead_id", me.id)
        .eq("active", true)
        .limit(1);

    const [listed, assurance, lead] = await Promise.all([
      supabase.auth.mfa.listFactors(),
      supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
      leadPromise,
    ]);

    if (lead?.skipped) {
      setLeadStatus("no");
    } else if (lead?.error) {
      // Fail closed for destructive factor removal when leadership visibility
      // cannot be confirmed. Server-side privilege enforcement remains canonical.
      setLeadStatus("unknown");
    } else {
      setLeadStatus((lead?.data || []).length > 0 ? "yes" : "no");
    }

    if (listed.error) {
      setError(humanError(listed.error, "Two-step verification status could not be loaded."));
      setFactors([]);
      setPendingFactors([]);
      setOtherVerified([]);
    } else {
      const all = collectFactors(listed.data);
      const totp = all.filter((factor) => factor.factor_type === "totp");
      const verifiedTotp = totp.filter((factor) => factor.status === "verified");
      setFactors(verifiedTotp);
      setPendingFactors(totp.filter((factor) => factor.status !== "verified"));
      setOtherVerified(all.filter(
        (factor) => factor.factor_type !== "totp" && factor.status === "verified"
      ));
      setSessionFactorId((current) =>
        verifiedTotp.some((factor) => factor.id === current)
          ? current
          : (verifiedTotp[0]?.id || "")
      );
    }

    if (assurance.error) {
      setError((current) => current || humanError(
        assurance.error,
        "Sign-in verification status could not be loaded."
      ));
      setLevel(null);
    } else {
      setLevel(assurance.data || null);
    }

    setLoading(false);
  }

  async function verifyCurrentSession() {
    const factor = factors.find((item) => item.id === sessionFactorId) || factors[0];
    if (!factor || !sessionCode.trim() || busy) return;

    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      const challenge = await supabase.auth.mfa.challenge({ factorId: factor.id });
      if (challenge.error) throw challenge.error;
      const verified = await supabase.auth.mfa.verify({
        factorId: factor.id,
        challengeId: challenge.data.id,
        code: sessionCode.trim(),
      });
      if (verified.error) throw verified.error;
      setSessionCode("");
      setMessage("This sign-in is now verified for account-security changes.");
      await load();
    } catch (err) {
      setError(humanError(
        err,
        "That verification code could not be accepted. Check the code and try again."
      ));
    } finally {
      setBusy(false);
    }
  }

  async function beginSetup() {
    if (busy || setup || pendingFactors.length) return;
    if (factors.length > 0 && !currentIsVerified) {
      setError("Verify this sign-in with your existing authenticator before adding another method.");
      return;
    }

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
      setSetupCode("");
    } catch (err) {
      setError(humanError(err, "CEAC could not start authenticator setup."));
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
      setMessage("Unfinished authenticator setup removed.");
      await load();
    } catch (err) {
      setError(humanError(err, "That unfinished authenticator setup could not be removed."));
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
      setMessage("Two-step verification is on. Other signed-in sessions may need to sign in again.");
      await load();
    } catch (err) {
      setError(humanError(
        err,
        "That verification code could not be accepted. Check the code and try again."
      ));
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
      setMessage("Unfinished authenticator setup removed.");
      await load();
    } catch (err) {
      setError(humanError(err, "That unfinished authenticator setup could not be removed."));
    } finally {
      setBusy(false);
    }
  }

  async function removeFactor(factor) {
    if (busy) return;
    if (!currentIsVerified) {
      setError("Verify this sign-in before removing a verified authenticator.");
      return;
    }
    if (lastFactorLocked) {
      setError("Add and verify a replacement before removing the only authenticator on this privileged account.");
      return;
    }
    if (!confirm(`Remove ${factorName(factor, 0)} from your account?`)) return;

    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      const removed = await supabase.auth.mfa.unenroll({ factorId: factor.id });
      if (removed.error) throw removed.error;
      setMessage("Authenticator removed.");
      await load();
    } catch (err) {
      setError(humanError(err, "That authenticator could not be removed."));
    } finally {
      setBusy(false);
    }
  }

  const status = useMemo(() => {
    if (loading) return "Checking…";
    if (!factors.length && !otherVerified.length) return "Not set up";
    if (currentIsVerified) return "Verified for this sign-in";
    return "Set up — verification needed";
  }, [loading, factors.length, otherVerified.length, currentIsVerified]);

  return <PersonalSection
    eyebrow="Account protection"
    title="Two-step verification"
    description="Use an authenticator app so a password alone is not enough to use your CEAC account."
  >
    {privileged ? <PersonalBoundary title="Privileged account protection">
      This account carries elevated CEAC authority. Final go-live enforcement is controlled separately, but once an authenticator is added CEAC keeps at least one verified authenticator on this privileged account.
    </PersonalBoundary> : null}

    {leadStatus === "unknown" && !basePrivileged ? <PersonalBoundary title="Removal temporarily locked">
      CEAC could not safely confirm whether this account leads a work lane. Adding and verifying an authenticator is still available, but removing the last verified authenticator is locked until that check succeeds.
    </PersonalBoundary> : null}

    {error ? <div className="flag flag-brick ev2pf-partial-error"><h4>Security change was not completed</h4>{error}</div> : null}
    {message ? <div className="flag flag-green"><h4>Account security updated</h4>{message}</div> : null}

    <PersonalRecordRow
      title="Protection status"
      meta={status}
      detail={factors.length
        ? `${factors.length} verified authenticator${factors.length === 1 ? "" : "s"} on this account`
        : "No verified authenticator app is recorded yet."}
    />

    {otherVerified.length > 0 ? <PersonalBoundary title="Another verified factor exists">
      CEAC currently manages authenticator-app (TOTP) methods here. Another verified factor exists on this account and is not silently ignored; final sign-in routing must still require a supported second step before workspace access.
    </PersonalBoundary> : null}

    {!loading && factors.length === 0 && !setup ? <PersonalEmpty
      title="Two-step verification is not set up"
      description="Add an authenticator app now. Privileged accounts must complete this before final production enforcement is enabled."
    /> : null}

    {factors.length > 0 && !currentIsVerified ? <div className="flag ev2pf-account-warning">
      <h4>Verify this sign-in before changing verified methods</h4>
      <p>Enter the current code from your authenticator app. This is required before removing a verified method and before adding another verified method.</p>
      {factors.length > 1 ? <label className="auth-field">
        <span>Authenticator</span>
        <select value={sessionFactorId} onChange={(event) => setSessionFactorId(event.target.value)}>
          {factors.map((factor, index) => <option key={factor.id} value={factor.id}>{factorName(factor, index)}</option>)}
        </select>
      </label> : null}
      <label className="auth-field">
        <span>Verification code</span>
        <input
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="Enter the current code"
          value={sessionCode}
          onChange={(event) => setSessionCode(event.target.value.replace(/\s/g, ""))}
          onKeyDown={(event) => event.key === "Enter" && verifyCurrentSession()}
        />
      </label>
      <button type="button" className="btn btn-sm" disabled={busy || !sessionCode.trim()} onClick={verifyCurrentSession}>
        {busy ? "Checking…" : "Verify this sign-in"}
      </button>
    </div> : null}

    {pendingFactors.map((factor, index) => <PersonalRecordRow
      key={factor.id}
      title={factorName(factor, index)}
      meta="Setup not finished"
      detail="This authenticator has not been verified and does not protect sign-in yet."
      action={<button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => removePendingFactor(factor)}>
        Remove unfinished setup
      </button>}
    />)}

    {factors.map((factor, index) => <PersonalRecordRow
      key={factor.id}
      title={factorName(factor, index)}
      meta="Verified"
      detail="Authenticator app"
      action={<button
        type="button"
        className="btn btn-ghost btn-sm"
        disabled={busy || !currentIsVerified || lastFactorLocked}
        onClick={() => removeFactor(factor)}
      >
        Remove
      </button>}
    />)}

    {lastFactorLocked && factors.length === 1 && currentIsVerified ? <PersonalBoundary title="Keep one verified authenticator">
      Add and verify a replacement before removing the only authenticator on this privileged account.
    </PersonalBoundary> : null}

    {!setup && pendingFactors.length > 0 ? <PersonalBoundary title="Finish or remove the unfinished setup">
      Remove the unfinished method above before starting another authenticator setup. This prevents abandoned verification methods from accumulating.
    </PersonalBoundary> : null}

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
    </div> : <button
      type="button"
      className="btn wide-auto"
      disabled={busy || loading || pendingFactors.length > 0 || (factors.length > 0 && !currentIsVerified)}
      onClick={beginSetup}
    >
      Add authenticator app
    </button>}
  </PersonalSection>;
}

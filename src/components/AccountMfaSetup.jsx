import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { verifiedMfaFactors } from "../lib/mfaPolicy";
import { humanError } from "../lib/productLanguage";
import { hasSignedTotpAssurance } from "../lib/Stage2UniversalMfaPolicy";

// This surface only manages the signed-in person's own Auth factors.
// Neither the service-role credential nor any colleague's MFA secrets belong here.
export default function AccountMfaSetup({ onVerified }) {
  const [loading, setLoading] = useState(true);
  const [statusReady, setStatusReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [factors, setFactors] = useState([]);
  const [selectedFactorId, setSelectedFactorId] = useState(null);
  const [totpAssured, setTotpAssured] = useState(false);
  const [setup, setSetup] = useState(null);
  const [code, setCode] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);


  // A backup factor is a separate verified provider factor. Keep the user's
  // selection only while it remains present in the provider's own factor list.
  function recordVerifiedFactors(data) {
    const active = verifiedMfaFactors(data || {})
      .filter((factor) => factor.factor_type === "totp");
    setFactors(active);
    setSelectedFactorId((previous) =>
      active.some((factor) => factor.id === previous) ? previous : active[0]?.id || null);
  }

  async function refresh() {
    // Deny backup-factor actions while fresh provider assurance is unresolved.
    setStatusReady(false);
    setTotpAssured(false);
    const [factorResult, assuranceResult, claimsResult, userResult] = await Promise.all([
      supabase.auth.mfa.listFactors(),
      supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
      supabase.auth.getClaims(),
      supabase.auth.getUser(),
    ]);
    for (const result of [factorResult, assuranceResult, claimsResult, userResult]) {
      if (result.error) throw result.error;
    }
    const userId = userResult.data?.user?.id;
    if (!userId || claimsResult.data?.claims?.sub !== userId) {
      throw new Error("Your current authenticator identity could not be verified.");
    }
    const assured = hasSignedTotpAssurance({
      assurance: assuranceResult.data, claims: claimsResult.data?.claims,
      expectedUserId: userId,
    });
    recordVerifiedFactors(factorResult.data);
    setTotpAssured(assured);
    setStatusReady(true);
    return assured;
  }

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [factorResult, assuranceResult, claimsResult, userResult] = await Promise.all([
          supabase.auth.mfa.listFactors(),
          supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
          supabase.auth.getClaims(),
          supabase.auth.getUser(),
        ]);
        if (!active) return;
        for (const result of [factorResult, assuranceResult, claimsResult, userResult]) {
          if (result.error) throw result.error;
        }
        const userId = userResult.data?.user?.id;
        if (!userId || claimsResult.data?.claims?.sub !== userId) {
          throw new Error("Your current authenticator identity could not be verified.");
        }
        recordVerifiedFactors(factorResult.data);
        setTotpAssured(hasSignedTotpAssurance({
          assurance: assuranceResult.data, claims: claimsResult.data?.claims,
          expectedUserId: userId,
        }));
        setStatusReady(true);
      } catch (err) {
        if (active) setError(humanError(err, "Authenticator status could not be loaded."));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  async function startEnrollment() {
    if (busy || !statusReady || setup || (factors.length > 0 && !totpAssured)) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const { data, error: failure } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: factors.length ? "CEAC backup authenticator" : "CEAC authenticator",
      });
      if (failure) throw failure;
      if (!data?.id || !data?.totp) throw new Error("Authenticator setup was not returned.");
      const suppliedQr = String(data.totp.qr_code || "");
      setSetup({
        id: data.id,
        qr: suppliedQr.startsWith("data:image/svg+xml") ? suppliedQr : "",
        secret: String(data.totp.secret || ""),
      });
      setCode("");
      setShowKey(false);
    } catch (err) {
      setError(humanError(err, "Authenticator setup could not start."));
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode() {
    if (busy) return;
    const candidate = code.trim();
    if (!/^[0-9]{6}$/.test(candidate)) {
      setError("Enter the six-digit code shown by your authenticator app.");
      return;
    }
    const factorId = setup?.id || (
      factors.some((factor) => factor.id === selectedFactorId) ? selectedFactorId : factors[0]?.id
    );
    if (!factorId) {
      setError("Set up an authenticator before verifying a code.");
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
        try {
      const { error: failure } = await supabase.auth.mfa.challengeAndVerify({
        factorId,
        code: candidate,
      });
      if (failure) throw failure;
      setCode("");
      setSetup(null);
      setShowKey(false);
      const assured = await refresh();
      if (!assured) {
        throw new Error("Your authenticator code was accepted but this session has not yet reached verified TOTP/AAL2. Retry verification.");
      }
      await onVerified?.();
      setNotice("Authenticator verified for this session.");
    } catch (err) {
      setError(humanError(err, "That code could not be verified. Check your authenticator and try again."));
    } finally {
      setBusy(false);
    }
  }

  async function cancelEnrollment() {
    if (!setup || busy) return;
    setBusy(true);
    setError(null);
    try {
      const { error: failure } = await supabase.auth.mfa.unenroll({ factorId: setup.id });
      if (failure) throw failure;
      setSetup(null);
      setCode("");
      setShowKey(false);
      await refresh();
    } catch (err) {
      setError(humanError(err, "Authenticator setup could not be cancelled."));
    } finally {
      setBusy(false);
    }
  }

  const enrolled = factors.length > 0;
  // Supabase AAL2 from a different MFA method does not satisfy CEAC TOTP.
  // Its verified TOTP challenge MUST remain visible, and it cannot enrol a
  // backup authenticator until the current signed session proves TOTP.
  const needsStepUp = enrolled && !totpAssured;
  const canAddBackup = enrolled && totpAssured && factors.length < 2;
return <div className="ev2pf-account-mfa" aria-label="Your authenticator">
      <p className="screen-note">
      An authenticator app provides the required second check for your CEAC account.
      Set this up for your own account only. Never share setup keys or verification codes.
    </p>
    {loading && <p role="status" aria-busy="true">Checking your authenticator...</p>}
    {!loading && statusReady && !error && <p role="status">
      {totpAssured
        ? "This session has verified two-step access."
        : enrolled
          ? "An authenticator is registered. Verify a code to strengthen this session."
          : "No verified authenticator is registered for this account."}
    </p>}
    {!loading && statusReady && needsStepUp && <p className="screen-note">
      If your authenticator devices are unavailable, request an independently verified
      account recovery through established CEAC Administration channels.
      A password reset cannot bypass the required TOTP check.
      Never share your password or authenticator codes.
    </p>}
    {error && <div className="flag flag-brick" role="alert">{error}</div>}
    {notice && <p role="status" className="pill p-green">{notice}</p>}
    {/* Auth token refresh can remount this account screen, discarding a brief
        success toast. Persist the factual backup status via the provider list
        instead of client storage or a remembered AAL2 flag. */}
    {!loading && statusReady && factors.length > 1 &&
      <p role="status">A backup authenticator is verified for this account.</p>}

    {!loading && !statusReady && <button type="button" className="btn btn-ghost" disabled={busy} onClick={async () => {
      setBusy(true); setError(null);
      try { await refresh(); } catch (err) { setError(humanError(err, "Authenticator status could not be loaded.")); }
      finally { setBusy(false); }
    }}>Retry authenticator status</button>}

    {!loading && statusReady && !setup && (!enrolled || canAddBackup) &&
      <>
        {canAddBackup && <p className="screen-note">
          Add a separate backup authenticator while your current verified session is active.
          It can help if your primary device is lost. If both authenticators are unavailable,
          request an independently verified recovery from authorised CEAC Administration.
          A password reset alone cannot replace the required authenticator.
        </p>}
        <button type="button" className="btn wide-auto" onClick={startEnrollment} disabled={busy}>
          {busy ? "Preparing..." : canAddBackup ? "Add backup authenticator" : "Set up authenticator"}
        </button>
      </>}

    {setup && <div className="ev2pf-mfa-enrollment">
      <p>Open your authenticator app and add a new account using this QR code.</p>
      {setup.qr && <img src={setup.qr} alt="QR code to set up your own CEAC authenticator" width="188" height="188" />}
      {setup.secret && <div>
        <button type="button" className="btn btn-ghost" onClick={() => setShowKey((value) => !value)} disabled={busy}>
          {showKey ? "Hide manual setup key" : "Use a manual setup key"}
        </button>
        {showKey && <p><code>{setup.secret}</code></p>}
      </div>}
      <p className="screen-note">This setup is incomplete until you verify a code below.</p>
    </div>}

    {!loading && statusReady && (setup || needsStepUp) &&
      <div className="auth-form">
        {needsStepUp && factors.length > 1 &&
          <label className="auth-field">
            <span>Authenticator device</span>
            <select
              aria-label="Authenticator device"
              value={selectedFactorId || factors[0]?.id || ""}
              onChange={(event) => {
                setSelectedFactorId(event.target.value);
                setCode("");
                setError(null);
              }}
              disabled={busy}
            >
              {factors.map((factor, index) =>
                <option key={factor.id} value={factor.id}>
                  {factor.friendly_name === "CEAC backup authenticator"
                    ? "Backup authenticator"
                    : factor.friendly_name || `Authenticator ${index + 1}`}
                </option>
              )}
            </select>
          </label>}
        <label className="auth-field">
          <span>Six-digit authenticator code</span>
          <input
            type="text"
            autoComplete="one-time-code"
            inputMode="numeric"
            pattern="[0-9]{6}"
            maxLength={6}
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/[^0-9]/g, "").slice(0, 6))}
            placeholder="000000"
            aria-label="Authenticator verification code"
          />
        </label>
        <div className="ev2pf-inline-actions">
          <button type="button" className="btn" disabled={busy || code.length !== 6} onClick={verifyCode}>
            {busy ? "Verifying..." : "Verify authenticator"}
          </button>
          {setup && <button type="button" className="btn btn-ghost" disabled={busy} onClick={cancelEnrollment}>
            Cancel setup
          </button>}
        </div>
      </div>}
  </div>;
}

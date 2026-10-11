import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { verifiedMfaFactors } from "../lib/mfaPolicy";
import { humanError } from "../lib/productLanguage";

// This surface only manages the signed-in person's own Auth factors.
// Neither the service-role credential nor any colleague's MFA secrets belong here.
export default function AccountMfaSetup() {
  const [loading, setLoading] = useState(true);
  const [statusReady, setStatusReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [factors, setFactors] = useState([]);
  const [level, setLevel] = useState("aal1");
  const [setup, setSetup] = useState(null);
  const [code, setCode] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  async function refresh() {
    const [factorResult, assuranceResult] = await Promise.all([
      supabase.auth.mfa.listFactors(),
      supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
    ]);
    if (factorResult.error) throw factorResult.error;
    if (assuranceResult.error) throw assuranceResult.error;
    setFactors(verifiedMfaFactors(factorResult.data || {})
      .filter((factor) => factor.factor_type === "totp"));
    setLevel(assuranceResult.data?.currentLevel || "aal1");
    setStatusReady(true);
  }

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [factorResult, assuranceResult] = await Promise.all([
          supabase.auth.mfa.listFactors(),
          supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
        ]);
        if (!active) return;
        if (factorResult.error) throw factorResult.error;
        if (assuranceResult.error) throw assuranceResult.error;
        setFactors(verifiedMfaFactors(factorResult.data || {})
          .filter((factor) => factor.factor_type === "totp"));
        setLevel(assuranceResult.data?.currentLevel || "aal1");
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
    if (busy || setup) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const { data, error: failure } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "CEAC authenticator",
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
    const factorId = setup?.id || factors[0]?.id;
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
      await refresh();
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
  const needsStepUp = enrolled && level !== "aal2";

  return <div className="ev2pf-account-mfa" aria-label="Your authenticator security">
    <p className="screen-note">
      An authenticator app adds a second check when you sign in to a privileged CEAC workspace.
      Set this up for your own account only. Never share setup keys or verification codes.
    </p>

    {loading && <p role="status" aria-busy="true">Checking your authenticator...</p>}
    {!loading && statusReady && !error && <p role="status">
      {level === "aal2"
        ? "This session has verified two-step access."
        : enrolled
          ? "An authenticator is registered. Verify a code to strengthen this session."
          : "No verified authenticator is registered for this account."}
    </p>}
    {error && <div className="flag flag-brick" role="alert">{error}</div>}
    {notice && <p role="status" className="pill p-green">{notice}</p>}

    {!loading && !statusReady && <button type="button" className="btn btn-ghost" disabled={busy} onClick={async () => {
      setBusy(true); setError(null);
      try { await refresh(); } catch (err) { setError(humanError(err, "Authenticator status could not be loaded.")); }
      finally { setBusy(false); }
    }}>Retry authenticator status</button>}

    {!loading && statusReady && !enrolled && !setup &&
      <button type="button" className="btn wide-auto" onClick={startEnrollment} disabled={busy}>
        {busy ? "Preparing..." : "Set up authenticator"}
      </button>}

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

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { humanError } from "../lib/productLanguage";
import { verifiedMfaFactors } from "../lib/mfaPolicy";
import AuthFrame from "../components/AuthFrame";

function factorLabel(factor, index) {
  if (factor?.friendly_name) return factor.friendly_name;
  return `Authenticator ${index + 1}`;
}

export default function MfaChallenge({ onVerified }) {
  const [factors, setFactors] = useState([]);
  const [factorId, setFactorId] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    let live = true;
    supabase.auth.mfa.listFactors().then(({ data, error }) => {
      if (!live) return;
      if (error) {
        setMessage(humanError(error, "CEAC could not load your verification method."));
        setLoading(false);
        return;
      }

      const next = verifiedMfaFactors(data)
        .filter((factor) => factor.factor_type === "totp");
      setFactors(next);
      setFactorId(next[0]?.id || "");
      setLoading(false);
    });
    return () => { live = false; };
  }, []);

  const selected = useMemo(
    () => factors.find((factor) => factor.id === factorId) || factors[0] || null,
    [factors, factorId]
  );

  async function verify() {
    if (busy || !selected || !code.trim()) return;
    setBusy(true);
    setMessage(null);
    try {
      const challengeResult = await supabase.auth.mfa.challenge({ factorId: selected.id });
      if (challengeResult.error) throw challengeResult.error;

      const verified = await supabase.auth.mfa.verify({
        factorId: selected.id,
        challengeId: challengeResult.data.id,
        code: code.trim(),
      });
      if (verified.error) throw verified.error;
      onVerified?.();
    } catch (error) {
      setMessage(humanError(error, "That verification code could not be accepted. Check the code and try again."));
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    setBusy(true);
    setMessage(null);
    try {
      const { error } = await supabase.auth.signOut({ scope: "local" });
      if (error) throw error;
    } catch (error) {
      setMessage(humanError(error, "This device could not be signed out."));
      setBusy(false);
    }
  }

  return <AuthFrame
    eyebrow="Account security"
    title="Complete sign in"
    description="Your account has two-step verification. Enter the current authenticator code before CEAC opens your privileged workspace."
  >
    <div className="auth-form">
      {loading ? <div className="auth-message">Loading your authenticator…</div> : null}

      {!loading && factors.length === 0 ? <div className="auth-message error">
        <strong>A verified authenticator could not be found.</strong>
        <span>Sign out and contact CEAC Administration if this continues. CEAC will not silently bypass the second step.</span>
      </div> : null}

      {factors.length > 1 ? <label className="auth-field">
        <span>Authenticator</span>
        <select value={factorId} onChange={(event) => setFactorId(event.target.value)}>
          {factors.map((factor, index) => <option key={factor.id} value={factor.id}>
            {factorLabel(factor, index)}
          </option>)}
        </select>
      </label> : null}

      {selected ? <label className="auth-field">
        <span>Verification code</span>
        <input
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="Enter the current code"
          value={code}
          onChange={(event) => setCode(event.target.value.replace(/\s/g, ""))}
          onKeyDown={(event) => event.key === "Enter" && verify()}
        />
      </label> : null}

      {message ? <div className="auth-message error" role="status">{message}</div> : null}

      <button className="auth-primary" onClick={verify} disabled={busy || !selected || !code.trim()}>
        <span>{busy ? "Checking…" : "Verify and continue"}</span>
        {!busy ? <span aria-hidden="true">→</span> : null}
      </button>

      <button className="auth-secondary" onClick={signOut} disabled={busy}>
        Sign out on this device
      </button>
    </div>
  </AuthFrame>;
}

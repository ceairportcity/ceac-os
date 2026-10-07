import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { humanError } from "../lib/productLanguage";
import AuthFrame from "../components/AuthFrame";

function collectVerified(data) {
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
  for (const factor of Array.isArray(data?.all) ? data.all : []) source.push(factor);

  const seen = new Set();
  return source.filter((factor) => {
    if (!factor?.id || factor.status !== "verified" || seen.has(factor.id)) return false;
    seen.add(factor.id);
    return true;
  });
}

function factorLabel(factor, index) {
  return factor?.friendly_name || `Authenticator ${index + 1}`;
}

export default function MfaChallenge({ onVerified, onSetup }) {
  const [factors, setFactors] = useState([]);
  const [unsupportedCount, setUnsupportedCount] = useState(0);
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
      const all = collectVerified(data);
      const totp = all.filter((factor) => factor.factor_type === "totp");
      setFactors(totp);
      setUnsupportedCount(all.length - totp.length);
      setFactorId(totp[0]?.id || "");
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
      const challenge = await supabase.auth.mfa.challenge({ factorId: selected.id });
      if (challenge.error) throw challenge.error;
      const verified = await supabase.auth.mfa.verify({
        factorId: selected.id,
        challengeId: challenge.data.id,
        code: code.trim(),
      });
      if (verified.error) throw verified.error;
      onVerified?.();
    } catch (err) {
      setMessage(humanError(
        err,
        "That verification code could not be accepted. Check the code and try again."
      ));
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
    } catch (err) {
      setMessage(humanError(err, "This device could not be signed out."));
      setBusy(false);
    }
  }

  return <AuthFrame
    eyebrow="Account security"
    title="Complete sign in"
    description="Your account has two-step verification. Enter the current authenticator code before CEAC opens your workspace."
  >
    <div className="auth-form">
      {loading ? <div className="auth-message">Loading your verification method…</div> : null}

      {!loading && factors.length === 0 ? <div className="auth-message error">
        <strong>No CEAC authenticator is available for this sign-in.</strong>
        <span>{unsupportedCount
          ? "Another verified factor exists, but this CEAC flow currently supports authenticator-app (TOTP) verification only."
          : "No verified authenticator app is recorded for this account."}</span>
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

      <button className="auth-primary" type="button" onClick={verify} disabled={busy || !selected || !code.trim()}>
        <span>{busy ? "Checking…" : "Verify and continue"}</span>
        {!busy ? <span aria-hidden="true">→</span> : null}
      </button>

      {!selected && onSetup ? <button className="auth-secondary" type="button" onClick={() => onSetup()} disabled={busy}>
        Set up authenticator
      </button> : null}

      <button className="auth-secondary" type="button" onClick={signOut} disabled={busy}>
        Sign out on this device
      </button>
    </div>
  </AuthFrame>;
}

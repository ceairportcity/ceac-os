import { useState } from "react";
import AuthFrame from "../components/AuthFrame";
import { supabase } from "../lib/supabase";
import { humanError } from "../lib/productLanguage";

export default function MfaRequired({ onRetry }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);

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
    title="Two-step verification is required"
    description="This account has privileged CEAC authority, but this sign-in does not currently satisfy the required second step."
  >
    <div className="auth-form">
      <div className="auth-message error">
        <strong>Your privileged workspace remains locked.</strong>
        <span>Complete or restore your authenticator through Account Security. CEAC will not downgrade or bypass the security requirement.</span>
      </div>

      {message ? <div className="auth-message error" role="status">{message}</div> : null}

      <button className="auth-primary" type="button" onClick={() => onRetry?.()} disabled={busy}>
        <span>Check again</span>
        <span aria-hidden="true">→</span>
      </button>

      <button className="auth-secondary" type="button" onClick={signOut} disabled={busy}>
        Sign out on this device
      </button>
    </div>
  </AuthFrame>;
}

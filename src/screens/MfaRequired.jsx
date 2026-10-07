import { useState } from "react";
import AuthFrame from "../components/AuthFrame";
import { supabase } from "../lib/supabase";
import { humanError } from "../lib/productLanguage";

export default function MfaRequired({ onRetry, onSetup }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);

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
    title="Two-step verification is required"
    description="This account has privileged CEAC access, but this sign-in does not currently meet the required two-step protection."
  >
    <div className="auth-form">
      <div className="auth-message error">
        <strong>Your privileged workspace is not available yet.</strong>
        <span>Complete authenticator setup or verification. CEAC does not downgrade or bypass privileged authority to get around this check.</span>
      </div>

      {message ? <div className="auth-message error" role="status">{message}</div> : null}

      {onSetup ? <button className="auth-primary" type="button" onClick={() => onSetup()} disabled={busy}>
        <span>Set up authenticator</span>
        <span aria-hidden="true">→</span>
      </button> : null}

      <button className={onSetup ? "auth-secondary" : "auth-primary"} type="button" onClick={() => onRetry?.()} disabled={busy}>
        <span>Check again</span>
        {!onSetup ? <span aria-hidden="true">→</span> : null}
      </button>

      <button className="auth-secondary" type="button" onClick={signOut} disabled={busy}>
        Sign out on this device
      </button>
    </div>
  </AuthFrame>;
}

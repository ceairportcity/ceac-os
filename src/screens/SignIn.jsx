import { useState } from "react";
import { supabase } from "../lib/supabase";
import AuthFrame from "../components/AuthFrame";
import { authRedirect } from "../lib/authRedirect";
import { authErrorMessage } from "../lib/signInError";

export default function SignIn() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);

  async function signInWithGoogle() {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: authRedirect(),
          queryParams: { prompt: "select_account" },
        },
      });
      if (error) throw error;
    } catch (error) {
      setMessage(authErrorMessage(error));
      setBusy(false);
    }
  }

  return (
    <AuthFrame
      eyebrow="Secure sign in"
      title="Welcome back"
      description="Use the Google account authorised by CEAC. Authenticator verification is required before CEAC data opens."
    >
      <div className="auth-form">
        <button className="btn primary" type="button" onClick={signInWithGoogle} disabled={busy}>
          {busy ? "Opening Google…" : "Continue with Google"}
        </button>
        {message && <p className="auth-message error" role="alert">{message}</p>}
        <p className="auth-note">Only HR-authorised CEAC accounts can continue. Password and magic-link sign-in are disabled.</p>
      </div>
    </AuthFrame>
  );
}

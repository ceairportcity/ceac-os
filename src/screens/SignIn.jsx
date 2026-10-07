import { useState } from "react";
import { supabase } from "../lib/supabase";
import AuthFrame from "../components/AuthFrame";
import { authRedirect } from "../lib/authRedirect";
import { recoveryErrorMessage, signInErrorMessage } from "../lib/signInError";

export default function SignIn() {
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);

  async function signIn() {
    if (busy || !email.trim() || !password) return;
    setBusy(true); setMessage(null);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
      if (error) setMessage(signInErrorMessage(error));
    } catch (error) { setMessage(signInErrorMessage(error)); }
    finally { setBusy(false); }
  }

  async function recover() {
    setBusy(true); setMessage(null);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo: authRedirect("/reset-password"),
      });
      if (error) throw error;
      setMessage("If that address belongs to a CEAC account, a password-recovery email is on its way.");
    } catch (error) { setMessage(recoveryErrorMessage(error)); }
    finally { setBusy(false); }
  }

  const isSignIn = mode === "signin";

  return <AuthFrame
    eyebrow={isSignIn ? "Secure sign in" : "Account recovery"}
    title={isSignIn ? "Welcome back" : "Reset your password"}
    description={isSignIn
      ? "Enter the work email attached to your CEAC account."
      : "Enter your CEAC work email and we will send a secure recovery link."}
  >
    <div className="auth-form">
      <label className="auth-field">
        <span>Work email</span>
        <input
          placeholder="Work email"
          type="email"
          inputMode="email"
          autoCapitalize="none"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </label>

      {isSignIn && <label className="auth-field">
        <span>Password</span>
        <div className="auth-password">
          <input
            placeholder="Password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && signIn()}
          />
          <button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"}>
            {showPassword ? "Hide" : "Show"}
          </button>
        </div>
      </label>}

      {message && <div className={`auth-message ${message.startsWith("If that") ? "success" : "error"}`} role="status">{message}</div>}

      <button className="auth-primary" onClick={isSignIn ? signIn : recover}
        disabled={busy || !email || (isSignIn && !password)}>
        <span>{busy ? "Please wait..." : isSignIn ? "Sign in to CEAC OS" : "Send recovery link"}</span>
        {!busy && <span aria-hidden="true">→</span>}
      </button>

      <button className="auth-secondary" onClick={() => {
        setMode(isSignIn ? "recover" : "signin");
        setMessage(null);
        setPassword("");
      }}>
        {isSignIn ? "Forgot your password?" : "Back to sign in"}
      </button>
    </div>

    <div className="auth-help">
      <span>Account access is issued by CEAC Administration.</span>
      <span>Your password is handled by the secure authentication service, not stored in this interface.</span>
    </div>
  </AuthFrame>;
}

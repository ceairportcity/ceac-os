import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import AuthFrame from "../components/AuthFrame";
import { authErrorMessage } from "../lib/signInError";

export default function AccountPassword({ mode, onDone }) {
  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    let mounted = true;
    async function check() {
      const { data, error } = await supabase.auth.getSession();
      if (!mounted) return;
      if (error) {
        setMessage(authErrorMessage(error, "link"));
        setHasSession(false);
        setReady(true);
        return;
      }
      setHasSession(Boolean(data.session));
      setReady(true);
    }
    check();
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setHasSession(Boolean(session));
      setReady(true);
    });
    return () => {
      mounted = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  async function save() {
    setMessage(null);
    if (password.length < 12) {
      setMessage("Use at least 12 characters.");
      return;
    }
    if (password !== confirm) {
      setMessage("The passwords do not match.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      setMessage(authErrorMessage(error, "password"));
      return;
    }
    setMessage(mode === "activate" ? "Your CEAC account is ready." : "Your password has been changed.");
    setTimeout(() => onDone?.(), 350);
  }


  if (!ready) return <div className="auth-boot"><span className="auth-boot-mark">CEAC</span><span>Opening your secure link…</span></div>;

  const title = mode === "activate" ? "Create your password" : "Choose a new password";
  const description = hasSession
    ? mode === "activate"
      ? "Your invitation has been verified. Set the password you will use for CEAC OS."
      : "Your recovery link has been verified. Choose a new password for your CEAC account."
    : mode === "activate"
      ? "A current CEAC invitation link is required before you can create a password."
      : "A current CEAC recovery link is required before you can choose a new password.";

  return <AuthFrame eyebrow={mode === "activate" ? "Account activation" : "Secure recovery"} title={title} description={description}>
    {!hasSession ? <div className="auth-message error">
      <strong>This link is no longer active.</strong>
      <span>Open the newest CEAC email link. If it has expired, request another recovery link from the sign-in page.</span>
    </div> : <div className="auth-form">
      <label className="auth-field">
        <span>New password</span>
        <input type="password" autoComplete="new-password" placeholder="At least 12 characters"
          value={password} onChange={(event) => setPassword(event.target.value)} />
      </label>
      <label className="auth-field">
        <span>Confirm password</span>
        <input type="password" autoComplete="new-password" placeholder="Enter it again"
          value={confirm} onChange={(event) => setConfirm(event.target.value)}
          onKeyDown={(event) => event.key === "Enter" && save()} />
      </label>
      <div className="auth-password-rule">Use at least 12 characters.</div>
      {message && <div className={`auth-message ${message.includes("ready") || message.includes("changed") ? "success" : "error"}`}>{message}</div>}
      <button className="auth-primary" onClick={save} disabled={busy || !password || !confirm}>
        <span>{busy ? "Saving..." : mode === "activate" ? "Finish account setup" : "Save new password"}</span>
        {!busy && <span aria-hidden="true">→</span>}
      </button>
    </div>}
  </AuthFrame>;

}

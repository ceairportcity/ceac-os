import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import AuthFrame from "./AuthFrame";
import AccountMfaSetup from "./AccountMfaSetup";

export default function MandatoryMfaGate({ children }) {
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setChecking(true);
    setError(null);
    try {
      const { data, error: assuranceError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (assuranceError) throw assuranceError;
      setAllowed(data?.currentLevel === "aal2");
    } catch (failure) {
      setAllowed(false);
      setError(failure?.message || "CEAC could not verify authenticator security.");
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const { data } = supabase.auth.onAuthStateChange(() => refresh());
    return () => data.subscription.unsubscribe();
  }, [refresh]);

  if (checking) {
    return <div className="auth-boot">Verifying authenticator security…</div>;
  }

  if (allowed) return children;

  return (
    <AuthFrame
      eyebrow="Required security step"
      title="Verify your authenticator"
      description="Every enabled CEAC account must reach AAL2 before application data, files or workflows are available."
    >
      {error && <p className="auth-message error" role="alert">{error}</p>}
      <AccountMfaSetup onVerified={refresh} />
      <button className="btn secondary" type="button" onClick={() => supabase.auth.signOut()}>
        Sign out
      </button>
    </AuthFrame>
  );
}

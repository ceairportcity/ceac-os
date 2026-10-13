import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import AuthFrame from "./AuthFrame";
import AccountMfaSetup from "./AccountMfaSetup";

export default function MandatoryMfaGate({ children }) {
  const [state, setState] = useState("checking");
  const [error, setError] = useState(null);
  const refreshGeneration = useRef(0);

  const refresh = useCallback(async () => {
    const generation = ++refreshGeneration.current;
    setState("checking");
    setError(null);
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      if (generation !== refreshGeneration.current) return;

      // Signed-out visitors must reach the Google-only sign-in screen. MFA
      // enrollment is never offered until Supabase has established a session.
      if (!sessionData?.session) {
        setState("signed-out");
        return;
      }

      const { data, error: assuranceError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (assuranceError) throw assuranceError;
      if (generation !== refreshGeneration.current) return;
      if (data?.currentLevel === "aal2") {
        setState("allowed");
        return;
      }

      // This is the only Data API call permitted before AAL2. The server
      // returns one boolean and verifies Google OAuth, the preserved Auth ID,
      // the matching profile email, and the profile's active state.
      const { data: eligible, error: eligibilityError } = await supabase
        .rpc("ceac_google_mfa_eligible");
      if (eligibilityError) throw eligibilityError;
      if (generation !== refreshGeneration.current) return;
      setState(eligible === true ? "enroll" : "denied");
    } catch (failure) {
      if (generation !== refreshGeneration.current) return;
      setState("error");
      setError(failure?.message || "CEAC could not verify account security.");
    }
  }, []);

  useEffect(() => {
    refresh();
    const { data } = supabase.auth.onAuthStateChange(() => refresh());
    return () => data.subscription.unsubscribe();
  }, [refresh]);

  if (state === "checking") {
    return <div className="auth-boot">Verifying account security…</div>;
  }

  if (state === "signed-out" || state === "allowed") return children;

  const denied = state === "denied";
  return (
    <AuthFrame
      eyebrow={denied ? "Account not authorised" : "Required security step"}
      title={denied ? "CEAC access is not enabled" : "Verify your authenticator"}
      description={denied
        ? "This Google account is not linked to an active CEAC profile. No application data or authenticator enrollment is available."
        : "Every enabled CEAC account must reach AAL2 before application data, files or workflows are available."}
    >
      {error && <p className="auth-message error" role="alert">{error}</p>}
      {state === "enroll" && <AccountMfaSetup onVerified={refresh} />}
      <button className="btn secondary" type="button" onClick={() => supabase.auth.signOut()}>
        Sign out
      </button>
    </AuthFrame>
  );
}

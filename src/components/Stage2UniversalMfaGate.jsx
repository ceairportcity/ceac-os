import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { decideUniversalTotpAccess, shouldRecheckUniversalTotp } from "../lib/Stage2UniversalMfaPolicy";
import AccountMfaSetup from "./AccountMfaSetup";
import AuthFrame from "./AuthFrame";

/**
 * Stage 2 provider-neutral MFA UI, not a security authority by itself.
 * Enable ONLY alongside server-side universal AAL2/TOTP enforcement and
 * approved, rehearsed owner cutover. Never enable for Stage 1 production.
 */
export default function Stage2UniversalMfaGate({ children, onVerified }) {
  const [state, setState] = useState("checking");
  const [error, setError] = useState(null);
  const generation = useRef(0);

  const refresh = useCallback(async () => {
    const currentGeneration = ++generation.current;
    // Never keep showing previously authorised workspace content while the
    // latest provider token, TOTP factor and assurance level are unverified.
    setState("checking");
    setError(null);
    try {
      // Fetch a verified JWT (getClaims), not untrusted user metadata.
      const [sessionResult, assuranceResult, factorResult, claimsResult] = await Promise.all([
        supabase.auth.getSession(),
        supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
        supabase.auth.mfa.listFactors(),
        supabase.auth.getClaims(),
      ]);
      for (const result of [sessionResult, assuranceResult, factorResult, claimsResult]) {
        if (result.error) throw result.error;
      }
      if (currentGeneration !== generation.current) return;
      const decision = decideUniversalTotpAccess({
        session: sessionResult.data?.session,
        assurance: assuranceResult.data,
        factors: factorResult.data,
        claims: claimsResult.data?.claims,
      });
      setState(decision.state);
      return decision.state;
    } catch (failure) {
      if (currentGeneration !== generation.current) return;
      setError(failure?.message || "Your authenticator session could not be verified.");
      setState("error");
      return "error";
    }
  }, []);

  useEffect(() => {
    refresh();
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (!shouldRecheckUniversalTotp(event)) return;
      // Revoke the previous visual "allow" immediately, including for sign-out
      // and token refresh. Never keep stale protected content on the screen.
      ++generation.current; // Ignore any earlier in-flight verification result.
      setState("checking");
      setError(null);
      // Supabase warns against awaiting auth calls inside its auth-state callback.
      // Defer the verification out of the auth-state lock.
      setTimeout(() => refresh(), 0);
    });
    return () => {
      ++generation.current;
      data.subscription.unsubscribe();
    };
  }, [refresh]);

  if (state === "allow") return children;
  if (state === "checking") return <div className="auth-boot">Verifying your CEAC sign-in security…</div>;

  return <AuthFrame
    eyebrow="Required security step"
    title={state === "enroll" ? "Set up your authenticator" : state === "challenge" ? "Verify your authenticator" : "Account security check"}
    description="All CEAC roles require an authenticator-app verification at each new sign-in. Your verified session remains valid during normal use."
  >
    {error && <p className="auth-message error" role="alert">{error}</p>}
    {(state === "enroll" || state === "challenge") && <AccountMfaSetup onVerified={async () => {
      const verifiedState = await refresh();
      if (verifiedState === "allow") await onVerified?.();
    }} />}
    {state === "error" && <button className="auth-primary" type="button" onClick={() => refresh()}>Retry verification</button>}
    <button className="btn secondary" type="button" onClick={() => supabase.auth.signOut()}>Sign out</button>
  </AuthFrame>;
}

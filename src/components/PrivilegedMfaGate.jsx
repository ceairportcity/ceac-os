import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { decideMfaAccess, isPrivilegedIdentity } from "../lib/mfaPolicy";
import AuthFrame from "./AuthFrame";
import AccountMfaSetup from "./AccountMfaSetup";

// Stage 1 keeps email/password authentication. This gate mirrors the already
// applied privileged-only database enforcement switch without activating the
// Stage 2 Google/universal-AAL2 policy.
export default function PrivilegedMfaGate({ me, children, onVerified }) {
  const [state, setState] = useState("checking");
  const [error, setError] = useState(null);
  const refreshGeneration = useRef(0);

  const refresh = useCallback(async () => {
    const generation = ++refreshGeneration.current;
    setState("checking");
    setError(null);

    try {
      if (!isPrivilegedIdentity(me)) {
        setState("allowed");
        return;
      }

      const { data: organisation, error: organisationError } = await supabase
        .from("organisations")
        .select("privileged_mfa_required")
        .eq("id", me.org_id)
        .single();
      if (organisationError) throw organisationError;
      if (generation !== refreshGeneration.current) return;

      if (organisation?.privileged_mfa_required !== true) {
        setState("allowed");
        return;
      }

      const [factorResult, assuranceResult] = await Promise.all([
        supabase.auth.mfa.listFactors(),
        supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
      ]);
      if (factorResult.error) throw factorResult.error;
      if (assuranceResult.error) throw assuranceResult.error;
      if (generation !== refreshGeneration.current) return;

      const decision = decideMfaAccess({
        currentLevel: assuranceResult.data?.currentLevel || "aal1",
        nextLevel: assuranceResult.data?.nextLevel || "aal1",
        factors: factorResult.data || {},
        privileged: true,
        enforcementEnabled: true,
      });
      setState(decision.state === "allow" ? "allowed" : decision.state);
    } catch (failure) {
      if (generation !== refreshGeneration.current) return;
      setState("error");
      setError(failure?.message || "CEAC could not verify privileged account security.");
    }
  }, [me]);

  useEffect(() => {
    refresh();
    const { data } = supabase.auth.onAuthStateChange(() => refresh());
    return () => data.subscription.unsubscribe();
  }, [refresh]);

  if (state === "checking") {
    return <div className="auth-boot">Verifying privileged account security…</div>;
  }

  if (state === "allowed") return children;

  const unsupported = state === "unsupported-factor";
  return (
    <AuthFrame
      eyebrow="Required security step"
      title={unsupported ? "Authenticator setup needs attention" : "Verify your authenticator"}
      description={unsupported
        ? "This privileged account has a verified factor that CEAC cannot use for the required TOTP step-up. Contact Administration before continuing."
        : "Privileged CEAC access requires a verified authenticator and an AAL2 session."}
    >
      {error && <p className="auth-message error" role="alert">{error}</p>}
      {(state === "enroll" || state === "challenge") && <AccountMfaSetup onVerified={async () => {
        await refresh();
        await onVerified?.();
      }} />}
      {state === "error" && <button className="auth-primary" type="button" onClick={refresh}>
        <span>Try again</span><span aria-hidden="true">→</span>
      </button>}
      <button className="btn secondary" type="button" onClick={() => supabase.auth.signOut()}>
        Sign out
      </button>
    </AuthFrame>
  );
}

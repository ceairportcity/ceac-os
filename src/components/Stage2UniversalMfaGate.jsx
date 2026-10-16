import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { decideMfaAccess } from "../lib/mfaPolicy";
import AccountMfaSetup from "./AccountMfaSetup";
import AuthFrame from "./AuthFrame";

/**
 * STAGE 2 ISOLATED CANDIDATE — deliberately not connected to App.jsx yet.
 *
 * Prerequisite before connecting:
 *   - forward-only provider-neutral CEAC enrollment-eligibility RPC, executable
 *     at AAL1 and returning ONLY an independently authorised boolean.
 *   - restrictive server/DB/Storage/Edge AAL2 checks on protected data.
 *   - real Auth provider test, consented recovery design and owner cutover GO.
 *
 * Never call ceac_google_mfa_eligible or inspect protected profile rows at AAL1.
 */
export default function Stage2UniversalMfaGate({ children, onVerified }) {
  const [gate, setGate] = useState("checking");
  const [message, setMessage] = useState(null);
  const generation = useRef(0);

  const refresh = useCallback(async () => {
    const ticket = ++generation.current;
    setGate("checking");
    setMessage(null);
    try {
      const sessionResult = await supabase.auth.getSession();
      if (sessionResult.error) throw sessionResult.error;
      if (ticket !== generation.current) return;
      if (!sessionResult.data?.session) {
        setGate("signed-out");
        return;
      }

      // This narrowly authorised boolean must be implemented and audited
      // before the gate is enabled. Never use RLS-readable HR/person tables here.
      const eligibility = await supabase.rpc("ceac_universal_mfa_eligible");
      if (eligibility.error) throw eligibility.error;
      if (ticket !== generation.current) return;
      if (eligibility.data !== true) {
        setGate("denied");
        return;
      }

      const [assurance, factorResult] = await Promise.all([
        supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
        supabase.auth.mfa.listFactors(),
      ]);
      if (assurance.error) throw assurance.error;
      if (factorResult.error) throw factorResult.error;
      if (ticket !== generation.current) return;
      const decision = decideMfaAccess({
        currentLevel: assurance.data?.currentLevel || "aal1",
        nextLevel: assurance.data?.nextLevel || "aal1",
        factors: factorResult.data || {},
        privileged: true, // All active CEAC users, not just managers or admins.
        enforcementEnabled: true,
      });
      setGate(decision.state === "allow" ? "allowed" : decision.state);
    } catch {
      if (ticket === generation.current) {
        setMessage("CEAC could not verify the authenticator security boundary. Access remains locked.");
        setGate("error");
      }
    }
  }, []);

  useEffect(() => {
    void refresh();
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (["SIGNED_IN", "SIGNED_OUT", "TOKEN_REFRESHED", "USER_UPDATED", "MFA_CHALLENGE_VERIFIED"].includes(event)) {
        // Defer operations outside the synchronous Supabase auth callback.
        Promise.resolve().then(refresh);
      }
    });
    return () => {
      ++generation.current;
      data.subscription.unsubscribe();
    };
  }, [refresh]);

  if (gate === "allowed") return children;
  if (gate === "checking") return <div className="auth-boot" role="status">Verifying your authenticator session…</div>;

  const denied = gate === "denied";
  const signedOut = gate === "signed-out";
  const unsupported = gate === "unsupported-factor";
  return <AuthFrame
    eyebrow={denied ? "CEAC account not authorised" : "CEAC account security"}
    title={denied ? "Account access is not enabled" : signedOut ? "Sign in again" : unsupported ? "Authenticator setup needs attention" : "Verify your authenticator"}
    description={denied
      ? "This session is not linked to an active, authorised CEAC account."
      : signedOut
        ? "Your session has ended. Sign in again with your approved CEAC work account."
        : unsupported
          ? "A verified TOTP authenticator app is required. Contact Administration if you cannot access it."
          : "Every active CEAC account must verify a TOTP code on each genuine new login. Valid verified sessions remain usable while they last."}
  >
    {message && <p role="alert" className="auth-message error">{message}</p>}
    {(gate === "challenge" || gate === "enroll") && <AccountMfaSetup onVerified={async () => {
      await refresh();
      await onVerified?.();
    }} />}
    {gate === "error" && <button type="button" className="auth-primary" onClick={refresh}>Retry verification</button>}
    <button type="button" className="btn secondary" onClick={() => supabase.auth.signOut()}>Sign out</button>
  </AuthFrame>;
}

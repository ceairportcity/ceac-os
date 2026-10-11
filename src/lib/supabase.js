import { createClient } from "@supabase/supabase-js";
import { authRedirect } from "./authRedirect";
import { readServerVerifiedLegacyGrants, resolveCapabilityGrantRead } from "./capabilitySchemaCompatibility";

const fallbackSupabaseUrl = "https://efjljhftsesssumtshvp.supabase.co";
const fallbackSupabasePublishableKey = "sb_publishable_CVq1sCY0Z4-o9Us4Y6RaUw_53FUHQj-";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || fallbackSupabaseUrl;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || fallbackSupabasePublishableKey;

export const supabase = createClient(
  supabaseUrl,
  supabaseKey,
  { auth: { persistSession: true, autoRefreshToken: true } }
);
export async function loadMe() {
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError && authError.name !== "AuthSessionMissingError") throw authError;
  if (!auth?.user) return null;
  if (!auth.user.email_confirmed_at) {
    throw new Error("Complete your email verification before opening CEAC.");
  }
  const { data: p, error: profileError } = await supabase.from("profiles")
    .select("id, full_name, preferred_name, email, job_title, phone, is_admin, is_exec, org_id, joined_at, birthday, contract_type, active")
    .eq("id", auth.user.id).single();
  if (profileError) throw profileError;
  if (!p) return null;
  if (!p.active) throw new Error("Your CEAC access is inactive. Contact Administration.");
  const [
    { data: memberships, error: membershipError },
    { data: capabilityGrants, error: capabilityError },
    { data: ledSubTeams, error: leadError },
  ] = await Promise.all([
    supabase.from("unit_memberships")
      .select("role, unit_id, units(name)")
      .eq("profile_id", auth.user.id),
    supabase.from("capability_grants")
      .select("id,capability,scope_unit_id,granted_at,expires_at")
      .eq("profile_id", auth.user.id)
      .is("revoked_at", null),
    supabase.from("sub_teams")
      .select("id")
      .eq("lead_id", auth.user.id)
      .eq("active", true),
  ]);
  if (membershipError) throw membershipError;
  const { grants, capabilitySchemaReady, error: resolvedCapabilityError } =
    resolveCapabilityGrantRead({ data: capabilityGrants, error: capabilityError });
  if (resolvedCapabilityError) throw resolvedCapabilityError;
  if (leadError) throw leadError;
  // Legacy production schema has no expiry field yet. Verify every
  // existing grant through the CURRENT server RPC before making it visible.
  // If any server check fails, this stays deny-all.
  const legacyAuthority = capabilitySchemaReady
    ? null : await readServerVerifiedLegacyGrants(supabase, auth.user.id, p.org_id);
  const activeCapabilityGrants = (capabilitySchemaReady
    ? grants.filter((grant) => !grant.expires_at || Date.parse(grant.expires_at) > Date.now())
    : legacyAuthority.grants
  );
  const options = (memberships || []).map((m) => ({
    unit_id: m.unit_id,
    unit_name: m.units ? m.units.name : null,
    role: m.role,
  }));
  const savedUnitId = localStorage.getItem(`ceac-unit:${auth.user.id}`);
  const selected = options.find((m) => m.unit_id === savedUnitId)
    || options.find((m) => m.role === "manager")
    || options[0]
    || null;
  return { ...p,
    unit_id: selected ? selected.unit_id : null,
    unit_name: selected ? selected.unit_name : null,
    role: selected ? selected.role : null,
    memberships: options,
    led_sub_team_ids: (ledSubTeams || []).map((subTeam) => subTeam.id),
    capabilitySchemaReady,
    legacyAuthorityVerified: legacyAuthority?.verificationComplete ?? null,
    capability_grants: activeCapabilityGrants,
    capabilities: [...new Set(activeCapabilityGrants.map((grant) => grant.capability))] };
}
export class InvitationDeliveryUnconfirmedError extends Error {
  constructor(kind = "new") {
    super(kind === "resend"
      ? "The resend was prepared, but the activation email request was not accepted. Delivery is unconfirmed. Review the invitation's latest state before retrying."
      : "The invitation was recorded, but the activation email request was not accepted. Delivery is unconfirmed. Review Invitations before retrying.");
    this.name = "InvitationDeliveryUnconfirmedError";
    this.invitationRecorded = true;
  }
}

export async function inviteByEmail({ email, fullName, unitId }) {
  const redirect = authRedirect("/activate");
  const cleanEmail = email.trim().toLowerCase();
  const cleanName = fullName.trim();
  const { error: inviteError } = await supabase.rpc("create_pending_invitation", {
    p_email: cleanEmail,
    p_full_name: cleanName,
    p_unit_id: unitId,
    p_role: "staff",
  });
  if (inviteError) throw inviteError;

  // The database invitation already exists. An OTP/provider failure must
  // never be represented to Administration as "nothing was recorded".
  try {
    const { error: authError } = await supabase.auth.signInWithOtp({
      email: cleanEmail,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: redirect,
      },
    });
    if (authError) throw authError;
  } catch {
    throw new InvitationDeliveryUnconfirmedError("new");
  }
}

export async function resendStaffInvitation(id) {
  const redirect = authRedirect("/activate");
  const { data, error } = await supabase.rpc("prepare_staff_invitation_resend", { p_invitation_id: id });
  if (error) throw error;
  if (!data?.email || typeof data.email !== "string") {
    throw new InvitationDeliveryUnconfirmedError("resend");
  }
  try {
    const result = await supabase.auth.signInWithOtp({ email: data.email,
      options: { shouldCreateUser: !data.account_created, emailRedirectTo: redirect } });
    if (result.error) throw result.error;
  } catch {
    throw new InvitationDeliveryUnconfirmedError("resend");
  }
}

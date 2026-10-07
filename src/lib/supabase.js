import { createClient } from "@supabase/supabase-js";
import { authRedirect } from "./authRedirect";

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
      .select("id,capability,scope_unit_id,granted_at")
      .eq("profile_id", auth.user.id)
      .is("revoked_at", null),
    supabase.from("sub_teams")
      .select("id")
      .eq("lead_id", auth.user.id)
      .eq("active", true),
  ]);
  if (membershipError) throw membershipError;
  if (capabilityError) throw capabilityError;
  if (leadError) throw leadError;
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
    capability_grants: capabilityGrants || [],
    capabilities: [...new Set((capabilityGrants || []).map((grant) => grant.capability))] };
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

  const { error: authError } = await supabase.auth.signInWithOtp({
    email: cleanEmail,
    options: {
      shouldCreateUser: true,
      emailRedirectTo: redirect,
    },
  });
  if (authError) throw authError;
}

export async function resendStaffInvitation(id) {
  const redirect = authRedirect("/activate");
  const { data, error } = await supabase.rpc("prepare_staff_invitation_resend", { p_invitation_id: id });
  if (error) throw error;
  const result = await supabase.auth.signInWithOtp({ email: data.email,
    options: { shouldCreateUser: !data.account_created, emailRedirectTo: redirect } });
  if (result.error) throw result.error;
}

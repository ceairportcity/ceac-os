// Email conflicts are advisory UI checks only. The server-side invitation
// RPC remains responsible for atomic duplicate prevention and authorisation.
export function invitationEmailConflicts(email, people = [], invitations = []) {
  const wanted = String(email || "").trim().toLocaleLowerCase();
  if (!wanted) return { accountExists: false, invitationPending: false };
  const same = (record) => String(record?.email || "").trim().toLocaleLowerCase() === wanted;
  return {
    accountExists: (Array.isArray(people) ? people : []).some(same),
    invitationPending: (Array.isArray(invitations) ? invitations : [])
      .some((item) => same(item) && !item.revoked_at && item.activation_state !== "verified" && item.activation_state !== "expired"),
  };
}

/** Use only the verified server invitation state to offer recovery of an existing account.
 * This is a UI affordance, not authorisation. The resend RPC rechecks authority.
 */
export function findRecoverableInvitation(email, invitations = []) {
  const wanted = String(email || "").trim().toLowerCase();
  if (!isPlausibleInvitationEmail(wanted) || !Array.isArray(invitations)) return null;
  return invitations.find((row) => row && typeof row.id === "string"
    && String(row.email || "").trim().toLowerCase() === wanted
    && !row.revoked_at
    && ["awaiting_verification", "expired"].includes(row.activation_state)) || null;
}

export function isPlausibleInvitationEmail(email) {
  // Client-side guard only: server-side invitation validation is authoritative.
  const value = String(email || "").trim();
  return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/** Bounded and safe Auth-email error text. Never display a raw provider response. */
export function invitationDeliveryMessage(error){
 const code=String(error?.code||"").toLowerCase();
 const status=Number(error?.status||0);
 if(code==="email_address_not_authorized")
  return "Invitation saved, but this address is not authorised for CEAC's current email sender. An administrator must check email delivery settings.";
 if(code==="over_email_send_rate_limit"||status===429)
  return "Invitation saved, but the email sending limit was reached. Review the invitation before retrying.";
 if(status>=500)
  return "Invitation saved, but the email provider is unavailable. Review the invitation before retrying.";
 return "Invitation saved, but email delivery was not accepted. Review Invitations and the CEAC email settings before retrying.";
}

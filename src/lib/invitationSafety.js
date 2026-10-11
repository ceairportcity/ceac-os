// Email conflicts are advisory UI checks only. The server-side invitation
// RPC remains responsible for atomic duplicate prevention and authorisation.
export function invitationEmailConflicts(email, people = [], invitations = []) {
  const wanted = String(email || "").trim().toLocaleLowerCase();
  if (!wanted) return { accountExists: false, invitationPending: false };
  const same = (record) => String(record?.email || "").trim().toLocaleLowerCase() === wanted;
  return {
    accountExists: (Array.isArray(people) ? people : []).some(same),
    invitationPending: (Array.isArray(invitations) ? invitations : [])
      .some((item) => same(item) && !item.revoked_at && item.activation_state !== "verified"),
  };
}

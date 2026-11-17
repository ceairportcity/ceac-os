// Presentation eligibility only. The existing self_certify_work RPC remains
// authoritative and rechecks the actor's current department membership.
export function canSelfCertifyOwnWork(me, item) {
  if (!me?.id || !item || item.assignee_id !== me.id) return false;
  // Executive work retains its existing direct completion authority.
  if (me.is_exec) return true;
  const managerMemberships = (me.memberships || []).filter(
    membership => membership.role === "manager"
  );
  if (managerMemberships.length) {
    // Keep a manager's private work private. Organisational work may be
    // finished directly ONLY when the actual unit manager created it for
    // themself. Externally assigned work retains independent review.
    if (item.visibility === "private") return true;
    return item.visibility === "unit" && item.confidential !== true &&
      item.origin === "self_created" && item.assigned_by === me.id &&
      managerMemberships.some(membership => membership.unit_id === item.unit_id);
  }
  return Boolean(me.is_admin);
}

export function outstandingActivityActions(records = []) {
  const superseded = new Set(records.map(row => row.supersedes_id).filter(Boolean));
  return records.filter(row => !superseded.has(row.id) && row.next_action?.trim())
    .sort((a, b) => (a.next_action_on || "9999").localeCompare(b.next_action_on || "9999")
      || String(b.recorded_at || "").localeCompare(String(a.recorded_at || "")));
}

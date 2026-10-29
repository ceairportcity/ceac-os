// Presentation eligibility only. The existing self_certify_work RPC remains
// authoritative and rechecks the actor's current department membership.
export function canSelfCertifyOwnWork(me, item) {
  if (!me?.id || !item || item.assignee_id !== me.id
      || item.origin === "assigned_by_exec"
      || !(item.origin === "self_created" || item.assigned_by === me.id)) return false;
  return Boolean(me.is_admin || me.is_exec || (me.memberships || []).some(
    membership => membership.unit_id === item.unit_id && membership.role === "manager"
  ));
}

export function outstandingActivityActions(records = []) {
  const superseded = new Set(records.map(row => row.supersedes_id).filter(Boolean));
  return records.filter(row => !superseded.has(row.id) && row.next_action?.trim())
    .sort((a, b) => (a.next_action_on || "9999").localeCompare(b.next_action_on || "9999")
      || String(b.recorded_at || "").localeCompare(String(a.recorded_at || "")));
}

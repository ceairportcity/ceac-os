// Presentation eligibility only. The existing self_certify_work RPC remains
// authoritative and rechecks the actor's current department membership.
export function canSelfCertifyOwnWork(me, item) {
  if (!me?.id || !item || item.assignee_id !== me.id) return false;
  // Manager-owned organisational work is reviewed by the Executive, except
  // when explicitly assigned by an Admin. Both routes require submission.
  const managesAnyUnit = (me.memberships || []).some(
    membership => membership.role === "manager"
  );
  return Boolean(me.is_exec || (me.is_admin && !managesAnyUnit));
}

export function outstandingActivityActions(records = []) {
  const superseded = new Set(records.map(row => row.supersedes_id).filter(Boolean));
  return records.filter(row => !superseded.has(row.id) && row.next_action?.trim())
    .sort((a, b) => (a.next_action_on || "9999").localeCompare(b.next_action_on || "9999")
      || String(b.recorded_at || "").localeCompare(String(a.recorded_at || "")));
}

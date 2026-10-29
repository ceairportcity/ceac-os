export const MEMO_STATUS_LABELS = {
  draft: 'Draft', sent: 'Sent', responded: 'Responded', closed: 'Closed',
  pending_decision: 'Pending decision', changes_requested: 'Changes requested',
  approved: 'Approved', declined: 'Declined',
};
export function eligibleMemoDecisionMakers(people, { scope, unitId, to, senderId }) {
  return people.filter(person => person.id !== senderId && to.includes(person.id)
    && (person.is_group_pastor || scope === 'department' && unitId && person.managed_units?.includes(unitId)));
}
export function memoInView(memo, view, actorId) {
  if (view === 'drafts') return memo.sender_id === actorId && memo.status === 'draft';
  if (view === 'sent') return memo.sender_id === actorId && memo.status !== 'draft';
  if (view === 'awaiting') return memo.status === 'pending_decision';
  if (view === 'completed') return ['approved', 'declined', 'closed'].includes(memo.status);
  return memo.sender_id !== actorId && memo.status !== 'draft';
}
export function roomContext(room) {
  return room.kind === 'project' ? {kind:'project',projectId:room.project_id}
    : room.kind === 'sub_team' ? {kind:'sub_team',subTeamId:room.sub_team_id}
      : {kind:'unit',unitId:room.unit_id};
}
export function initials(name) {
  return String(name || 'CEAC').trim().split(/\s+/).slice(0,2).map(part => part[0]).join('').toUpperCase();
}
export function messageTimestamp(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('en-GB', {timeZone:'Africa/Accra',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}).format(new Date(value));
}

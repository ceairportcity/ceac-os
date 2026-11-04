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

/** Group already-authorised Memos in memory. Never merge records or decision histories. */
export function memoCurrentSubject(memo) {
  const versions = memo.memo_versions || [];
  return (versions.find(version => version.id === memo.current_version_id)
    || [...versions].sort((a,b) => b.version_no-a.version_no)[0])?.subject || "Untitled draft";
}
export function memoCorrespondentId(memo,actorId) {
  if (memo.sender_id !== actorId) return "from:"+memo.sender_id;
  const recipients = (memo.memo_recipients || []).filter(row => row.kind === "to")
    .map(row => row.profile_id).filter(Boolean).sort();
  return "to:"+[...new Set(recipients)].join(",");
}
export function memoConversationGroups(memos,actorId,mode="person") {
  const groups = new Map();
  for (const memo of memos) {
    const correspondent = memoCorrespondentId(memo,actorId);
    const subject = memoCurrentSubject(memo).trim();
    // A subject shared by two different people is not one private conversation.
    const key = mode === "subject" ? correspondent+"|"+subject.toLocaleLowerCase() : correspondent;
    if (!groups.has(key)) groups.set(key,{key,correspondent,subject,items:[],updatedAt:memo.updated_at});
    groups.get(key).items.push(memo);
  }
  return [...groups.values()].sort((a,b)=>Date.parse(b.updatedAt)-Date.parse(a.updatedAt));
}
export function memoPersonIdentity(person,units=[]) {
  const name = String(person?.full_name||"").trim() || "Sender unavailable";
  const preferred = [...(person?.managed_units||[]),...(person?.member_units||[])];
  const department = preferred.map(id=>units.find(unit=>unit.id===id)?.name).find(Boolean) || "";
  const role = String(person?.job_title||"").trim();
  return {name,role,department,detail:[role,department].filter(Boolean).join(" · ")};
}

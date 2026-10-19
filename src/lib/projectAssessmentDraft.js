export function assessmentMatchesReview(note, review, cycle, actorId) {
  if (!review || !cycle || review.manager_id !== actorId
    || note.org_id !== review.org_id || note.subject_profile_id !== review.profile_id
    || note.reviewer_id !== actorId) return false;
  const start = note.period_start || note.written_at?.slice(0, 10);
  const end = note.period_end || start;
  return Boolean(start && end && start <= cycle.ends_on && end >= cycle.starts_on);
}

export function includeProjectAssessment(body, note) {
  const source = `Project contribution source: ${note.id}`;
  if (body.includes(source)) return body;
  return [body.trim(), [source, `Project: ${note.project?.name || note.project_id}`,
    note.narrative, note.evidence_note && `Evidence: ${note.evidence_note}`,
    note.next_action && `Next action: ${note.next_action}`].filter(Boolean).join('\n')]
    .filter(Boolean).join('\n\n');
}

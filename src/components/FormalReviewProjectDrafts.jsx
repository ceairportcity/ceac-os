import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { assessmentMatchesReview } from '../lib/projectAssessmentDraft';

/** Existing reviewer draft → existing HR release → existing employee response.
 * Reading or selecting a project note never publishes it or assigns a rating. */
export default function FormalReviewProjectDrafts({ me, review, cycle, disabled, onInclude }) {
  const [sourceNotes, setSourceNotes] = useState([]);
  const [completedReviewScope, setCompletedReviewScope] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const reviewScope = [me.org_id,me.id,review.id,review.profile_id,review.manager_id,cycle.id,cycle.starts_on,cycle.ends_on].join(':');
  const ready = completedReviewScope === reviewScope && !loading && !error && review.manager_id === me.id;
  const notes = ready ? sourceNotes : [];
  const checking = loading || completedReviewScope !== reviewScope;
  const activeError = completedReviewScope === reviewScope ? error : '';
  useEffect(() => {
    let current = true;
    setSourceNotes([]); setCompletedReviewScope(''); setError(''); setLoading(true);
    if (review.manager_id !== me.id) { setLoading(false); return () => { current = false; }; }
    supabase.from('project_person_contribution_assessments')
      .select('id,org_id,project_id,subject_profile_id,reviewer_id,narrative,evidence_note,next_action,period_start,period_end,written_at,project:projects(name)', { count: 'exact' })
      .eq('org_id', me.org_id).eq('subject_profile_id', review.profile_id).eq('reviewer_id', me.id)
      .order('written_at', { ascending: false }).order('id').limit(1001)
      .then(result => {
        if (!current) return;
        if (result.error || !Array.isArray(result.data) || result.count !== result.data.length || result.count > 1000)
          setError('Project assessment history could not be verified. Retry before using this evidence.');
        else setSourceNotes(result.data.filter(note => assessmentMatchesReview(note, review, cycle, me.id)));
        setCompletedReviewScope(reviewScope); setLoading(false);
      }).catch(() => {
        if (!current) return;
        setSourceNotes([]);
        setError('Project assessment history could not be verified. Retry before using this evidence.');
        setCompletedReviewScope(reviewScope); setLoading(false);
      });
    return () => { current = false; };
  }, [me.id, me.org_id, review.id, review.profile_id, review.manager_id, cycle.id, cycle.starts_on, cycle.ends_on, retry]);
  if (review.manager_id !== me.id) return null;
  return <details className="performance-history">
    <summary>Project contribution drafts{ready ? ` · ${notes.length}` : ''}</summary>
    <p className="screen-note">Choose evidence for this person and review period. Inclusion only edits your unsaved assessment; record it and request independent HR release through the review below.</p>
    {checking && <p role="status">Checking project assessments…</p>}
    {activeError && <p role="alert">{activeError} <button type="button" className="btn btn-ghost btn-sm" onClick={() => setRetry(n => n + 1)}>Retry</button></p>}
    {ready && !notes.length && <p>No project assessment drafts match this person and period.</p>}
    {notes.map(note => <article key={note.id} className="card">
      <strong>{note.project?.name || 'Recorded project'}</strong>
      <small> · {note.written_at?.slice(0, 10)}</small>
      <p className="screen-note">{note.period_start || note.period_end
        ? `Contribution period: ${note.period_start || 'Start not specified'} to ${note.period_end || 'End not specified'}`
        : 'No contribution period specified — confirm relevance to this review.'}</p>
      <p>{note.narrative}</p>
      {note.evidence_note && <p>Evidence: {note.evidence_note}</p>}
      <button type="button" className="btn btn-ghost btn-sm" disabled={disabled || !ready}
        onClick={() => onInclude(note)}>Include in assessment draft</button>
    </article>)}
  </details>;
}

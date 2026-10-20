import test from 'node:test';
import assert from 'node:assert/strict';
import { assessmentMatchesReview, includeProjectAssessment } from '../src/lib/projectAssessmentDraft.js';

const review = { org_id: 'ceac', profile_id: 'person', manager_id: 'manager' };
const cycle = { starts_on: '2026-10-01', ends_on: '2026-12-31' };
const note = { id: 'source-1', org_id: 'ceac', subject_profile_id: 'person', reviewer_id: 'manager',
  written_at: '2026-10-19T12:00:00Z', project_id: 'project-1', narrative: 'A specific human-authored contribution.' };

test('project evidence selection is bound to the person, organisation, reviewer and review period', () => {
  assert.equal(assessmentMatchesReview(note, review, cycle, 'manager'), true);
  for (const changed of [{ subject_profile_id: 'other' }, { org_id: 'other' }, { reviewer_id: 'other' },
    { period_end: '2026-09-30' }, { period_start: '2027-01-01' }, { written_at: null },
    { period_start: '2026-12-01', period_end: '2026-10-01' }])
    assert.equal(assessmentMatchesReview({ ...note, ...changed }, review, cycle, 'manager'), false);
  assert.equal(assessmentMatchesReview(note, review, cycle, 'hr'), false);
  assert.equal(assessmentMatchesReview({ ...note, period_start: '2026-09-01', period_end: '2026-10-02' }, review, cycle, 'manager'), true);
});

test('writing date never substitutes for the contribution period', () => {
  for (const written_at of ['2026-09-30T12:00:00Z', '2027-01-07T12:00:00Z'])
    assert.equal(assessmentMatchesReview({ ...note, written_at }, review, cycle, 'manager'), true);
  assert.equal(assessmentMatchesReview({ ...note, period_start: '2026-09-01' }, review, cycle, 'manager'), true);
  assert.equal(assessmentMatchesReview({ ...note, period_end: '2027-01-07' }, review, cycle, 'manager'), true);
});

test('including a project draft preserves the human narrative and does not duplicate the same source', () => {
  const original = 'Reviewer judgement already written.';
  const once = includeProjectAssessment(original, note);
  assert.ok(once.startsWith(original));
  assert.ok(once.includes('Project contribution source: source-1'));
  assert.ok(once.includes(note.narrative));
  assert.equal(includeProjectAssessment(once, note), once);
  assert.ok(includeProjectAssessment(once, { ...note, id: 'source-2' }).includes('Project contribution source: source-2'));
});

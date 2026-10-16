import test from 'node:test';
import assert from 'node:assert/strict';
import { validateRecurrenceSchedule, occursOnDate, listOccurrenceDates, occurrenceKey } from '../src/lib/recurringResponsibilities.js';

test('Saturday weekly venue setup creates independent weekly dates', () => {
  const schedule = { frequency: 'weekly', startDate: '2026-10-17', weekdays: [6] };
  assert.deepEqual(listOccurrenceDates(schedule, { fromDate: '2026-10-17', throughDate: '2026-11-07' }), ['2026-10-17', '2026-10-24', '2026-10-31', '2026-11-07']);
  assert.equal(occursOnDate(schedule, '2026-10-18'), false);
});

test('weekly two-week interval supports multiple weekdays without duplicates', () => {
  const schedule = { frequency: 'weekly', startDate: '2026-10-12', interval: 2, weekdays: [1, 6] };
  assert.deepEqual(listOccurrenceDates(schedule, { throughDate: '2026-11-09' }), ['2026-10-12', '2026-10-17', '2026-10-26', '2026-10-31', '2026-11-09']);
});

test('month day 31 skips February and shorter months', () => {
  const schedule = { frequency: 'monthly', startDate: '2026-01-31' };
  assert.deepEqual(listOccurrenceDates(schedule, { throughDate: '2026-05-31' }), ['2026-01-31', '2026-03-31', '2026-05-31']);
});

test('count limits apply from series beginning even when requesting a later window', () => {
  const schedule = { frequency: 'daily', startDate: '2026-10-01', maxOccurrences: 3 };
  assert.deepEqual(listOccurrenceDates(schedule, { fromDate: '2026-10-02', throughDate: '2026-10-10' }), ['2026-10-02', '2026-10-03']);
});

test('end date and invalid schedule guardrails', () => {
  assert.deepEqual(listOccurrenceDates({ frequency: 'daily', startDate: '2026-10-01', endDate: '2026-10-02' }, { throughDate: '2026-10-10' }), ['2026-10-01', '2026-10-02']);
  assert.throws(() => validateRecurrenceSchedule({ frequency: 'weekly', startDate: '2026-10-01', weekdays: [8] }));
  assert.throws(() => occursOnDate({ frequency: 'daily', startDate: '2026-10-01' }, '2026-02-30'));
  assert.equal(occurrenceKey('media-venue', '2026-10-17'), 'media-venue:2026-10-17');
});

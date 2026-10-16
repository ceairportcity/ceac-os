/**
 * Stage 2 recurring-responsibility date planner.
 * Pure, deterministic, Ghana-local calendar dates (YYYY-MM-DD); no browser time zone dependence.
 * No database writes: callers MUST enforce idempotency/unique occurrence keys and RLS server-side.
 */
const DAY_MS = 86400000;
const isoDate = (value) => {
  if (typeof value !== 'string' || !/^\\d{4}-\\d{2}-\\d{2}$/.test(value)) throw new Error('Expected YYYY-MM-DD');
  const parsed = new Date(value + 'T00:00:00.000Z');
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) throw new Error('Invalid calendar date');
  return parsed;
};
const dateText = (date) => date.toISOString().slice(0, 10);
const daysBetween = (start, next) => Math.round((next - start) / DAY_MS);
const monthsBetween = (start, next) => (next.getUTCFullYear() - start.getUTCFullYear()) * 12 + next.getUTCMonth() - start.getUTCMonth();

/** schedule: {frequency:'daily'|'weekly'|'monthly', interval?:integer, startDate, weekdays?:number[], monthDay?:1..31, endDate?, maxOccurrences?}
 * weekdays are ISO-style 1=Monday through 7=Sunday. Missing monthly days are skipped, never shifted.
 */
export function validateRecurrenceSchedule(schedule) {
  if (!schedule || !['daily', 'weekly', 'monthly'].includes(schedule.frequency)) throw new Error('Unsupported recurrence frequency');
  isoDate(schedule.startDate);
  const interval = schedule.interval ?? 1;
  if (!Number.isInteger(interval) || interval < 1 || interval > 366) throw new Error('Invalid repeat interval');
  if (schedule.endDate && isoDate(schedule.endDate) < isoDate(schedule.startDate)) throw new Error('End date before start');
  if (schedule.maxOccurrences != null && (!Number.isInteger(schedule.maxOccurrences) || schedule.maxOccurrences < 1)) throw new Error('Invalid occurrence count');
  if (schedule.frequency === 'weekly' && schedule.weekdays != null && (!Array.isArray(schedule.weekdays) || !schedule.weekdays.length || schedule.weekdays.some(day => !Number.isInteger(day) || day < 1 || day > 7))) throw new Error('Invalid weekdays');
  if (schedule.frequency === 'monthly' && schedule.monthDay != null && (!Number.isInteger(schedule.monthDay) || schedule.monthDay < 1 || schedule.monthDay > 31)) throw new Error('Invalid month day');
  return true;
}

export function occursOnDate(schedule, date) {
  validateRecurrenceSchedule(schedule);
  const start = isoDate(schedule.startDate);
  const candidate = isoDate(date);
  if (candidate < start || (schedule.endDate && date > schedule.endDate)) return false;
  const interval = schedule.interval ?? 1;
  if (schedule.frequency === 'daily') return daysBetween(start, candidate) % interval === 0;
  if (schedule.frequency === 'weekly') {
    const startDay = (start.getUTCDay() + 6) % 7;
    const dayIndex = (candidate.getUTCDay() + 6) % 7;
    const weeks = Math.floor((daysBetween(start, candidate) + startDay) / 7);
    const days = schedule.weekdays ?? [startDay + 1];
    return weeks % interval === 0 && days.includes(dayIndex + 1);
  }
  return monthsBetween(start, candidate) % interval === 0 && candidate.getUTCDate() === (schedule.monthDay ?? start.getUTCDate());
}

/** Return bounded candidate dates for server-side occurrence creation. */
export function listOccurrenceDates(schedule, { fromDate, throughDate, limit = 100 } = {}) {
  validateRecurrenceSchedule(schedule);
  const from = isoDate(fromDate ?? schedule.startDate);
  const through = isoDate(throughDate ?? fromDate ?? schedule.startDate);
  if (through < from) return [];
  if (!Number.isInteger(limit) || limit < 1 || limit > 1000) throw new Error('Invalid result limit');
  if (daysBetween(from, through) > 3660) throw new Error('Planning window exceeds ten years');
  const results = [];
  // maxOccurrences counts occurrences from the series start, not just within this window.
  const begin = schedule.maxOccurrences ? isoDate(schedule.startDate) : from;
  let count = 0;
  for (let tick = begin.getTime(); tick <= through.getTime(); tick += DAY_MS) {
    const date = dateText(new Date(tick));
    if (occursOnDate(schedule, date)) {
      count += 1;
      if (schedule.maxOccurrences && count > schedule.maxOccurrences) break;
      if (tick >= from.getTime()) {
        results.push(date);
        if (results.length === limit) break;
      }
    }
  }
  return results;
}

export function occurrenceKey(seriesId, scheduledDate) {
  if (!seriesId || typeof seriesId !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(seriesId)) throw new Error('Invalid series ID');
  isoDate(scheduledDate);
  return seriesId + ':' + scheduledDate;
}

/** UI selection only; schedule, permission and duplicate-record authority remain server-side. */
export function toggleRoutineWeekday(current, day, enabled) {
  if (!Array.isArray(current)) throw new Error("Weekday selection is unavailable.");
  const nextDay = Number(day);
  const existing = current.map(Number);
  if (!Number.isInteger(nextDay) || nextDay < 1 || nextDay > 7 ||
    existing.some(value => !Number.isInteger(value) || value < 1 || value > 7)) {
    throw new Error("Choose a weekday from Monday to Sunday.");
  }
  const selected = new Set(existing);
  if (enabled) selected.add(nextDay);
  else selected.delete(nextDay);
  return [...selected].sort((a, b) => a - b);
}

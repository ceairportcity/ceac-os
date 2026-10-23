export const initialRoutineScheduleOptions = () => ({ interval: "1", timezone: "Africa/Accra", dueTime: "", limit: "", reminder: "" });
export function routineScheduleOptions(value = {}) {
  const interval = Number(value.interval ?? 1);
  const limit = value.limit === "" || value.limit == null ? null : Number(value.limit);
  if (!Number.isInteger(interval) || interval < 1 || interval > 366) throw new Error("Repeat every must be a whole number from 1 to 366.");
  if (limit !== null && (!Number.isInteger(limit) || limit < 1 || limit > 5000)) throw new Error("Choose an end count from 1 to 5000.");
  const reminder = value.reminder === "" || value.reminder == null ? null : Number(value.reminder);
  if (reminder !== null && (!Number.isInteger(reminder) || reminder < 0 || reminder > 1440)) throw new Error("Choose a reminder from zero to 1440 minutes before the due time.");
  const timezone = String(value.timezone ?? "Africa/Accra").trim();
  try { new Intl.DateTimeFormat("en", {timeZone:timezone}).format(0); } catch { throw new Error("Choose a recognised time zone, such as Africa/Accra."); }
  const dueTime = value.dueTime || "";
  if (dueTime && !/^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,6})?)?$/.test(dueTime)) throw new Error("Choose a valid due time.");
  return {interval_count:interval,timezone,due_time:dueTime || null,occurrence_limit:limit,...('reminder' in value ? {reminder_minutes_before:reminder} : {})};
}

export const initialRoutineScheduleOptions = () => ({ interval: "1", timezone: "Africa/Accra", dueTime: "", limit: "" });
export function routineScheduleOptions(value = {}) {
  const interval = Number(value.interval ?? 1);
  const limit = value.limit === "" || value.limit == null ? null : Number(value.limit);
  if (!Number.isInteger(interval) || interval < 1 || interval > 366) throw new Error("Repeat every must be a whole number from 1 to 366.");
  if (limit !== null && (!Number.isInteger(limit) || limit < 1 || limit > 5000)) throw new Error("Choose an end count from 1 to 5000.");
  const timezone = String(value.timezone ?? "Africa/Accra").trim();
  try { new Intl.DateTimeFormat("en", {timeZone:timezone}).format(0); } catch { throw new Error("Choose a recognised time zone, such as Africa/Accra."); }
  const dueTime = value.dueTime || "";
  if (dueTime && !/^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,6})?)?$/.test(dueTime)) throw new Error("Choose a valid due time.");
  return {interval_count:interval,timezone,due_time:dueTime || null,occurrence_limit:limit};
}

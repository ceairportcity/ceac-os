import { routineScheduleOptions } from "./routineScheduleOptions.js";
/** Authoritative client schedule validation for CEAC organisational routines.
 * Validation is additional to existing server authority and recurrence checks.
 * No client completion, approval or calendar event is created here.
 */
const validCivilDate = (value) => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};

export function organisationalRepeatDetails(repeat, steps) {
  if (!repeat || !["daily", "weekly", "monthly"].includes(repeat.frequency))
    throw new Error("Choose a supported repeat frequency.");
  if (!validCivilDate(repeat.start) || (repeat.end && !validCivilDate(repeat.end)) ||
      (repeat.end && repeat.end < repeat.start))
    throw new Error("Choose a valid start date and an end date after it.");

  const weekday = Number(repeat.weekday);
  const monthDay = Number(repeat.monthDay);
  // Old single-weekday drafts stay readable; new drafts support several days.
  const selected = repeat.weekdays === undefined ? [repeat.weekday] : repeat.weekdays;
  if (repeat.frequency === "weekly" && !Array.isArray(selected))
    throw new Error("Choose at least one valid weekday.");
  const weekdays = Array.isArray(selected) ? selected.map(Number) : [];
  if (repeat.frequency === "weekly" && (!weekdays.length ||
      weekdays.some(day => !Number.isInteger(day) || day < 1 || day > 7) ||
      new Set(weekdays).size !== weekdays.length))
    throw new Error("Choose one or more different weekdays from Monday to Sunday.");
  if (repeat.frequency === "weekly" && repeat.weekdays === undefined &&
      (!Number.isInteger(weekday) || weekday < 1 || weekday > 7))
    throw new Error("Choose a weekday from Monday to Sunday.");
  if (repeat.frequency === "monthly" && (!Number.isInteger(monthDay) || monthDay < 1 || monthDay > 31))
    throw new Error("Choose a day of month from 1 to 31.");

  return {
    ...(["interval","timezone","dueTime","limit","reminder"].some(key=>key in repeat) ? routineScheduleOptions(repeat) : {}), origin: "self_created", schedule_kind: repeat.frequency, starts_on: repeat.start,
    ...(repeat.end ? { ends_on: repeat.end } : {}),
    ...(repeat.frequency === "weekly" ? { weekdays: weekdays.sort((a, b) => a - b) } : {}),
    ...(repeat.frequency === "monthly" ? { day_of_month: monthDay } : {}),
    steps,
  };
}

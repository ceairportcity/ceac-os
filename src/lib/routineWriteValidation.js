/**
 * Guard CEAC's existing organisational routine write paths before network RPCs.
 * Database RPCs remain the source of authorisation, concurrency and history truth.
 * Custom interval, timezone and reminder options are validated separately by
 * routineScheduleOptions and the authoritative server schedule contract.
 */
const civil = date => {
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const result = new Date(date + "T00:00:00.000Z");
  return Number.isFinite(result.getTime()) && result.toISOString().slice(0, 10) === date;
};

function asDays(value, name) {
  if (!Array.isArray(value) || !value.length) throw new Error("Choose at least one " + name + ".");
  const days = value.map(Number);
  if (days.some(n => !Number.isInteger(n) || n < 1 || n > 7) || new Set(days).size !== days.length)
    throw new Error("Choose different weekdays between Monday and Sunday.");
  return days.sort((a, b) => a - b);
}

function asMonthDay(value) {
  if (value == null || String(value).trim() === "") throw new Error("Choose a monthly day.");
  const day = Number(value);
  if (!Number.isInteger(day) || day < 1 || day > 31)
    throw new Error("Choose a monthly day from 1 through 31.");
  return day;
}

export function routineCreationDetails({
  schedule, start, end = "", weekday, weekdays = [], monthDay,
  recordsValue = false, valueLabel = ""
}) {
  if (!["daily", "weekly", "weekdays", "monthly"].includes(schedule))
    throw new Error("Choose a supported routine schedule.");
  if (!civil(start) || (end && !civil(end)) || (end && end < start))
    throw new Error("Choose a valid start date and an end date on or after it.");
  const repeatDays = schedule === "weekly" ? asDays([weekday], "weekday")
    : schedule === "weekdays" ? asDays(weekdays, "weekday") : null;
  const dayOfMonth = schedule === "monthly" ? asMonthDay(monthDay) : null;
  if (recordsValue && !String(valueLabel).trim())
    throw new Error("Name the number that this routine records.");
  return {
    schedule_kind: schedule, starts_on: start, ...(end ? { ends_on: end } : {}),
    ...(repeatDays ? { weekdays: repeatDays } : {}),
    ...(dayOfMonth != null ? { day_of_month: dayOfMonth } : {}),
    records_value: Boolean(recordsValue),
    ...(recordsValue ? { value_label: String(valueLabel).trim() } : {}),
  };
}

export function routineFutureChange({
  workId, effectiveFrom, schedule, weekday, weekdays = [], monthDay,
  end = "", today, hasReliableSchedule = true
}) {
  if (!workId) throw new Error("Select a routine to edit.");
  if (!civil(today) || !civil(effectiveFrom))
    throw new Error("Choose a valid effective date.");
  if (effectiveFrom < today || (hasReliableSchedule && effectiveFrom <= today))
    throw new Error(hasReliableSchedule ? "A new schedule must start after today." : "Schedule must start today or later.");
  const normalized = routineCreationDetails({
    schedule, start: effectiveFrom, end, weekday, weekdays, monthDay
  });
  return {
    p_work_item_id: workId,
    p_effective_from: effectiveFrom,
    p_schedule_kind: schedule,
    p_weekdays: normalized.weekdays || null,
    p_day_of_month: normalized.day_of_month || null,
    p_ends_on: end || null,
  };
}

export function routineOccurrenceDetails({ workId, date, today, numericValue, recordsValue, note }) {
  if (!workId || !civil(today) || !civil(date) || date > today)
    throw new Error("Choose today or an earlier valid occurrence date.");
  const input = String(numericValue ?? "").trim();
  const value = recordsValue ? Number(input) : null;
  if (recordsValue && (!input || !Number.isFinite(value)))
    throw new Error("Record a finite number for this routine.");
  return {
    p_work_item_id: workId,
    p_occurred_on: date,
    p_value: value,
    p_note: String(note || "").trim() || null,
  };
}

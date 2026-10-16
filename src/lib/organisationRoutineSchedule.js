import { listOccurrenceDates } from "./recurringResponsibilities.js";

/**
 * Existing CEAC organisational routines are backed by recurring_operations,
 * and dated proof records by operation_occurrences. This maps their confirmed
 * schedule without creating duplicate Work items or inventing completion.
 */
export function routineScheduleForPlanner(operation) {
  if (!operation || !operation.starts_on || !operation.active) return null;
  const base = { startDate: operation.starts_on, endDate: operation.ends_on || undefined };
  switch (operation.schedule_kind) {
    case "daily": return { ...base, frequency: "daily" };
    case "weekly":
    case "weekdays": return { ...base, frequency: "weekly",
      weekdays: Array.isArray(operation.weekdays) && operation.weekdays.length
        ? operation.weekdays.map(Number) : undefined };
    case "monthly": return { ...base, frequency: "monthly",
      monthDay: Number(operation.day_of_month) || undefined };
    default: return null;
  }
}

/** The state is 'recorded', never an invented or automatically certified task completion. */
export function projectedRoutineDates(operation, records, { fromDate, throughDate, today } = {}) {
  const schedule = routineScheduleForPlanner(operation);
  if (!schedule) return [];
  const dates = listOccurrenceDates(schedule, { fromDate, throughDate, limit: 100 });
  const recorded = new Set((records || [])
    .filter((row) => row.operation_id === operation.id && typeof row.occurred_on === "string")
    .map((row) => row.occurred_on.slice(0, 10)));
  return dates.map((date) => ({
    operationId: operation.id,
    date,
    state: recorded.has(date) ? "recorded" : date < today ? "unrecorded_past" : "scheduled",
  }));
}

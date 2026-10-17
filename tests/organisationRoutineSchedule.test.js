import test from "node:test";
import assert from "node:assert/strict";
import { projectedRoutineDates, routineScheduleForPlanner } from "../src/lib/organisationRoutineSchedule.js";

test("Saturday UPSA routine is shown weekly and records remain independently attributable", () => {
  const operation = { id: "upsa", active: true, starts_on: "2026-10-17", schedule_kind: "weekly", weekdays: [6] };
  const instances = projectedRoutineDates(operation, [{ operation_id: "upsa", occurred_on: "2026-10-17" }], {
    fromDate: "2026-10-17", throughDate: "2026-10-31", today: "2026-10-26",
  });
  assert.deepEqual(instances.map((x) => [x.date, x.state]), [
    ["2026-10-17", "recorded"],
    ["2026-10-24", "unrecorded_past"],
    ["2026-10-31", "scheduled"],
  ]);
});

test("Sunday routine and multiple weekdays remain distinct occurrences", () => {
  const operation = { id: "media", active: true, starts_on: "2026-10-12", schedule_kind: "weekdays", weekdays: [3, 7] };
  const dates = projectedRoutineDates(operation, [], {
    fromDate: "2026-10-12", throughDate: "2026-10-25", today: "2026-10-14",
  });
  assert.deepEqual(dates.map((x) => x.date), ["2026-10-14", "2026-10-18", "2026-10-21", "2026-10-25"]);
});

test("paused and undated operations have no fabricated scheduled occurrences", () => {
  assert.equal(routineScheduleForPlanner({ id: "x", active: false, starts_on: "2026-10-16", schedule_kind: "daily" }), null);
  assert.equal(routineScheduleForPlanner({ id: "x", active: true, schedule_kind: "weekly" }), null);
  assert.deepEqual(projectedRoutineDates({ id: "x", active: false, starts_on: "2026-10-16", schedule_kind: "daily" }, [], {
    fromDate: "2026-10-16", throughDate: "2026-10-31", today: "2026-10-16",
  }), []);
});

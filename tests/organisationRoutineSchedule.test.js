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

test("a future Sunday change preserves the earlier Saturday responsibility and proof", () => {
  const operation = { id: "venue", active: true, starts_on: "2026-10-17", schedule_kind: "weekly", weekdays: [7] };
  const versions = [
    { operation_id: "venue", version: 1, effective_from: "2026-10-17", effective_to: "2026-10-24", schedule_kind: "weekly", weekdays: [6] },
    { operation_id: "venue", version: 2, effective_from: "2026-10-25", effective_to: null, schedule_kind: "weekly", weekdays: [7] },
    { operation_id: "another-unit", version: 1, effective_from: "2026-10-17", schedule_kind: "daily" },
  ];
  const dates = projectedRoutineDates(operation, [{ operation_id: "venue", occurred_on: "2026-10-17" }], {
    fromDate: "2026-10-17", throughDate: "2026-11-01", today: "2026-10-26", versions,
  });
  assert.deepEqual(dates.map(({ date, state }) => [date, state]), [
    ["2026-10-17", "recorded"], ["2026-10-24", "unrecorded_past"],
    ["2026-10-25", "unrecorded_past"], ["2026-11-01", "scheduled"],
  ]);
});

test("schedule gaps and unavailable versions never fall back to the latest master", () => {
  const operation = { id: "venue", active: true, starts_on: "2026-10-01", schedule_kind: "daily" };
  const window = { fromDate: "2026-10-01", throughDate: "2026-10-07", today: "2026-10-05" };
  assert.deepEqual(projectedRoutineDates(operation, [], { ...window, versions: [] }), []);
  const versions = [{ operation_id: "venue", effective_from: "2026-10-03", effective_to: "2026-10-04", schedule_kind: "daily" }];
  assert.deepEqual(projectedRoutineDates(operation, [], { ...window, versions }).map(row => row.date), ["2026-10-03", "2026-10-04"]);
});

test("versioned monthly day 31 skips missing dates and obeys the series end", () => {
  const operation = { id: "monthly", active: true, starts_on: "2026-01-01", ends_on: "2026-04-01", schedule_kind: "daily" };
  const versions = [{ operation_id: "monthly", effective_from: "2026-01-01", schedule_kind: "monthly", day_of_month: 31 }];
  const dates = projectedRoutineDates(operation, [], { fromDate: "2026-01-01", throughDate: "2026-06-01", today: "2026-04-01", versions });
  assert.deepEqual(dates.map(row => row.date), ["2026-01-31", "2026-03-31"]);
});

test("pausing retains earlier missed dates and recorded same-day proof without future obligations", () => {
 const operation={id:"own",active:false,paused_at:"2026-10-20T12:00:00Z",starts_on:"2026-10-17",schedule_kind:"daily"};
 const rows=projectedRoutineDates(operation,[{operation_id:"own",occurred_on:"2026-10-20"}],{
  fromDate:"2026-10-17",throughDate:"2026-10-24",today:"2026-10-22"});
 assert.deepEqual(rows.map(({date,state})=>[date,state]),[
  ["2026-10-17","unrecorded_past"],["2026-10-18","unrecorded_past"],
  ["2026-10-19","unrecorded_past"],["2026-10-20","recorded"]]);
});

test("resuming excludes historical paused days but restores the resumption date", () => {
 const operation={id:"own",active:true,starts_on:"2026-10-17",schedule_kind:"daily"};
 const pauses=[
  {operation_id:"own",paused_at:"2026-10-18T12:00:00Z",resumed_at:"2026-10-21T09:00:00Z"},
  {operation_id:"another",paused_at:"2026-10-17T00:00:00Z",resumed_at:null}];
 const rows=projectedRoutineDates(operation,[{operation_id:"own",occurred_on:"2026-10-18"}],{
  fromDate:"2026-10-17",throughDate:"2026-10-22",today:"2026-10-22",pauses});
 assert.deepEqual(rows.map(({date,state})=>[date,state]),[
  ["2026-10-17","unrecorded_past"],["2026-10-18","recorded"],
  ["2026-10-21","unrecorded_past"],["2026-10-22","scheduled"]]);
});

test("a zero-day pause creates no date gap; malformed pause evidence fails closed", () => {
 const operation={id:"own",active:true,starts_on:"2026-10-17",schedule_kind:"daily"};
 const options={fromDate:"2026-10-17",throughDate:"2026-10-18",today:"2026-10-18"};
 assert.equal(projectedRoutineDates(operation,[],{...options,pauses:[
  {operation_id:"own",paused_at:"2026-10-17T09:00:00Z",resumed_at:"2026-10-17T11:00:00Z"}
 ]}).length,2);
 assert.throws(()=>projectedRoutineDates(operation,[],{...options,pauses:[
  {operation_id:"own",paused_at:"unknown",resumed_at:null}
 ]}),/Invalid routine pause/);
 assert.throws(()=>projectedRoutineDates(operation,[],{...options,pauses:[
  {operation_id:"own",paused_at:"2026-10-18T09:00:00Z",resumed_at:"2026-10-17T11:00:00Z"}
 ]}),/Invalid routine pause/);
});

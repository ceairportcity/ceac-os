import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = (path) => readFileSync(path,"utf8");

test("staff Work includes only their assigned, unit-visible recurring responsibilities", () => {
  const staff = source("src/components/AssignedRoutineOccurrences.jsx");
  const parent = source("src/screens/Work.jsx");
  assert.match(parent, /mode === "assigned" && !loading && !loadError && <AssignedRoutineOccurrences/);
  assert.match(staff, /\.eq\("assignee_id", me\.id\)/);
  assert.match(staff, /\.eq\("kind", "routine"\)/);
  assert.match(staff, /\.eq\("visibility", "unit"\)/);
  assert.match(staff, /\.in\("work_item_id", templates\.map/);
  assert.match(staff, /\.from\("operation_occurrences"\)/);
  assert.match(staff, /projectedRoutineDates\(routine, history\.data/);
  assert.match(staff, /item\.state==="unrecorded_past"/);
  assert.match(staff, /onOpen\?\.\(item\.routine\.work_item_id\)/);
  assert.doesNotMatch(staff, /\.insert\(|\.update\(|\.delete\(|\.rpc\(/);
});

test("existing routine completion remains on the accountable official work record", () => {
  const detail = source("src/screens/Item.jsx");
  const planner = source("src/lib/organisationRoutineSchedule.js");
  assert.match(detail, /record_routine_occurrence/);
  assert.match(detail, /change_routine_schedule/);
  assert.match(detail, /set_routine_paused/);
  assert.match(planner, /unrecorded_past/);
  assert.doesNotMatch(planner, /status:"completed"|state:"completed"/);
});

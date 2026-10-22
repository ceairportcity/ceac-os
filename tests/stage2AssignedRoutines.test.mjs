import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = (path) => readFileSync(path,"utf8");

test("staff Work includes only their assigned, unit-visible recurring responsibilities", () => {
  const staff = source("src/components/AssignedRoutineOccurrences.jsx");
  const parent = source("src/screens/Work.jsx");
  assert.match(parent, /\(mode === "all" \|\| mode === "assigned"\) && !loading && !loadError && <AssignedRoutineOccurrences/);
  assert.match(staff, /\.eq\("assignee_id", me\.id\)/);
  assert.match(staff, /\.eq\("kind", "routine"\)/);
  assert.match(staff, /\.eq\("visibility", "unit"\)/);
  assert.match(staff, /\.in\("work_item_id", templates\.map/);
  assert.match(staff, /readRoutineSchedulePreview\(supabase/);
  assert.match(staff, /item\.state==="unrecorded_past"/);
  assert.match(staff, /onOpen\?\.\(item\.routine\.work_item_id,item\.date\)/);
  assert.match(staff, /item\.state === "skipped"/);
  assert.match(staff, /Skipped with authorised reason/);
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

test("P4 assigned/Manager recurring work rejects incomplete provider pages and avoids stale cross-user schedule exposure",()=>{
  const assigned=source("src/components/AssignedRoutineOccurrences.jsx");
  const manager=source("src/components/ManagerRoutineOccurrences.jsx");
  for(const view of [assigned,manager]){
    assert.match(view,/count:"exact"/);
    assert.match(view,/typeof \w+\.count!=="number"|typeof operationCount!=="number"/);
    assert.match(view,/verifiedIdentity===identity/);
    assert.match(view,/setVerifiedIdentity\(""\)/);
    assert.match(view,/document\.addEventListener\("visibilitychange",refresh\)/);
    assert.match(view,/window\.setInterval\(refresh,60000\)/);
    assert.match(view,/window\.clearInterval\(timer\)/);
  }
  assert.match(assigned,/source\.count!==source\.data\.length/);
  assert.match(assigned,/result\.count!==result\.data\.length/);
  const reader=source("src/lib/readRoutineSchedulePreview.js");
  assert.match(reader,/count:"exact"/);
  assert.match(reader,/expected!==result\.count/);
  assert.match(reader,/batchRows\.length<expected/);
  assert.doesNotMatch(assigned,/catch \{ return \[\]; \}/);
  assert.match(manager,/operationCount!==operations\.length/);
  assert.doesNotMatch(manager,/series\.filter\(\(operation\)=>!operation\.paused_at\)/);
  for (const view of [assigned,manager]) assert.match(view,/readRoutineSchedulePreview\(supabase/);
  assert.match(manager,/const items = !ready \? \[\] :/);
  assert.doesNotMatch(manager,/catch \{\s*return \[\];\s*\}/);
});

test("P4 confirmed schedule reads refresh when the person or organisation changes even if unit assignments do not",()=>{
  const assigned=source("src/components/AssignedRoutineOccurrences.jsx");
  const manager=source("src/components/ManagerRoutineOccurrences.jsx");
  assert.match(assigned,/\[me\.id,me\.org_id,today\]/);
  assert.match(manager,/\[unitKey, today, me\.id, me\.org_id\]/);
});

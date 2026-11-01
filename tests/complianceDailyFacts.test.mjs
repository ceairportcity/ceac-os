import test from "node:test";
import assert from "node:assert/strict";
import { complianceDailyFacts } from "../src/lib/complianceDailyFacts.js";

const DATE = "2026-11-01";
const row = (id, extra = {}) => ({
  profile_id: id, employee_id: `roster-${id}`, expected_today: true,
  sessions: [], approved_leave: [], ...extra,
});

test("a person with two departments counts as one attendee, even if their session is repeated", () => {
  const session = { id: "session1", started_at: "2026-11-01T08:00:00Z", ended_at: "2026-11-01T17:00:00Z" };
  const rows = [
    row("catherine", { unit_id: "compliance", sessions: [session] }),
    row("catherine", { unit_id: "childrens", employee_id: "other-roster-id", sessions: [session] }),
    row("frank", { unit_id: "media" }),
  ];
  assert.deepEqual(complianceDailyFacts(rows, DATE), {
    people: 2, scheduled: 2, recordedStarts: 1, noStartRecorded: 1, approvedLeave: 0, openSessions: 0,
  });
});

test("leave and missing start records remain distinct facts, not automatic violations", () => {
  const facts = complianceDailyFacts([
    row("leave", { approved_leave: [{ state:"current", start_date:DATE, end_date:DATE }] }),
    row("unscheduled", { expected_today:false }),
    row("unknown", { expected_today:null }),
  ], DATE);
  assert.deepEqual(facts, {
    people:3, scheduled:1, recordedStarts:0, noStartRecorded:1, approvedLeave:1, openSessions:0,
  });
  assert.equal("violations" in facts, false);
  assert.equal("deductions" in facts, false);
});

test("open sessions are flagged as recorded but do not imply verified hours worked", () => {
  const facts = complianceDailyFacts([
    row("frank", { sessions:[{ id:"overnight", started_at:"2026-10-31T22:00:00Z", ended_at:null }] }),
    row("catherine", { expected_today:false, sessions:[{id:"s",started_at:"2026-11-01T11:00:00Z", ended_at:"2026-11-01T12:00:00Z"}] }),
  ], DATE);
  assert.equal(facts.recordedStarts,2);
  assert.equal(facts.openSessions,1);
  assert.equal(facts.noStartRecorded,0);
  assert.equal("hoursWorked" in facts,false);
});

test("unverified data never silently turns into zero counts", () => {
  assert.equal(complianceDailyFacts(null,DATE),null);
  assert.equal(complianceDailyFacts([{name:"Unknown"}],DATE),null);
  assert.equal(complianceDailyFacts([], "invalid"),null);
});

import test from "node:test";
import assert from "node:assert/strict";
import { summariseAdminToday } from "../src/lib/adminTodaySummary.js";

test("one person with overlapping open sessions is counted once", () => {
  assert.deepEqual(summariseAdminToday({
    activeProfiles: [{ id: "a" }, { id: "b" }],
    todaySessions: [{ profile_id: "a" }],
    activeSessions: [{ profile_id: "a" }, { profile_id: "a" }],
    approvedLeave: [],
  }), { working: 1, leave: 0, notStarted: 1, headcount: 2 });
});

test("an overnight open session is working, never no-session", () => {
  const result = summariseAdminToday({
    activeProfiles: [{ id: "a" }],
    todaySessions: [],
    activeSessions: [{ profile_id: "a" }],
  });
  assert.equal(result.working, 1);
  assert.equal(result.notStarted, 0);
});

test("approved leave is excluded from no-session, not treated as absence", () => {
  assert.deepEqual(summariseAdminToday({
    activeProfiles: [{ id: "a" }, { id: "b" }, { id: "c" }],
    todaySessions: [],
    activeSessions: [],
    approvedLeave: [{ profile_id: "a" }, { profile_id: "a" }],
  }), { working: 0, leave: 1, notStarted: 2, headcount: 3 });
});

test("inactive/unknown identities and duplicate active profiles never inflate totals", () => {
  assert.deepEqual(summariseAdminToday({
    activeProfiles: [{ id: "a" }, { id: "a" }],
    todaySessions: [{ profile_id: "deleted" }],
    activeSessions: [{ profile_id: "deleted" }],
    approvedLeave: [{ profile_id: "deleted" }],
  }), { working: 0, leave: 0, notStarted: 1, headcount: 1 });
});

test("an empty snapshot never implies a workforce absence", () => {
  assert.deepEqual(summariseAdminToday({}), { working: 0, leave: 0, notStarted: 0, headcount: 0 });
});

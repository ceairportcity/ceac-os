import test from "node:test";
import assert from "node:assert/strict";
import { summariseAdminToday, countRecordedSessionDays } from "../src/lib/adminTodaySummary.js";

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

test("recorded session days use Accra UTC dates with duplicate sessions counted once", () => {
  const now = Date.parse("2026-10-11T10:00:00Z");
  assert.equal(countRecordedSessionDays([
    { profile_id: "p", started_at: "2026-10-10T23:59:59Z" },
    { profile_id: "p", started_at: "2026-10-11T00:00:01Z" },
    { profile_id: "p", started_at: "2026-10-11T05:00:00Z" },
    { profile_id: "other", started_at: "2026-10-08T09:00:00Z" },
  ], "p", now), 2);
});

test("future, malformed and old work sessions are not presented as actual recent activity", () => {
  const now = Date.parse("2026-10-11T10:00:00Z");
  assert.equal(countRecordedSessionDays([
    { profile_id: "p", started_at: "2026-10-12T08:00:00Z" },
    { profile_id: "p", started_at: "broken" },
    { profile_id: "p", started_at: "2026-10-01T08:00:00Z" },
    null,
  ], "p", now), 0);
  assert.equal(countRecordedSessionDays(null, "p", now), 0);
  assert.equal(countRecordedSessionDays([], null, now), 0);
});

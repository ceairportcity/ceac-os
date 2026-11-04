import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {canAdminDecideLeave, leaveStageLabel} from "../src/lib/leaveDecisionStage.js";

const overview = readFileSync("src/experience-v2/admin-overview/AdminOverviewV2.jsx", "utf8");
const stylesheet = readFileSync("src/experience-v2/admin-overview/admin-overview.css", "utf8");
const components = readFileSync("src/experience-v2/components/DataComponents.jsx", "utf8");
const contract = readFileSync("docs/design/CEAC_OS_PREMIUM_REDESIGN_SOURCE_OF_TRUTH_2026-09-23.md", "utf8");
const mobile = readFileSync("tests/admin-premium-briefing.spec.js", "utf8");

test("the approved visual direction is a binding reference, not an accepted screenshot", () => {
  assert.match(contract, /dark premium navigation shell/);
  assert.match(contract, /cool off-white workspace/);
  assert.match(contract, /electric blue primary action/);
  assert.match(stylesheet, /#0c5df9/i);
  assert.match(stylesheet, /ceac-hero-landscape\.svg/);
});

test("Administration remains decision-first with a personal premium daily greeting", () => {
  assert.match(overview, /Administration daily briefing/);
  assert.match(overview, /\{greeting\}, \{adminFirstName\}/);
  assert.match(overview, /const dayActions=\[/);
  assert.match(overview, /withOverviewActions\(notificationPanel,dayActions/);
  assert.match(overview, /Upcoming commitments/);
  assert.match(overview, /pendingInvitations\.length/);
  assert.match(overview, /onLeaveDecision\?\.\(request/);
});

test("the hero preserves existing actual-work navigation and authorised role controls", () => {
  assert.match(overview, /href="#ceac-your-day"/);
  assert.match(readFileSync("src/components/OverviewNotifications.jsx","utf8"), /id="ceac-your-day"/);
  assert.match(components, /export function DataPanel\(\{\s*id,/);
  assert.match(components, /<Surface id=\{id\}/);
  assert.match(overview, /canManagePeople \? <Button/);
  assert.match(overview, /onOpenSettings/);
  assert.match(overview, /onOpenMeeting\?\.\(meeting\.id\)/);
  assert.match(overview, /onScheduleMeeting\?\.\(/);
});

test("mobile and desktop have separate first-class hierarchy and real screenshot tests", () => {
  assert.match(stylesheet, /max-width: 899px/);
  assert.match(stylesheet, /max-width: 599px/);
  assert.match(stylesheet, /grid-template-columns: 1fr/);
  assert.match(stylesheet, /prefers-reduced-motion/);
  assert.match(mobile, /desktop-1440/);
  assert.match(mobile, /desktop-1366/);
  assert.match(mobile, /tablet-820/);
  assert.match(mobile, /phone-390/);
  assert.match(mobile, /screenshot\(/);
  assert.match(mobile, /document\.documentElement\.scrollWidth/);
});

test("the dominant next step contains real CEAC authority-preserving navigation", () => {
  assert.match(overview, /const suggestedAction = leaveQueue\.length/);
  assert.match(overview, /eyebrow: canAdminDecideLeave\(leaveQueue\[0\]\) \? "Leave decision waiting" : "Leave request to review"/);
  assert.match(overview, /onOpenLeaveRequest\(leaveQueue\[0\]\.id\)/);
  assert.match(overview, /action: onOpenWorkflows/);
  assert.match(overview, /pendingInvitations\.length && canManagePeople/);
  assert.match(overview, /action: onOpenInvitations/);
  assert.match(overview, /onClick:onOpenInvitations/);
  assert.match(overview, /onOpenItem\?\.\(mine\[0\]\.id\)/);
  assert.match(overview, /withOverviewActions\(notificationPanel,dayActions/);
  assert.match(stylesheet, /Admin premium reference: dominant next-decision focus/);
  assert.doesNotMatch(overview, /automatically.*approve.*leave/i);
});

test("all leave kinds route pending and historical escalated requests directly to HR", () => {
  for (const kind of ["annual", "sick", "maternity", "paternity", "study", "custom"]) {
    const pending = {kind, status:"pending"};
    assert.equal(leaveStageLabel(pending), "Waiting for HR approval");
    assert.equal(leaveStageLabel(pending, "manager_then_admin"), "Waiting for HR approval",
      "legacy policy metadata must not reintroduce Manager approval");
    assert.equal(canAdminDecideLeave(pending), true);
    const historicallyEscalated = {...pending, status:"escalated"};
    assert.equal(leaveStageLabel(historicallyEscalated), "Awaiting HR final decision");
    assert.equal(canAdminDecideLeave(historicallyEscalated), true);
    for (const status of ["approved", "declined", "cancelled", "", undefined]) {
      assert.equal(canAdminDecideLeave({kind, status}), false);
    }
  }
});

test("empty or concluded requests cannot acquire an HR decision", () => {
  for (const request of [null, {}, {status:"approved"}, {status:"declined"}, {status:"cancelled"}]) {
    assert.equal(canAdminDecideLeave(request), false);
    assert.doesNotMatch(leaveStageLabel(request), /Manager approved|Waiting for Manager/);
  }
});

test("Overview stage guards protect both controls and the mutation handler", () => {
  const home = readFileSync("src/screens/AdminHome.jsx", "utf8");
  const workforce = readFileSync("src/screens/Workforce.jsx", "utf8");
  assert.match(overview, /actions:canAdminDecideLeave\(request\)\?<>/);
  assert.match(overview, /onOpenLeaveRequest\(request\.id\)/);
  assert.match(home, /go\?\.\("attendance", \{leaveRequestId:requestId\}\)/);
  assert.match(workforce, /initialRequestId=\{initialLeaveRequestId\}/);
  assert.match(overview, /leaveStageLabel\(request\)/);
  assert.match(workforce, /leaveStageLabel\(l,route\)/);
  const handler = home.slice(home.indexOf("async function decideLeave("), home.indexOf("const adminDate"));
  const guard = handler.indexOf("!canAdminDecideLeave(request)");
  assert.ok(guard >= 0 && guard < handler.indexOf('supabase.rpc("workforce_leave_action"'));
  assert.match(handler, /!\["approved", "declined"\]\.includes\(decision\)/);
});

test("the Administration calendar is navigable without fabricating missing events", () => {
  assert.match(overview, /function AdminCalendarRail\(\{ meetings \}\)/);
  assert.match(overview, /aria-label="Previous month"/);
  assert.match(overview, /aria-label="Next month"/);
  assert.match(overview, /aria-label="Show current month"/);
  assert.match(overview, /onClick=\{\(\) => setMonthOffset/);
  assert.match(overview, /aria-pressed=\{day\.date === selectedDay\}/);
  assert.match(overview, /meetingDays\.has\(day\.date\)/);
  assert.match(overview, /This calendar previews at most six upcoming meetings within the next 14 days/);
  assert.match(overview, /No meeting is shown for this date in the limited upcoming preview/);
  assert.match(stylesheet, /Approved Admin calendar rail/);
  assert.match(stylesheet, /adminv2-calendar-days/);
});

test("open work sessions never pretend to confirm live presence", () => {
  assert.match(overview, /label="Open work sessions"/);
  assert.match(overview, /supporting="Not verified live presence"/);
  assert.doesNotMatch(overview, /label="Working now"/);
});

test("no fabricated clear inbox state while loading or after a failed read", () => {
  assert.match(overview, /Loading your recorded Administration priorities/);
  assert.match(overview, /latest Administration priorities could not be verified/);
  assert.match(overview, /Current meeting information could not be verified/);
  assert.match(overview, /!loading && !loadFailed \? <div className="adminv2-agenda-foot"/);
  assert.match(overview, /loading\s*\? "Loading your recorded/);
});

test("People & Access publishes verified HR roster before optional private employee photos", () => {
  const people = readFileSync("src/screens/People.jsx", "utf8");
  const verifiedAt = people.indexOf("setVerifiedRosterScope(scopeKey);");
  const visibleAt = people.indexOf("setRows(rosterRows);");
  const loadingFinishedAt = people.indexOf("setLoading(false);", visibleAt);
  const mediaFetchAt = people.indexOf("const photoGroups = await listOperationalFilesForContexts(", visibleAt);
  assert.ok(verifiedAt > 0 && visibleAt > verifiedAt);
  assert.ok(loadingFinishedAt > visibleAt && mediaFetchAt > loadingFinishedAt,
    "Optional signed photos must not block permission-verified People & Access");
  assert.match(people, /if \(generation === rosterGeneration\.current\) setRows\(hydratedRows\)/);
  assert.match(people, /if \(generation !== rosterGeneration\.current\) return false/);
  assert.match(people, /catch \{\s*return entry;\s*\}/);
  assert.doesNotMatch(people, /getPublicUrl\(/);
});

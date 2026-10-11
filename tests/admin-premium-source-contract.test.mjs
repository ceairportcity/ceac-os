import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

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
  assert.match(overview, /Needs Administration/);
  assert.match(overview, /Upcoming commitments/);
  assert.match(overview, /pendingInvitations\.length/);
  assert.match(overview, /onLeaveDecision\?\.\(request/);
});

test("the hero preserves existing actual-work navigation and authorised role controls", () => {
  assert.match(overview, /href="#admin-operational-inbox"/);
  assert.match(overview, /id="admin-operational-inbox"/);
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
  assert.match(mobile, /desktop-1366/);
  assert.match(mobile, /phone-390/);
  assert.match(mobile, /screenshot\(/);
  assert.match(mobile, /document\.documentElement\.scrollWidth/);
});

test("the dominant next step contains real CEAC authority-preserving navigation", () => {
  assert.match(overview, /const suggestedAction = leaveQueue\.length/);
  assert.match(overview, /eyebrow: "Leave decision waiting"/);
  assert.match(overview, /action: onOpenAttendance/);
  assert.match(overview, /action: onOpenWorkflows/);
  assert.match(overview, /pendingInvitations\.length && canManagePeople/);
  assert.match(overview, /action: onOpenPeople/);
  assert.match(overview, /onOpenItem\?\.\(mine\[0\]\.id\)/);
  assert.match(overview, /adminv2-focus-strip/);
  assert.match(stylesheet, /Admin premium reference: dominant next-decision focus/);
  assert.doesNotMatch(overview, /automatically.*approve.*leave/i);
});

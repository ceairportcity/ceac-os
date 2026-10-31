import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { strategyProgress } from "../src/experience-v2/executive-overview/strategyProgress.js";

test("Executive never displays missing objective observations as measured zero", () => {
  assert.equal(strategyProgress({ measurement_kind:"numeric", target_value:100, current_value:null }), null);
  assert.equal(strategyProgress({ measurement_kind:"numeric", target_value:100 }), null);
  assert.equal(strategyProgress({ measurement_kind:"numeric", target_value:null, current_value:0 }), null);
  assert.equal(strategyProgress({ measurement_kind:"numeric", current_value:0 }), null);
});

test("a genuinely recorded zero or fractional objective remains accurate", () => {
  assert.equal(strategyProgress({ measurement_kind:"numeric", target_value:100, current_value:0 }), 0);
  assert.equal(strategyProgress({ measurement_kind:"numeric", target_value:100, current_value:25 }), 25);
  assert.equal(strategyProgress({ measurement_kind:"numeric", target_value:100, current_value:150 }), 100);
});

test("non-numeric and invalid targets never generate a fabricated progress measure", () => {
  assert.equal(strategyProgress({measurement_kind:"qualitative", target_value:100, current_value:25}), null);
  assert.equal(strategyProgress({measurement_kind:"numeric", target_value:0, current_value:15}), null);
  assert.equal(strategyProgress({measurement_kind:"numeric", target_value:"not recorded", current_value:15}), null);
});

test("Executive UI actually uses the measured-only helper", () => {
  const source=readFileSync("src/experience-v2/executive-overview/ExecutiveOverviewV2.jsx","utf8");
  assert.match(source, /import \{ strategyProgress \} from "\.\/strategyProgress\.js";/);
  assert.match(source, /const progress = strategyProgress\(row\);/);
  assert.doesNotMatch(source, /const current = Number\(row\?\.current_value\);/);
});

test("Executive greeting follows Accra local time", () => {
  const source=readFileSync("src/experience-v2/executive-overview/ExecutiveOverviewV2.jsx","utf8");
  assert.match(source, /function accraGreeting/);
  assert.match(source, /timeZone: "Africa\/Accra"/);
  assert.match(source, /hour < 12/);
  assert.match(source, /hour < 17/);
  assert.match(source, /<h2>\{greeting\}, \{executiveName \|\| "Executive"\}<\/h2>/);
});

test("Executive organisational overview explicitly scopes all read-context queries", () => {
  const source=readFileSync("src/screens/ExecutiveHome.jsx","utf8");
  assert.match(source, /from\("meeting_sessions"\)[\s\S]{0,180}\.eq\("org_id",me\.org_id\)/);
  assert.match(source, /from\("report_periods"\)[\s\S]{0,150}\.eq\("org_id",me\.org_id\)/);
  assert.match(source, /from\("units"\)[\s\S]{0,90}\.eq\("org_id",me\.org_id\)/);
  assert.match(source, /from\("reports"\)[\s\S]{0,155}\.eq\("org_id",me\.org_id\)/);
});

test("Executive scenic hero reuses the local approved CEAC asset and keeps clean mobile composition", () => {
  const css = readFileSync("src/experience-v2/executive-overview/executive-overview.css", "utf8");
  const svg = readFileSync("public/ceac-hero-landscape.svg", "utf8");
  assert.match(css, /url\('\/ceac-hero-landscape\.svg'\)/);
  assert.match(svg, /<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.match(css, /@media \(max-width: 720px\)\s*\{[\s\S]*?\.executivev2-hero\s*\{[^}]*background:\s*#fff;/);
  assert.doesNotMatch(css, /\.executivev2-hero::before\s*\{\s*background:/);
});

test("Executive Overview denies false zero counts and incomplete ministry sources",()=>{
 const src=readFileSync("src/screens/ExecutiveHome.jsx","utf8");
 const app=readFileSync("src/App.jsx","utf8");
 assert.match(src,/if \(!Number\.isInteger\(result\.count\) \|\| result\.count < 0\)/);
 assert.doesNotMatch(src,/return result\.count \?\? 0/);
 assert.match(src,/\[objectiveRows,strategyRows,unitRows,operationRows,employmentRows,activeProfileRows\]\.every\(complete\)/);
 assert.match(src,/result\.count === result\.data\.length/);
 assert.match(src,/!complete\(occurrenceResult\)/);
 assert.match(src,/!complete\(reportRows\)/);
 assert.match(src,/activeTeams: optionalCount\(teamRows\)/);
 assert.match(src,/activeVolunteers: activeVolunteerIds\.size/);
 assert.match(src,/activeStaff: activeStaffIds\.size/);
 assert.match(src,/The executive source evidence could not be fully verified/);
 assert.match(app,/ExecutiveHome key=\{me\.org_id\+":"\+me\.id\}/);
});

test("Executive people cards open role-specific directory views without altering attendance counts", () => {
  const app=readFileSync("src/App.jsx","utf8");
  const overview=readFileSync("src/experience-v2/executive-overview/ExecutiveOverviewV2.jsx","utf8");
  const screen=readFileSync("src/screens/ExecutiveOrganisation.jsx","utf8");
  assert.match(app,/initialDirectory=\{directory\}/);
  assert.match(app,/options\.directory/);
  assert.match(overview,/onOpenOrganisation\?\.\("staff"\)/);
  assert.match(overview,/onOpenOrganisation\?\.\("volunteers"\)/);
  assert.match(overview,/onOpenOrganisation\?\.\("teams"\)/);
  assert.match(screen,/initialDirectory = null/);
  assert.match(screen,/const \[directory, setDirectory\] = useState\(emptyDirectory\)/);
  assert.doesNotMatch(screen,/\{ me, directory = null/);
  assert.match(screen,/peopleForView = peopleGroup === "staff"/);
});

test("Executive linked staff and volunteer metrics are deduplicated and limited to active accessible profiles", () => {
  const home=readFileSync("src/screens/ExecutiveHome.jsx","utf8");
  const directory=readFileSync("src/screens/ExecutiveOrganisation.jsx","utf8");
  assert.match(home,/linkedActiveProfileIds = new Set\(activeProfileRows\.data/);
  assert.match(home,/linkedActiveProfileIds\.has\(row\.profile_id\)/);
  assert.match(home,/activeVolunteerIds = new Set/);
  assert.match(home,/activeStaffIds = new Set/);
  assert.match(directory,/employedIds = new Set/);
  assert.match(directory,/volunteerIds = new Set/);
  assert.match(directory,/\.eq\("employment_status", "active"\)/);
});

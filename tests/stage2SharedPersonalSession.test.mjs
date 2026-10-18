import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path,"utf8");

test("Manager and Administration Overviews own Start/End Work, not team attendance mutations",()=>{
 const manager=read("src/experience-v2/manager-overview/ManagerOverviewV2.jsx");
 const admin=read("src/experience-v2/admin-overview/AdminOverviewV2.jsx");
 const exec=read("src/experience-v2/executive-overview/ExecutiveOverviewV2.jsx");
 const execScreen=read("src/screens/ExecutiveHome.jsx");
 for(const [role,component] of [["Manager",manager],["Administration",admin],["Executive",exec]]){
   assert.match(component,/import EmployeeWorkSession from/,`${role} must share its own authorised session controls`);
   assert.match(component,/<EmployeeWorkSession me=\{me\} \/>/,`${role} missing personal attendance on Overview`);
 }
 assert.match(execScreen,/me=\{me\}/,"Executive must pass the signed employee identity, not an organisation-wide roster");
 const clock=read("src/components/EmployeeWorkSession.jsx");
 assert.match(clock,/openSession\(me\.org_id, me\.id\)/);
 assert.match(clock,/startWork\(me\.org_id,me\.id,place/);
 assert.match(clock,/endWork\(session\.id\)/);
 assert.match(clock,/reconcileWorkSession\(session\.id,"continue"/);
 assert.match(clock,/reconcileWorkSession\(session\.id,"close"/);
 assert.match(clock,/\.eq\("assignee_id",me\.id\)/);
 assert.match(clock,/\.eq\("org_id",me\.org_id\)/);
 assert.doesNotMatch(clock,/supabase\.from\("work_sessions"\)\.insert|supabase\.from\("work_sessions"\)\.update/);
 assert.doesNotMatch(clock,/\.from\("employment_records"\)|\.from\("payroll"/);
});

test("unknown or stale session fails closed and is not called a verified HR attendance day",()=>{
 const clock=read("src/components/EmployeeWorkSession.jsx");
 assert.match(clock,/setVerified\(false\)/);
 assert.match(clock,/setVerified\(true\)/);
 assert.match(clock,/disabled=\{busy\|\|loading\|\|!verified\}/);
 assert.match(clock,/Retry session verification/);
 assert.match(clock,/stale\?\s*<button/);
 assert.match(clock,/role="alert"/);
 assert.match(clock,/Africa\/Accra/);
 assert.match(clock,/not automatic attendance approval, overtime or payroll/);
 assert.match(clock,/work sessions? could not be verified/i);
});

test("existing staff's approved session API is reused with geolocation evidence",()=>{
 const session=read("src/lib/session.js");
 assert.match(session,/getPositionOnce/);
 assert.match(session,/office_location_id: verifiedOfficeLocationId/);
 assert.match(session,/rpc\("end_work_session_with_location"/);
 assert.match(session,/rpc\("reconcile_work_session"/);
});

test("P2/P3 shared personal session lookup scopes BOTH org and current actor", () => {
 const session = read("src/lib/session.js");
 const open = session.match(/export async function openSession\(orgId, userId\) \{([\s\S]*?)\n\}/)?.[1];
 assert.ok(open, "Authoritative personal session lookup must exist");
 assert.match(open, /\.eq\("org_id", orgId\)\.eq\("profile_id", userId\)\.is\("ended_at", null\)/);
 assert.match(open, /if \(error\) throw error;/,
   "A failed tenant-scoped read may not be interpreted as no active session");
});

test("a still-open work session becomes stale when the Accra day advances", () => {
 const clock = read("src/components/EmployeeWorkSession.jsx");
 assert.match(clock, /const \[clockNow, setClockNow\] = useState\(\(\) => Date\.now\(\)\)/);
 assert.match(clock, /setInterval\(updateClock, 60_000\)/);
 assert.match(clock, /addEventListener\("visibilitychange", updateClock\)/);
 assert.match(clock, /ghanaDay\(clockNow\)/);
 assert.match(clock, /\[session, clockNow\]/);
 assert.match(clock, /clearInterval\(timer\)/);
});

test("end and historic close recheck the server rather than trusting a void RPC", () => {
 const clock=read("src/components/EmployeeWorkSession.jsx");
 assert.match(clock,/async function verifyClosedSession\(closedId\)/);
 assert.match(clock,/const current = await openSession\(me\.org_id, me\.id\)/);
 assert.match(clock,/if \(current\?\.id === closedId\)/);
 assert.match(clock,/await endWork\(session\.id\);\s*await verifyClosedSession\(session\.id\)/);
 assert.match(clock,/await reconcileWorkSession\(session\.id,"close",[\s\S]*?await verifyClosedSession\(session\.id\)/);
 assert.match(clock,/setVerified\(false\);[\s\S]*?Retry session verification/);
 assert.match(clock,/onClick=\{stop\} disabled=\{busy\|\|loading\|\|!verified\}/);
});

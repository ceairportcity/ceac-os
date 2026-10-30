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

test("P3 open-session lookup rejects more than one concurrent actor-owned session", () => {
 const source=read("src/lib/session.js");
 const open=source.match(/export async function openSession\(orgId, userId\) \{([\s\S]*?)\n\}/)?.[1];
 assert.ok(open);
 assert.match(open,/\.eq\("org_id", orgId\)\.eq\("profile_id", userId\)\.is\("ended_at", null\)/);
 assert.match(open,/\.limit\(2\)\.maybeSingle\(\)/,
   "Requesting one row would conceal duplicate active sessions; two must fail closed");
 assert.match(open,/if \(error\) throw error;/);
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

test("End Work requires the exact authorised session row to have an end timestamp", () => {
 const source=read("src/components/EmployeeWorkSession.jsx");
 const body=source.match(/async function verifyClosedSession\(closedId\) \{([\s\S]*?)\n  \}/)?.[1];
 assert.ok(body);
 assert.match(body,/supabase\.from\("work_sessions"\)/);
 assert.match(body,/\.select\("id,ended_at"\)/);
 assert.match(body,/\.eq\("org_id", me\.org_id\)\s*\.eq\("profile_id", me\.id\)\s*\.eq\("id", closedId\)/);
 assert.match(body,/closeReadError \|\| !closed\?\.ended_at/);
 assert.match(body,/const current = await openSession\(me\.org_id, me\.id\)/);
});

test("stale-session recovery verifies the new linked row and still rejects stale evidence", () => {
 const source = read("src/components/EmployeeWorkSession.jsx");
 const continued = source.match(/async function continueOld\(\) \{([\s\S]*?)\n  \}/)?.[1];
 assert.ok(continued, "Continuation control must exist");
 assert.match(continued, /verifyContinuedWorkSession\(me\.org_id,me\.id,session\.id,created\)/);
 const api=read("src/lib/session.js");
 assert.match(api,/created\.id === previousId/);
 assert.match(api,/current\?\.id !== created\.id/);
 assert.match(api,/current\.flags\?\.continued_from_session_id !== previousId/);
 assert.match(api,/\.eq\("org_id", orgId\)\.eq\("profile_id", userId\)\.eq\("id", previousId\)/);
 assert.match(api,/error \|\| !previous\?\.ended_at/);
 assert.match(continued, /ghanaDay\(current\.last_confirmed_at \|\| current\.started_at\) < ghanaDay\(Date\.now\(\)\)/,
   "Continuation must confirm the server refreshed the stale timestamp");
 assert.match(continued, /setSession\(current\);setVerified\(true\);setRecover\(false\)/);
});

test("P3 start verifies server-confirmed open session before showing In progress", () => {
 const source = read("src/components/EmployeeWorkSession.jsx");
 const start = source.match(/async function begin\(\) \{([\s\S]*?)\n  \}/)?.[1];
 assert.ok(start);
 assert.match(start, /const created = await startWork\(me\.org_id,me\.id,place/);
 assert.match(start, /const current = await openSession\(me\.org_id, me\.id\)/);
 assert.match(start, /!created\?\.id \|\| current\?\.id !== created\.id/);
 assert.match(start, /setSession\(current\);setVerified\(true\);setEditor\(false\)/);
});

test("P3 own-work status never shows a confirmed running or absent session after failed verification", () => {
 const component = read("src/components/EmployeeWorkSession.jsx");
 assert.match(component, /loading\?"Checking your existing session…":!verified/);
 assert.match(component, /Work session status unavailable · verification required/);
 assert.match(component, /disabled=\{busy\|\|loading\|\|!verified\}/);
});

test("P3 uncertain Start Work and history reconciliation require an explicit recheck before another write", () => {
 const screen = read("src/components/EmployeeWorkSession.jsx");
 const begin = screen.match(/async function begin\(\) \{([\s\S]*?)\n  \}/)?.[1];
 const continued = screen.match(/async function continueOld\(\) \{([\s\S]*?)\n  \}/)?.[1];
 const closed = screen.match(/async function closeOld\(\) \{([\s\S]*?)\n  \}/)?.[1];
 assert.ok(begin && continued && closed);
 assert.match(begin, /if \(starting\.current \|\| busy \|\| !verified\) return/);
 assert.match(begin, /setVerified\(false\); setEditor\(false\); setReady\(false\)/);
 assert.match(screen, /canStart=\{verified&&\(place/);
 const dialog=read("src/components/StartWorkDialog.jsx");
 assert.match(dialog, /disabled=\{busy \|\| !canStart\}/);
 assert.match(dialog, /if \(!busy && canStart\) onStart\(\)/);
 assert.match(continued, /setVerified\(false\); setRecover\(false\)/);
 assert.match(closed, /setVerified\(false\)/);
 assert.doesNotMatch(closed, /catch\(e\) \{[\s\S]*setRecover\(false\)/, "A failed correction must retain its form");
 assert.match(screen, /Retry session verification/);
});

test("P3 Manager and Admin Workforce do not fabricate zero session evidence on failed reads", () => {
 const source = read("src/screens/Workforce.jsx");
 assert.match(source, /const sessionReadFailed=Boolean\(datasetErrors\.sessions\)/);
 assert.equal((source.match(/meta=\{sessionReadFailed\?"Evidence unavailable":sessions\.length\+" records"\}/g) || []).length, 1);
 assert.equal((source.match(/meta=\{sessionReadFailed\?"Evidence unavailable":flaggedSessions\.length\+" records"\}/g) || []).length, 2);
 assert.equal((source.match(/!sessions\.length&&!sessionReadFailed&&<WorkforceEmpty/g) || []).length, 1);
 assert.equal((source.match(/!flaggedSessions\.length&&!sessionReadFailed&&<WorkforceEmpty/g) || []).length, 2);
 assert.match(source, /meta=\{sessionReadFailed\?"Evidence unavailable":\(sessionProfileFocus\?sessions\.filter\(x=>x\.profile_id===sessionProfileFocus\):sessions\)\.length\+" records"\}/);
 assert.match(source, /!\(sessionProfileFocus\?sessions\.some\(row=>row\.profile_id===sessionProfileFocus\):sessions\.length\)&&!sessionReadFailed&&<WorkforceEmpty/);
 assert.match(source, /sessionReadFailed\?"session evidence unavailable":facts\.first/);
});


test("P3 Start Work refuses unknown places and rejects other employees' or tenants' off-site tasks before location capture",()=>{
 const api=read("src/lib/session.js");
 const body=api.match(/export async function startWork\(orgId, userId, place, workItemId, officeLocationId = null, offsiteLocationName = ""\) \{([\s\S]*?)\n\}/)?.[1];
 assert.ok(body);
 assert.match(body,/place !== "office" && place !== "elsewhere"/);
 assert.match(body,/if \(place === "elsewhere" && workItemId\)/);
 assert.doesNotMatch(body,/if \(!workItemId\) throw/);
 assert.match(body,/\.eq\("org_id",orgId\)\.eq\("assignee_id",userId\)\.eq\("id",workItemId\)/);
 assert.match(body,/\.in\("status",\["not_started","in_progress","returned"\]\)/);
 assert.match(body,/if \(assignmentError \|\| !assigned\?\.id\)/);
 assert.ok(body.indexOf("assignmentError")<body.indexOf("const pos = await getPositionOnce()"));
});

test("P3 Staff session actions require authoritative exact-row verification before another Start or End",()=>{
 const home=read("src/screens/Home.jsx");
 const view=read("src/experience-v2/staff-today/StaffTodayV2.jsx");
 assert.match(home,/import \{ openSession, startWork, endWork, reconcileWorkSession, verifyContinuedWorkSession, WorkStartPreflightError \} from/);
 assert.match(home,/const sessionVerified = verifiedSessionScope === sessionScope/);
 assert.match(home,/const created = await startWork/);
 assert.match(home,/const current = await openSession\(me\.org_id,me\.id\)/);
 assert.match(home,/!created\?\.id \|\| current\?\.id !== created\.id/);
 assert.match(home,/await endWork\(session\.id\);\s*await verifyEndedSession\(session\.id\)/);
 assert.match(home,/\.eq\("profile_id",me\.id\)\.eq\("id",id\)\.maybeSingle\(\)/);
 assert.match(home,/closeError \|\| !closed\?\.ended_at/);
 assert.match(home,/await reconcileWorkSession\(session\.id, "continue"\)/);
 assert.match(home,/await reconcileWorkSession\(session\.id, "close",[\s\S]*?await verifyEndedSession\(session\.id\)/);
 assert.match(home,/setVerifiedSessionScope\(null\)/);
 assert.match(home,/Retry session verification/);
 assert.match(home,/sessionVerified=\{sessionVerified\}/);
 assert.match(view,/sessionVerified = true/);
 assert.match(view,/disabled=\{busy \|\| !sessionVerified\}/);
 assert.match(view,/!sessionVerified \? "Unverified"/);
});

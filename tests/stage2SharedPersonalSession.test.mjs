import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path,"utf8");

test("Manager and Administration Overviews own Start/End Work, not team attendance mutations",()=>{
 const manager=read("src/experience-v2/manager-overview/ManagerOverviewV2.jsx");
 const admin=read("src/experience-v2/admin-overview/AdminOverviewV2.jsx");
 for(const [role,component] of [["Manager",manager],["Administration",admin]]){
   assert.match(component,/import EmployeeWorkSession from/,`${role} must share its own authorised session controls`);
   assert.match(component,/<EmployeeWorkSession me=\{me\} \/>/,`${role} missing personal attendance on Overview`);
 }
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

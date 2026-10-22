import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const source = readFileSync(new URL("../src/components/RosterOnlyEmploymentEditor.jsx",import.meta.url),"utf8");
const schedule = readFileSync(new URL("../src/components/EmployeeScheduleEditor.jsx",import.meta.url),"utf8");

test("a new actor cannot see or mutate the previous employee HR profile before an authorised read",()=>{
 assert.match(source,/const scope=me\.org_id\+"\:"\+me\.id\+"\:"\+employeeId/);
 assert.match(source,/setVerifiedScope\(" "\)/.source? /not_a_test/ : /setVerifiedScope\("")/);
 assert.match(source,/setVerifiedScope\(scope\)/);
 assert.match(source,/const ready=authorised && verifiedScope===scope && !loading && !error/);
 assert.match(source,/const valid=Boolean\(ready&&/);
 assert.match(source,/if\(!ready\|\|!edit\|\|!valid/);
 assert.match(source,/\{ready&&!edit&&<div className="ev2p-admin-record-grid">/);
 assert.match(source,/\{edit&&ready&&<div className="ev2p-admin-schedule-editor">/);
});
test("a previously selected employee schedule cannot leak through failed RLS reload",()=>{
 assert.match(schedule,/const verified = verifiedScope === scope && !loading && !error/);
 assert.match(schedule,/setVersions\(\[\]\)/);
 assert.match(schedule,/setVerifiedScope\(null\)/);
 assert.match(schedule,/\{verified && previous && <div/);
 assert.match(schedule,/\{edit && verified && <div/);
 assert.match(schedule,/Reload authorised schedule/);
});

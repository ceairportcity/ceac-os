import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=(p)=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const people=read("src/screens/People.jsx");
const editor=read("src/components/RosterOnlyEmploymentEditor.jsx");

test("approved selected-person screen keeps the real directory but collapses duplicate long rail",()=>{
 assert.match(people,/<details className="ev2p-admin-master-list" aria-label="Employee directory">/);
 assert.match(people,/<summary className="ev2p-admin-directory-trigger">Switch employee/);
 assert.match(people,/const responsibilitySummary = rosterUnitNames/);
 assert.doesNotMatch(people,/title="Identity & employment state"/);
 assert.match(people,/\{personTab === "overview" && <PeopleWorkspaceSection/);
 assert.match(people,/\{personTab === "access" && <PeopleWorkspaceSection/);
 assert.match(people,/\{personTab === "documents" && <PeopleWorkspaceSection/);
});
test("selected roster-only employee has an in-record edit and separate account action",()=>{
 assert.match(people,/aria-label="Employee record actions"/);
 assert.match(people,/onClick=\{\(\)=>editSelectedEmployment\(\)\}>Edit employee record/);
 assert.match(people,/onClick=\{\(\)=>editSelectedEmployment\("transferred"\)\}>Assign \/ transfer department/);
 assert.match(people,/onClick=\{\(\)=>setPersonTab\("time"\)\}>Work schedule/);
 assert.match(people,/!hasLinkedProfile&&<button[^>]*onClick=\{\(\)=>openAccessAdministration\(null\)\}>Invite account/);
 assert.match(people,/const \[rosterEditRequest,setRosterEditRequest\]/);
 assert.match(people,/editRequest=\{rosterEditRequest.employeeId===person.employee_id\?/);
 assert.match(editor,/editRequest=0/);
 assert.match(editor,/if\(editRequest===consumedEditRequest.current/);
 assert.match(editor,/consumedEditRequest.current=editRequest/);
 assert.doesNotMatch(editor,/\.auth\.signUp\(/);
});

test("selected employee shows canonical HR contact and start date independently of login",()=>{
 assert.match(people,/supabase\.from\("employee_roster"\)/);
 assert.match(people,/\.select\("id,org_id,profile_id,hr_contact_email,hr_contact_phone,hr_started_on"\)/);
 assert.match(people,/hrContactResult\.data\?\.id !== summary\.id/);
 assert.match(people,/hrContactResult\.data\.org_id !== me\.org_id/);
 assert.match(people,/\(hrContactResult\.data\.profile_id \|\| null\) !== \(summary\.profile_id \|\| null\)/);
 assert.match(people,/hr_contact_email: hrContactResult\.data\.hr_contact_email \|\| null/);
 assert.match(people,/hr_contact_phone: hrContactResult\.data\.hr_contact_phone \|\| null/);
 assert.match(people,/hr_started_on: hrContactResult\.data\.hr_started_on \|\| null/);
 assert.match(people,/title="HR contact email \(not login\)"/);
 assert.match(people,/title="HR contact telephone"/);
 assert.match(people,/title="Employment start date"/);
 assert.doesNotMatch(people,/email: hrContactResult\.data\.hr_contact_email/);
});

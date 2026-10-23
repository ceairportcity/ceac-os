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
 assert.match(people,/!hasLinkedProfile&&<button[^>]*onClick=\{\(\)=>openAccessAdministration\(null,\{/);
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
 assert.doesNotMatch(people,/\n\s*email: hrContactResult\.data\.hr_contact_email/);
});

test("invite entry carries selected roster identity into existing verified invitation form",()=>{
 const access=read("src/components/PeopleAccess.jsx");
 assert.match(people,/setAccessInviteRoster\(profileId \? null : inviteRoster\)/);
 assert.match(people,/initialInviteRoster=\{accessInviteRoster\?\.requestedBy===me\.id && accessInviteRoster\?\.orgId===me\.org_id \? accessInviteRoster : null\}/);
 assert.match(people,/contactEmail:person\.hr_contact_email \|\| ""/);
 assert.match(people,/requestedBy:me\.id/);
 assert.match(people,/orgId:me\.org_id/);
 assert.match(people,/unitId:\(person\.roster_units\|\|\[\]\)\.find\(member=>member\.is_primary\)\?\.unit_id/);
 assert.match(access,/if \(!initialInviteRoster\?\.employeeId \|\| !canManage\) return/);
 assert.match(access,/email: initialInviteRoster\.contactEmail \|\| ""/);
 assert.match(access,/An invitation never links this employee automatically/);
 assert.match(access,/existingAccountEmail \|\| existingInvitationEmail/);
 const prefill=access.slice(access.indexOf("if (!initialInviteRoster?.employeeId"),access.indexOf("  async function load()"));
 assert.ok(prefill.length>0);
 assert.doesNotMatch(prefill,/inviteByEmail|resendStaffInvitation/);
});

test("private roster invitation context cannot survive actor or externally selected access scope",()=>{
 assert.match(people,/setAccessInviteRoster\(null\);\s*void load\(\);/);
 assert.match(people,/setAccessFocusMode\(accessIntent\.mode \|\| null\);\s*setAccessInviteRoster\(null\);/);
 assert.match(people,/setAccessInviteRoster\(profileId \? null : inviteRoster\);/);
});

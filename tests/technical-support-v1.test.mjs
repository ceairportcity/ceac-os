import test from "node:test";
import assert from "node:assert/strict";
import {supportCasePeople} from "../src/lib/supportCasePeople.js";
import {
  HELP_CATEGORIES, SUPPORT_WORKSPACES, SUPPORT_GUIDES, SERVICE_NAMES,
  canManageSupport, supportCaseGroups, supportCategoryLabel, filterSupportCases, supportCasesNeedingMe, supportUnavailableMessage, canRecordSupportOutcome, supportReportedServiceIssues,
} from "../src/lib/technicalSupport.js";

test("triage resolves only RLS-visible names and searches the resolved reporter/department", async()=>{
 const calls=[];
 const client={from(table){return {select(fields){calls.push({table,fields});return {in:async()=>({data:table==='profiles'?[{id:'reporter',full_name:'Synthetic reporter'}]:[{id:'unit',name:'IT'}]})};}};}};
 const cases=await supportCasePeople(client,[{id:'case',reported_by:'reporter',affected_profile_id:'reporter',affected_unit_id:'unit'}]);
 assert.equal(cases[0].reporter_name,'Synthetic reporter');assert.equal(cases[0].department_name,'IT');
 assert.equal(filterSupportCases(cases,'reporter').length,1);assert.equal(filterSupportCases(cases,'IT').length,1);
 assert.deepEqual(calls,[{table:'profiles',fields:'id,full_name'},{table:'units',fields:'id,name'}]);
});
test("denied directory results retain the case without inventing reporter identity",async()=>{
 const client={from(){return {select(){return {in:async()=>({error:{message:'Denied'},data:null})};}};}};
 const [item]=await supportCasePeople(client,[{id:'case',reported_by:'hidden',affected_unit_id:'hidden-unit'}]);
 assert.equal(item.id,'case');assert.equal(item.reporter_name,null);assert.equal(item.department_name,null);
});

test("support panel has the six locked workspaces and categories", () => {
  assert.deepEqual(SUPPORT_WORKSPACES.map((item) => item.label),
    ["Home", "Help Desk", "People & Access", "System", "Improvements", "Guides"]);
  assert.equal(HELP_CATEGORIES.length, 6);
  assert.equal(SUPPORT_GUIDES.length, 11);
  assert.equal(SERVICE_NAMES.length, 7);
  assert.equal(supportCategoryLabel("access_needed"), "I need access to something");
});

test("support capability is narrow and absent from ordinary employment roles", () => {
  assert.equal(canManageSupport({ role: "manager", is_admin: true, capabilities: ["people.manage"] }), false);
  assert.equal(canManageSupport({ role: "staff", capabilities: ["support.case.manage"] }), true);
  assert.equal(canManageSupport({ capabilities: [] }), false);
  assert.equal(canManageSupport(null), false);
});

test("cases are grouped only by facts; unresolved approval is not marked resolved", () => {
  const cases = [
    { id: "a", category: "cannot_sign_in", state: "open" },
    { id: "b", category: "cannot_sign_in", state: "waiting_approval" },
    { id: "c", category: "access_needed", state: "resolved" },
    { id: "d", category: "other", state: "in_progress" },
    { id: "e", category: "other", state: "closed" },
  ];
  const result = supportCaseGroups(cases);
  assert.deepEqual(result.attention.map((x) => x.id), ["a", "d"]);
  assert.deepEqual(result.waitingApproval.map((x) => x.id), ["b"]);
  assert.deepEqual(result.recentlyResolved.map((x) => x.id), ["c", "e"]);
  assert.equal(result.access.length, 3);
  assert.deepEqual(result.recurring.map((x) => x.id), ["cannot_sign_in", "other"]);
});

test("Help Desk filters only already-authorised loaded cases without changing their order", () => {
  const cases = [
    { id: "a", state: "open", category: "cannot_sign_in", summary: "Password reset", reference: "TS-123" },
    { id: "b", state: "resolved", category: "cannot_upload", summary: "PDF upload", reference: "TS-456" },
    { id: "c", state: "open", category: "access_needed", summary: "Unit access", reference: "TS-789" },
  ];
  assert.deepEqual(filterSupportCases(cases, "ts-456").map((item) => item.id), ["b"]);
  assert.deepEqual(filterSupportCases(cases, "cannot sign in", "open").map((item) => item.id), ["a"]);
  assert.deepEqual(filterSupportCases(cases, "access", "open").map((item) => item.id), ["c"]);
  assert.deepEqual(filterSupportCases(cases, "", "open").map((item) => item.id), ["a", "c"]);
  assert.deepEqual(filterSupportCases(cases, "pdf", "open"), []);
  assert.deepEqual(filterSupportCases(null), []);
  assert.deepEqual(cases.map((item) => item.id), ["a", "b", "c"]);
});

test("personal Support home excludes colleagues' assignments and awaiting approval", () => {
  const cases = [
    { id: "own", state: "in_progress", assigned_to: "me" },
    { id: "new", state: "open", assigned_to: null },
    { id: "theirs", state: "open", assigned_to: "other" },
    { id: "approval", state: "waiting_approval", assigned_to: "me" },
    { id: "closed", state: "closed", assigned_to: "me" },
    { id: "resolved", state: "resolved", assigned_to: null },
  ];
  assert.deepEqual(supportCasesNeedingMe(cases, "me").map((item) => item.id), ["own", "new"]);
  assert.deepEqual(supportCasesNeedingMe(cases, "other").map((item) => item.id), ["new", "theirs"]);
  assert.deepEqual(supportCasesNeedingMe(null, "me"), []);
  assert.deepEqual(supportCasesNeedingMe(cases, null).map((item) => item.id), ["new"]);
});

test("unavailable support schema has a truthful safe message", () => {
  for (const code of ["PGRST205", "42P01"]) {
    const message = supportUnavailableMessage({ code });
    assert.match(message, /not enabled in this environment/);
    assert.doesNotMatch(message, /permission denied|not found|SQL/i);
  }
  assert.equal(supportUnavailableMessage({ code: "42501" }), null);
  assert.equal(supportUnavailableMessage({ code: "PGRST301" }), null);
  assert.equal(supportUnavailableMessage(null), null);
});

test("case closure cannot imply unverified business access approval", () => {
  for (const state of ["resolved", "closed"]) {
    assert.equal(canRecordSupportOutcome({ category: "access_needed" }, state), false);
  }
  for (const state of ["open", "waiting_approval", "in_progress"]) {
    assert.equal(canRecordSupportOutcome({ category: "access_needed" }, state), true);
  }
  assert.equal(canRecordSupportOutcome({ category: "cannot_sign_in" }, "resolved"), true);
  assert.equal(canRecordSupportOutcome(null, "closed"), true);
  assert.equal(canRecordSupportOutcome({ id: "case-1", category: "access_needed" }, "resolved", {
    state: "executed", approved_by: "approver", executed_by: "operator",
    execution_reference: 12345678, case_id: "case-1",
  }), false);
  assert.equal(canRecordSupportOutcome({ id: "case-1", category: "access_needed" }, "resolved", {
    state: "executed", approved_by: "approver", executed_by: "operator",
    execution_reference: "TICKET-1234", case_id: "case-1",
  }), true);

});


test("system health never manufactures uptime from self-reported support incidents", () => {
  const incidents = [
    { state: "open", affected_service: "CEAC platform" },
    { state: "waiting_approval", affected_service: "CEAC platform" },
    { state: "resolved", affected_service: "CEAC platform" },
    { state: "in_progress", affected_service: "Files & uploads" },
    { state: "open", affected_service: "Other service" },
  ];
  const counts = supportReportedServiceIssues(incidents);
  assert.equal(counts.length, SERVICE_NAMES.length);
  assert.deepEqual(counts.find((x) => x.service === "CEAC platform"), {
    service: "CEAC platform", reportCount: 2, health: "Not verified",
  });
  assert.equal(counts.find((x) => x.service === "Files & uploads").reportCount, 1);
  assert.equal(counts.find((x) => x.service === "Automatic jobs").reportCount, 0);
  assert.ok(counts.every((x) => x.health === "Not verified"));
  assert.deepEqual(supportReportedServiceIssues(null, ["CEAC platform"]), [
    { service: "CEAC platform", reportCount: 0, health: "Not verified" },
  ]);
});

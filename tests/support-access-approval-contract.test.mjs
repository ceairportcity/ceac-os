import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { canRecordSupportOutcome } from "../src/lib/technicalSupport.js";

const read=(path)=>readFileSync(path,"utf8");
const migration=read("supabase/migrations/20261011190000_135_support_access_approval_execution_ledger.sql");
const gate=read("supabase/tests/support_access_approval_execution_gate.sql");
const runner=read("scripts/ci/run-sql-security-gates.sh");
const support=read("src/screens/TechnicalSupport.jsx");
const supportActions=read("src/components/SupportAccessCaseActions.jsx");
const approvals=read("src/components/SupportAccessApprovals.jsx");
const admin=read("src/screens/AdminHome.jsx");
const manager=read("src/screens/ManagerHome.jsx");
const peopleAccess=read("src/components/PeopleAccess.jsx");
const technicalHelp=read("src/screens/TechnicalHelp.jsx");

test("business approval and support execution are different attributable transitions",()=>{
  assert.match(migration,/CREATE TABLE public\.support_access_requests/);
  assert.match(migration,/CREATE TABLE public\.support_access_events/);
  assert.match(migration,/CREATE POLICY support_access_create/);
  assert.match(migration,/CREATE POLICY support_access_transition/);
  assert.match(migration,/OLD\.state='pending' AND NEW\.state IN \('approved','declined'\)/);
  assert.match(migration,/OLD\.state='approved' AND NEW\.state='executed'/);
  assert.match(migration,/NEW\.version:=OLD\.version\+1/);
  assert.match(migration,/actor=OLD\.requested_by OR actor=c\.assigned_to/);
  assert.match(migration,/support_actor OR actor=OLD\.requested_by/);
  assert.match(migration,/app_has_capability\('support\.access\.apply_approved',NULL\)/);
  assert.match(migration,/app_has_capability\('people\.manage',NULL\)/);
  assert.match(migration,/target_unit_id IN \(SELECT public\.app_managed_units\(\)\)/);
  assert.match(migration,/EXISTS \(\s*SELECT 1 FROM public\.support_access_requests ar/);
});

test("ledger cannot write permissions, impersonate actors or expose trigger internals",()=>{
  assert.doesNotMatch(migration,/INSERT INTO public\.(capability_grants|pending_invitations|unit_memberships|auth\.users)/i);
  assert.doesNotMatch(migration,/GRANT (?:EXECUTE|ALL) ON FUNCTION public\.support_access_/i);
  assert.match(migration,/REVOKE ALL ON FUNCTION public\.support_access_request_guard\(\) FROM PUBLIC,anon,authenticated/);
  assert.match(migration,/REVOKE ALL ON public\.support_access_events FROM PUBLIC,anon,authenticated/);
  assert.match(migration,/CREATE TRIGGER support_access_events_immutable/);
  assert.match(migration,/support\.access\.apply_approved/);
  assert.match(migration,/case_id uuid NOT NULL UNIQUE/);
  assert.match(migration,/NEW\.access_object:=CASE NEW\.requested_action/);
  assert.match(migration,/Unit workspace access troubleshooting/);
  assert.match(migration,/Invitation delivery troubleshooting/);
  assert.match(migration,/Account access recovery assistance/);
  assert.match(migration,/NEW\.requested_by:=actor/);
  assert.match(migration,/NEW\.approved_by:=actor/);
  assert.match(migration,/NEW\.executed_by:=actor/);
  assert.match(migration,/current case holder or Support Lead/);
});

test("authenticated role gate proves denial, approval, execution and ordinary-incident isolation",()=>{
  assert.match(runner,/support_access_approval_execution_gate\.sql/);
  assert.match(gate,/^BEGIN;/m);
  assert.match(gate,/^ROLLBACK;/m);
  assert.match(gate,/SET LOCAL ROLE authenticated;/);
  assert.match(gate,/Support operator business-approved its own request/);
  assert.match(gate,/Second access request for the same case was accepted/);
  assert.match(gate,/Support selected a different organisation access unit/);
  assert.match(gate,/Untrusted client supplied a business-approval label/);
  assert.match(gate,/Unrelated Unit B manager approved Unit A request/);
  assert.match(gate,/Actual Unit Manager approval was not recorded/);
  assert.match(gate,/Stale version wrote access execution/);
  assert.match(gate,/Approved technical execution was not recorded with split actors/);
  assert.match(gate,/Normal incident was blocked by access ledger/);
  assert.match(gate,/Immutable request\/approval\/execution history is incomplete/);
});

test("UI separates business decisions from technical assistance and never suggests a new grant",()=>{
  assert.match(supportActions,/\.from\("support_access_requests"\)/);
  assert.match(supportActions,/\.eq\("version", visible\.version\)/);
  assert.match(supportActions,/support\.access\.apply_approved/);
  assert.match(supportActions,/Business owners decide/);
  assert.match(supportActions,/does not create accounts or grant permissions/);
  assert.match(approvals,/\.eq\("state", "pending"\)/);
  assert.match(approvals,/\.eq\("version", request\.version\)/);
  assert.match(approvals,/Approving|Approve support action/);
  assert.doesNotMatch(admin,/SupportAccessApprovals/);
  assert.doesNotMatch(manager,/SupportAccessApprovals/);
  assert.match(peopleAccess,/mode === "technical-support"[\s\S]*SupportAccessApprovals me=\{me\} authority="people_administration"/);
  assert.match(technicalHelp,/SupportAccessApprovals me=\{me\} authority="unit_manager"/);
  assert.match(support,/SupportAccessCaseActions item=\{item\}/);
  assert.match(support,/accessLedger/);
  assert.doesNotMatch(supportActions,/\.from\("capability_grants"\)\.(?:insert|update)/);
});

test("closure UI needs an executed ledger; normal incidents remain independent",()=>{
  const caseRecord={id:"case-a",category:"access_needed"};
  assert.equal(canRecordSupportOutcome(caseRecord,"resolved"),false);
  assert.equal(canRecordSupportOutcome(caseRecord,"closed",{state:"approved"}),false);
  assert.equal(canRecordSupportOutcome(caseRecord,"resolved",{
    state:"executed",case_id:"case-a",approved_by:"business",executed_by:"support",
    execution_reference:"APPROVED-12345"
  }),true);
  assert.equal(canRecordSupportOutcome(caseRecord,"closed",{
    state:"executed",case_id:"case-a",approved_by:"same",executed_by:"same",
    execution_reference:"APPROVED-12345"
  }),false);
  assert.equal(canRecordSupportOutcome({category:"cannot_sign_in"},"resolved"),true);
});

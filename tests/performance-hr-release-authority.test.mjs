import assert from "node:assert/strict";
import test from "node:test";
import { readdirSync, readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL("../"+path,import.meta.url),"utf8");
const sql=read("supabase/migrations/20261014224500_144_hr_performance_release.sql");
const source=read("src/screens/Performance.jsx");

test("only one version 144 performance migration is present",()=>{
  const files=readdirSync(new URL("../supabase/migrations/",import.meta.url))
    .filter(name => name.startsWith("20261014224500_144"));
  assert.deepEqual(files,["20261014224500_144_hr_performance_release.sql"]);
  assert.doesNotMatch(sql,/as \$\s*\n|\n\$;/);
  assert.match(sql,/language sql stable security definer set search_path=''\s+as \$\$/);
});

test("Manager can request but cannot directly publish narrative",()=>{
  assert.match(source,/rpc\("performance_request_release"/);
  assert.doesNotMatch(source,/rpc\("share_performance_review"/);
  assert.match(sql,/create or replace function public\.performance_request_release/);
  assert.match(sql,/v_review\.manager_id is distinct from v_actor/);
  assert.match(sql,/create or replace function public\.share_performance_review/);
  assert.match(sql,/raise exception 'Manager requests assessment release; HR authorises publication\.'/);
});

test("HR is a separate, authorised approver and approval pins the exact assessment version",()=>{
  assert.match(sql,/not public\.app_is_admin\(\)/);
  assert.match(sql,/not public\.app_has_capability\('people\.manage',null\)/);
  assert.match(sql,/v_actor=v_request\.requested_by/);
  assert.match(sql,/v_latest is distinct from v_request\.requested_assessment_id/);
  assert.match(sql,/unique index if not exists performance_release_one_pending_idx/);
  assert.match(source,/rpc\("performance_hr_decide_release"/);
  assert.match(source,/currentReleaseRequest\.requested_by === me\.id/);
  assert.match(source,/Approve release to employee/);
});

test("unpublished manager narratives and development plans are protected by RLS",()=>{
  assert.match(sql,/drop policy if exists stage7_entries_read/);
  assert.match(sql,/appraisal_entries\.entry_type not in \('manager_assessment','conversation_record'\)/);
  assert.match(sql,/performance_employee_release_visible\(/);
  assert.match(sql,/drop policy if exists stage7_development_read/);
  assert.match(sql,/profile_id=auth\.uid\(\)\s+and public\.performance_employee_release_visible\(appraisal_id,created_at\)/);
  assert.match(sql,/revoke select on public\.appraisals from public,anon,authenticated/);
  assert.doesNotMatch(sql,/grant select\([^;]*(assessment|development_notes)/);
  const entriesPolicy=sql.slice(sql.indexOf("create policy stage7_entries_read"),sql.indexOf("revoke select on public.appraisals"));
  assert.doesNotMatch(entriesPolicy,/app_has_capability\('performance\.admin'/);
  assert.match(entriesPolicy,/public\.app_is_admin\(\) and public\.app_has_capability\('people\.manage',null\)/);
});

test("review UI does not claim publication while pending",()=>{
  assert.match(source,/performance_review_release_requests/);
  assert.match(source,/The manager\x27s assessment release request was recorded for HR review/);
  assert.match(source,/HR publication decision/);
  assert.match(source,/HR is reviewing the current manager release request/);
  assert.match(source,/!approvedCurrentAssessment/);
});

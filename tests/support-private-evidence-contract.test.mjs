import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read=(path)=>readFileSync(path,"utf8");
const migration=read("supabase/migrations/20261011195500_137_support_private_case_evidence.sql");
const gate=read("supabase/tests/support_private_case_evidence_gate.sql");
const runner=read("scripts/ci/run-sql-security-gates.sh");
const panel=read("src/screens/TechnicalSupport.jsx");
const core=read("src/lib/operationalFiles.js");

test("support evidence extends approved operational bucket without introducing HR storage paths",()=>{
  assert.match(migration,/operational_file_links_context_relation_check/);
  assert.match(migration,/\(context_type='support_case' and relation='support_evidence'\)/);
  assert.match(migration,/when 'support_case' then public\.app_can_read_support_case\(p_context_id\)/);
  assert.match(migration,/when 'support_case' then public\.app_can_write_support_case\(p_context_id\)/);
  assert.match(migration,/A Support case can use only evidence registered to that case/);
  assert.match(migration,/Support evidence cannot be linked to another context/);
  assert.match(migration,/ceac-operational-private/);
  assert.doesNotMatch(migration,/ceac-hr-private/);
  assert.doesNotMatch(migration,/GRANT\s+SELECT\s+ON\s+hr_private\./i);
});

test("case access requires current membership plus case capability; author-only upload",()=>{
  assert.match(migration,/public\.app_has_capability\('support\.case\.manage',NULL\)/);
  assert.match(migration,/tm\.active/);
  assert.match(migration,/operator\.active/);
  assert.match(migration,/sc\.id=p_case_id and sc\.org_id=public\.app_org_id\(\)/);
  assert.match(migration,/sc\.state not in \('resolved','closed'\)/);
  assert.match(migration,/sc\.assigned_to=auth\.uid\(\)/);
  assert.match(migration,/tm\.active and tm\.role='lead'/);
  assert.match(migration,/revoke all on function public\.app_can_read_support_case\(uuid\)\s+from public,anon,authenticated/);
  assert.match(migration,/revoke all on function public\.app_can_write_support_case\(uuid\)\s+from public,anon,authenticated/);
  assert.doesNotMatch(migration,/grant execute on function public\.app_can_read_support_case\(uuid\) to authenticated/i);
});

test("Support uses existing upload and private signed URL architecture",()=>{
  assert.match(panel,/OperationalFileList key=\{`\$\{me\.org_id\}:\$\{me\.id\}:\$\{item\.id\}`\} contextType="support_case" contextId=\{item\.id\}/);
  assert.match(panel,/relation="support_evidence"/);
  assert.match(panel,/canUpload=\{item\.state !== "closed" && item\.state !== "resolved"/);
  assert.match(core,/register_operational_file/);
  assert.match(core,/finalize_operational_file/);
  assert.match(core,/createSignedUrl/);
  assert.doesNotMatch(panel,/storage\.from\("ceac-hr-private"\)/);
});

test("SQL rollback gate proves reporter and manager denied and Support evidence scoped",()=>{
  assert.match(runner,/support_private_case_evidence_gate\.sql/);
  assert.match(gate,/^BEGIN;/m);
  assert.match(gate,/^ROLLBACK;/m);
  assert.match(gate,/SET LOCAL ROLE authenticated;/);
  assert.match(gate,/Reporter registered internal Support private evidence/);
  assert.match(gate,/Assigned Support operator lacks case evidence access/);
  assert.match(gate,/Support evidence was not registered in private bucket/);
  assert.match(gate,/Support evidence used protected employee file relation/);
  assert.match(gate,/Manager could read internal Support private evidence/);
});

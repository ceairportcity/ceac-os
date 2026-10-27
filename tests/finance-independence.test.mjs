import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(path,'utf8');
const migration=read('supabase/migrations/20261027125202_finance_independent_requests_and_receipts.sql');
test('funds requests preserve independent identities, stages and serialised fulfilment',()=>{
 assert.match(migration,/r\.requested_by=auth\.uid\(\)/);
 assert.match(migration,/new\.independent_path:=case when public\.app_is_admin\(\) then array\['finance','exec'\]/);
 assert.match(migration,/new\.state<>'submitted'/);
 assert.match(migration,/new\.independent_path is distinct from old\.independent_path/);
 assert.equal((migration.match(/where id = p_request_id for update/g)||[]).length,2);
 assert.match(migration,/d\.decider_id = auth\.uid\(\)/);
 assert.match(migration,/p_decision='declined'.*nullif\(btrim\(p_note\)/);
 assert.doesNotMatch(migration,/create or replace function (public\.)?(finance_request_path|unit_budget_position)/i);
});
test('receipt authority covers registration, current Storage insertion, finalisation and non-portable links',()=>{
 assert.match(migration,/app_can_attach_spend_receipt\(p_spend_id uuid\)[\s\S]*?security invoker/);
 assert.match(migration,/create policy expense_receipt_current_writer on storage\.objects[\s\S]*?as restrictive for insert/i);
 assert.match(migration,/l\.context_type in \('routine_date_progress','spend_line'\)/);
 assert.match(migration,/p_context_type='spend_line' and not exists/);
 assert.match(migration,/p_context_type<>'spend_line' or l\.context_id<>p_context_id/);
 assert.match(migration,/not public\.finance_record_is_demo\('spend_lines'/);
 assert.match(read('scripts/ci/run-sql-security-gates.sh'),/finance_independent_requests_receipts_gate\.sql/);
});
test('independent request UI uses recorded server path and excludes self-decisions',()=>{
 const queue=read('src/components/FinanceRequestQueue.jsx');
 assert.match(queue,/return request\.independent_path/);
 assert.match(queue,/request\.requested_by!==me\.id/);
 assert.match(queue,/d\.decider_id===me\.id/);
 const form=read('src/components/AdminFinanceRequests.jsx');
 assert.match(form,/\.eq\('requested_by',me\.id\)/);
 assert.match(form,/<fieldset disabled=\{busy\}/);
 assert.match(form,/setMode\(null\);setDraft\(null\)/);
 assert.doesNotMatch(form,/decide_finance_request|fulfil_finance_request/);
});
test('receipts remain optional and attach only to recorded spend identities',()=>{
 const cost=read('src/screens/Cost.jsx');
 assert.match(cost,/contextType="spend_line" contextId=\{receiptExpense\.id\} relation="expense_receipt"/);
 assert.match(cost,/canUpload=\{me\.is_admin\|\|financeUnits\.includes\(receiptExpense\.unit_id\)\}/);
 assert.match(cost,/Receipts are optional and do not change the recorded amount/);
 assert.match(read('src/App.jsx'),/<Finance key=\{`\$\{me\.org_id\}:\$\{me\.id\}`\}/);
});

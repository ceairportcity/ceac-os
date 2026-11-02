import { test } from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {pathToFileURL} from 'node:url';
const {canSelfCertifyOwnWork}=await import(pathToFileURL(process.cwd()+'/src/lib/workCompletion.js'));
test('assigned manager can finish own executive-assigned task, but staff cannot',()=>{
 const item={assignee_id:'head',assigned_by:'executive',origin:'assigned_by_exec',unit_id:'unit-1'};
 assert.equal(canSelfCertifyOwnWork({id:'head',memberships:[{unit_id:'unit-1',role:'manager'}]},item),true);
 assert.equal(canSelfCertifyOwnWork({id:'head',memberships:[{unit_id:'unit-1',role:'staff'}]},item),false);
 assert.equal(canSelfCertifyOwnWork({id:'head',memberships:[{unit_id:'unit-2',role:'manager'}]},item),false);
 assert.equal(canSelfCertifyOwnWork({id:'other',is_admin:true},item),false);
});
test('pending manager review can finish with history preserved',()=>{
 const ui=readFileSync('src/screens/Item.jsx','utf8');
 const sql=readFileSync('supabase/migrations/20261101211000_manager_own_work_review_release.sql','utf8');
 assert.match(ui,/managerOwnWork && item.status === "in_review"/);
 assert.match(sql,/select 1 from submissions s/);
 assert.match(sql,/not exists \(select 1 from reviews r/);
 assert.match(sql,/INSERT INTO activity_events|insert into activity_events/);
 assert.doesNotMatch(sql,/DELETE FROM\s+submissions/i);
});

test('reconciled guard only lets the assigned unit manager finish executive work',()=>{
 const sql=readFileSync('supabase/migrations/20261101233000_manager_work_guard_reconciliation.sql','utf8');
 assert.match(sql,/CREATE OR REPLACE FUNCTION public\.guard_executive_work_self_certification\(\)/i);
 assert.match(sql,/OLD\.assignee_id IS DISTINCT FROM auth\.uid\(\)/i);
 assert.match(sql,/m\.profile_id = auth\.uid\(\)/i);
 assert.match(sql,/m\.unit_id = OLD\.unit_id/i);
 assert.match(sql,/m\.role = 'manager'/i);
 assert.match(sql,/ERRCODE = '42501'/i);
 assert.doesNotMatch(sql,/drop\s+trigger|disable\s+trigger|delete\s+from\s+(submissions|reviews)/i);
});

test('mobile attendance review remains readable and factually qualified',()=>{
 const ui=readFileSync('src/components/WorkforceTodayReviewList.jsx','utf8');
 const css=readFileSync('src/experience-v2/workforce-family/workforce-family.css','utf8');
 assert.match(ui,/How to read these records/);
 assert.match(ui,/Missing a start is not proof of absence or lateness/);
 assert.match(css,/ev2wf-today-review-entry>td:nth-of-type\(1\)::before/);
 assert.match(css,/ev2wf-today-review-entry>td:last-child/);
 assert.match(css,/ev2wf-today-review-entry \.btn\{min-height:44px;scroll-margin-block:96px\}/);
});

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

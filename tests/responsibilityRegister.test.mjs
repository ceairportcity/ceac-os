import test from 'node:test';
import assert from 'node:assert/strict';
import { filterResponsibilities, groupResponsibilities } from '../src/lib/responsibilityRegister.js';

test('waiting-on and returned records stay separate from work in progress',()=>{
  const rows=[{id:1,status:'waiting_on'},{id:2,status:'in_progress'},{id:3,status:'returned'},
    {id:4,status:'self_certified'},{id:5,status:'cancelled'},{id:6,status:'not_started'}];
  const groups=Object.fromEntries(groupResponsibilities(rows).map(g=>[g.title,g.items.map(r=>r.id)]));
  assert.deepEqual(groups['Waiting & review'],[1,3]);
  assert.deepEqual(groups['In progress'],[2]);
  assert.deepEqual(groups.Completed,[4]);
  assert.deepEqual(groups.Archived,[5]);
  assert.deepEqual(groups.Upcoming,[6]);
});

test('project filters use identities even when two projects share the same name',()=>{
  const rows=[{id:1,project_id:'a',projects:{name:'Outreach'},title:'Print books',status:'in_progress'},
    {id:2,project_id:'b',projects:{name:'Outreach'},title:'Print books',status:'waiting_on'}];
  assert.deepEqual(filterResponsibilities(rows,{projectId:'b',query:' PRINT ',status:'waiting_on'}).map(r=>r.id),[2]);
  assert.deepEqual(filterResponsibilities(rows,{projectId:'a',status:'waiting_on'}),[]);
  assert.equal(rows.length,2);
});

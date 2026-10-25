import test from 'node:test';
import assert from 'node:assert/strict';
import {complianceReviewQueue} from '../src/lib/complianceReviewQueue.js';
test('review desk includes only unresolved recorded cases and current pending decisions',()=>{
 const cases=['open','referred','disputed','resolved'].map((status,id)=>({id,status,employee_name:'Employee',category:'missing_evidence'}));
 const evidence=['submitted','verified','rejected'].map((state,id)=>({id,state}));
 const exceptions=['requested','approved','declined'].map((state,id)=>({id,state}));
 const queue=complianceReviewQueue(cases,evidence,exceptions);
 assert.deepEqual(queue.map(row=>row.kind),['attendance','attendance','attendance','evidence','exceptions']);
 assert.equal(new Set(queue.map(row=>row.key)).size,5);
 assert.equal(queue[0].record,cases[0]);
 assert.equal(queue[0].title,'Missing attendance evidence');
 assert.equal(queue[3].record,evidence[0]);
 assert.equal(queue[4].record,exceptions[0]);
});
test('empty evidence does not manufacture cases or personal scores',()=>{
 assert.deepEqual(complianceReviewQueue(),[]);
 const queue=complianceReviewQueue([],[{id:'e',state:'submitted',profile:{full_name:'Person'},requirement:{title:'Safety certificate'}}]);
 assert.equal(queue[0].person,'Person');assert.equal(queue[0].title,'Safety certificate');
 assert.ok(!queue.some(row=>'score' in row));
});

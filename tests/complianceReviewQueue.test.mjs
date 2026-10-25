import test from 'node:test';
import assert from 'node:assert/strict';
import {complianceReviewQueue,compliancePersonOptions,withCompliancePersonNames} from '../src/lib/complianceReviewQueue.js';
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

test('Compliance names use exact authorised profile IDs when the wider private profile join is withheld',()=>{
 const people=compliancePersonOptions([{id:'operator',full_name:'Operator'}],[{profile_id:'employee',name:'Employee A'},{profile_id:null,name:'Roster only'}]);
 assert.deepEqual(people.map(p=>p.id),['employee','operator']);
 const original={id:'evidence',profile_id:'employee',profile:null,state:'submitted'};
 const [record]=withCompliancePersonNames([original],people);
 assert.equal(record.profile.full_name,'Employee A');assert.equal(record.id,original.id);
 assert.equal(original.profile,null);
 assert.equal(complianceReviewQueue([],[record])[0].person,'Employee A');
 assert.equal(withCompliancePersonNames([{profile_id:'unrelated',profile:null}],people)[0].profile,null);
 const joined={profile_id:'employee',profile:{full_name:'Existing authorised name'}};
 assert.equal(withCompliancePersonNames([joined],people)[0],joined);
});

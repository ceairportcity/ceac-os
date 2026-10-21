import test from 'node:test';
import assert from 'node:assert/strict';
import {readRoutineDateProgress,routineEvidenceLinks} from '../src/lib/routineDateProgress.js';
const scope={orgId:'org',operationId:'operation',date:'2026-10-21'};
const row=(n)=>({id:'entry-'+n,org_id:'org',operation_id:'operation',scheduled_on:scope.date,entry_number:n,
 actor_id:'actor',recorded_at:'2026-10-21T20:00:00Z',status:'in_progress',completed_step_ids:[],checklist_snapshot:[],evidence_links:[]});
function clientFor(pages){let calls=0; const client={from(name){assert.equal(name,'routine_date_progress');return {
 select(fields,options){assert.equal(options.count,'exact');return this;},eq(){return this;},order(){return this;},
 async range(){return pages[calls++];},
 };}};return client;}
test('date history reads every declared page and preserves independent order',async()=>{
 const rows=Array.from({length:101},(_,i)=>row(101-i));
 const result=await readRoutineDateProgress(clientFor([{data:rows.slice(0,100),count:101},{data:rows.slice(100),count:101}]),scope);
 assert.equal(result.length,101);assert.equal(result.at(-1).entry_number,1);
});
test('empty history is a verified zero, not an error',async()=>{
 assert.deepEqual(await readRoutineDateProgress(clientFor([{data:[],count:0}]),scope),[]);
});
test('partial and changing provider totals cannot masquerade as complete history',async()=>{
 await assert.rejects(()=>readRoutineDateProgress(clientFor(Array.from({length:20},()=>({data:[],count:1}))),scope),/incomplete/);
 await assert.rejects(()=>readRoutineDateProgress(clientFor([{data:[row(2)],count:2},{data:[row(1)],count:3}]),scope),/verified/);
});
test('wrong date, organisation, operation and missing history versions are refused',async()=>{
 for(const edit of [{scheduled_on:'2026-10-20'},{org_id:'other'},{operation_id:'other'},{entry_number:3}])
  await assert.rejects(()=>readRoutineDateProgress(clientFor([{data:[{...row(1),...edit}],count:1}]),scope),/incomplete/);
});
test('duplicate rows and untrusted evidence protocols are refused',async()=>{
 await assert.rejects(()=>readRoutineDateProgress(clientFor([{data:[row(2),{...row(1),id:'entry-2'}],count:2}]),scope),/incomplete/);
 await assert.rejects(()=>readRoutineDateProgress(clientFor([{data:[{...row(1),evidence_links:['javascript:alert(1)']}],count:1}]),scope),/web links/);
});
test('evidence links remain bounded plain web references',()=>{
 assert.deepEqual(routineEvidenceLinks(' https://example.org/proof\n\nhttp://example.org/second '),['https://example.org/proof','http://example.org/second']);
 assert.throws(()=>routineEvidenceLinks('https://example.org/a b'),/web links/);
 assert.throws(()=>routineEvidenceLinks(Array(6).fill('https://example.org').join('\n')),/web links/);
});

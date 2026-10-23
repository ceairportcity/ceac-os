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

test('a delayed previous-date schedule cannot replace the selected skipped date',async()=>{
 const {readFileSync}=await import('node:fs');
 const source=readFileSync('src/components/RoutineDateProgress.jsx','utf8');
 const start=source.indexOf(' useEffect(()=>{');
 const end=source.indexOf(' },[scope,stepKey,reload]);',start);
 assert.ok(start>=0 && end>start);
 const body=source.slice(start+' useEffect(()=>{'.length,end);
 const setters=['setHistory','setVerified','setDateScheduleState','setError','setWriteError','setLimit','setHistoryOpen','setDone','setNote','setLinks','setStatus'];
 const effect=new Function('context','const {'+['readRoutineSchedulePreview','readRoutineCovers','routineCoverKey','setCover','readRoutineDateProgress','supabase','item','routine','date','me','scope','steps',...setters].join(',')+'}=context;'+body);
 let resolveOld,progressReads=0; const state={};
 const oldPreview=new Promise(resolve=>{resolveOld=resolve;});
 const context={readRoutineCovers:async()=>new Map(),routineCoverKey:(id,date)=>id+':'+date,setCover:()=>{},supabase:{},item:{id:'work'},routine:{id:'operation'},date:'2026-10-22',me:{org_id:'org'},scope:'old',steps:[],
  readRoutineSchedulePreview:()=>oldPreview,
  readRoutineDateProgress:async()=>{progressReads++;return [];}};
 for(const name of setters) context[name]=value=>{state[name]=value;};
 const cleanup=effect(context); cleanup();
 effect({...context,date:'2026-10-23',scope:'selected',readRoutineSchedulePreview:async()=>[{operationId:'operation',state:'skipped'}]});
 await new Promise(setImmediate);
 assert.equal(state.setVerified,'selected');assert.equal(state.setDateScheduleState,'skipped');
 resolveOld([{operationId:'operation',state:'scheduled'}]);await new Promise(setImmediate);
 assert.equal(state.setDateScheduleState,'skipped');assert.equal(state.setVerified,'selected');
 assert.equal(progressReads,0,'discard the old date before requesting its progress');
});

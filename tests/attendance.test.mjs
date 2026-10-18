import test from 'node:test';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import {attendanceDate,dailyClocks,startEvidence,presenceCheckpoint} from '../src/lib/attendance.js';
import {getForegroundPosition} from '../src/lib/locationEvidence.js';
test('foreground collection never prompts without a granted permission and failures are factual',async()=>{
  let reads=0;
  const read=async()=>{reads++;return {lat:0,lng:0};};
  for(const nav of [null,{}, {permissions:{query:async()=>({state:'prompt'})}}, {permissions:{query:async()=>{throw Error('unsupported');}}}]) {
    assert.ok((await getForegroundPosition(nav,read)).failure);
  }
  assert.match((await getForegroundPosition({permissions:{query:async()=>({state:'denied'})}},read)).failure,/denied/);
  assert.equal(reads,0);
  assert.equal((await getForegroundPosition({permissions:{query:async()=>({state:'granted'})}},read)).lat,0);
  assert.equal(reads,1);
});
test('day-specific clocks override legacy clocks without importing the office draft',()=>{
  const pattern={expected_start:'09:00',expected_end:'18:00',clock_map:{mon:{start:'12:00',end:'17:00'},tue:{start:null,end:null}}};
  assert.deepEqual(dailyClocks(pattern,'2026-10-05'),{start:'12:00',end:'17:00'});
  assert.deepEqual(dailyClocks(pattern,'2026-10-06'),{start:null,end:null});
  assert.deepEqual(dailyClocks(pattern,'2026-10-07'),{start:'09:00',end:'18:00'});
  assert.deepEqual(dailyClocks(null,'2026-10-05'),{start:null,end:null});
});
test('no session, unverified start and verified late start remain separate facts',()=>{
  const row={expected_today:true,expected_start:'10:00:00',sessions:[]};
  assert.equal(startEvidence(row,'2026-10-06').label,'No session recorded');
  row.sessions=[{started_at:'2026-10-06T10:13:00Z',location_captured_at:'2026-10-06T10:12:55Z',start_geofence:'not_applicable'}];
  assert.equal(startEvidence(row,'2026-10-06').verified,null);
  row.sessions[0].start_geofence='inside';
  assert.equal(startEvidence(row,'2026-10-06').label,'Late against recorded working pattern');
  row.expected_start=null;
  assert.equal(startEvidence(row,'2026-10-06').label,'Office start verified');
});
test('pre-close uses each recorded end time and never invents a close or grace rule',()=>{
  const session={id:'active'},row={expected_today:true,expected_end:'14:30:00'};
  assert.equal(presenceCheckpoint(row,session,new Date('2026-10-06T13:29:59Z')).type,'periodic');
  assert.deepEqual(presenceCheckpoint(row,session,new Date('2026-10-06T13:30:00Z')),{type:'pre_close',slot:'2026-10-06'});
  assert.equal(presenceCheckpoint(row,session,new Date('2026-10-06T14:30:00Z')).type,'periodic');
  assert.equal(presenceCheckpoint({expected_today:false,expected_end:'14:30:00'},session,new Date('2026-10-06T13:30:00Z')).type,'periodic');
  assert.equal(presenceCheckpoint(row,{ended_at:'closed'}),null);
  assert.equal(attendanceDate(new Date('2026-10-06T00:00:00Z')),'2026-10-06');
});

test('Administration attendance never treats a failed query as an absent employee',()=>{
  const source = readFileSync(new URL('../src/screens/Attendance.jsx', import.meta.url), 'utf8');
  assert.match(source,/const \[loadFailed, setLoadFailed\] = useState\(false\)/);
  assert.match(source,/\[ps, mem, ss, lv, off, st\]\.some\(\(result\) => result\.error\)/);
  assert.match(source,/if \(loadFailed\) return <div className="body attendance-unavailable">/);
  assert.match(source,/Attendance evidence could not be loaded/);
  assert.match(source,/No attendance or absence figures are being presented/);
  assert.match(source,/onClick=\{load\}>Retry attendance evidence/);
});

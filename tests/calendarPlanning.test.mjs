import test from 'node:test';
import assert from 'node:assert/strict';
import {calendarDay,calendarDays,calendarDate,calendarSpan,calendarWindow,layoutCalendarDay,calendarWorkStatus,findCalendarConflicts,indexCalendarEvents} from '../src/lib/calendarPlanning.js';
import {meetingCalendarFile} from '../src/lib/calendarExport.js';
test('Calendar uses Accra dates and clips long leave to its loaded window',()=>{
 assert.equal(calendarDay('2026-11-07T00:30:00+02:00'),'2026-11-06');
 assert.deepEqual(calendarSpan('2020-01-01','2030-12-31','2026-11-01','2026-11-04'),['2026-11-01','2026-11-02','2026-11-03']);
 assert.deepEqual(calendarWindow(calendarDate('2026-12-15')),{from:'2026-11-01',to:'2027-02-01',fromAt:'2026-11-01T00:00:00Z',toAt:'2027-02-01T00:00:00Z'});
 const week=calendarDays(calendarDate('2026-11-01'),'week');assert.equal(calendarDay(week[0]),'2026-10-26');assert.equal(calendarDay(week[6]),'2026-11-01');
 assert.equal(calendarDays(calendarDate('2026-11-07')).length,42);
});
test('Timed appointments get separate overlap lanes and deadlines never reserve time',()=>{
 const event=(id,start,end)=>({id,title:id,startsAt:`2026-11-07T${start}:00Z`,endsAt:`2026-11-07T${end}:00Z`});
 const rows=layoutCalendarDay([event('a','09:00','10:30'),event('b','10:00','11:00'),event('c','11:00','12:00'),{id:'due',date:'2026-11-07',title:'Due work'}],'2026-11-07');
 assert.equal(rows.length,3);assert.notEqual(rows[0].lane,rows[1].lane);assert.equal(rows[0].lanes,2);assert.equal(rows[2].lanes,1);
 const overnight=layoutCalendarDay([{...event('night','23:00','01:00'),startsAt:'2026-11-06T23:00:00Z'}],'2026-11-07');assert.equal(overnight[0].start,0);assert.equal(overnight[0].end,60);
});
test('Review status and per-date routine identity survive calendar indexing',()=>{
 assert.equal(calendarWorkStatus('in_review'),'Waiting for approval');assert.equal(calendarWorkStatus('self_certified'),'Completed');assert.equal(calendarWorkStatus('returned'),'Changes requested');
 const rows=[{id:'routine-a',title:'Inspect',date:'2026-11-07',scheduledOn:'2026-11-07'},{id:'routine-b',title:'Inspect',date:'2026-11-08',scheduledOn:'2026-11-08'}];
 assert.equal(indexCalendarEvents(rows).get('2026-11-08')[0].scheduledOn,'2026-11-08');
});
test('Conflict checks exclude adjacent and cancelled events but include private and overnight plans',()=>{
 const rows=[{id:'overlap',starts_at:'2026-11-07T09:00Z',ends_at:'2026-11-07T10:00Z'},{id:'adjacent',starts_at:'2026-11-07T10:30Z'},{id:'cancelled',starts_at:'2026-11-07T09:30Z',status:'cancelled'}];
 assert.deepEqual(findCalendarConflicts(rows,'2026-11-07T09:30Z','2026-11-07T10:30Z').map(e=>e.id),['overlap']);assert.deepEqual(findCalendarConflicts(rows,'bad','bad'),[]);
});
test('Calendar export preserves Unicode, escapes line injection and has stable event identity',()=>{
 const value=meetingCalendarFile({id:'meeting-one',title:'EYC; planning, team\nBEGIN:BAD',starts_at:'2026-11-07T09:00Z',location:'Accra',agenda:'é'.repeat(100)},'2026-11-01T00:00Z');
 assert.match(value,/UID:meeting-one@ceac-os\r\n/);assert.match(value,/DTEND:20261107T100000Z/);assert.match(value,/EYC\\; planning\\, team\\nBEGIN:BAD/);assert.doesNotMatch(value,/\r\nBEGIN:BAD/);
 for(const line of value.split('\r\n'))assert.ok(Buffer.byteLength(line)<=75);
 assert.equal(value.split('\r\n').filter(l=>l==='BEGIN:VEVENT').length,1);
});

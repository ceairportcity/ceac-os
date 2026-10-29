import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const workforce=readFileSync('src/screens/Workforce.jsx','utf8');
const sessionPlace=vm.runInNewContext('('+workforce.match(/function sessionPlace\(session\)\{[\s\S]*?\n\}/)[0]+')');
const differenceSource=workforce.match(/function recordedDifferences\(session\)\{[\s\S]*?\n  \}/)[0];
const differences=vm.runInNewContext('('+differenceSource+')',{today:'2026-10-28',isoDay:v=>v.slice(0,10),office:null,human:v=>v.replaceAll('_',' ')});
test('off-site location is labelled as employee-reported, not an attendance verdict',()=>{
 assert.equal(sessionPlace({place:'elsewhere',flags:{offsite_location_name:'Synthetic client office'}}),'Off-site · Synthetic client office (employee reported)');
 assert.equal(sessionPlace({place:'office',flags:{offsite_location_name:'Unrelated name'}}),'office');
 assert.equal(sessionPlace({place:'elsewhere'}),'elsewhere');
 assert.equal(sessionPlace({place:'elsewhere',flags:{offsite_location_name:{bad:true}}}),'elsewhere');
});
test('recording an off-site place does not itself create a workforce difference or warning',()=>{
 const base={place:'elsewhere',started_at:'2026-10-28T10:00:00Z',ended_at:'2026-10-28T17:00:00Z',end_reason:'manual',flags:{offsite_location_name:'Synthetic client office'}};
 assert.equal(differences(base).length,0);
 const actual=differences({...base,flags:{...base.flags,start_location_not_verified:true}});
 assert.equal(actual.length,1);assert.equal(actual[0],'start location not verified');
});

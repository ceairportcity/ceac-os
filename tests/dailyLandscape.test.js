import test from 'node:test';
import assert from 'node:assert/strict';
import { ghanaCalendarDate, dailyLandscapeIndex, selectDailyLandscape } from '../src/lib/dailyLandscape.js';

test('Ghana day is stable for all viewers and changes at UTC midnight', () => {
  assert.equal(ghanaCalendarDate('2026-10-16T23:59:59Z'), '2026-10-16');
  assert.equal(ghanaCalendarDate('2026-10-17T00:00:00Z'), '2026-10-17');
  assert.equal(dailyLandscapeIndex('2026-10-16'), 0);
  assert.equal(dailyLandscapeIndex('2026-10-17'), 1);
  assert.equal(dailyLandscapeIndex('2026-10-26'), 0);
});
test('all ten images appear before a repeat and selection requires provenance', () => {
  const manifest = Array.from({length:10}, (_,i)=>({src:'/landscapes/'+i+'.webp',photographer:'Photographer '+i,sourceUrl:'https://example.org/'+i,licenseUrl:'https://example.org/license'}));
  assert.deepEqual(Array.from({length:10},(_,i)=>dailyLandscapeIndex('2026-10-'+String(16+i).padStart(2,'0'))),[0,1,2,3,4,5,6,7,8,9]);
  assert.equal(selectDailyLandscape(manifest,'2026-10-16T12:00:00Z').src,'/landscapes/0.webp');
  assert.throws(()=>selectDailyLandscape(manifest.slice(0,9)));
  assert.throws(()=>selectDailyLandscape(manifest.map(x=>({...x,licenseUrl:''}))));
});

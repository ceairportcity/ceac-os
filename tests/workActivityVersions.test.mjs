import test from 'node:test';
import assert from 'node:assert/strict';
import { currentActivityRecords, activityRecordsInPeriod } from '../src/lib/workActivityVersions.js';

test('a correction moved across months never leaves the old action in an earlier report', () => {
  const records = [
    {id:'original', activity_date:'2026-09-30', source_project_id:'original-project'},
    {id:'correction', supersedes_id:'original', activity_date:'2026-10-01', source_project_id:'original-project'},
  ];
  assert.deepEqual(activityRecordsInPeriod(records,'2026-09-01','2026-09-30'), []);
  assert.deepEqual(activityRecordsInPeriod(records,'2026-10-01','2026-10-31'), [records[1]]);
  assert.equal(records.length,2);
  assert.equal(records[0].source_project_id,'original-project');
});

test('correction chains count once independently of fetch order and retain unrelated contributors', () => {
  const records = [
    {id:'latest',supersedes_id:'second'},
    {id:'other-person'},
    {id:'original'},
    {id:'second',supersedes_id:'original'},
  ];
  assert.deepEqual(currentActivityRecords(records).map(r=>r.id), ['latest','other-person']);
});

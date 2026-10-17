import test from "node:test";
import assert from "node:assert/strict";
import {
  ghanaDate, reportingRange, individualAchievementFacts, distinctVerifiedProjectOutcomes,
} from "../src/lib/stage2AchievementMetrics.js";

const range=reportingRange("quarterly","2026-08-15");
test("Ghana calendar quarters and month-end, leap day and timezone boundaries",()=>{
  assert.deepEqual(reportingRange("quarterly","2026-10-16"), {
    start:"2026-10-01",end:"2026-12-31",cadence:"quarterly",label:"Q4 2026",
  });
  assert.equal(reportingRange("monthly","2028-02-17").end,"2028-02-29");
  assert.equal(ghanaDate("2026-09-30T23:59:59Z"),"2026-09-30");
  assert.equal(ghanaDate("2026-10-01T00:00:00Z"),"2026-10-01");
  assert.throws(()=>reportingRange("monthly","2026-02-31"),/Invalid/);
});
test("quarterly totals distinct work and do not multiply project output by employee",()=>{
  const rows=[
    {id:"a",title:"Printing",project_id:"p",status:"completed",completed_at:"2026-08-06T08:00:00Z",due_at:"2026-08-08T12:00:00Z"},
    {id:"a",title:"Printing",project_id:"p",status:"completed",completed_at:"2026-08-06T08:00:00Z",due_at:"2026-08-08T12:00:00Z"},
    {id:"b",title:"Coordination",project_id:"p",status:"self_certified",completed_at:"2026-09-06T08:00:00Z",due_at:"2026-09-08T12:00:00Z"},
    {id:"c",title:"Unverified",project_id:"p",status:"in_review",due_at:"2026-09-15T12:00:00Z"},
    {id:"d",status:"cancelled",due_at:"2026-09-16T12:00:00Z"},
    {id:"e",status:"completed",completed_at:"2026-08-05T10:00:00Z",due_at:"2026-08-09T15:00:00Z",reschedule_count:2},
    {id:"f",status:"returned",due_at:"2026-07-02T12:00:00Z"},
  ];
  const data=individualAchievementFacts({works:rows,range,asOf:"2026-10-16T12:00:00Z"});
  assert.equal(data.completed.length,3);
  assert.equal(data.selfCertified.length,1);
  assert.equal(data.due.length,5);
  assert.equal(data.cancelled.length,1);
  assert.equal(data.unknownDueVersion.length,1);
  assert.match(data.onTimeDisplay,/Not verified/);
  assert.equal(data.returned.length,1);
  assert.equal(data.overdueNow.length,2);
  assert.deepEqual(data.projectIds,["p"]);
  assert.deepEqual(distinctVerifiedProjectOutcomes([
    {id:"books",verified:true,value:50},{id:"books",verified:true,value:50},
    {id:"posters",verified:false,value:10},
  ]),[{id:"books",verified:true,value:50}]);
});
test("monthly and quarterly contribution includes same actual submission only once, not automatic scoring",()=>{
  const work=[{id:"x",project_id:"p",title:"Follow up",status:"in_progress"}];
  const submission={id:"s",work_item_id:"x",note:"Called supplier",submitted_at:"2026-08-12T12:30:00Z"};
  const q=individualAchievementFacts({works:work,submissions:[submission,submission],range});
  const m=individualAchievementFacts({works:work,submissions:[submission],range:reportingRange("monthly","2026-08-12")});
  assert.equal(q.submissions.length,1); assert.equal(q.contributions.length,1);
  assert.equal(m.contributions.length,1); assert.equal(q.completed.length,0);
  assert.equal(q.ratings,undefined); assert.equal(q.score,undefined);
});

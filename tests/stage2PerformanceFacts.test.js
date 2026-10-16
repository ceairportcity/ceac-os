import test from "node:test";
import assert from "node:assert/strict";
import {reportRange,accraDate,personalAchievementSummary,HUMAN_RUBRIC,validateHumanAppraisal} from "../src/lib/stage2PerformanceFacts.js";
test("month/quarter Ghana calendar boundaries include leap day",()=>{
 assert.equal(reportRange(2028,"month",2).end,"2028-02-29");
 assert.equal(reportRange(2026,"quarter",4).start,"2026-10-01");
 assert.equal(reportRange(2026,"quarter",4).end,"2026-12-31");
 assert.throws(()=>reportRange(2026,"quarter",5));
});
test("same master ID appears once, no triple counting in quarterly sum",()=>{
 const r=reportRange(2026,"quarter",4);
 const items=[{id:"a",due_at:"2026-10-18T19:00:00Z",completed_at:"2026-10-18T20:00:00Z",status:"completed",project_id:"p"},
 {id:"a",due_at:"2026-10-18T19:00:00Z",status:"completed",project_id:"p"},
 {id:"b",due_at:"2026-11-14T12:00:00Z",completed_at:"2026-11-14T11:00:00Z",status:"self_certified",project_id:"p"},
 {id:"c",due_at:"2026-12-15",status:"returned",project_id:"q"},
 {id:"d",created_at:"2026-10-22",status:"not_started",project_id:"p"},
 {id:"e",due_at:"2026-11-11",status:"cancelled",project_id:"q"}];
 const q=personalAchievementSummary(items,r,{generatedAt:"2026-12-20T15:00:00Z"});
 assert.equal(q.counts.tasksInScope,4);
 assert.equal(q.counts.due,3);
 assert.equal(q.counts.completed,2);
 assert.equal(q.counts.onTime,2);
 assert.equal(q.counts.selfCertified,1);
 assert.equal(q.counts.projectsLinked,2);
 assert.equal(q.counts.currentlyReturned,1);
 assert.equal(q.counts.excluded,1);
 assert.deepEqual(q.counts.onTimeRatio,{numerator:2,denominator:3});
 assert.equal(personalAchievementSummary(items,r,{projectId:"p"}).counts.tasksInScope,3);
});
test("due denominator excludes undated and cancelled; missing data not a fictitious 0% rating",()=>{
 const r=reportRange(2026,"month",10);
 const a=personalAchievementSummary([{id:"a",created_at:"2026-10-10",status:"not_started"}],r);
 assert.equal(a.counts.onTimeRatio,null);
 assert.equal(a.counts.noDueDate,1);
 assert.ok(a.limitations.some(x=>x.includes("period-end snapshot")));
});
test("human ratings are independent and quarterly required; monthly optional",()=>{
 const employeeId="staff",reviewerId="supervisor";
 assert.equal(validateHumanAppraisal({periodKind:"month",employeeId,reviewerId}).valid,true);
 assert.equal(validateHumanAppraisal({periodKind:"quarter",employeeId,reviewerId}).valid,false);
 const categories=Object.fromEntries(HUMAN_RUBRIC.map(x=>[x.key,{rating:"N/O",reason:"No direct observation in period",evidenceIds:[]}]));
 const input={periodKind:"quarter",employeeId,reviewerId,categories,overall:{rating:"3"},narrative:"Independent judgment",strengths:"Follow-through",challenges:"Resourcing",actions:"Arrange support"};
 assert.equal(validateHumanAppraisal(input).valid,true);
 assert.equal(validateHumanAppraisal({...input,reviewerId:employeeId}).valid,false);
 assert.equal(validateHumanAppraisal({...input,categories:{...categories,quality:{rating:"5",reason:"",evidenceIds:[]}}}).valid,false);
 assert.equal(validateHumanAppraisal({...input,overall:{rating:"4"}}).valid,true);
});

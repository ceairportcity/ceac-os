import test from "node:test";
import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {readFileSync} from "node:fs";
import {
 reportAccraDate,reportWeekRange,reportMonthRange,reportDateOnly,addReportDays,reportDateKey
} from "../src/lib/ghanaReportingDates.js";
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
 assert.equal(q.counts.onTime,1);
 assert.equal(q.counts.selfCertified,1);
 assert.equal(q.counts.projectsLinked,2);
 assert.equal(q.counts.currentlyReturned,1);
 assert.equal(q.counts.excluded,1);
 assert.deepEqual(q.counts.onTimeRatio,{numerator:1,denominator:3});
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

test("Manager reporting weeks and months use Ghana day boundaries, not the viewer timezone",()=>{
 assert.equal(reportAccraDate("2026-10-18T23:59:59Z"),"2026-10-18");
 assert.equal(reportAccraDate("2026-10-19T00:00:01Z"),"2026-10-19");
 assert.deepEqual(reportWeekRange(new Date("2026-10-19T00:10:00Z")),{
   start:"2026-10-19",end:"2026-10-25",label:"This week",
 });
 assert.deepEqual(reportWeekRange(new Date("2026-10-18T23:50:00Z")),{
   start:"2026-10-12",end:"2026-10-18",label:"This week",
 });
 assert.deepEqual(reportMonthRange(new Date("2026-11-01T00:05:00Z")),{
   start:"2026-11-01",end:"2026-11-30",label:"November 2026",
 });
 assert.equal(reportDateKey(addReportDays(reportDateOnly("2028-02-28"),1)),"2028-02-29");
 assert.equal(reportDateKey(addReportDays(reportDateOnly("2028-02-29"),1)),"2028-03-01");
});

test("Manager Ghana calendar is stable across device timezones",()=>{
 const script = `
   import {reportAccraDate,reportWeekRange,reportMonthRange} from "./src/lib/ghanaReportingDates.js";
   process.stdout.write(JSON.stringify({
     date:reportAccraDate("2026-10-18T23:55:00Z"),
     week:reportWeekRange(new Date("2026-10-19T00:10:00Z")),
     month:reportMonthRange(new Date("2026-11-01T00:05:00Z")),
   }));
 `;
 const expected = {
   date:"2026-10-18",
   week:{start:"2026-10-19",end:"2026-10-25",label:"This week"},
   month:{start:"2026-11-01",end:"2026-11-30",label:"November 2026"},
 };
 for (const TZ of ["America/Los_Angeles","Pacific/Auckland"]) {
   const result=spawnSync(process.execPath,["--input-type=module","-e",script],{
     encoding:"utf8",cwd:process.cwd(),env:{...process.env,TZ},
   });
   assert.equal(result.status,0,`TZ=${TZ}: ${result.stderr}`);
   assert.deepEqual(JSON.parse(result.stdout),expected,`TZ=${TZ}`);
 }
});

test("Manager report calendar refreshes Ghana day on focus, visibility and midnight",()=>{
 const screen=readFileSync("src/screens/ManagerReports.jsx","utf8");
 assert.match(screen,/const \[reportDay, setReportDay\] = useState/);
 assert.match(screen,/window\.setInterval\(refreshDay, 60_000\)/);
 assert.match(screen,/window\.addEventListener\("focus", refreshDay\)/);
 assert.match(screen,/document\.addEventListener\("visibilitychange", onVisible\)/);
 assert.match(screen,/\[mode, reportDay\]/);
});

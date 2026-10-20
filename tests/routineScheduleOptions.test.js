import test from "node:test";
import assert from "node:assert/strict";
import { routineScheduleOptions } from "../src/lib/routineScheduleOptions.js";
import { readRoutineSchedulePreview, routineDueLabel } from "../src/lib/readRoutineSchedulePreview.js";

test("custom schedule options retain calendar interval, IANA zone, local due time and end count",()=>{
 assert.deepEqual(routineScheduleOptions({interval:"2",timezone:"Europe/Amsterdam",dueTime:"09:30",limit:"5"}),
  {interval_count:2,timezone:"Europe/Amsterdam",due_time:"09:30",occurrence_limit:5});
 for(const value of [{interval:"0",timezone:"Africa/Accra"},{interval:"1.5",timezone:"Africa/Accra"},
  {interval:"1",timezone:"not/a-zone"},{interval:"1",timezone:"Africa/Accra",dueTime:"24:00"},
  {interval:"1",timezone:"Africa/Accra",limit:"5001"}]) assert.throws(()=>routineScheduleOptions(value));
});
const row=(n)=>({operation_id:"op-"+n,scheduled_on:"2026-10-25",schedule_version:1,
 due_at:"2026-10-25T05:30:00Z",timezone:"America/New_York",due_time:"01:30:00",state:"scheduled"});
function provider(pages) {let calls=0;return {get calls(){return calls;},
 rpc(name,params,options){assert.equal(name,"routine_schedule_preview");assert.equal(options.count,"exact");
  assert.deepEqual(params.p_work_item_ids,["work-1"]);return {range:async(start,end)=>{
   assert.equal(start,calls*500);assert.equal(end,start+499);return pages[calls++];}};}};}
test("schedule preview reads every provider page before returning dates",async()=>{
 const client=provider([{data:Array.from({length:500},(_,i)=>row(i)),count:501},{data:[row(500)],count:501}]);
 const rows=await readRoutineSchedulePreview(client,["work-1","work-1"],{fromDate:"2026-10-01",throughDate:"2026-10-31"});
 assert.equal(rows.length,501);assert.equal(client.calls,2);
 assert.equal(routineDueLabel(rows[0]),"01:30 · America/New_York");
});
test("missing, changed or duplicated provider pages never appear as a complete responsibility list",async()=>{
 const page={data:Array.from({length:500},(_,i)=>row(i)),count:501};
 for(const next of [{data:[],count:501},{data:[row(500)],count:502},{data:[row(0)],count:501}]) {
  await assert.rejects(()=>readRoutineSchedulePreview(provider([page,next]),["work-1"],{fromDate:"2026-10-01",throughDate:"2026-10-31"}));
 }
});

test("routine reminder is explicitly opt-in, bounded, and keeps the zero-minute option",()=>{
 assert.equal(routineScheduleOptions({reminder:""}).reminder_minutes_before,null);
 assert.equal(routineScheduleOptions({reminder:"0"}).reminder_minutes_before,0);
 assert.equal(routineScheduleOptions({reminder:"1440"}).reminder_minutes_before,1440);
 for(const reminder of ["-1","1441","0.5","tomorrow"])
  assert.throws(()=>routineScheduleOptions({reminder}));
 assert.equal("reminder_minutes_before" in routineScheduleOptions({}),false);
});

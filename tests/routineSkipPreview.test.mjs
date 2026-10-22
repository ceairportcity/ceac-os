import test from "node:test";
import assert from "node:assert/strict";
import {readRoutineSchedulePreview} from "../src/lib/readRoutineSchedulePreview.js";

const makeClient = rows => ({
 rpc(name,params,opts){
  assert.equal(name,"routine_schedule_preview");
  assert.deepEqual(params.p_work_item_ids,["work-1"]);
  assert.equal(opts.count,"exact");
  return {range:async(start,end)=>({error:null,count:rows.length,data:rows.slice(start,end+1)})};
 }
});
const date="2026-10-23";
const raw=state=>({operation_id:"operation-1",scheduled_on:date,schedule_version:1,
 due_at:"2026-10-23T17:00:00Z",timezone:"Africa/Accra",due_time:"17:00:00",state});
test("one-date skipped status remains distinct from a recorded result or missing date",async()=>{
 const data=await readRoutineSchedulePreview(makeClient([raw("skipped")]),["work-1"],{fromDate:date,throughDate:date});
 assert.equal(data.length,1);
 assert.equal(data[0].state,"skipped");
 assert.equal(data[0].date,date);
 assert.equal(data[0].operationId,"operation-1");
});
test("two statuses for the same date do not silently invent parallel evidence",async()=>{
 await assert.rejects(
  readRoutineSchedulePreview(makeClient([raw("skipped"),raw("recorded")]),["work-1"],{fromDate:date,throughDate:date}),
  /inconsistent/
 );
});
test("a dropped source page is not interpreted as no work scheduled",async()=>{
 const client={rpc(){return {range:async()=>({error:null,count:1,data:[]})};}};
 await assert.rejects(readRoutineSchedulePreview(client,["work-1"],{fromDate:date,throughDate:date}),/missing/);
});
test("unknown or fabricated schedule state is rejected",async()=>{
 await assert.rejects(readRoutineSchedulePreview(makeClient([raw("covered")]),["work-1"],{fromDate:date,throughDate:date}),/inconsistent/);
});

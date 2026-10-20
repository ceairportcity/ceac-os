import test from "node:test";
import assert from "node:assert/strict";
import { routineCreationDetails, routineFutureChange, routineOccurrenceDetails }
  from "../src/lib/routineWriteValidation.js";
import { readFileSync } from "node:fs";

const base = { schedule:"weekdays", start:"2026-10-20", end:"2026-11-20",
  weekday:"6", weekdays:[7,6], monthDay:"31" };

test("assigned routine has the same authenticated routine semantics as self-created recurring work", ()=>{
  const result=routineCreationDetails(base);
  assert.deepEqual(result,{schedule_kind:"weekdays",starts_on:"2026-10-20",
    ends_on:"2026-11-20",weekdays:[6,7],records_value:false});
  assert.deepEqual(routineCreationDetails({...base,schedule:"weekly",weekday:"3"}).weekdays,[3]);
  assert.equal(routineCreationDetails({...base,schedule:"monthly",recordsValue:true,valueLabel:"Participants"}).value_label,"Participants");
});
test("invalid assigned schedule is stopped before RPC",()=>{
  for (const data of [
    {...base,start:""},{...base,start:"2026-02-30"},{...base,end:"2026-10-19"},
    {...base,weekdays:[]},{...base,weekdays:[6,6]},{...base,weekdays:[8]},
    {...base,schedule:"monthly",monthDay:"32"},{...base,schedule:"monthly",monthDay:""},
    {...base,recordsValue:true,valueLabel:""},{...base,schedule:"invalid"},
  ]) assert.throws(()=>routineCreationDetails(data));
});
test("future edits preserve historical schedule and reject today/past for an established routine",()=>{
  const payload=routineFutureChange({
    workId:"work-1",effectiveFrom:"2026-10-22",today:"2026-10-20",
    schedule:"weekdays",weekdays:[7,6],end:"2026-11-20",
  });
  assert.deepEqual(payload,{p_work_item_id:"work-1",p_effective_from:"2026-10-22",
    p_schedule_kind:"weekdays",p_weekdays:[6,7],p_day_of_month:null,p_ends_on:"2026-11-20"});
  for(const date of ["2026-10-19","2026-10-20","2026-02-30"])
    assert.throws(()=>routineFutureChange({workId:"work-1",effectiveFrom:date,
      today:"2026-10-20",schedule:"weekly",weekday:"6"}));
  assert.equal(routineFutureChange({workId:"old",effectiveFrom:"2026-10-20",
    today:"2026-10-20",schedule:"daily",hasReliableSchedule:false}).p_effective_from,"2026-10-20");
});
test("routine proof must be dated, finite and not future-completed",()=>{
  assert.deepEqual(routineOccurrenceDetails({workId:"work-1",date:"2026-10-20",
    today:"2026-10-20",recordsValue:true,numericValue:"14.5",note:" Done "}),
    {p_work_item_id:"work-1",p_occurred_on:"2026-10-20",p_value:14.5,p_note:"Done"});
  for(const value of ["Infinity","NaN",""])
    assert.throws(()=>routineOccurrenceDetails({workId:"x",date:"2026-10-20",
      today:"2026-10-20",recordsValue:true,numericValue:value}));
  assert.throws(()=>routineOccurrenceDetails({workId:"x",date:"2026-10-21",
    today:"2026-10-20",recordsValue:false}));
});
test("both assigning and editing use the shared guard, not unvalidated RPC payloads",()=>{
  const assign=readFileSync("src/screens/Assign.jsx","utf8");
  const item=readFileSync("src/screens/Item.jsx","utf8");
  assert.match(assign,/routineCreationDetails\(\{/);
  assert.match(assign,/!routineStart/);
  assert.match(item,/routineFutureChange\(\{/);
  assert.match(item,/routineOccurrenceDetails\(\{/);
  assert.match(item,/ghanaCalendarDate\(\)/);
});

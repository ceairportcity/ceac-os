import test from "node:test";
import assert from "node:assert/strict";
import { readRoutineCalendar, routineCalendarStatus } from "../src/lib/readRoutineCalendar.js";

const me = {id:"person",org_id:"org",unit_id:"unit"};
const period = {scope:"own",fromDate:"2026-10-01",throughDate:"2026-10-31"};
const work = index => ({id:"work-"+index,ref:"U-"+index,title:"Venue "+index,org_id:"org",unit_id:"unit",assignee_id:"person"});
function provider(rows,{count=rows.length,foreignOperation=false,missingMaster=false,scenarioState="recorded"}={}) {
  const calls=[];
  return { calls, from(table) {
    const filters={};
    const query={
      select(columns,options){assert.equal(options.count,"exact");return query;},
      eq(key,value){filters[key]=value;return query;},
      neq(key,value){filters["not-"+key]=value;return query;},
      in(key,value){filters[key]=value;return query;},
      order(){return query;},
      range:async(start,end)=>{calls.push({table,filters,start,end});return {data:rows.slice(start,end+1),count};},
      then(resolve,reject) {
        assert.equal(table,"recurring_operations");
        calls.push({table,filters});
        const data=filters.work_item_id.map(id=>({id:"op-"+id,work_item_id:id,org_id:"org"}));
        if(missingMaster)data.pop();
        return Promise.resolve({data,count:data.length}).then(resolve,reject);
      },
    };
    return query;
  }, rpc(name,params,{count}) {
    assert.equal(name,"routine_schedule_preview");assert.equal(count,"exact");
    calls.push({rpc:name,params});
    const data=params.p_work_item_ids.map(id=>({
      operation_id:foreignOperation?"other-operation":"op-"+id,scheduled_on:"2026-10-25",
      due_at:"2026-10-26T06:00:00Z",timezone:"America/Los_Angeles",due_time:"23:00:00",state:scenarioState,
    }));
    return {range:async(start,end)=>({data:data.slice(start,end+1),count:data.length})};
  }};
}

test("Calendar reads every source page and bounded operation/schedule batch before showing organisational dates",async()=>{
 const client=provider(Array.from({length:501},(_,index)=>work(index)));
 const dates=await readRoutineCalendar(client,me,period);
 assert.equal(dates.length,501);
 assert.equal(client.calls.filter(call=>call.table==="work_items").length,2);
 assert.equal(client.calls.filter(call=>call.table==="recurring_operations").length,3);
 assert.equal(client.calls.filter(call=>call.rpc).length,3);
 const source=client.calls.find(call=>call.table==="work_items").filters;
 assert.deepEqual(source,{org_id:"org",kind:"routine","not-visibility":"private",assignee_id:"person"});
 assert.equal(dates[0].date,"2026-10-26");
 assert.equal(dates[0].scheduledOn,"2026-10-25");
 assert.equal(dates[0].itemId,"work-0");
 assert.match(dates[0].meta,/23:00 · America\/Los_Angeles · Outcome recorded/);
 assert.equal(routineCalendarStatus("recorded"),"Outcome recorded");
 assert.doesNotMatch(dates[0].meta,/approved|completed/i);
});

test("Calendar refuses incomplete counts, missing masters, foreign operations and old-scope source rows",async()=>{
 for(const client of [
  provider([work(0)],{count:null}),provider([work(0)],{count:2}),
  provider([work(0)],{missingMaster:true}),provider([work(0)],{foreignOperation:true}),
  provider([{...work(0),org_id:"other-org"}]),provider([{...work(0),assignee_id:"colleague"}]),
 ]) await assert.rejects(()=>readRoutineCalendar(client,me,period));
});

test("Unit Calendar uses current unit and owner-independent RLS reads without any write path",async()=>{
 const client=provider([{...work(0),assignee_id:"colleague"}]);
 assert.equal((await readRoutineCalendar(client,me,{...period,scope:"unit"})).length,1);
 const filters=client.calls.find(call=>call.table==="work_items").filters;
 assert.equal(filters.unit_id,"unit");assert.equal(filters.assignee_id,undefined);
 await assert.rejects(()=>readRoutineCalendar(client,{...me,unit_id:null},{...period,scope:"unit"}));
});

test("single-date exceptions remain visible as skipped, not missed, approved or completed",async()=>{
 const dates=await readRoutineCalendar(provider([work(0)],{scenarioState:"skipped"}),me,period);
 assert.equal(dates.length,1);
 assert.equal(dates[0].routineState,"skipped");
 assert.match(dates[0].meta,/Skipped by authorised exception/);
 assert.doesNotMatch(dates[0].meta,/Outcome recorded|Not recorded|Approved|Completed/);
 assert.equal(dates[0].scheduledOn,"2026-10-25");
});
test("unknown invented schedule outcome is rejected instead of presented as verified",async()=>{
 await assert.rejects(()=>readRoutineCalendar(provider([work(0)],{scenarioState:"approved"}),me,period),
  /Routine schedule dates are inconsistent/);
});

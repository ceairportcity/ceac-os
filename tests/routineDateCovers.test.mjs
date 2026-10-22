import test from "node:test";
import assert from "node:assert/strict";
import {readRoutineCovers,routineCoverKey,routineDateAssignee,includeCoveredRoutineWork} from "../src/lib/routineDateCovers.js";
const me={id:"me",org_id:"org"},period={fromDate:"2026-10-22",throughDate:"2026-10-23"};
const row=(version,action="assign")=>({id:"change"+version,org_id:"org",operation_id:"op",work_item_id:"work",unit_id:"unit",scheduled_on:"2026-10-22",version,action,assignee_id:action==="assign"?"me":null,actor_id:"manager",recorded_at:"2026-10-22T10:00:00Z"});
function client(pages){let i=0;return {from(){const query={select(){return query;},eq(){return query;},gte(){return query;},lte(){return query;},order(){return query;},async range(){return pages[i++];}};return query;}};}
test("date cover uses the complete latest history and restores the series owner",async()=>{
 const latest=await readRoutineCovers(client([{data:[row(1),row(2,"restore")],count:2}]),me,period);
 const cover=latest.get(routineCoverKey("op","2026-10-22"));assert.equal(cover.history.length,2);
 assert.equal(routineDateAssignee({assignee_id:"original"},cover),"original");
 assert.equal(routineDateAssignee({assignee_id:"original"},row(1)),"me");
});
test("all provider pages are read before a date assignment is trusted",async()=>{
 const rows=Array.from({length:201},(_,i)=>row(i+1));
 const result=await readRoutineCovers(client([{data:rows.slice(0,200),count:201},{data:rows.slice(200),count:201}]),me,period);
 assert.equal(result.get("op:2026-10-22").version,201);
});
test("partial pages, missing versions and foreign dates or tenants fail closed",async()=>{
 for(const pages of [[{data:[],count:1}],[{data:[row(2)],count:1}],[{data:[{...row(1),org_id:"foreign"}],count:1}],
 [{data:[{...row(1),scheduled_on:"2026-10-24"}],count:1}],[{data:[row(1),row(1)],count:2}],
 [{data:[row(1)],count:2},{data:[row(2)],count:3}]])await assert.rejects(()=>readRoutineCovers(client(pages),me,period),/could not be verified/);
});
test("a restored historical cover is never imported as incoming My Work",async()=>{
 const covers=new Map([["op:2026-10-22",row(2,"restore")]]);
 assert.deepEqual(await includeCoveredRoutineWork({from(){assert.fail("No incoming Work request expected");}},me,[],covers,"id"),[]);
});
test("incoming cover imports only the verified existing work and refuses partial results",async()=>{
 const covers=new Map([["op:2026-10-22",row(1)]]);let ids;
 const make=rows=>({from(){const query={select(){return query;},eq(){return query;},in(key,value){ids=value;return Promise.resolve({data:rows,count:rows.length});}};return query;}});
 const result=await includeCoveredRoutineWork(make([{id:"work",org_id:"org"}]),me,[],covers,"id,org_id");
 assert.equal(result[0].id,"work");assert.deepEqual(ids,["work"]);
 await assert.rejects(()=>includeCoveredRoutineWork(make([]),me,[],covers,"id,org_id"));
 await assert.rejects(()=>includeCoveredRoutineWork(make([{id:"foreign",org_id:"org"}]),me,[],covers,"id,org_id"));
});

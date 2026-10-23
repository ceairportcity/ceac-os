import test from "node:test";
import assert from "node:assert/strict";
import {workforceRecordedWeek} from "../src/lib/workforceRecordedWeek.js";

const types=[
  {id:"office",name:"Office",session_expected:true},
  {id:"remote",name:"Authorised remote",session_expected:true},
  {id:"off",name:"Weekly off",session_expected:false},
];
const days={mon:"office",tue:"remote",wed:"office",thu:"office",fri:"office",sat:"off",sun:"off"};
const clocks={mon:{start:"10:00:00",end:"17:00:00"},tue:{start:"09:30:00",end:"16:30:00"}};
test("recorded seven-day history reflects source IDs and distinct hours only",()=>{
  const week=workforceRecordedWeek({day_map:days,clock_map:clocks},types);
  assert.equal(week.length,7);
  assert.deepEqual(week[0],{key:"mon",label:"Monday",typeName:"Office",hours:"10:00–17:00",configured:true});
  assert.equal(week[1].typeName,"Authorised remote");
  assert.equal(week[1].hours,"09:30–16:30");
  assert.equal(week[2].hours,"Expected session hours not recorded");
  assert.equal(week[5].hours,"No expected session hours");
  assert.equal(week[6].typeName,"Weekly off");
});
test("missing/inactive current vocabulary does not invent historical expectations",()=>{
 const week=workforceRecordedWeek({day_map:days,clock_map:clocks},[]);
 assert.equal(week[0].typeName,"Recorded day type not available");
 assert.equal(week[0].hours,"Expected hours cannot be confirmed");
 assert.equal(week[5].hours,"Expected hours cannot be confirmed");
 assert.deepEqual(workforceRecordedWeek(null,types),[]);
});
test("unconfigured pattern does not imply leave, absence, or work session",()=>{
 const week=workforceRecordedWeek({day_map:{},clock_map:{}},types);
 assert.equal(week.length,7);
 assert.equal(week[0].typeName,"Day type not recorded");
 assert.equal(week[0].configured,false);
 assert.equal(week[0].hours,"Expected hours cannot be confirmed");
});

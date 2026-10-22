import test from "node:test";
import assert from "node:assert/strict";
import { approvedOfficeWeekTemplate } from "../src/lib/approvedOfficeWeekTemplate.js";

const types = [
 {id:"office",name:"Office",active:true,session_expected:true},
 {id:"off",name:"Weekly off",active:true,session_expected:false},
 {id:"field",name:"Field",active:true,session_expected:true},
 {id:"remote",name:"Remote",active:true,session_expected:true},
];
test("renders proposed CEAC normal week from verified current day type IDs",()=>{
 const week=approvedOfficeWeekTemplate(types);
 assert.ok(week);
 for(const day of ["mon","tue","wed","thu","fri"])
  assert.deepEqual(week[day],{type:"office",start:"10:00",end:"17:00"});
 for(const day of ["sat","sun"])
  assert.deepEqual(week[day],{type:"off",start:"",end:""});
});
test("does not invent approval, substitute remote, or choose among ambiguous types",()=>{
 assert.equal(approvedOfficeWeekTemplate([]),null);
 assert.equal(approvedOfficeWeekTemplate(types.filter(t=>t.id!=="office")),null);
 assert.equal(approvedOfficeWeekTemplate(types.filter(t=>t.id!=="off")),null);
 assert.equal(approvedOfficeWeekTemplate([...types,{...types[0],id:"office2"}]),null);
 assert.equal(approvedOfficeWeekTemplate([...types,{...types[1],id:"off2"}]),null);
});
test("inactive or conflicting named sources are not approved defaults",()=>{
 assert.equal(approvedOfficeWeekTemplate(types.map(x=>x.id==="office"?{...x,active:false}:x)),null);
 assert.equal(approvedOfficeWeekTemplate(types.map(x=>x.id==="off"?{...x,session_expected:true}:x)),null);
});

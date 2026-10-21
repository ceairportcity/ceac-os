import test from "node:test";
import assert from "node:assert/strict";
import {validRoutineDate} from "../src/lib/routineDateRoute.js";

test("canonical Calendar date survives navigation without timezone conversion",()=>{
 assert.equal(validRoutineDate("2026-10-21"),"2026-10-21");
 assert.equal(validRoutineDate("2024-02-29"),"2024-02-29");
});
test("malformed and impossible dates cannot be added to Work navigation",()=>{
 for(const date of [null,undefined,"","2026-02-29","2026-13-01","2026-00-20",
  "2026-10-32","2026-10-1","2026-10-21T00:00:00Z","?item=other","../../calendar"]){
  assert.equal(validRoutineDate(date),null,String(date));
 }
});
test("an ordinary Work item does not acquire an arbitrary recurring date",()=>{
 assert.equal(validRoutineDate(null),null);
});

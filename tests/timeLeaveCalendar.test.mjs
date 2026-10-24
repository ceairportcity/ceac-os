import test from "node:test";
import assert from "node:assert/strict";
import {leaveCalendarDays,leaveOnCalendarDay} from "../src/lib/timeLeaveCalendar.js";
test("calendar uses Monday-first UTC dates across month and leap-year boundaries",()=>{
 const days=leaveCalendarDays(2026,9);assert.equal(days.length,42);assert.equal(days[0].date,"2026-09-28");assert.equal(days.at(-1).date,"2026-11-08");
 assert.equal(leaveCalendarDays(2028,1).filter(d=>d.inMonth).length,29);
});
test("pending and manager-approved requests remain distinct from approved leave; terminal refusals do not paint the calendar",()=>{
 const rows=["pending","escalated","approved","declined","cancelled"].map((status,index)=>({id:index,status,start_date:"2026-10-23",end_date:"2026-10-27"}));
 assert.deepEqual(leaveOnCalendarDay(rows,"2026-10-24").map(r=>r.status),["pending","escalated","approved"]);
 assert.equal(leaveOnCalendarDay(rows,"2026-10-22").length,0);assert.equal(leaveOnCalendarDay(rows,"2026-10-28").length,0);
 assert.equal(leaveOnCalendarDay(rows,"2026-10-27").length,3);
});

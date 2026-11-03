import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {notificationRetryDelay,runNotificationTasks} from "../src/lib/notificationRefreshControl.js";

test("global notification requests never exceed the concurrent worker budget",async()=>{
  let active=0,max=0;
  const tasks=Array.from({length:11},(_,i)=>async()=>{
    active++;max=Math.max(max,active);
    await new Promise(resolve=>setTimeout(resolve,5));
    active--;
    return {data:[i],error:null};
  });
  const rows=await runNotificationTasks(tasks,3);
  assert.equal(max,3);
  assert.deepEqual(rows.map(row=>row.data[0]),Array.from({length:11},(_,i)=>i));
});

test("one failing notification source cannot prevent other sources completing",async()=>{
  const rows=await runNotificationTasks([
    async()=>({data:["ok"]}),
    async()=>{throw Error("database timeout");},
    async()=>({data:["still ok"]}),
  ],2);
  assert.deepEqual(rows[0].data,["ok"]);
  assert.match(rows[1].error.message,/timeout/);
  assert.deepEqual(rows[2].data,["still ok"]);
});

test("notification retries back off rather than flood a slow database",()=>{
  assert.equal(notificationRetryDelay(1),30000);
  assert.equal(notificationRetryDelay(2),60000);
  assert.equal(notificationRetryDelay(3),120000);
  assert.equal(notificationRetryDelay(4),240000);
  assert.equal(notificationRetryDelay(5),360000);
});

test("shared notifications avoid overlapping requests and keep minute-level reminders",()=>{
  const hook=readFileSync("src/lib/useCeacUnreadNotifications.js","utf8");
  assert.match(hook,/document\.visibilityState==="hidden"\|\|inFlight/);
  assert.match(hook,/runNotificationTasks\(tasks,3\)/);
  assert.match(hook,/new AbortController\(\)/);
  assert.match(hook,/window\.setTimeout\(\(\)=>controller\.abort\(\),12000\)/);
  assert.match(hook,/nextFetchAt=Date\.now\(\)\+180000/);
  assert.match(hook,/publish\(Date\.now\(\)\)/);
  assert.match(hook,/activeController\?\.abort\(\)/);
});

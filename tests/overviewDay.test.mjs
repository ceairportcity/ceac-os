import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {filterDayNotices} from "../src/lib/overviewDay.js";
test("Work decision is only previewed once in Your Day",()=>{
  const notices=[{id:"work",url:"/?tab=work&item=task-a"},{id:"meeting",url:"/?tab=home&meeting=one"}];
  assert.deepEqual(filterDayNotices(notices,[{workItemId:"task-a"}]).map(row=>row.id),["meeting"]);
  assert.equal(notices.length,2);
});
test("Different decisions and unread notices remain independent",()=>{
  assert.equal(filterDayNotices([{url:"/?tab=work&item=other"}],[{workItemId:"one"}]).length,1);
});
test("All four role Overviews use the shared day panel",()=>{
  for(const path of ["staff-today/StaffTodayV2","manager-overview/ManagerOverviewV2",
    "executive-overview/ExecutiveOverviewV2","admin-overview/AdminOverviewV2"]){
    const source=readFileSync("src/experience-v2/"+path+".jsx","utf8");
    assert.match(source,/withOverviewActions\(notificationPanel,dayActions/);
  }
});

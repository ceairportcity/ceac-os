import test from "node:test";
import assert from "node:assert/strict";
import {ministryPeriodEvidence, latestUnitReportStatus, isIssuedUnitReport} from "../src/lib/ministryReportingFacts.js";
test("two departments contributing fifty books never create a 100-book organisational outcome",()=>{
 const x=ministryPeriodEvidence({
  unitReports:[{unit_id:"a",version:1,status:"submitted",narrative:"Made 50 books"},{unit_id:"b",version:1,status:"submitted",narrative:"Helped deliver 50 books"},{unit_id:"a",version:2,status:"draft",narrative:"Private pending new revision"}],
  objectives:[{id:"deliver50",name:"Produce 50 books",achieved_value:50,target_unit:"books"},{id:"deliver50",name:"Produce 50 books",achieved_value:50,target_unit:"books"}],
  milestones:[{id:"m1",name:"Print books"},{id:"m1",name:"Print books"}],
  activeUnitIds:["a","b","c"]
 });
 assert.equal(x.objectives.length,1);
 assert.equal(x.objectives[0].achieved_value,50);
 assert.equal(x.milestones.length,1);
 assert.equal(x.filedReports.length,2);
 assert.equal(x.filing.submitted,2);
 assert.deepEqual(x.filing.missing,["c"]);
 assert.ok(x.filing.visibleUnits!==x.filing.submitted);
 assert.ok(x.coverageNote.includes("not a measure of performance"));
});
test("latest issued version wins, drafts excluded, no synthetic scores",()=>{
 const x=ministryPeriodEvidence({unitReports:[
   {unit_id:"a",version:1,status:"submitted",narrative:"Old"},
   {unit_id:"a",version:2,status:"confirmed",narrative:"Revised"},
   {unit_id:"b",version:6,status:"draft",narrative:"not issued"}],
  activeUnitIds:["a","b"]});
 assert.equal(x.filedReports.length,1);
 assert.equal(x.filedReports[0].narrative,"Revised");
 assert.deepEqual(x.filing.missing,["b"]);
 assert.equal(x.rating,undefined);
});

test("Administration and Executive keep an issued version visible during a later unsubmitted correction",()=>{
 const latest=latestUnitReportStatus([
  {unit_id:"media",version:2,status:"submitted",narrative:"The issued record"},
  {unit_id:"media",version:3,status:"draft",narrative:"Not published"},
  {unit_id:"tech",version:1,status:"draft",narrative:"Not yet submitted"},
  {unit_id:"training",version:7,status:"returned",narrative:"Not issued"},
  {unit_id:"media",version:1,status:"confirmed",narrative:"Earlier approved"},
 ]);
 assert.equal(latest.media.version,2,"new draft cannot hide prior issued evidence");
 assert.equal(latest.media.narrative,"The issued record");
 assert.equal(latest.tech.status,"draft");
 assert.equal(latest.training,undefined,"returned is not submitted");
 assert.equal(isIssuedUnitReport(latest.media),true);
 assert.equal(isIssuedUnitReport(latest.tech),false);
 assert.deepEqual(Object.keys(latest).sort(),["media","tech"]);
});
test("same-version report revisions prefer the latest issued timestamp and never count unknown statuses",()=>{
 const latest=latestUnitReportStatus([
  {unit_id:"a",version:5,status:"submitted",submitted_at:"2026-09-02T09:00:00Z",narrative:"old"},
  {unit_id:"a",version:5,status:"confirmed",submitted_at:"2026-09-03T10:00:00Z",narrative:"new"},
  {unit_id:"a",version:6,status:"draft",narrative:"unreleased"},
  {unit_id:"b",version:1,status:"cancelled",narrative:"invalid"},
 ]);
 assert.equal(latest.a.narrative,"new");
 assert.equal(latest.b,undefined);
});

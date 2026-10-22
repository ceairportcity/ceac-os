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

test("Executive quarterly brief binds targets and evidence only to latest independently issued revision",()=>{
 const x=ministryPeriodEvidence({
  unitReports:[
   {id:"issued-old",unit_id:"u1",version:1,status:"submitted",narrative:"Original"},
   {id:"issued-current",unit_id:"u1",version:2,status:"confirmed",narrative:"Revised issued"},
   {id:"unissued",unit_id:"u2",version:3,status:"draft",narrative:"Private revision"},
  ],
  targets:[
   {id:"t-old",report_id:"issued-old",name:"Superseded target"},
   {id:"t-new",report_id:"issued-current",name:"Quarterly books",target_value:50,achieved_value:41,next_target_value:60,position:1},
   {id:"t-new",report_id:"issued-current",name:"Quarterly books duplicated by join",position:1},
   {id:"t-draft",report_id:"unissued",name:"Confidential unreleased next target"},
   {id:"t-unrelated",report_id:"other-org",name:"Unscoped target"},
  ],
  evidenceRefs:[
   {id:"e-current",report_id:"issued-current",label:"Verified in source workflow"},
   {id:"e-old",report_id:"issued-old",label:"Superseded version attachment"},
   {id:"e-draft",report_id:"unissued",label:"Private draft attachment"},
  ],
  activeUnitIds:["u1","u2"],
 });
 assert.deepEqual(x.unitTargets.map(t=>t.id),["t-new"]);
 assert.deepEqual(x.unitTargets.map(t=>t.unit_id),["u1"]);
 assert.equal(x.unitTargets[0].next_target_value,60);
 assert.deepEqual(x.unitEvidence.map(e=>e.id),["e-current"]);
 assert.deepEqual(x.filing.missing,["u2"]);
 assert.equal(x.filedReports[0].id,"issued-current");
});

import test from "node:test";
import assert from "node:assert/strict";
import {reconcileWorkforceRosterToday} from "../src/lib/workforceRosterToday.js";
const date="2026-10-22";
const week={thu:"office"};
const dayTypes=[{id:"office",name:"Office",session_expected:true}];
const roster=[
 {id:"roster-1",profile_id:"profile-1",full_name:"Linked staff",employment_status:"active",units:[{unit_name:"IT"}]},
 {id:"roster-2",profile_id:null,full_name:"Unlinked staff",employment_status:"active",units:[{unit_name:"Support"}]},
 {id:"roster-3",profile_id:null,full_name:"Former staff",employment_status:"inactive",units:[]},
];
const schedules=[
 {id:"week-1",employee_id:"roster-1",effective_from:"2026-10-01",effective_to:null,day_map:week},
 {id:"week-2",employee_id:"roster-2",effective_from:"2026-10-01",effective_to:null,day_map:week},
];
const linkedRows=[
 {profileId:"profile-1",name:"App account",started:false,sessionEvidenceUnavailable:false},
];
test("roster-first review includes unlinked staff with a schedule without alleging absence",()=>{
 const rows=reconcileWorkforceRosterToday({roster,linkedRows,schedules,dayTypes,date});
 assert.equal(rows.length,3);
 assert.equal(rows[0].name,"Linked staff");
 assert.equal(rows[0].category,"no_session_recorded");
 assert.equal(rows[1].unit,"Support");
 assert.equal(rows[1].loginAvailable,false);
 assert.equal(rows[1].configured,true);
 assert.equal(rows[1].category,"no_login_account");
 assert.equal(rows[2].category,"inactive");
});
test("unlinked roster with no schedule is not discarded or treated as absence",()=>{
 const rows=reconcileWorkforceRosterToday({roster,linkedRows,schedules:[],dayTypes,date});
 assert.equal(rows[1].category,"schedule_unconfigured");
 assert.equal(rows[1].loginAvailable,false);
});
test("unreconciled account remains visibly distinct from roster employee",()=>{
 const others=[...linkedRows,{profileId:"other",name:"Other profile",started:true}];
 const rows=reconcileWorkforceRosterToday({roster,linkedRows:others,schedules,dayTypes,date});
 assert.equal(rows.length,4);
 assert.equal(rows[3].category,"identity_unlinked");
 assert.equal(rows[3].employeeId,null);
});
test("missing historical day vocabulary is NOT taken as no expected work session",()=>{
 const rows=reconcileWorkforceRosterToday({roster,linkedRows,schedules,dayTypes:[],date});
 assert.equal(rows[0].category,"schedule_source_unavailable");
 assert.equal(rows[1].category,"schedule_source_unavailable");
});
test("reject duplicate employee accounts or incomplete scope before presenting coverage",()=>{
 assert.throws(()=>reconcileWorkforceRosterToday({roster:[roster[0],roster[0]],linkedRows,schedules,dayTypes,date}),/duplicated/);
 assert.throws(()=>reconcileWorkforceRosterToday({roster,linkedRows:null,schedules,dayTypes,date}),/incomplete/);
});

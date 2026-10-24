import test from "node:test";
import assert from "node:assert/strict";
import {adminWorkforceToday,clusterWorkStartLocations} from "../src/lib/adminWorkforceToday.js";

const roster=[
 {id:"employee-1",profile_id:"account-1",full_name:"Ama",units:[{name:"Media"}]},
 {id:"employee-2",profile_id:"account-2",full_name:"Kojo",units:[{name:"Operations"}]},
 {id:"employee-3",profile_id:null,full_name:"Rita",units:[{name:"Support"}]},
];

test("one row per employee, with first start coordinates rather than later session or checkpoint",()=>{
 const rows=adminWorkforceToday(roster,[
  {id:"later",profile_id:"account-1",started_at:"2026-10-21T11:00:00Z",ended_at:null,lat:6,lng:-1,location_captured_at:"2026-10-21T11:01:00Z"},
  {id:"first",profile_id:"account-1",started_at:"2026-10-21T08:00:00Z",ended_at:"2026-10-21T09:00:00Z",lat:5.6,lng:-.2,location_captured_at:"2026-10-21T08:00:30Z",location_accuracy_m:14},
 ],[],"first");
 assert.equal(rows.length,3);
 const ama=rows.find(row=>row.id==="employee-1");
 assert.equal(ama.firstStart,"2026-10-21T08:00:00Z");
 assert.equal(ama.latitude,5.6);
 assert.equal(ama.longitude,-.2);
 assert.equal(ama.accuracyM,14);
 assert.equal(ama.sessionCount,2);
 assert.equal(ama.open,true);
 assert.equal(rows.find(row=>row.id==="employee-3").firstStart,null);
});
test("missing GPS does not become a plotted location even when later session has coordinates",()=>{
 const rows=adminWorkforceToday(roster,[
  {id:"first",profile_id:"account-1",started_at:"2026-10-21T08:00:00Z",ended_at:null,lat:null,lng:null},
  {id:"later",profile_id:"account-1",started_at:"2026-10-21T09:00:00Z",ended_at:null,lat:5.6,lng:-.2},
 ],[],"first");
 assert.equal(rows[0].latitude,null);
 assert.equal(clusterWorkStartLocations(rows).length,0);
});
test("valid zero coordinates remain legitimate evidence rather than treated as false",()=>{
 const rows=adminWorkforceToday(roster,[
  {id:"zero",profile_id:"account-2",started_at:"2026-10-21T08:00:00Z",ended_at:null,lat:0,lng:0},
 ],[],"first");
 assert.equal(clusterWorkStartLocations(rows).length,1);
 assert.deepEqual([clusterWorkStartLocations(rows)[0].lat,clusterWorkStartLocations(rows)[0].lng],[0,0]);
});
test("same recorded location clusters people without hiding separate identities",()=>{
 const rows=adminWorkforceToday(roster,[
  {id:"a",profile_id:"account-1",started_at:"2026-10-21T08:00:00Z",ended_at:null,lat:5.6,lng:-.2},
  {id:"b",profile_id:"account-2",started_at:"2026-10-21T08:30:00Z",ended_at:null,lat:5.6,lng:-.2},
 ],[],"first");
 const clusters=clusterWorkStartLocations(rows);
 assert.equal(clusters.length,1);
 assert.deepEqual(clusters[0].people.map(person=>person.name),["Ama","Kojo"]);
});
test("invalid coordinate, unknown profile and missing source array remain explicit",()=>{
 const result=adminWorkforceToday(roster,[
  {id:"x",profile_id:"account-2",started_at:"2026-10-21T08:00:00Z",ended_at:null,lat:95,lng:200},
  {id:"y",profile_id:"unlinked-profile",started_at:"2026-10-21T10:00:00Z",ended_at:null,lat:null,lng:null},
 ],[],"first");
 assert.equal(result.find(x=>x.id==="employee-2").latitude,null);
 assert.equal(result.find(x=>x.id==="profile:unlinked-profile").name,"Employee record unavailable");
 assert.throws(()=>adminWorkforceToday(null,[]),/incomplete/);
});


test("authorised operational profile resolves unlinked staff without inventing a canonical roster record",()=>{
 const rows=adminWorkforceToday(roster,[
  {id:"earlier",profile_id:"operational-account",started_at:"2026-10-21T08:00:00Z",ended_at:"2026-10-21T09:00:00Z",lat:5.63,lng:-.18},
  {id:"later",profile_id:"operational-account",started_at:"2026-10-21T10:00:00Z",ended_at:null,lat:6.2,lng:0.4},
 ],[{profile_id:"operational-account",full_name:"Operational colleague",unit_name:"Creative Team"}],"first");
 const match=rows.filter(row=>row.profileId==="operational-account");
 assert.equal(match.length,1);
 assert.equal(match[0].name,"Operational colleague");
 assert.equal(match[0].unit,"Creative Team");
 assert.equal(match[0].firstStart,"2026-10-21T08:00:00Z");
 assert.equal(match[0].latitude,5.63);
 assert.equal(match[0].sessionCount,2);
 assert.equal(match[0].open,true);
 assert.equal(match[0].linked,false);
 assert.equal(rows.length,4);
});
test("canonical linked roster identity always outranks operational account projection",()=>{
 const rows=adminWorkforceToday(roster,[
  {id:"a",profile_id:"account-1",started_at:"2026-10-21T08:00:00Z",lat:5.6,lng:-.2},
 ],[{profile_id:"account-1",full_name:"Conflicting operational spelling",unit_name:"Other"}]);
 const canonical=rows.find(row=>row.profileId==="account-1");
 assert.equal(canonical.id,"employee-1");
 assert.equal(canonical.name,"Ama");
 assert.equal(rows.length,3);
});

test("latest start is default while first start and full session history remain available",()=>{
 const sessions=[{id:"a",profile_id:"account-1",started_at:"2026-10-24T08:00:00Z",ended_at:null,lat:5.6,lng:-.2,place:"elsewhere"},{id:"b",profile_id:"account-1",started_at:"2026-10-24T10:00:00Z",ended_at:"2026-10-24T11:00:00Z",lat:5.7,lng:-.3,place:"office"}];
 const latest=adminWorkforceToday(roster,sessions)[0];assert.equal(latest.firstStart,sessions[0].started_at);assert.equal(latest.mapStart,sessions[1].started_at);assert.equal(latest.latitude,5.7);assert.equal(latest.place,"office");assert.equal(latest.open,true);assert.equal(latest.mapOpen,false);assert.equal(latest.startHistory.length,2);
 assert.equal(adminWorkforceToday(roster,sessions,[],"first")[0].latitude,5.6);
});
test("a missing latest capture is not replaced by an earlier GPS fix",()=>{
 const rows=adminWorkforceToday(roster,[{id:"a",profile_id:"account-1",started_at:"2026-10-24T08:00:00Z",lat:5.6,lng:-.2},{id:"b",profile_id:"account-1",started_at:"2026-10-24T10:00:00Z",lat:null,lng:null}]);
 assert.equal(rows[0].latitude,null);assert.equal(clusterWorkStartLocations(rows).length,0);assert.equal(rows[0].startHistory.length,2);
});

test("department labels preserve commas and multiple memberships for exact filtering",()=>{
 const [person]=adminWorkforceToday([{id:"employee-comma",profile_id:null,full_name:"Synthetic colleague",units:[{name:"Facilities, Logistics and Procurement"},{name:"Operations"}]}],[]);
 assert.deepEqual(person.unitNames,["Facilities, Logistics and Procurement","Operations"]);
 assert.equal(person.unitNames.includes("Facilities, Logistics and Procurement"),true);
 assert.equal(person.unitNames.includes("Facilities"),false);
 const [fallback]=adminWorkforceToday([{id:"fallback",unit_name:"Facilities, Logistics and Procurement"}],[]);
 assert.deepEqual(fallback.unitNames,["Facilities, Logistics and Procurement"]);
});

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
 ]);
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
 ]);
 assert.equal(rows[0].latitude,null);
 assert.equal(clusterWorkStartLocations(rows).length,0);
});
test("valid zero coordinates remain legitimate evidence rather than treated as false",()=>{
 const rows=adminWorkforceToday(roster,[
  {id:"zero",profile_id:"account-2",started_at:"2026-10-21T08:00:00Z",ended_at:null,lat:0,lng:0},
 ]);
 assert.equal(clusterWorkStartLocations(rows).length,1);
 assert.deepEqual([clusterWorkStartLocations(rows)[0].lat,clusterWorkStartLocations(rows)[0].lng],[0,0]);
});
test("same recorded location clusters people without hiding separate identities",()=>{
 const rows=adminWorkforceToday(roster,[
  {id:"a",profile_id:"account-1",started_at:"2026-10-21T08:00:00Z",ended_at:null,lat:5.6,lng:-.2},
  {id:"b",profile_id:"account-2",started_at:"2026-10-21T08:30:00Z",ended_at:null,lat:5.6,lng:-.2},
 ]);
 const clusters=clusterWorkStartLocations(rows);
 assert.equal(clusters.length,1);
 assert.deepEqual(clusters[0].people.map(person=>person.name),["Ama","Kojo"]);
});
test("invalid coordinate, unknown profile and missing source array remain explicit",()=>{
 const result=adminWorkforceToday(roster,[
  {id:"x",profile_id:"account-2",started_at:"2026-10-21T08:00:00Z",ended_at:null,lat:95,lng:200},
  {id:"y",profile_id:"unlinked-profile",started_at:"2026-10-21T10:00:00Z",ended_at:null,lat:null,lng:null},
 ]);
 assert.equal(result.find(x=>x.id==="employee-2").latitude,null);
 assert.equal(result.find(x=>x.id==="profile:unlinked-profile").name,"Employee record unavailable");
 assert.throws(()=>adminWorkforceToday(null,[]),/incomplete/);
});

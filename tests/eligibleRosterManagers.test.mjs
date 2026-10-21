import test from "node:test";
import assert from "node:assert/strict";
import {eligibleRosterManagers} from "../src/lib/eligibleRosterManagers.js";

const people=[
 {profile_id:"manager-1",full_name:"Manager A",active:true,account_active:true,unit_id:"unit-a"},
 {profile_id:"manager-2",full_name:"Manager B",active:true,account_active:true,unit_id:"unit-b"},
 {profile_id:"former-manager",full_name:"Former manager",active:false,account_active:true,unit_id:"unit-b"},
 {profile_id:"closed-account",full_name:"Deactivated account",active:true,account_active:false,unit_id:"unit-b"},
 {profile_id:null,full_name:"Roster-only name with Manager title",active:true,account_active:false,unit_id:"unit-b"},
];
const memberships=[
 {profile_id:"manager-1",unit_id:"unit-a",role:"manager"},
 {profile_id:"manager-1",unit_id:"unit-b",role:"manager"},
 {profile_id:"manager-2",unit_id:"unit-b",role:"manager"},
 {profile_id:"former-manager",unit_id:"unit-b",role:"manager"},
 {profile_id:"closed-account",unit_id:"unit-b",role:"manager"},
 {profile_id:"former-manager",unit_id:"unit-a",role:"member"},
];

test("real multi-unit managers appear for additional managed department",()=>{
 const eligible=eligibleRosterManagers(people,memberships,"unit-b");
 assert.deepEqual(eligible.map(person=>person.profile_id),["manager-1","manager-2"]);
});
test("primary-unit position and display title cannot impersonate manager authority",()=>{
 assert.deepEqual(eligibleRosterManagers(people,memberships,"unit-a").map(p=>p.profile_id),["manager-1"]);
 assert.deepEqual(eligibleRosterManagers(people,[],"unit-b"),[]);
});
test("inactive employment or inactive login is not selectable",()=>{
 assert.equal(eligibleRosterManagers(people,memberships,"unit-b").length,2);
});
test("incomplete source is rejected instead of treated as all clear",()=>{
 assert.throws(()=>eligibleRosterManagers(people,null,"unit-b"),/incomplete/);
 assert.throws(()=>eligibleRosterManagers(people,[{profile_id:"manager-1",unit_id:"unit-b"}],"unit-b"),/inconsistent/);
});
test("unassigned primary department has no manager option",()=>{
 assert.deepEqual(eligibleRosterManagers(people,memberships,""),[]);
});

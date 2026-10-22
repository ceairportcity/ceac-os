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
test("an authorised operational manager without any linked HR roster record remains selectable",()=>{
 const operational=[
  {profile_id:"manager-2",full_name:"Manager B",active:true,account_active:true},
  {profile_id:null,full_name:"Unlinked roster person titled Manager",active:true,account_active:false},
 ];
 // Neither roster membership nor a job title is the source of permission.
 const results=eligibleRosterManagers(operational,memberships,"unit-b");
 assert.deepEqual(results.map(person=>person.profile_id),["manager-2"]);
});

test("a manager with inactive employment or login is rejected regardless of unit membership",()=>{
 const inactiveEmployment=[{profile_id:"manager-2",full_name:"Manager B",active:false,account_active:true}];
 const disabledAccount=[{profile_id:"manager-2",full_name:"Manager B",active:true,account_active:false}];
 assert.deepEqual(eligibleRosterManagers(inactiveEmployment,memberships,"unit-b"),[]);
 assert.deepEqual(eligibleRosterManagers(disabledAccount,memberships,"unit-b"),[]);
});

test("unassigned primary department has no manager option",()=>{
 assert.deepEqual(eligibleRosterManagers(people,memberships,""),[]);
});

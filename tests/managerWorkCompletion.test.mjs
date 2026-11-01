import test from "node:test";
import assert from "node:assert/strict";
import { canSelfCertifyOwnWork } from "../src/lib/workCompletion.js";

const manager = {id:"person-a", memberships:[{unit_id:"unit-a",role:"manager"}]};
const task = {id:"work-a",kind:"task",assignee_id:"person-a",assigned_by:"exec-b",origin:"assigned_by_exec",unit_id:"unit-a"};

test("manager may finish an executive-assigned responsibility without routine review",()=>{
 assert.equal(canSelfCertifyOwnWork(manager,task),true);
});
test("unrelated manager and staff cannot self-certify another person's work",()=>{
 assert.equal(canSelfCertifyOwnWork({...manager,id:"other"},task),false);
 assert.equal(canSelfCertifyOwnWork({...manager,memberships:[]},task),false);
 assert.equal(canSelfCertifyOwnWork({...manager,memberships:[{unit_id:"unit-b",role:"manager"}]},task),false);
});
test("manager can finish self-created work and cannot finish work assigned to another person",()=>{
 assert.equal(canSelfCertifyOwnWork(manager,{...task,origin:"self_created",assigned_by:"person-a"}),true);
 assert.equal(canSelfCertifyOwnWork(manager,{...task,assignee_id:"other"}),false);
});

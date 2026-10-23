import test from "node:test";
import assert from "node:assert/strict";
import {nextWorkforceClusterPersonId} from "../src/lib/workforceStreetMap.js";
test("shared GPS marker cycles across all people at a real coordinate",()=>{
 const people=[{id:"person-a"},{id:"person-b"},{id:"person-c"}];
 assert.equal(nextWorkforceClusterPersonId(people,null),"person-a");
 assert.equal(nextWorkforceClusterPersonId(people,"person-a"),"person-b");
 assert.equal(nextWorkforceClusterPersonId(people,"person-b"),"person-c");
 assert.equal(nextWorkforceClusterPersonId(people,"person-c"),"person-a");
});
test("does not create a marker identity where no source people exist",()=>{
 assert.equal(nextWorkforceClusterPersonId([],null),null);
 assert.equal(nextWorkforceClusterPersonId([{id:"only"}],"stale"),"only");
});

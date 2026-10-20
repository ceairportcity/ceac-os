import test from "node:test";
import assert from "node:assert/strict";
import { currentProjectActions, visibleProjectPeople } from "../src/lib/projectContributionPeople.js";

test("project contributors include actual cross-person work without inventing completed tasks", () => {
  const work = [
    { id: "w1", assignee_id: "a", profiles: { full_name: "Assigned A" } },
    { id: "w2", assignee_id: "a", profiles: { full_name: "Assigned A" } },
    { id: "w3", assignee_id: "c", profiles: { full_name: "Assigned C" } },
  ];
  const actions = [
    { contributor_id: "a", contributor: { full_name: "Assigned A" } },
    { contributor_id: "b", contributor: { full_name: "Contributor B" } },
    { contributor_id: "b", contributor: { full_name: "Contributor B" } },
  ];
  const people = visibleProjectPeople(work, actions);
  assert.equal(people.length, 3);
  assert.deepEqual(people.find(p=>p.id==="a"), { id:"a",name:"Assigned A",assignedWorkCount:2,recordedActionCount:1 });
  assert.deepEqual(people.find(p=>p.id==="b"), { id:"b",name:"Contributor B",assignedWorkCount:0,recordedActionCount:2 });
  assert.deepEqual(people.find(p=>p.id==="c"), { id:"c",name:"Assigned C",assignedWorkCount:1,recordedActionCount:0 });
});

test("corrected activity replaces original rather than double-counting evidence", () => {
  const rows = [
    {id:"original",supersedes_id:null,recorded_at:"2026-10-20T10:00:00Z"},
    {id:"fixed",supersedes_id:"original",recorded_at:"2026-10-20T11:00:00Z"},
  ];
  assert.deepEqual(currentProjectActions(rows).map(row=>row.id),["fixed"]);
  assert.deepEqual(currentProjectActions([]),[]);
});

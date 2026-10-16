import test from "node:test";
import assert from "node:assert/strict";
import { HUMAN_RUBRIC_CATEGORIES, HUMAN_RATING_OPTIONS, blankHumanRubric,
  validateHumanRubric, canHumanReview } from "../src/lib/stage2HumanRubric.js";
const eid = "10000000-0000-4000-8000-000000000001";
const sample = () => ({
  categories: HUMAN_RUBRIC_CATEGORIES.map(({key}) => ({
    category:key, rating:"3", explanation:"Manager's specific assessment: recorded deliverable and documented contribution.",
    evidenceIds:[eid],
  })),
  overallRating:"4", overallNarrative:"Manager selected this independent overall judgment with contextual reasons.",
  strengths:"Strengths grounded in accepted project work and actual contributions.",
  challenges:"Difficulties in coordinating deadlines, without presumed culpability.",
  improvementActions:"Meet fortnightly to review agreed corrective actions and evidence.",
  nextResponsibilities:"Prepare next quarter departmental plans and follow up on results.",
});
test("only the five approved categories and human rating scale exist", () => {
  assert.deepEqual(HUMAN_RUBRIC_CATEGORIES.map(x=>x.key),
    ["delivery","quality","ownership","initiative","collaboration"]);
  assert.deepEqual(HUMAN_RATING_OPTIONS.map(x=>x.value),
    ["1","2","3","4","5","N/O"]);
});
test("blank draft is not submitted as a completed quarterly review", () => {
  assert.equal(validateHumanRubric(blankHumanRubric()).valid,false);
});
test("valid manager-selected quarterly rubric preserves independent overall 4", () => {
  const result=validateHumanRubric(sample());
  assert.equal(result.valid,true);
  assert.equal(result.payload.overallRating,"4");
  assert.deepEqual(result.payload.categories.map(x=>x.rating),["3","3","3","3","3"]);
  assert.equal(Object.hasOwn(result.payload,"calculatedScore"),false);
});
test("monthly has optional ratings; partial monthly review cannot masquerade as a completed rubric", () => {
  assert.equal(validateHumanRubric(null,{cadence:"monthly"}).valid,true);
  assert.equal(validateHumanRubric(null,{cadence:"monthly"}).payload,null);
  assert.equal(validateHumanRubric(blankHumanRubric(),{cadence:"monthly"}).valid,false);
  assert.equal(validateHumanRubric(null,{cadence:"quarterly"}).valid,false);
});
test("every category must have an explanation and real evidence or a reasoned N/O", () => {
  const d=sample();d.categories[0].explanation="Poor";d.categories[1].evidenceIds=[];
  const q=validateHumanRubric(d);
  assert.equal(q.valid,false);
  assert.ok(q.errors.some(x=>x.includes("Delivery")));
  assert.ok(q.errors.some(x=>x.includes("Quality")));
  d.categories[0].explanation="The evidence for this category is not yet fully available.";
  d.categories[1].rating="N/O";
  assert.equal(validateHumanRubric(d).valid,true);
});
test("reasoned N/O is not zero or invented evidence", () => {
  const p=sample();p.categories[2]={category:"ownership",rating:"N/O",
    explanation:"Manager has not directly observed this category in this review period.",
    evidenceIds:[]};
  p.overallRating="N/O";
  const result=validateHumanRubric(p);
  assert.equal(result.valid,true);
  assert.equal(result.payload.overallRating,"N/O");
});
test("duplicate, missing or unfamiliar categories fail closed", () => {
  const r=sample();r.categories[4].category="delivery";
  assert.equal(validateHumanRubric(r).valid,false);
  const t=sample();t.categories.pop();
  assert.equal(validateHumanRubric(t).valid,false);
  const u=sample();u.categories[2].category="attendance";
  assert.equal(validateHumanRubric(u).valid,false);
});
test("references must be UUIDs, distinct and relevant server-side", () => {
  const p=sample();p.categories[0].evidenceIds=[eid,eid];
  assert.equal(validateHumanRubric(p).valid,false);
  p.categories[0].evidenceIds=["an invented reference"];
  assert.equal(validateHumanRubric(p).valid,false);
});
test("overall narrative and all next-step fields are required, not computed", () => {
  for(const key of ["overallRating","overallNarrative","strengths","challenges","improvementActions","nextResponsibilities"]){
    const p=sample();p[key]="";
    assert.equal(validateHumanRubric(p).valid,false,key);
  }
});
test("reviewer must be assigned, distinct from employee and case open", () => {
  const input={reviewerId:"r",employeeId:"e",caseReviewerId:"r",caseOpen:true,cadence:"quarterly"};
  assert.equal(canHumanReview(input),true);
  assert.equal(canHumanReview({...input,employeeId:"r"}),false);
  assert.equal(canHumanReview({...input,caseReviewerId:"other"}),false);
  assert.equal(canHumanReview({...input,caseOpen:false}),false);
});

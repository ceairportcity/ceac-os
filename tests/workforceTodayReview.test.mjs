import test from "node:test";
import assert from "node:assert/strict";
import {workforceTodayReviewCategory,workforceTodayReviewNeedsReview} from "../src/lib/workforceTodayReview.js";

test("approved leave is not converted to missing attendance",()=>{
 const status=workforceTodayReviewCategory({configured:true,expected:true,started:false,approvedLeave:true});
 assert.equal(status,"approved_leave");
 assert.equal(workforceTodayReviewNeedsReview(status),false);
});
test("a failed session read never implies no session or absence",()=>{
 const status=workforceTodayReviewCategory({configured:true,expected:true,started:false,sessionEvidenceUnavailable:true});
 assert.equal(status,"evidence_unavailable");
 assert.equal(workforceTodayReviewNeedsReview(status),true);
});
test("unconfigured work pattern and missing expected start are different review needs",()=>{
 assert.equal(workforceTodayReviewCategory({configured:false,expected:null,started:false}),"schedule_unconfigured");
 assert.equal(workforceTodayReviewCategory({configured:true,expected:true,started:false}),"no_session_recorded");
 assert.equal(workforceTodayReviewCategory({configured:true,expected:false,started:false}),"no_session_expected");
});
test("recorded starts are factual, not earned performance scores",()=>{
 const status=workforceTodayReviewCategory({configured:true,expected:true,started:true});
 assert.equal(status,"recorded_start");
 assert.equal(workforceTodayReviewNeedsReview(status),false);
});

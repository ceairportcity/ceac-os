import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  classifyPreviewFeatureResult,
  isPendingVolunteerRecommendationsTable,
  isPendingAttendanceIntegrityStatus,
} from "../src/lib/pendingFeatureCompatibility.js";

test("only the exact unapplied volunteer table is classified as pending", () => {
  const missing = { code: "PGRST205", message: "Could not find the table 'public.volunteer_change_recommendations' in the schema cache" };
  assert.equal(isPendingVolunteerRecommendationsTable(missing), true);
  assert.equal(isPendingVolunteerRecommendationsTable({ code:"42P01", message:'relation "public.volunteer_change_recommendations" does not exist' }), true);
  assert.equal(isPendingVolunteerRecommendationsTable({ code:"42501", message:missing.message }), false);
  assert.equal(isPendingVolunteerRecommendationsTable({ code:"PGRST205", message:"Could not find table public.payroll_entries" }), false);
});

test("only exact missing attendance-integrity RPC is classified as pending", () => {
  const missing = { code: "PGRST202", message:"Could not find the function public.attendance_integrity_status without parameters in the schema cache" };
  assert.equal(isPendingAttendanceIntegrityStatus(missing), true);
  assert.equal(isPendingAttendanceIntegrityStatus({ code:"42883", message:"function public.attendance_integrity_status() does not exist" }), true);
  assert.equal(isPendingAttendanceIntegrityStatus({ code:"42501", message:missing.message }), false);
  assert.equal(isPendingAttendanceIntegrityStatus({ code:"PGRST202", message:"Could not find public.payroll_readiness_summary" }), false);
});

test("absence is not treated as a successful empty business result", () => {
  const classified = classifyPreviewFeatureResult("volunteerRecommendations", {
    data: null, error: { code:"PGRST205", message:"Could not find the table 'public.volunteer_change_recommendations' in the schema cache" },
  });
  assert.deepEqual(classified, { available:false, data:null, error:null });
  assert.deepEqual(classifyPreviewFeatureResult("volunteerRecommendations", { data: [], error:null }),
    { available:true, data:[], error:null });
});

test("permission and network failures propagate unchanged", () => {
  const denied = { code:"42501", message:"permission denied for volunteer_change_recommendations" };
  const timeout = { name:"TypeError", message:"Failed to fetch" };
  assert.equal(classifyPreviewFeatureResult("volunteerRecommendations", {error:denied}).error, denied);
  assert.equal(classifyPreviewFeatureResult("attendanceIntegrity", {error:timeout}).error, timeout);
  assert.equal(classifyPreviewFeatureResult("unknown", {error:{code:"PGRST202",message:"Could not find attendance_integrity_status"}}).available,false);
});

test("people detail keeps secure RPC errors fatal but labels unavailable recommendations", () => {
  const people = readFileSync("src/screens/People.jsx","utf8");
  assert.match(people, /classifyPreviewFeatureResult\("volunteerRecommendations", recommendationResponse\)/);
  assert.match(people, /\|\| volunteerFeature\.error/);
  assert.match(people, /setVolunteerRecommendationsAvailable\(volunteerFeature\.available\)/);
  assert.match(people, /Volunteer recommendations pending/);
  assert.match(people, /recommendation history and decisions remain unavailable/);
});

test("office settings preserve existing fields and disable undeployed attendance controls", () => {
  const office = readFileSync("src/screens/OfficeSettings.jsx","utf8");
  assert.match(office, /classifyPreviewFeatureResult\("attendanceIntegrity", integrityResult\)/);
  assert.match(office, /if \(integrityFeature\.error\)/);
  assert.match(office, /setIntegrityAvailable\(integrityFeature\.available\)/);
  assert.match(office, /integrityAvailable\?<AttendanceCodeIssuer me=\{me\}/);
  assert.match(office, /Check-in codes unavailable/);
  assert.doesNotMatch(office, /attendance_set_office_code/);
  assert.match(office, /<DutyLocationSettings me=\{me\}/);
});

import test from "node:test";
import assert from "node:assert/strict";
import { isolatedStage2FocusedScope } from "../scripts/ci/stage2-focused-scope.mjs";
const p3 = "src/components/EmployeeWorkSession.jsx";
const p3test = "tests/stage2SharedPersonalSession.test.mjs";
const p6 = "src/screens/ManagerReports.jsx";
const p6test = "tests/experience-v2-reports-manager.spec.js";
const judge = (subject, tipFiles, eventName = "pull_request") =>
  isolatedStage2FocusedScope({ subject, tipFiles, eventName });
test("tagged P3 attendance source with matching tests uses targeted Workforce browser", () => {
  assert.equal(judge("[p3-attendance] verify stale sessions", [p3, p3test]), "workforce");
  assert.equal(judge("[p3-attendance] verify Workforce", ["src/screens/Workforce.jsx", "tests/experience-v2-workforce-admin.spec.js"]), "workforce");
});
test("tagged P6 reporting source with matching acceptance uses targeted Manager browser", () => {
  assert.equal(judge("[p6-reports] truthful evidence", [p6, p6test]), "reports");
});
test("security, database, CI, unrelated product, docs and visual changes cannot opt out of full PR checks", () => {
  for (const path of [
    "supabase/migrations/20261017010000_156_stage2_provider_neutral_auth_storage_reconciliation.sql",
    "supabase/functions/integration-runtime/index.ts", ".github/workflows/quality-gate.yml",
    "scripts/ci/classify-verification.mjs", "src/lib/supabase.js",
    "src/components/Stage2UniversalMfaGate.jsx", "src/screens/AdminProtectedHR.jsx",
    "src/screens/ExecutiveHome.jsx", "docs/security/CEAC_STAGE2_AUTH_SESSION_POLICY_2026-10-16.md",
    "tests/visual-regression.spec.js", "tests/experience-v2-workforce-admin.spec.js",
  ]) assert.equal(judge("[p6-reports] change", [p6, path]), null, path);
  assert.equal(judge("[p3-attendance] change", [p3, "src/screens/ManagerReports.jsx"]), null);
});
test("manual/full acceptance, test-only, mixed stages and non-PR changes stay full", () => {
  assert.equal(judge("[p3-attendance] [level-b] closure", [p3]), null);
  assert.equal(judge("[p6-reports] [level-b] closure", [p6]), null);
  assert.equal(judge("[p3-attendance] [p6-reports] mixed", [p3]), null);
  assert.equal(judge("update session", [p3]), null);
  assert.equal(judge("[p3-attendance] test-only", [p3test]), null);
  assert.equal(judge("[p6-reports] test-only", [p6test]), null);
  assert.equal(judge("[p6-reports] push", [p6], "push"), null);
  assert.equal(judge("[p3-attendance] dispatch", [p3], "workflow_dispatch"), null);
  assert.equal(judge("[p3-attendance] empty", []), null);
});


test("P6 personal read-only reporting may use exact-head source and browser assurance", () => {
 const screen="src/screens/PersonalAchievements.jsx";
 assert.equal(judge("[p6-personal] bounded report", [screen, "tests/stage2OwnerReportingSource.test.mjs"]), "personal");
 assert.equal(judge("[p6-personal] verify provider errors", [screen, "tests/experience-v2-personal-achievements.spec.js"]), "personal");
 assert.equal(judge("[p6-personal] report implementation", [screen]), "personal");
 for (const unsafe of [
   "src/lib/stage2AchievementMetrics.js",
   "src/screens/ManagerReports.jsx",
   "src/components/StructuredAppraisalRatings.jsx",
   "src/screens/AdminProtectedHR.jsx",
   "src/lib/supabase.js",
   "tests/visual-regression.spec.js",
   "tests/experience-v2-reports-manager.spec.js",
   "scripts/ci/run-level-a-browser.sh",
 ]) assert.equal(judge("[p6-personal] unsafe", [screen,unsafe]),null,unsafe);
 assert.equal(judge("[p6-personal] test only",["tests/stage2OwnerReportingSource.test.mjs"]),null);
});
test("P7 focused CSS stays in one People component and cannot change global visuals or baselines", () => {
 const peopleCss="src/experience-v2/people-family/people-family.css";
 assert.equal(judge("[p7-people-css] remove dead people styles",[peopleCss]),"p7-people");
 for (const unsafe of [
   "src/styles.css",
   "src/experience-v2/shell/shell.css",
   "src/experience-v2/calendar/calendar.css",
   "src/role-styles/executive-redesign.css",
   "tests/visual-home-baselines.js",
   "tests/visual-regression.spec.js",
   "tests/visual-fidelity-performance-closure.spec.js",
   "supabase/migrations/20261017010000_156_stage2_provider_neutral_auth_storage_reconciliation.sql",
   "docs/design/CEAC_STAGE2_V4_VISUAL_PRODUCT_LOCK_2026-10-16.md",
   ".github/workflows/ci.yml",
 ]) assert.equal(judge("[p7-people-css] bypass?",[peopleCss,unsafe]),null,unsafe);
 assert.equal(judge("[p7-people-css] [level-b] final acceptance",[peopleCss]),null);
 assert.equal(judge("[p7-people-css] no source",[]),null);
});
test("focused classification never bypasses security/full release or mixed change boundaries",()=>{
 const source="src/screens/PersonalAchievements.jsx";
 assert.equal(judge("[p6-personal] [p7-people-css] mixed",[source]),null);
 assert.equal(judge("[p6-personal] [level-b] stage close",[source]),null);
 assert.equal(judge("[p6-personal] dispatch",[source],"workflow_dispatch"),null);
 assert.equal(judge("[p6-personal] push",[source],"push"),null);
});

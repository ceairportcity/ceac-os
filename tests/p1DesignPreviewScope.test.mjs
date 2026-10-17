import test from "node:test";
import assert from "node:assert/strict";
import { isIsolatedP1PreviewChange } from "../scripts/ci/p1-design-preview-scope.mjs";
const html = "docs/design/stage2-v4/CEAC_STAGE2_P1_CONNECTED_ROLE_REVIEW.html";
const browser = "tests/stage2-p1-connected-review.spec.js";
const docs = "docs/design/CEAC_STAGE2_P1_CONNECTED_DESIGN_REVIEW_2026-10-17.md";
function classify(files, options = {}) {
  return isIsolatedP1PreviewChange({
    eventName: options.eventName ?? "pull_request",
    subject: options.subject ?? "design(stage2): [p1-design] refine isolated prototype",
    tipFiles: files,
  });
}
test("isolated P1 prototype and focused tests can be Level A only when explicitly marked", () => {
  assert.equal(classify([html, browser, docs]), true);
  assert.equal(classify([html]), true);
  assert.equal(classify([docs]), false);
  assert.equal(classify([]), false);
  assert.equal(classify([browser], { subject:"design: improve" }), false);
});
test("no auth, SQL, source, generic browser or visual threshold changes qualify", () => {
  for (const file of [
    "src/App.jsx","src/screens/ManagerReports.jsx",
    "supabase/migrations/20261017010000_156_stage2_provider_neutral_auth_storage_reconciliation.sql",
    "tests/experience-v2-reports-manager.spec.js",
    "tests/visual-fidelity-state-closure.spec.js",
    "scripts/ci/classify-verification.mjs",
    ".github/workflows/quality-gate.yml",
    "docs/design/stage2-v4/CEAC_STAGE2_V4_PROJECTS.png",
    "src/experience-v2.css",
    "tests/stage2UniversalMfaPolicy.test.js",
    "AGENTS.md",
  ]) assert.equal(classify([html,file]), false, "wrongly classified: "+file);
});
test("manual Level B, non-PR and unmarked changes always retain full checking", () => {
  assert.equal(classify([html,browser], { subject:"[p1-design] [level-b] P1 close" }), false);
  assert.equal(classify([html,browser], { eventName:"workflow_dispatch" }), false);
  assert.equal(classify([html,browser], { eventName:"push" }), false);
  assert.equal(classify([html,browser], { subject:"[level-b] release acceptance" }), false);
});

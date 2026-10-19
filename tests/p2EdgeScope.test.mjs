import test from "node:test";
import assert from "node:assert/strict";
import { isIsolatedP2EdgeChange } from "../scripts/ci/p2-edge-scope.mjs";
const edge = "supabase/functions/integration-runtime/index.ts";
const module = "supabase/functions/integration-runtime/mfa.mjs";
const native = "tests/integration-runtime.test.mjs";
function classify(files, options = {}) {
  return isIsolatedP2EdgeChange({
    eventName: options.eventName ?? "pull_request",
    subject: options.subject ?? "[p2-security] provider-verified Edge check",
    tipFiles: files,
  });
}
test("tagged P2 Edge-only sources may use focused security checks", () => {
  assert.equal(classify([edge]), true);
  assert.equal(classify([edge, module, native]), true);
  assert.equal(classify([module], {subject: "[p2-edge] auth safeguard"}), true);
  assert.equal(classify([native]), false);
  assert.equal(classify([]), false);
});
test("SQL, Auth UI, CI, browser and unrelated changes cannot qualify", () => {
  for (const file of [
    "src/App.jsx", "src/components/Stage2UniversalMfaGate.jsx",
    "supabase/migrations/20261017010000_156_stage2_provider_neutral_auth_storage_reconciliation.sql",
    "supabase/tests/stage2_universal_totp_all_roles_gate.sql",
    ".github/workflows/quality-gate.yml", "scripts/ci/classify-verification.mjs",
    "tests/account-mfa-local-only.spec.js", "src/screens/ExecutiveReports.jsx",
  ]) assert.equal(classify([edge, file]), false, file);
});
test("manual release checks and untagged/non-PR changes remain full", () => {
  assert.equal(classify([edge], {subject: "[p2-security] [level-b] P2 closure"}), false);
  assert.equal(classify([edge], {subject: "fix: Edge security"}), false);
  assert.equal(classify([edge], {eventName: "push"}), false);
  assert.equal(classify([edge], {eventName: "workflow_dispatch"}), false);
});

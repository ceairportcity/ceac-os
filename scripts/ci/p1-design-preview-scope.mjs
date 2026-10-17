/**
 * Strict, explicit Level A gate for isolated standalone P1 design-preview work.
 * Never applies to application source, protected security code, SQL, CI config,
 * visual baselines or general Playwright acceptance contracts.
 * P1/P7/P8 full exact-SHA certification remains mandatory at their stage boundaries.
 */
const P1_PREVIEW_ALLOWLIST = new Set([
  "docs/design/stage2-v4/CEAC_STAGE2_P1_CONNECTED_ROLE_REVIEW.html",
  "docs/design/CEAC_STAGE2_P1_CONNECTED_DESIGN_REVIEW_2026-10-17.md",
  "docs/design/CEAC_STAGE2_P1_FINITE_FAMILY_REVIEW_2026-10-17.md",
  "docs/design/CEAC_STAGE2_P1_ROUTE_REFERENCE_COVERAGE_MATRIX_2026-10-17.md",
  "tests/stage2-p1-connected-review.spec.js",
  "tests/stage2P1ConnectedDesignContract.test.mjs",
]);
const P1_INTERACTION_FILES = new Set([
  "docs/design/stage2-v4/CEAC_STAGE2_P1_CONNECTED_ROLE_REVIEW.html",
  "tests/stage2-p1-connected-review.spec.js",
  "tests/stage2P1ConnectedDesignContract.test.mjs",
]);
export function isIsolatedP1PreviewChange({ eventName, subject, tipFiles }) {
  return eventName === "pull_request"
    && /\[p1-design\]/i.test(subject || "")
    && Array.isArray(tipFiles)
    && tipFiles.length > 0
    && tipFiles.every((file) => P1_PREVIEW_ALLOWLIST.has(file))
    && tipFiles.some((file) => P1_INTERACTION_FILES.has(file))
    && !/\[level-b\]/i.test(subject || "");
}

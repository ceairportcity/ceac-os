/**
 * Strictly bounded INTERIM Stage 2 P3/P6 reporting and P7 component-CSS checks.
 * These tags apply only to a single PR tip that touches exactly the listed
 * implementation / regression files; only relevant exact-head browser suites run. Every other edit uses the conservative
 * PR-wide classification; [level-b], push, dispatch and P8 remain full.
 * This never certifies a stage or permits a production cutover.
 */
const MODES = [
  {
    marker: "[p3-attendance]",
    scope: "workforce",
    source: new Set([
      "src/components/EmployeeWorkSession.jsx",
      "src/lib/session.js",
      "src/screens/Workforce.jsx",
    ]),
    tests: new Set([
      "tests/stage2SharedPersonalSession.test.mjs",
      "tests/experience-v2-workforce-admin.spec.js",
      "tests/experience-v2-workforce-correction-approval.spec.js",
      "tests/attendance.test.mjs",
    ]),
  },
  {
    marker: "[p6-reports]",
    scope: "reports",
    source: new Set(["src/screens/ManagerReports.jsx"]),
    tests: new Set([
      "tests/experience-v2-reports-manager.spec.js",
      "tests/report-rpc-tenant-scope-contract.test.mjs",
    ]),
  },
  {
    // Personal achievements is a read-only, self-scoped report. Its negative
    // source/error browser checks are mandatory during implementation; full
    // cross-role/HR export and provider assurance remain P6/P8 release gates.
    marker: "[p6-personal]",
    scope: "personal",
    source: new Set(["src/screens/PersonalAchievements.jsx"]),
    tests: new Set([
      "tests/stage2OwnerReportingSource.test.mjs",
      "tests/experience-v2-personal-achievements.spec.js",
    ]),
  },
  {
    // Component-local P7 styling is not app-wide layout approval. The targeted
    // suite still enforces the real immutable aggregate CSS budget and People
    // role layout; shell/global styles, visual fixtures and CI code are denied.
    marker: "[p7-people-css]",
    scope: "p7-people",
    source: new Set(["src/experience-v2/people-family/people-family.css"]),
    tests: new Set([]),
  },
];

export function isolatedStage2FocusedScope({ eventName, subject, tipFiles } = {}) {
  if (eventName !== "pull_request" || typeof subject !== "string"
      || /\[level-b\]/i.test(subject) || !Array.isArray(tipFiles)
      || tipFiles.length === 0) return null;
  const selected = MODES.filter((mode) => subject.toLowerCase().includes(mode.marker));
  if (selected.length !== 1) return null;
  const mode = selected[0];
  if (!tipFiles.every((file) => mode.source.has(file) || mode.tests.has(file))) return null;
  // Do not green-light a test-only edit or a no-op without affected source.
  if (!tipFiles.some((file) => mode.source.has(file))) return null;
  return mode.scope;
}

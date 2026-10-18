/**
 * Strictly bounded INTERIM Stage 2 P3/P6 source+browser testing.
 * These tags apply only to a single PR tip that touches exactly the listed
 * implementation / regression files. Every other edit uses the conservative
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

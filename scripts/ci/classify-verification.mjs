import { execFileSync } from "node:child_process";
import { appendFileSync } from "node:fs";

const base = process.env.VERIFICATION_BASE_SHA || "HEAD^";
const head = process.env.VERIFICATION_HEAD_SHA || "HEAD";
const eventName = process.env.VERIFICATION_EVENT_NAME || "local";
const headRef = process.env.VERIFICATION_HEAD_REF || "";
const fullBundleAcceptance = headRef === "chatgpt/ceac-complete-source-verification-20261015";

function git(...args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

function changedFiles() {
  try {
    return git("diff", "--name-only", `${base}...${head}`)
      .split("\n")
      .map((file) => file.trim())
      .filter(Boolean);
  } catch {
    return git("diff", "--name-only", `${base}`, `${head}`)
      .split("\n")
      .map((file) => file.trim())
      .filter(Boolean);
  }
}

const files = changedFiles();
const subject = git("log", "-1", "--format=%s", head);

const documentationOnly =
  files.length > 0 &&
  files.every(
    (file) =>
      file === "AGENTS.md" ||
      file === "README.md" ||
      file.startsWith("docs/") ||
      file.endsWith(".md"),
  );

const workflowOrHarnessChanged = files.some(
  (file) =>
    file.startsWith(".github/") ||
    file.startsWith("scripts/ci/") ||
    file === "playwright.config.js" ||
    file === "package.json" ||
    file === "package-lock.json",
);
const databaseOrSecurityChanged = files.some(
  (file) =>
    file.startsWith("supabase/") ||
    file === "src/lib/supabase.js" ||
    file === "scripts/test-account-security.mjs" ||
    file === "scripts/test-real-invitation-rpc.mjs" ||
    /auth|security|session/i.test(file),
);
const levelBRequested = /\[level-b\]/i.test(subject);
// Any edited Playwright acceptance test requires its exact-head browser and SQL
// evidence. Treating a finance-only (or other single-scope) .spec.js diff as
// Level A produces a misleading green Quality Gate with all browser jobs skipped.
const browserAcceptanceChanged = files.some((file) =>
  file.startsWith("tests/") && /\.spec\.[cm]?[jt]sx?$/i.test(file)
);

const scopeRules = [
  ["vf9b", /visual-fidelity-css-cascade-closure\.spec\.js$/i],
  ["vf9c", /visual-fidelity-performance-closure\.spec\.js$/i],
  ["vf9d", /visual-fidelity-state-closure\.spec\.js$/i],
  ["stage15", /experience-v2-stage15-|premium(?:-(?:parity|staff|manager|admin|executive))?\.css$|\/styles\.css$|\/PremiumShell\.jsx$/i],
  ["stage14", /experience-v2-stage14-/i],
  ["personal", /personal-family|\/Me\.jsx$|\/AccountActivity\.jsx$|\/Performance\.jsx$|\/Learning\.jsx$|\/Assets\.jsx$|\/Compliance\.jsx$/i],
  ["finance", /finance|cost|spend|budget|transfer|expense/i],
  ["workforce", /workforce|attendance|leave|session|calendar/i],
  ["project", /project|portfolio|delivery|objective/i],
  ["people", /people|person(?!al)|team|profile|employee/i],
  ["work", /work-family|\/Work\.jsx$|\/Item\.jsx$|\/Assign\.jsx$|blocker|submission|review/i],
  ["reports", /report/i],
  ["shell", /App\.jsx$|bits\.jsx$|experience-v2\/(components|shell|tokens|icons)/i],
];

const matchedScopes = scopeRules
  .filter(([, pattern]) => files.some((file) => pattern.test(file)))
  .map(([scope]) => scope);
const scope =
  documentationOnly
    ? "docs"
    : workflowOrHarnessChanged || databaseOrSecurityChanged || matchedScopes.length !== 1
      ? "full"
      : matchedScopes[0];

const broadProductChange = !documentationOnly && scope === "full";
const levelB =
  fullBundleAcceptance ||
  levelBRequested ||
  browserAcceptanceChanged ||
  (!documentationOnly &&
    (eventName === "workflow_dispatch" ||
      workflowOrHarnessChanged ||
      databaseOrSecurityChanged ||
      broadProductChange));

const outputs = {
  documentation_only: String(documentationOnly),
  level_b: String(levelB),
  scope,
  run_migration: String(levelB || files.some((file) => file.startsWith("supabase/"))),
  run_account_security: String(
    levelB ||
      files.some(
        (file) =>
          file === "scripts/test-account-security.mjs" ||
          file === "scripts/test-real-invitation-rpc.mjs" ||
          /auth|security|session/i.test(file),
      ),
  ),
  browser_acceptance_changed: String(browserAcceptanceChanged),
  changed_count: String(files.length),
};

const outputFile = process.env.GITHUB_OUTPUT;
if (outputFile) {
  appendFileSync(
    outputFile,
    Object.entries(outputs)
      .map(([key, value]) => `${key}=${value}`)
      .join("\n") + "\n",
  );
}

console.log(
  JSON.stringify(
    {
      ...outputs,
      subject,
      files,
    },
    null,
    2,
  ),
);

import { execFileSync } from "node:child_process";
import { appendFileSync } from "node:fs";
import { isIsolatedP1PreviewChange } from "./p1-design-preview-scope.mjs";

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

const prFiles = changedFiles();
const subject = git("log", "-1", "--format=%s", head);
// GitHub PR base...HEAD spans the entire existing Stage 2 PR. Only a
// single, explicit synthetic P1 preview tip is eligible for the narrow
// Level A path. Broader PR scope remains due at stage/P8 acceptance.
let tipFiles = [];
try {
  tipFiles = git("diff", "--name-only", `${head}^`, head).split("\n").map(f=>f.trim()).filter(Boolean);
} catch {
  tipFiles = [];
}
const p1DesignOnly = isIsolatedP1PreviewChange({ eventName, subject, tipFiles });
const files = p1DesignOnly ? tipFiles : prFiles;

const documentationOnly =
  files.length > 0 &&
  !p1DesignOnly &&
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
const browserAcceptanceChanged = !p1DesignOnly && files.some((file) =>
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
  p1DesignOnly ? "p1-design" : documentationOnly
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
  p1_design_only: String(p1DesignOnly),
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
      pr_diff_count: prFiles.length,
      tip_commit_files: tipFiles,
      note: p1DesignOnly ? "FOCUSED SYNTHETIC DESIGN PREVIEW ONLY — never P1/P7/P8 acceptance" : "normal verification boundary",
    },
    null,
    2,
  ),
);

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
// Registered private-context suite also runs the focused Protected HR guards.
import "./protected-hr-context-race.test.mjs";
import "./protected-hr-save-failure.test.mjs";
import "./protected-hr-roster-read.test.mjs";


const read = (path) => readFileSync(path, "utf8");
const privateFiles = read("src/components/OperationalFiles.jsx");
const approvals = read("src/components/SupportAccessApprovals.jsx");
const support = read("src/screens/TechnicalSupport.jsx");

test("private attachments are scoped during render, not merely cleared after an effect", () => {
  assert.match(privateFiles, /const contextKey = /);
  assert.match(privateFiles, /const verified = loadedContext === contextKey/);
  assert.match(privateFiles, /const visibleRows = verified \? rows : \[\]/);
  assert.match(privateFiles, /visibleRows\.map\(\(file\)/);
  assert.match(privateFiles, /readGeneration\.current/);
  assert.match(privateFiles, /generation === readGeneration\.current/);
  assert.match(privateFiles, /return \(\) => \{ scopeGeneration\.current \+= 1; readGeneration\.current \+= 1;/);
  assert.doesNotMatch(privateFiles, /rows\.map\(\(file\) => <button/);
});

test("stale private signed URL requests cannot open documents after a context switch", () => {
  assert.match(privateFiles, /async function open\(file\) \{/);
  assert.match(privateFiles, /if \(!verified\) return/);
  assert.match(privateFiles, /await signedOperationalFileUrl\(file, 300\)/);
  assert.match(privateFiles, /if \(scopeGenerationAtStart === scopeGeneration\.current\) \{\s*window\.open/);
  assert.match(privateFiles, /disabled=\{busy \|\| !verified \|\| !contextId \|\| Boolean\(visibleError\)\}/);
  assert.match(privateFiles, /writeBusy\.current/);
  assert.match(privateFiles, /if \(scopeGenerationAtStart !== scopeGeneration\.current\) return;/);
});

test("file upload or load failure remains truthful and recoverable", () => {
  assert.match(privateFiles, /Files could not be loaded/);
  assert.match(privateFiles, /Retry private files/);
  assert.match(privateFiles, /Checking authorised private files/);
  assert.match(privateFiles, /await uploadOperationalFiles/);
  assert.match(privateFiles, /if \(scopeGenerationAtStart === scopeGeneration\.current\) onChanged\?\.\(\)/);
  assert.match(privateFiles, /if \(generation === readGeneration\.current\) setLoadedContext\(contextKey\)/);
  assert.match(support, /OperationalFileList key=/);
});

test("business approvals never mistake failed reads for empty queues", () => {
  assert.match(approvals, /const verified = loadedScope === scope/);
  assert.match(approvals, /const visible = verified && !loadFailed \? rows : \[\]/);
  assert.match(approvals, /if \(isMissingTechnicalSupportStageSchema\(failure\)\) \{\s*setStagePending\(true\)/);
  assert.match(approvals, /else \{\s*setLoadFailed\(true\)/);
  assert.match(approvals, /Refresh approval requests/);
  assert.match(approvals, /if \(busyRef\.current \|\| busy \|\| !verified \|\| loadFailed \|\| loading\) return/);
  assert.match(approvals, /\.eq\("version", request\.version\)/);
  assert.match(approvals, /\.eq\("state", "pending"\)\.select\("id,state,version"\)/);
  assert.match(approvals, /Showing the oldest 30 pending requests/);
  assert.doesNotMatch(approvals, /No pending access-assistance decisions assigned to this business authority/);
});

test("valid business decision is acknowledged without claiming technical execution", () => {
  assert.match(approvals, /Business decision recorded\. Technical Support must separately verify and record the approved action/);
  assert.match(approvals, /does not itself create an account, membership or permission/);
  assert.match(approvals, /onClick=\{\(\) => decide\(item, "approved"\)\}/);
  assert.match(approvals, /onClick=\{\(\) => decide\(item, "declined"\)\}/);
  assert.doesNotMatch(approvals, /from\("capability_grants"\)/);
});


test("private media previews never reuse stale signed links for changed file identity", () => {
  assert.match(privateFiles, /const mediaKey = files\.map/);
  assert.match(privateFiles, /file\.storage_bucket \|\| ""/);
  assert.match(privateFiles, /file\.storage_path \|\| ""/);
  assert.match(privateFiles, /const safeUrls = loadedMediaKey === mediaKey \? urls : \{\}/);
  assert.match(privateFiles, /const url = safeUrls\[file\.id\]/);
  assert.match(privateFiles, /if \(!cancelled\) \{ setUrls\(Object\.fromEntries\(pairs\)\); setLoadedMediaKey\(mediaKey\); \}/);
  assert.match(privateFiles, /if \(activeMediaKey\.current === expectedKey\) window\.open/);
  assert.match(privateFiles, /if \(loadedMediaKey !== mediaKey\) return/);
  assert.match(privateFiles, /Retry private media/);
  assert.match(privateFiles, /Checking private media/);
  assert.match(privateFiles, /disabled=\{loadedMediaKey !== mediaKey\} onClick=\{\(\) => void openMedia\(file\)\}/);
  assert.doesNotMatch(privateFiles, /const url = urls\[file\.id\]/);
});


test("same-account Manager transfer and grant revocation invalidate approval snapshots", () => {
  assert.match(approvals, /const membershipSignature = \(me\.memberships \|\| \[\]\)/);
  assert.match(approvals, /membership\.unit_id/);
  assert.match(approvals, /membership\.role/);
  assert.match(approvals, /const capabilitySignature = \(me\.capability_grants \|\| \[\]\)/);
  assert.match(approvals, /grant\.scope_unit_id/);
  assert.match(approvals, /grant\.expires_at/);
  assert.match(approvals, /me\.unit_id \|\| ""/);
  assert.match(approvals, /\}, \[scope\]\);/);
  assert.match(approvals, /const verified = loadedScope === scope/);
  assert.match(approvals, /if \(generation\.current === id\) setRows\(data \|\| \[\]\)/);
});


test("file-picker errors do not reference private-media state from another component", () => {
  const picker = privateFiles.split("export function PendingFilePicker")[1]
    ?.split("export function OperationalFileList")[0] || "";
  const media = privateFiles.split("export function OperationalMediaList")[1] || "";
  assert.match(picker, /\{error && <div className="hint" role="alert">\{error\}<\/div>\}/);
  assert.doesNotMatch(picker, /loadedMediaKey|mediaKey|setRetry/);
  assert.match(media, /\{error && loadedMediaKey === mediaKey/);
  assert.match(media, /Retry private media/);
});

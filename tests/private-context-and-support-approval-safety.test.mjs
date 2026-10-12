import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

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
  assert.match(approvals, /if \(generation\.current === id\) \{\s*setLoadFailed\(true\)/);
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

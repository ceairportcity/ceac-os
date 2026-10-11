import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const auto = readFileSync(".devcontainer/ceac-private-runner.sh", "utf8");
const gate = readFileSync("scripts/ci/run-independent-release-gate.sh", "utf8");
const config = readFileSync(".devcontainer/devcontainer.json", "utf8");
const pkg = JSON.parse(readFileSync("package.json", "utf8"));

test("Codespaces verifies current private PR44 instead of obsolete PR27", () => {
  assert.match(auto, /refs\/pull\/44\/head/);
  assert.match(auto, /refs\/heads\/main/);
  assert.match(auto, /"\$local_head" == "\$expected_pr"/);
  assert.match(auto, /run-independent-release-gate\.sh "\$PWD" 44/);
  assert.match(auto, /gh pr comment 44/);
  assert.doesNotMatch(auto, /refs\/pull\/27\/head|run-independent-release-gate\.sh "\$PWD" 27|gh pr comment 29/);
});

test("independent release runner refuses SHA drift and live secrets", () => {
  assert.match(gate, /"\$actual" == "\$expected"/);
  assert.match(gate, /"\$main" == "\$expected_main"/);
  assert.match(gate, /git -C "\$repo" worktree add --detach "\$work" "\$expected"/);
  assert.match(gate, /DATABASE_URL SUPABASE_DB_URL SUPABASE_ACCESS_TOKEN/);
  assert.match(gate, /supabase migration up --local/);
  assert.match(gate, /npm run verify:source/);
  assert.doesNotMatch(gate, /supabase db push --linked|supabase db reset --linked/);
});

test("Codespaces setup is an isolated Docker-in-Docker test runner", () => {
  const parsed = JSON.parse(config);
  assert.match(parsed.features["ghcr.io/devcontainers/features/docker-in-docker:4"] ? "enabled" : "", /enabled/);
  assert.match(parsed.postStartCommand, /launch-automatic-verification/);
  assert.match(pkg.scripts["verify:source"], /technical-support-source-contract\.test\.mjs/);
  assert.match(pkg.scripts["verify:source"], /pending-feature-compatibility\.test\.mjs/);
});

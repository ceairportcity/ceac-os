import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const auto = readFileSync(".devcontainer/ceac-private-runner.sh", "utf8");
const launcher = readFileSync(".devcontainer/launch-automatic-verification.sh", "utf8");
const gate = readFileSync("scripts/ci/run-independent-release-gate.sh", "utf8");
const config = readFileSync(".devcontainer/devcontainer.json", "utf8");
const pkg = JSON.parse(readFileSync("package.json", "utf8"));

test("Codespaces verifies current private PR44 instead of obsolete PR27", () => {
  assert.match(auto, /refs\/pull\/44\/head/);
  assert.match(auto, /refs\/heads\/main/);
  assert.match(auto, /git worktree add --detach "\$verify_checkout\/source" "\$expected_pr"/);
  assert.match(auto, /verify_checkout\/source\/scripts\/ci\/run-independent-release-gate\.sh/);
  assert.doesNotMatch(auto, /"\$local_head" == "\$expected_pr"/);
  assert.match(auto, /run-independent-release-gate\.sh" "\$PWD" 44/);
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
  assert.match(gate, /live_pr_final="\$\(git -C "\$repo" ls-remote origin/);
  assert.match(gate, /live_main_final="\$\(git -C "\$repo" ls-remote origin/);
  assert.match(gate, /exact_head_freshness\.status/);
  assert.doesNotMatch(gate, /supabase db push --linked|supabase db reset --linked/);
});

test("Codespaces setup is an isolated Docker-in-Docker test runner", () => {
  const parsed = JSON.parse(config);
  assert.match(parsed.features["ghcr.io/devcontainers/features/docker-in-docker:4"] ? "enabled" : "", /enabled/);
  assert.match(parsed.postStartCommand, /launch-automatic-verification/);
  assert.match(pkg.scripts["verify:source"], /technical-support-source-contract\.test\.mjs/);
  assert.match(pkg.scripts["verify:source"], /pending-feature-compatibility\.test\.mjs/);
});

test("Codespaces never accepts a stale result after the PR branch advances", () => {
  assert.match(launcher, /current_head="\$\(git rev-parse HEAD\)"/);
  assert.match(launcher, /previous_head="\$\(cat \/tmp\/ceac-private-autorun-tested-head/);
  assert.match(launcher, /live_pr_head="\$\(git ls-remote origin refs\/pull\/44\/head/);
  assert.match(launcher, /"\$previous_head" == "\$live_pr_head"/);
  assert.doesNotMatch(launcher, /"\$previous_head" == "\$current_head"/);
  assert.match(auto, /printf '%s\\n' "\$\{expected_pr:-UNRESOLVED\}" > \/tmp\/ceac-private-autorun-tested-head/);
});

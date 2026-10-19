import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = (path) => readFileSync(path, "utf8");

test("portrait storage is private and read/write policies require verified TOTP AAL2", () => {
  const sql = source("supabase/migrations/20261016164000_149_private_portrait_media_stage2.sql");
  assert.match(sql, /CREATE TABLE public\.profile_portraits/);
  assert.match(sql, /ALTER TABLE public\.profile_portraits ENABLE ROW LEVEL SECURITY/);
  assert.match(sql, /CREATE FUNCTION public\.app_portrait_totp_aal2\(\)/);
  assert.match(sql, /auth\.jwt\(\)->>'aal'\) = 'aal2'/);
  assert.match(sql, /method_claim\.entry->>'method' = 'totp'/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.app_portrait_totp_aal2\(\) TO authenticated/);
  assert.match(sql, /VALUES \('ceac-profile-portraits','ceac-profile-portraits',false/);
  assert.match(sql, /allowed_mime_types=ARRAY\['image\/webp'\]/);
  assert.equal((sql.match(/CREATE POLICY ceac_profile_portraits_/g)||[]).length,4);
  assert.equal((sql.match(/CREATE POLICY ceac_portrait_storage_/g)||[]).length,3);
  assert.ok((sql.match(/public\.app_portrait_totp_aal2\(\)/g)||[]).length >= 9);
  assert.doesNotMatch(sql, /public\s*=\s*true/);
});

test("signed portraits remain scoped to user-submitted real faces, no broad public links", () => {
  const hook = source("src/lib/useProjectPortraits.js");
  const avatar = source("src/components/PersonAvatar.jsx");
  const project = source("src/components/Stage2ProjectOverview.jsx");
  assert.match(hook, /VITE_STAGE2_UNIVERSAL_AAL2/);
  const batched = source("src/lib/profilePortraits.js");
  assert.match(hook, /signedProjectPortraits\(ids\)/);
  assert.match(batched, /from\("profile_portraits"\)/);
  assert.match(batched, /\.createSignedUrls\(paths, 3600\)/);
  assert.match(hook, /setUrls\(\{\}\)/);
  assert.match(project, /useProjectPortraits\(project\)/);
  assert.match(project, /<PersonAvatar/);
  assert.match(avatar, /permittedPortraitUrl/);
  assert.doesNotMatch(hook, /getPublicUrl|localStorage|service_role/);
});

test("new rollback-only private portrait adversarial gate is registered", () => {
  const gate = source("supabase/tests/stage2_private_portrait_totp_gate.sql");
  const runner = source("scripts/ci/run-sql-security-gates.sh");
  assert.match(gate, /BEGIN;/);
  assert.match(gate, /ROLLBACK;/);
  assert.match(gate, /non-TOTP AAL2/);
  assert.match(gate, /Unregistered viewer/);
  assert.match(runner, /stage2_private_portrait_totp_gate\.sql/);
});

test("forward-only 157 permits current password release while keeping future factor-backed MFA", () => {
  const next = source("supabase/migrations/20261019160000_157_stage2_password_release_private_portraits.sql");
  assert.match(next, /CREATE OR REPLACE FUNCTION public\\.app_portrait_totp_aal2\\(\\)/);
  assert.match(next, /public\\.app_stage2_universal_aal_allowed\\(\\)/);
  assert.match(next, /auth\\.uid\\(\\) IS NOT NULL/);
  assert.match(next, /SECURITY INVOKER/);
  assert.doesNotMatch(next, /SET universal_totp_required\\s*=\\s*true/i);
  assert.match(next, /REVOKE ALL ON FUNCTION public\\.app_portrait_totp_aal2\\(\\) FROM PUBLIC, anon/);
  const gate = source("supabase/tests/stage2_private_portrait_totp_gate.sql");
  assert.match(gate, /\\$password_release\\$/);
  assert.match(gate, /universal_totp_required=true/);
  assert.match(gate, /'verified'::auth.factor_status/);
});

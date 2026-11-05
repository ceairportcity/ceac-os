import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const { canSelfCertifyOwnWork } = await import(pathToFileURL(process.cwd() + "/src/lib/workCompletion.js"));
const source = (path) => readFileSync(path, "utf8");

test("all managers, including the OFTGP Secretariat head and HR manager, must submit for independent approval", () => {
  const item = { assignee_id: "head", assigned_by: "head", origin: "self_created", unit_id: "unit-1" };
  const manager = { id: "head", memberships: [{ unit_id: "unit-1", role: "manager" }] };
  assert.equal(canSelfCertifyOwnWork(manager, item), false);
  assert.equal(canSelfCertifyOwnWork({ ...manager, is_admin: true }, item), false);
  assert.equal(canSelfCertifyOwnWork({ id: "head", memberships: [{ unit_id: "unit-2", role: "manager" }] }, item), false);
  assert.equal(canSelfCertifyOwnWork({ id: "head", memberships: [{ unit_id: "unit-1", role: "staff" }] }, item), false);
  assert.equal(canSelfCertifyOwnWork({ id: "head", is_exec: true }, item), true);
  assert.equal(canSelfCertifyOwnWork({ id: "head", is_admin: true, memberships: [] }, item), true);
  assert.equal(canSelfCertifyOwnWork({ id: "another", is_exec: true }, item), false);
});

test("manager Work screen sends for review instead of using the old self-certification action", () => {
  const ui = source("src/screens/Item.jsx");
  assert.match(ui, /const selfCertifiableWork = canSelfCertifyOwnWork\(me, item\)/);
  assert.match(ui, /if \(selfCertifiableWork\)/);
  assert.match(ui, /supabase\.rpc\("submit_work_for_review"/);
  assert.match(ui, /Waiting on \{responsibleReviewer\?\.full_name/);
  assert.doesNotMatch(ui, /managerSubmissionBlocked|MANAGER_SELF_CERTIFICATION_READY|managerOwnWork/);
});

test("server enforces Executive review for managers, except a real Admin assignment", () => {
  const sql = source("supabase/migrations/20261105120000_manager_work_executive_review.sql");
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.app_responsible_reviewer_id\(item_id uuid\)/i);
  assert.match(sql, /manager_membership\.profile_id=w\.assignee_id/);
  assert.match(sql, /manager_membership\.role='manager'/);
  assert.match(sql, /w\.assigned_by is distinct from w\.assignee_id/i);
  assert.match(sql, /assigning_admin\.id=w\.assigned_by/);
  assert.match(sql, /assigning_admin\.is_admin/);
  assert.match(sql, /return w\.assigned_by/);
  assert.match(sql, /executive\.active and executive\.is_exec/);
  assert.match(sql, /executive\.org_id=w\.org_id/);
  assert.match(sql, /return v_reviewer/);
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.app_can_review_item\(item_id uuid\)/i);
  assert.match(sql, /public\.app_is_admin\(\)\s+and not exists/);
  assert.match(sql, /public\.app_responsible_reviewer_id\(w\.id\)=auth\.uid\(\)/);
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.guard_executive_work_self_certification\(\)/i);
  assert.match(sql, /NEW\.status = 'self_certified'/);
  assert.match(sql, /Manager work must be sent for review/);
  assert.doesNotMatch(sql, /DELETE FROM\s+(public\.)?(submissions|reviews|work_items)/i);
});

test("prior review and certification history remains stored; new approval rules are forward-facing", () => {
  const historical = source("supabase/migrations/20261101211000_manager_own_work_review_release.sql");
  assert.match(historical, /select 1 from submissions s/);
  assert.match(historical, /not exists \(select 1 from reviews r/);
  assert.match(historical, /INSERT INTO activity_events|insert into activity_events/);
  assert.doesNotMatch(historical, /DELETE FROM\s+submissions/i);
});

test("mobile attendance review remains readable and factually qualified", () => {
  const ui = source("src/components/WorkforceTodayReviewList.jsx");
  const css = source("src/experience-v2/workforce-family/workforce-family.css");
  assert.match(ui, /How to read these records/);
  assert.match(ui, /Missing a start is not proof of absence or lateness/);
  assert.match(css, /ev2wf-today-review-entry>td:nth-of-type\(1\)::before/);
  assert.match(css, /ev2wf-today-review-entry>td:last-child/);
  assert.match(css, /ev2wf-today-review-entry \.btn\{min-height:44px;scroll-margin-block:96px\}/);
});

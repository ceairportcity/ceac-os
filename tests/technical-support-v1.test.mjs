import test from "node:test";
import assert from "node:assert/strict";
import {
  HELP_CATEGORIES, SUPPORT_WORKSPACES, SUPPORT_GUIDES, SERVICE_NAMES,
  canManageSupport, supportCaseGroups, supportCategoryLabel,
} from "../src/lib/technicalSupport.js";

test("support panel has the six locked workspaces and categories", () => {
  assert.deepEqual(SUPPORT_WORKSPACES.map((item) => item.label),
    ["Home", "Help Desk", "People & Access", "System", "Improvements", "Guides"]);
  assert.equal(HELP_CATEGORIES.length, 6);
  assert.equal(SUPPORT_GUIDES.length, 11);
  assert.equal(SERVICE_NAMES.length, 7);
  assert.equal(supportCategoryLabel("access_needed"), "I need access to something");
});

test("support capability is narrow and absent from ordinary employment roles", () => {
  assert.equal(canManageSupport({ role: "manager", is_admin: true, capabilities: ["people.manage"] }), false);
  assert.equal(canManageSupport({ role: "staff", capabilities: ["support.case.manage"] }), true);
  assert.equal(canManageSupport({ capabilities: [] }), false);
  assert.equal(canManageSupport(null), false);
});

test("cases are grouped only by facts; unresolved approval is not marked resolved", () => {
  const cases = [
    { id: "a", category: "cannot_sign_in", state: "open" },
    { id: "b", category: "cannot_sign_in", state: "waiting_approval" },
    { id: "c", category: "access_needed", state: "resolved" },
    { id: "d", category: "other", state: "in_progress" },
    { id: "e", category: "other", state: "closed" },
  ];
  const result = supportCaseGroups(cases);
  assert.deepEqual(result.attention.map((x) => x.id), ["a", "d"]);
  assert.deepEqual(result.waitingApproval.map((x) => x.id), ["b"]);
  assert.deepEqual(result.recentlyResolved.map((x) => x.id), ["c", "e"]);
  assert.equal(result.access.length, 3);
  assert.deepEqual(result.recurring.map((x) => x.id), ["cannot_sign_in", "other"]);
});

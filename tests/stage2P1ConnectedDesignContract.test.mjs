import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const html = readFileSync("docs/design/stage2-v4/CEAC_STAGE2_P1_CONNECTED_ROLE_REVIEW.html", "utf8");
function getMenu(role) {
  const start = html.indexOf("\n " + role + ":[[");
  assert.ok(start >= 0, "missing preview role: " + role);
  return html.slice(start, html.indexOf("\n", start + 1));
}
test("P1 Compliance and Payroll have separate capability-specific preview panels", () => {
  assert.match(getMenu("compliance"), /\["compliance","Independent Compliance desk"\]/);
  assert.match(getMenu("payroll"), /\["payroll","Payroll preparation and approval"\]/);
  for (const role of ["staff","manager","support","admin","executive","volunteer"]) {
    assert.doesNotMatch(getMenu(role), /\["(?:compliance|payroll)",/);
  }
  assert.match(html, /<option value="compliance">Compliance Officer/);
  assert.match(html, /<option value="payroll">Payroll-authorised officer/);
  assert.match(html, /const dest=roleNav\[role\]; if\(!dest\.some\(row=>row\[0\]===page\)\)page=dest\[0\]\[0\]/);
});
test("P1 additions wire accessible local synthetic Compliance and Payroll views", () => {
  for (const fragment of [
    "function complianceP1()", "function payrollP1()",
    "compliance:complianceP1,payroll:payrollP1",
    'kind==="compliance-review"', 'kind==="payroll-detail"',
    "Payroll.prepare", "Payroll.approve",
    "cannot automatically become payable payroll amounts",
    "No salary or payout data exists",
    "No actual changes will be saved",
  ]) assert.ok(html.includes(fragment), "missing P1 source boundary: " + fragment);
  assert.doesNotMatch(html, /(?:fetch\s*\(|\.from\s*\(|\.rpc\s*\(|supabase\.auth|signInWithPassword|service_role)/);
});
test("P1 extension retains canonical light-blue palette and responsive layout", () => {
  for (const token of [
    "--bg:#f5f8fc", "--surface:#fff", "--nav:#fff", "--ink:#122440",
    "--blue:#1368ed", "--line:#e7edf4", "max-width:960px",
  ]) assert.ok(html.includes(token), "missing V4 source token: " + token);
  assert.match(html, /<meta name="viewport" content="width=device-width,initial-scale=1">/);
});

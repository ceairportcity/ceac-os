import fs from "node:fs";
import { test, expect } from "@playwright/test";

const control = fs.readFileSync(new URL("../src/screens/ControlCenter.jsx", import.meta.url), "utf8");

test("OCR5E Control Center is state-derived and never invents a numeric health score", () => {
  for (const status of ["Ready","Needs attention","Partly configured","Not configured","Awaiting policy"]) {
    expect(control).toContain(status);
  }

  for (const domain of [
    "Organisation",
    "People & access",
    "Work & operations",
    "Time & Leave",
    "Payroll & Finance",
    "Security & governance",
    "Integrations",
    "Audit & records",
  ]) {
    expect(control).toContain(`title:"${domain}"`);
  }

  expect(control).toContain('supabase.rpc("admin_employee_roster_summary")');
  expect(control).toContain('supabase.rpc("payroll_readiness_summary")');
  expect(control).toContain('from("leave_policy_versions")');
  expect(control).toContain('from("integration_connectors")');
  expect(control).toContain('from("workflow_run_steps")');
  expect(control).toContain('from("platform_audit_events")');
  expect(control).toContain("Roster-only status alone is not treated as an error.");
  expect(control).toContain("Manager approval → Administration final approval");
  expect(control).toContain("This is not a numeric health score.");
  expect(control).not.toContain("healthScore");
  expect(control).not.toContain("managed elsewhere");
});

test("OCR5E Control Center deep-links to authoritative configuration surfaces", () => {
  for (const route of [
    "office-settings","units","people","protected-hr","workflows","attendance",
    "payroll","finance","authority","policies","integrations","audit","events",
  ]) {
    expect(control).toContain(`go("${route}")`);
  }
});

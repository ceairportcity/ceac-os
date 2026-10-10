import fs from "node:fs";
import { test, expect } from "@playwright/test";

const people = fs.readFileSync(new URL("../src/screens/People.jsx", import.meta.url), "utf8");
const workforce = fs.readFileSync(new URL("../src/screens/Workforce.jsx", import.meta.url), "utf8");
const protectedHrScreen = fs.readFileSync(new URL("../src/screens/AdminProtectedHR.jsx", import.meta.url), "utf8");
const payroll = fs.readFileSync(new URL("../src/screens/AdminPayroll.jsx", import.meta.url), "utf8");
const roleFixtures = fs.readFileSync(new URL("../scripts/seed-role-fixtures.mjs", import.meta.url), "utf8");
const rosterMigration = fs.readFileSync(new URL("../supabase/migrations/20261003120215_employee_roster_master.sql", import.meta.url), "utf8");
const protectedHrMigration = fs.readFileSync(new URL("../supabase/migrations/20261003135007_104_employee_protected_hr_subject.sql", import.meta.url), "utf8");
const payrollMigration = fs.readFileSync(new URL("../supabase/migrations/20261003135010_105_payroll_employee_population.sql", import.meta.url), "utf8");
const readinessMigration = fs.readFileSync(new URL("../supabase/migrations/20261003135013_106_payroll_readiness_summary.sql", import.meta.url), "utf8");

test("employee roster is independent from auth profiles", () => {
  expect(rosterMigration).toContain("create table if not exists public.employee_roster");
  expect(rosterMigration).toContain("profile_id uuid unique references public.profiles(id)");
  expect(rosterMigration).toContain("identity_state text not null");
  expect(rosterMigration).toContain("'roster_only'");
  expect(rosterMigration).toContain("'needs_review'");
  expect(rosterMigration).toContain("Profiles are intentionally NOT auto-backfilled into the employee roster");
});

test("Administration People is driven by the employee roster and keeps operational data optional", () => {
  expect(people).toContain('supabase.rpc("admin_employee_roster_summary")');
  expect(people).toContain('supabase.rpc("admin_employee_roster_detail"');
  expect(people).toContain("operationalByProfile");
  expect(people).toContain("No linked operational account");
  expect(people).toContain("Roster only · no account linked");
  expect(people).toContain("Not inferred from workbook title");
});

test("protected HR supports roster-only employee subjects", () => {
  expect(protectedHrMigration).toContain("add column if not exists employee_id uuid references public.employee_roster(id)");
  expect(protectedHrMigration).toContain("hr_employee_protected_summary");
  expect(protectedHrMigration).toContain("hr_employee_protected_record");
  expect(people).toContain('supabase.rpc("hr_employee_protected_summary"');
  expect(people).toContain('supabase.rpc("hr_employee_protected_record"');
  expect(protectedHrScreen).toContain('supabase.rpc("admin_employee_roster_summary")');
  expect(protectedHrScreen).toContain('supabase.rpc("hr_employee_protected_summary"');
  expect(protectedHrScreen).toContain('supabase.rpc("hr_employee_protected_record"');
  expect(protectedHrScreen).toContain("ComposerDrawer");
  expect(protectedHrScreen).toContain("Show version history");
  expect(protectedHrScreen).toContain("Roster only · no account linked");
  expect(protectedHrScreen).not.toContain('supabase.from("profiles")');
});

test("Payroll snapshots employees rather than auth profiles", () => {
  expect(payrollMigration).toContain("from public.employee_roster er");
  expect(payrollMigration).toContain("alter column employee_id set not null");
  expect(payrollMigration).toContain("unique(run_id,employee_id)");
  expect(payrollMigration).toContain("'employee_id',e.employee_id");
  expect(payroll).toContain("entry.employee_id || entry.profile_id");
});

test("Payroll readiness exposes completeness without exposing protected values", () => {
  expect(readinessMigration).toContain("payroll_readiness_summary");
  expect(readinessMigration).toContain("'compensation_missing_count'");
  expect(readinessMigration).toContain("'payment_missing_count'");
  expect(readinessMigration).toContain("'identity_review_count'");
  expect(payroll).toContain('supabase.rpc("payroll_readiness_summary")');
  expect(payroll).toContain("Every salary-eligible employee is represented");
  expect(payroll).toContain("Active volunteers are excluded from ordinary salary payroll");
});


test("browser acceptance fixtures explicitly model employees instead of treating auth as employment", () => {
  expect(roleFixtures).toContain('service.from("employee_roster").insert');
  expect(roleFixtures).toContain('identity_state: "linked"');
  expect(roleFixtures).toContain('service.from("employee_unit_memberships").insert');
});


test("OCR5D keeps daily Workforce separate from advanced policy and preserves Leave authority", () => {
  expect(workforce).toContain('["setup","Schedules & policy"]');
  expect(workforce).toContain("Manager approval → Administration final approval");
  expect(workforce).toContain("No session recorded");
  expect(workforce).toContain("not an absence judgement");
  expect(workforce).toContain('p_action:action');
  expect(workforce).toContain('"admin_approved"');
});

test("OCR5D harmonises Payroll overlays without changing preparation or approval authority", () => {
  expect(payroll).toContain("ComposerDrawer");
  expect(payroll).toContain("Administration prepares");
  expect(payroll).toContain("Group Pastor approves");
  expect(payroll).toContain('capabilities.has("payroll.prepare")');
  expect(payroll).toContain('capabilities.has("payroll.approve")');
  expect(payroll).toContain('supabase.rpc("payroll_submit_run"');
  expect(payroll).toContain('supabase.rpc("payroll_approve_run"');
  expect(payroll).toContain("Approved payroll is immutable");
  expect(payroll).not.toContain("<Sheet");
});

#!/usr/bin/env bash
set -euo pipefail

database_url="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
tests=(
  rls_smoke.sql
  admin_hr_security_gate.sql
  platform_kernel_gate.sql
  security_definer_surface_gate.sql
  meeting_authority_gate.sql
  employment_history_gate.sql
  platform_audit_gate.sql
  capability_authority_gate.sql
  event_framework_gate.sql
  workflow_engine_gate.sql
  policy_rules_gate.sql
  integration_gateway_gate.sql
  employee_lifecycle_gate.sql
  protected_hr_stage3_gate.sql
  employee_protected_hr_gate.sql
  payroll_stage13_gate.sql
  employee_roster_completeness_gate.sql
  goals_strategy_stage4_gate.sql
  work_management_stage5_gate.sql
  resource_workload_stage6_gate.sql
  performance_development_stage7_gate.sql
  learning_stage8_gate.sql
  workforce_management_stage9_gate.sql
  assets_devices_stage10_gate.sql
  compliance_policy_stage11_gate.sql
  integrations_stage12_gate.sql
  project_register_experience_stage5_gate.sql
  experience_stage6_finance_gate.sql
  experience_stage7_work_capture_gate.sql
  experience_stage8_interface_gate.sql
  fpg12_security_posture_gate.sql
  production_hardening_gate.sql
  operational_clarity_files_gate.sql
  onboarding_access_presence_gate.sql
  attendance_phase2_gate.sql
  compliance_phase3_gate.sql
  notification_work_state_gate.sql
)

for test_file in "${tests[@]}"; do
  echo "Running $test_file"
  psql "$database_url" -v ON_ERROR_STOP=1 -f "supabase/tests/$test_file"
done

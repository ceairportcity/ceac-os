# CEAC OS — Historical Migration Parity Reconciliation

Date: 7 October 2026
Status: REPOSITORY PARITY PREPARED / PROTECTED CHECKS REQUIRED
Production Supabase: `efjljhftsesssumtshvp`
Baseline protected main: `827fbe7391467dd13d6e411527416402a252993c`

## Why this reconciliation exists

A full repository-to-production migration-history comparison found that the S1 filename repair had not corrected older historical timestamp drift.

Before this branch:

- GitHub contained 118 migration files / 118 unique versions.
- Production contained 119 migration-history rows / 119 unique versions.
- 19 GitHub migration versions were absent from production history.
- 20 production migration versions were absent from GitHub.
- two same-version migrations also had filename/name-label differences.

No schema drift was inferred from the timestamps alone. The live migration-history table stores the applied SQL, so each mismatch was compared against its corresponding GitHub file before any write.

## SQL equivalence verification

Every production-only migration was matched to its GitHub counterpart by applied SQL.

Results:

- the mapped migrations are byte-identical except migrations 100 and 115;
- migrations 100 and 115 are semantically identical after comments/whitespace are removed;
- production contains two historical applications of the same `095_ministry_number_definition_rpc` SQL;
- both 095 production entries are byte-identical to the GitHub source and were therefore represented as two historical files so fresh replay reproduces the same history.

No production migration-history row was edited or deleted.

## Repository-only reconciliation

The atomic history commit:

`3bba5a31937bbea580799a246cc41da2c063a855`

reuses the existing migration blobs and changes only their repository paths/versions, plus the one duplicate 095 history file required to represent the second production application.

Key mappings:

| Previous GitHub version | Production/canonical version | Migration |
| --- | --- | --- |
| 20260924125300 | 20260925071727 | 095_ministry_number_definition_rpc |
| — | 20260925122617 | duplicate byte-identical 095 history row |
| 20260924141000 | 20260925071859 | 095_project_participant_register |
| 20260924152000 | 20260925122851 | 096_experience_stage6_finance_corrections |
| 20260924154500 | 20260930150414 | experience_stage7_work_capture_recipes |
| 20260924160000 | 20260930150423 | experience_stage8_interface_defects |
| 20260926062000 | 20261001100730 | 099_integration_runtime |
| 20261001101500 | 20261001100914 | 100_integration_table_privilege_hardening |
| 20261003122000 | 20261003135007 | 104_employee_protected_hr_subject |
| 20261003130000 | 20261003135010 | 105_payroll_employee_population |
| 20261003133000 | 20261003135013 | 106_payroll_readiness_summary |
| 20261003213000 | 20261003222056 | leave_owner_rules |
| 20261004132000 | 20261005133253 | 108_operational_files_and_exec_rooms |
| 20261004170000 | 20261005133256 | 109_exec_project_room_context |
| 20261004190000 | 20261005133259 | 110_employee_operational_files |
| 20261006004149 | 20261006021138 | 111_onboarding_access_presence_foundation |
| 20261006041453 | 20261006062907 | 112_attendance_patterns_permissions |
| 20261006070840 | 20261006121001 | 113_compliance_operating_surface |
| 20261006153340 | 20261006163734 | 114_security_definer_surface_reduction |
| 20261006165000 | 20261006165945 | 115_s6_hot_path_rls_fk_hardening |

The existing versions `20260921071233` and `20260921072235` were also renamed only after the version prefix so the repository migration names match the live history names exactly.

## Post-write verification

Read-only comparison after the atomic commit returned:

- GitHub migration files: **119**
- GitHub unique versions: **119**
- live migration rows: **119**
- live unique versions: **119**
- GitHub-only version/name pairs: **0**
- live-only version/name pairs: **0**
- exact version + name pair match: **true**

## Safety rules

This branch does not:

- apply SQL to production;
- edit the live Supabase migration-history table;
- delete live history;
- invent a replacement migration timestamp;
- weaken Migration Replay or any security gate.

The reconciliation is accepted only after the protected exact-head checks pass, especially Migration Replay. The duplicate 095 file must remain unless a future reviewed migration-history repair deliberately changes both canonical history and replay evidence.

## Security sequencing impact

This reconciliation must land before new S3/S7/S8/Technical Support schema migrations.

After merge:

1. re-read protected `main`;
2. re-compare all GitHub migration version/name pairs with live Supabase;
3. require exact 119/119 parity;
4. then continue S3 from canonical migration `20261007083250_118_capability_delegation_expiry.sql`;
5. do not apply S3 through a tool that generates a different version.

# CEAC OS — S7 Recovery, Privacy & Handover Control

Date: 6 October 2026
Status: IMPLEMENTED CONTROL PACKAGE / OPERATIONAL RESTORE EVIDENCE OPEN
Baseline: protected main `27b0457857f76ca29dc8c483606910fb0f8d27eb`
Production Supabase: `efjljhftsesssumtshvp`
Programme: `docs/security/CEAC_SECURITY_HARDENING_PROGRAM_2026-10-06.md`

This document updates the operating state established by the 22 September Stage 0 backup runbook. Historical documents remain evidence; this file is the current S7 control record.

## 1. Verified current state

- Supabase organisation plan: **Free**.
- Production project status: **ACTIVE_HEALTHY**.
- Database engine: PostgreSQL 17.
- Latest verified production security migration at preparation: `115_s6_hot_path_rls_fk_hardening`.
- Private Storage buckets:
  - `ceac-hr-private`;
  - `ceac-operational-private`.
- Database schema includes public application data, protected `hr_private` data, Auth data and Storage metadata.
- All 10 current `hr_private` base tables deny direct SELECT/INSERT/UPDATE/DELETE privileges to both `anon` and `authenticated`.
- `ceac-hr-private` Storage access is capability- and organisation-path-bound.
- `ceac-operational-private` Storage reads/writes are tied to the operational-file authorization contract.

## 2. Recovery posture

### Database

Current Supabase documentation states that scheduled platform backups are provided on paid plans, while Free projects should create regular logical database exports and keep copies outside the production project.

CEAC must therefore **not** claim a verified managed production restore point while the project remains on Free.

Until paid-plan backup controls are activated, the minimum production recovery control is:

1. create a supported logical database export from production;
2. encrypt/protect the export and store it outside the production Supabase project;
3. record source project, creation date, method and responsible operator without storing credentials in GitHub;
4. restore it into a specifically approved non-production target;
5. verify schema, migration history, authority/RLS contracts and representative non-sensitive records;
6. verify the restored `hr_private` boundary remains closed to browser roles;
7. destroy or securely retain the recovery target according to an approved policy.

No production restore test has yet been evidenced in the repository. This remains an S7 exit blocker.

### Storage objects

A database backup does **not** restore Storage objects. Database backup covers Storage metadata, not the files themselves.

CEAC therefore needs a separate protected export/recovery process for both private buckets. At minimum it must preserve:

- object bytes;
- bucket/path identity;
- object-to-record relationship;
- access classification;
- integrity evidence sufficient to prove that a recovered object is the expected object.

The current connector does not expose a safe bulk Storage backup/restore operation. No Storage restore test is claimed.

### Paid-plan target

After the planned Supabase upgrade:

- confirm scheduled database backups are active for the selected plan;
- record actual retention available on that plan;
- decide whether PITR is operationally justified before purchasing/activating it;
- keep Storage-object recovery separate even if database backups are enabled;
- perform a safe non-production restore test before treating the paid backup control as production-ready.

No paid feature is described as active until independently verified.

## 3. Destructive-action rule

No destructive production action that could irreversibly remove important CEAC data may rely on an assumed backup.

Before such an action, the operator must have:

- a current accepted backup/recovery path for the affected data class;
- a rollback/recovery procedure;
- correct business approval;
- attributable execution evidence.

If those are absent, the destructive action is blocked.

## 4. Privacy/governance facts

Current owner-confirmed facts:

- CEAC is not currently registered with Ghana's Data Protection Commission.
- There is no formally approved CEAC OS privacy notice yet.
- There is no formal data-processing/handover agreement between CEAC and the builder yet.
- The Standard Institute / Standard Solution is the builder and is intended to hand the system over fully.
- CEAC Technical Support is intended to become technical owner after handover.

This repository does not claim legal compliance that has not been established.

## 5. Data minimisation findings

The protected HR/payroll architecture is materially stronger than ordinary profile data:

- salary, compensation, payment details, protected identifiers and protected employee documents are in `hr_private` and private Storage;
- direct browser table access to `hr_private` is denied;
- access is via reviewed capability-bound contracts.

Go-live minimisation review is still required for ordinary profile/directory data:

- some same-unit Team surfaces currently request coworker email;
- some same-unit Staff/Home surfaces currently request birthday;
- `profiles` also stores phone and other ordinary profile fields.

Seeing a coworker operationally must not automatically imply a right to every personal field stored on the same profile row. The directory/birthday policy must be explicitly accepted before broad onboarding. Until then, new surfaces should request only the columns they need.

Location evidence is also purpose-bound data. It may support attendance/reconciliation and approved technical/compliance troubleshooting, but it must not become background surveillance, employee scoring or unrestricted technical-support content.

## 6. Retention decision register

No statutory retention period is invented here. Automated deletion must not be introduced until CEAC obtains the necessary legal/HR/privacy decisions.

| Data class | Current retention decision | Required decision owner |
|---|---|---|
| Auth/account events and privilege audit | Period unresolved; preserve security attribution | CEAC + privacy/security review |
| Employment and protected HR records | Period unresolved; replacement/history architecture preserved | Administration/HR + legal/privacy review |
| Payroll records | Period unresolved; approved/correction history preserved | Administration/HR + finance/legal review |
| Leave/medical evidence | Period unresolved; need-to-know only | Administration/HR + legal/privacy review |
| Attendance/work-session/location evidence | Period unresolved; purpose-limited | Administration/HR + privacy/legal review |
| Operational work/project/report records | Period unresolved; preserve organisational history | CEAC leadership |
| Support/security incident records | Period unresolved; preserve investigation/change evidence | Technical Support + Administration |
| Storage documents/files | Follow owning record and approved document-class policy | Business owner + Administration |
| Backups/restore copies | Define retention, encryption and disposal before production process begins | Technical Support + CEAC leadership |

## 7. Technical handover

Before the builder exits operational ownership, CEAC Technical Support must receive and verify:

- GitHub ownership/access and protected-main operating rules;
- Supabase ownership/access with privileged MFA active for real privileged users;
- Vercel/deployment ownership and recovery path;
- current migrations and clean replay procedure;
- database backup and restore procedure with at least one successful non-production restore;
- Storage backup/recovery procedure with evidence;
- list of production integrations and secret/key owners;
- rotation/revocation process for each production credential;
- account joiner/mover/leaver runbook;
- incident and suspected-compromise runbook;
- Technical Support authority limits and escalation path;
- known platform/plan limitations;
- current privacy/data-classification/access matrix;
- unresolved legal/policy decisions.

The builder must not remain a hidden permanent dependency after handover.

## 8. S7 exit criteria

S7 is not fully accepted until all of the following are evidenced:

- [x] current recovery gap documented truthfully;
- [x] database and Storage recovery treated as separate concerns;
- [x] data classification/access matrix recorded;
- [x] draft privacy notice prepared for CEAC review;
- [x] handover responsibilities documented;
- [x] retention questions recorded without invented periods;
- [ ] real production database export completed;
- [ ] safe non-production database restore test completed and recorded;
- [ ] private Storage export/recovery procedure executed at least once;
- [ ] formal privacy notice approved/published by CEAC;
- [ ] processing/handover agreement approved;
- [ ] CEAC/DPC registration position resolved through the appropriate owner/legal process;
- [ ] post-upgrade backup controls independently verified if/when plan changes.

The unchecked items are operational/legal owner actions, not reasons to weaken the technical boundary.

# Manager project creation — permission repair, 25 October 2026

The owner reported that the Technical Support Manager Projects list had no way to add a project. Investigated current main `752c129aa02c04418f3dd4b392a496e801e72a79`, preserving PR #145/#146 and the earlier Compliance/HR releases.

## Confirmed cause

The existing ManagerProjects screen already implements Create project → Project basics → objectives → work, using the existing atomic `create_project_with_participants` RPC. Both the screen and the production RPC require the legacy `create_project` capability. Read-only production inspection found five active manager accounts, of which two (Technical Support and Compliance heads) lacked that existing capability. Three already had it. The fixture manager is seeded with that capability, which explains why its existing positive creation coverage did not expose this production assignment gap.

The current approved owner decision already states that managers create lawful projects for their managed units. This is a bounded missing permission assignment repair, not a new project feature, new department or broader Administration authority.

## Repair and verification

Using the connected production database owner's maintenance access, a transaction asserted exactly two inspected active non-Admin/non-Executive manager accounts were missing the capability, inserted only those two `create_project` rows, and appended an explicit owner-authorised repair reason to platform audit. The normal capability-insert audit trigger also recorded both writes. No in-app actor was impersonated: nullable `granted_by`/actor attribution remains null, with the database-owner execution path explicitly described in the appended audit context.

Readback: five active manager accounts; zero missing project-creation permissions; exactly two repaired rows, two automatic insert audit records and two reason audit records. No unrelated permissions, profiles, memberships, project/business records, schema, RLS, RPC, Auth/provider or application source were changed.

The existing server still requires management of the selected lead unit and validates all participating units as active and in the caller's organisation. Existing atomic project/participant creation and project-created activity remain unchanged. Restoring this legacy capability does not provide HR, Payroll, confidential records or general cross-unit management authority.

The Manager Projects list loads this permission on entry. Refreshing the page reloads it and exposes the existing Create project action. No fake production project was created. Actual post-repair manager UI submission/save/reload is not claimed as tested in this maintenance session; readback and existing code/server boundary inspection are the evidence. No source change invalidates the already qualified application or warrants another full application test run.

## Continuity

Keep the existing manager creation workflow and server scope checks. A future new manager account still needs its existing project capability assigned through the authorised provisioning/permission process; this repair does not silently introduce automatic role-based grants or change offboarding policy. Rollback, if owner-required: revoke only the two capability IDs recorded by the matching `capability.owner_authorised_repair` audit events after verifying no unrelated later permission change. Do not delete projects or audit history.

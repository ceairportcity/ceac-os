# CEAC OS — Owner decisions for next controlled release (14 October 2026)

Status: explicit owner decisions; technical design and acceptance details pending reconciliation with three owner-supplied HR/contract/policy documents and existing binding contracts. This is a release-scope register, not a production deployment authorisation.

## Next controlled production release

1. Volunteer lifecycle, Technical Support and enhanced Attendance capabilities previously approved are **mandatory** for the next production release. They may not be silently deferred.
2. Deliver them as **one controlled, verified release**, with transactional migration planning, exact-SHA tests, role acceptance and rollback/recovery considerations. Do not deploy partially incompatible schema and UI.
3. Prioritize **functionality before additional visual refinements**, without compromising accepted UI contracts or accessibility.

## Role and business decisions

4. Managers create volunteer records; **HR approves initial activation**. Preserve previously agreed HR control over volunteer payment and status changes, contracts and notification; do not infer that managers gain HR authority.
5. **All staff and volunteers** may raise Technical Support cases. Case submission does not imply unrestricted membership, evidence access or HR/Payroll authority.
6. Require verification codes for **all ordinary on-site attendance**. Preserve appropriate anti-replay/anti-gaming measures and supported exception/correction workflows; details to be reconciled against existing attendance contract.
7. **Executive has final authority to approve payroll** before it becomes an official record. Preserve separation of preparation, review, approval, protected compensation and attributable audit history.

## HR operational decisions

8. Existing **18-person employee roster** is the initial authoritative onboarding population, subject to genuine HR verification. Do not fabricate authentication identities or email addresses.
9. Where an individually signed employment contract conflicts with general office policy, **flag the discrepancy for HR review** rather than silently choosing a rule.
10. **Historical leave balances and working schedules require explicit HR confirmation** before the application relies upon them for calculations. No synthetic backfills.

## Release sequencing and unresolved evidence

- Stage 1 remains live on original production Supabase (119 applied migrations) and existing Vercel; do not create a replacement project or enable Stage 2 Google/OAuth/universal AAL2 as part of this follow-on product release.
- The owner has deferred comprehensive backup/restore remediation to the **initial Stage 2 work**. Record the recovery exposure as unresolved and assess migration rollback/restore for any intervening release without falsely calling it complete.
- Stage 2 is provisionally targeted for November: verify CE Airport City-owned project existence/ownership; compare authorized project transfer with migration/cutover, including all subsequent live data and schema changes.
- Upcoming **three owner-supplied documents are not yet attached or reviewed**. When received, reconcile them with contracts, existing code, schema and these ten decisions. Seek clarification only for genuine conflicts.
- Reconcile current live production commit and canonical main before another automatic production deployment; do not overwrite unmerged work.
- Review existing protected HR/Payroll source fixes and stage genuine functional/role acceptance before expansion. No owner-authorized production SQL mutation or deployment follows from this file alone.

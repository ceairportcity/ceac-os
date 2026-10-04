# Leave Owner Rules — Build State

Status: ACCEPTED / PRODUCTION ROUTING VERIFIED
Canonical merged main: `5254d7a685825c6130f8963598f55a02e32e943a`
Production project: `efjljhftsesssumtshvp`
Production migration: `leave_owner_rules` (`20261003222056`)

LOR0: ACCEPTED
LOR1: ACCEPTED
LOR2: ACCEPTED
LOR3: ACCEPTED
LOR4: PRODUCTION VERIFIED

Implemented and verified:
- owner-confirmed leave categories: annual, sick, maternity, paternity, study;
- Employee request → Manager approval → Administration final approval;
- Manager approval records the first decision and moves the request to Administration review;
- Administration alone performs final approval on the confirmed route;
- leave request/cancellation is independent of work-session state;
- no work session recorded is not an absence finding;
- attendance/work-session data does not automatically create Payroll deductions;
- owner-confirmed routing remains effective while entitlement/accrual/carry-over values are intentionally unconfigured;
- arbitrary unconfirmed leave kinds are rejected;
- My Hub exposes exactly the confirmed category set;
- Manager Home no longer reads the legacy `manager_approval_limit` or acts as a second Leave approval engine; Leave attention routes to authoritative Time & Leave.

Production verification:
- annual, sick, maternity, paternity and study rows exist;
- each uses `manager_then_admin`;
- `routing_confirmed = true`;
- `complete = false`;
- entitlement, accrual and carry-over values remain null/unconfigured.

No entitlement amount, accrual rate, carry-over formula, unpaid-leave rule or Payroll consequence was invented.

Independent authenticated deployed-Vercel UI smoke is not claimed here because the connected Vercel account still lacks project/team authorization. That is an access/evidence limitation, not a Leave code or database defect.

## Visible Leave discoverability closure — accepted on PR #99

Accepted application SHA: `55e9ce8518bac77fca2f5d8ebddaa1b4e413a781`.

The owner reported that the confirmed Leave implementation was not discoverable enough in the visible product. The corrective pass therefore preserved the existing Leave domain/security implementation and made the established workflow explicit in the product:

- Staff and Manager shells now expose `Time & Leave` as a first-class destination;
- My Hub continues to preserve the established personal Workforce deep-link and its dedicated Leave tab;
- My Hub Leave visibly states the confirmed categories: Annual, Sick, Maternity, Paternity and Study;
- Workforce visibly states `Manager approval → Administration final approval`;
- entitlement amounts, accrual and carry-over remain explicitly not configured rather than inferred;
- no Payroll consequence or authority boundary changed;
- the prior Staff/Manager navigation tests were updated to ratify this owner-directed discoverability change rather than treating Time & Leave as Administration-only;
- BrandBook-only visual CSS introduced immediately before this correction was route-scoped to preserve the existing aggregate CSS performance budget without changing rendered class structure.

Exact-head verification:
- CI — PASS;
- Migration Replay — PASS;
- Account Security — PASS;
- Quality Gate — PASS;
- Level B SQL/authority contracts — PASS;
- all browser shards — PASS, including the Stage 9 Leave lifecycle and Staff/Manager routing contracts.

GitHub's Vercel status on the branch is currently blocked by the external build-rate limit. This does not weaken the accepted application verification above and does not imply a Leave application defect.

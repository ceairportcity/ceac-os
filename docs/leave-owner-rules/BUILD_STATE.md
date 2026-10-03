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

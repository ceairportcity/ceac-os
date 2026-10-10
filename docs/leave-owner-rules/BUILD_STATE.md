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


## 7 October 2026 go-live Annual policy extension — PRE-RESTORATION IMPLEMENTED / NOT YET ACCEPTED

Owner-decision source:
- `docs/final-product/LEAVE_RULES_v1.md`
- annual entitlement: 24 working days per leave year;
- accrual: 6 working days per completed quarter;
- joiners: pro-rated first completed-quarter credit;
- ordinary unused Annual leave: expires at leave-year end;
- protected/contractual exceptions and approved cross-year leave remain preservable;
- attendance/leave never automatically creates a Payroll consequence.

Prepared implementation branch:
`chatgpt/pre-restoration-go-live-ready-2026-10-07`

Prepared implementation:
- migration `20261007180500_go_live_annual_leave_policy.sql`;
- Annual policy rule is upgraded from routing-only to 24 days / quarterly / 6-day credit without inventing secondary leave quantities;
- annual request rows retain the legacy date span and additionally record a schedule-derived `working_days` value where attributable schedule evidence is available;
- Annual balance is calculated server-side;
- joiner pro-rating implements the literal portion of the completed join quarter served using calendar-day proportion, avoiding any invented pre-employment working pattern;
- routine carry-forward is prohibited; explicit protected/contractual exceptions and corrections use an append-only, attributable adjustment ledger with reversals;
- browser-facing new Annual RPCs are SECURITY INVOKER wrappers; privileged implementations are placed in the non-public `private` schema;
- My Space and Workforce UI now state the confirmed Annual rule and keep unresolved secondary leave quantities truthful/unconfigured;
- SQL acceptance gate `go_live_annual_leave_policy_gate.sql` is included in the complete SQL/security suite.

Not yet claimed:
- GitHub Actions exact-head acceptance;
- Migration Replay acceptance;
- browser-shard/product evidence;
- protected-main merge;
- production migration/application;
- live Vercel acceptance.

Those items remain acceptance gates, not missing product-owner decisions.

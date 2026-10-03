# Leave Owner Rules — Build State

Status: ACTIVE
Branch: `chatgpt/leave-owner-rules-2026-10-03`
Baseline main: `16ec9ca1263761c8c1631107184e5ad30ec1a856`
Reconciled protected main: `a590998fefdf51742cc4693b7c4f7453efbd0ed3`

LOR0: COMPLETE
LOR1: IMPLEMENTED / REGATE PENDING
LOR2: IMPLEMENTED / REGATE PENDING
LOR3: IMPLEMENTED / REGATE PENDING
LOR4: PENDING

Implementation now includes:
- owner-confirmed leave categories: annual, sick, maternity, paternity, study;
- routing confirmation decoupled from unresolved entitlement mathematics;
- Manager-to-Administration approval enforced;
- arbitrary unconfirmed leave kinds rejected;
- My Hub request UI aligned to the confirmed category list.

No entitlement amount, accrual rate, carry-over formula, unpaid-leave rule or payroll consequence was invented.

- canonical Manager approval now records the first decision and moves the request to Administration review;
- Administration alone performs the final approval step on the confirmed route;
- owner-confirmed routing remains effective even when entitlement/accrual/carry-over values are intentionally unconfigured;
- the stale Stage 9 browser acceptance path has been aligned to Manager approval -> Administration final approval.

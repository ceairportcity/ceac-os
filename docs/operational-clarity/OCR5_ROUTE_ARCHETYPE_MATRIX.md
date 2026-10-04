# CEAC OS — OCR5 Route Archetype Matrix

Status: **OCR5H implementation evidence**
Date: 2026-10-04

This matrix assigns every route in the Operational Clarity route sweep a primary page archetype. It does not change authority; guarded routes remain available only when the existing capability/role contract allows them.

| Role | Route | Primary archetype | Notes |
|---|---|---|---|
| Staff | Today | Overview | Personal operational starting point. |
| Staff | Work | Queue | Assigned work and action state. |
| Staff | Team | Record | Unit/sub-team people context. |
| Staff | Time & Leave | Ledger | Personal sessions and leave records; no absence/pay inference. |
| Staff | Calendar | Ledger | Time-ordered personal schedule. |
| Staff | Messages | Queue | Contextual Rooms/mentions/announcements; no unrestricted DMs. |
| Staff | My Hub | Overview | Personal work/development hub. |
| Staff | Your account | Settings | Self-only account/session controls. |
| Staff | Record | Record | Personal attributable record detail. |
| Staff | Announcements | Queue | Published organisational notices. |
| Staff | Performance & development | Record | Evidence and human-judged review context. |
| Staff | Learning | Record | Learning records and completion evidence. |
| Staff | Assets & devices | Ledger | Assigned asset custody and lifecycle. |
| Staff | Compliance | Ledger | Policies, acknowledgements and evidence. |
| Manager | Overview | Overview | Unit decision and operating context. |
| Manager | Work | Queue | Shared Work-family manager queue. |
| Manager | Team | Record | Unit/sub-team operating workspace. |
| Manager | Projects | Ledger | Project portfolio and record drill-down. |
| Manager | Time & Leave | Ledger | Unit workforce context and authorised actions. |
| Manager | Calendar | Ledger | Unit/project time view. |
| Manager | Finance | Ledger | Currency-separated unit financial record. |
| Manager | Reports | Ledger | Recorded reporting submissions. |
| Manager | Messages | Queue | Contextual communication queue. |
| Manager | My Hub | Overview | Personal manager hub. |
| Manager | Your account | Settings | Self-only account/session controls. |
| Manager | Record | Record | Personal attributable record detail. |
| Manager | Announcements | Queue | Organisational notices. |
| Manager | Ministry | Record | Direction/objective record where authorised. |
| Manager | Delivery | Ledger | Delivery/project context. |
| Manager | Workload | Ledger | Factual capacity/work context without scoring. |
| Manager | Performance & development | Record | Human-judged development record. |
| Manager | Learning | Record | Learning record. |
| Manager | Assets & devices | Ledger | Asset custody. |
| Manager | Compliance | Ledger | Compliance evidence. |
| Administration | Overview | Overview | Needs Administration first, then HR/operations context. |
| Administration | People | Record | Directory / Organisation / Needs attention + employee master-detail. |
| Administration | Work | Queue | Shared Work-family queue. |
| Administration | Time & Leave | Ledger | Daily workforce operation separated from advanced policy. |
| Administration | Finance | Ledger | Currency-safe finance record. |
| Administration | Payroll | Ledger | Prepare/list-detail; Group Pastor/CEO approval remains separate. |
| Administration | Reports | Ledger | Reporting coverage and submissions. |
| Administration | Control Center | Settings | State-derived configuration/governance command centre. |
| Administration | Messages | Queue | Contextual communication queue. |
| Administration | My Hub | Overview | Personal Administration hub. |
| Administration | Your account | Settings | Self-only account/session controls. |
| Administration | Employee lifecycle | Queue | Lifecycle case queue + selected record; mutation uses Composer. |
| Administration | Protected HR | Record | Capability-protected employee records. |
| Administration | Units | Ledger | Organisation unit operating record. |
| Administration | Projects | Ledger | Cross-unit project context. |
| Administration | Calendar | Ledger | Organisation schedule. |
| Administration | Audit | Ledger | Consequential attributable history. |
| Administration | System events | Ledger | Internal event evidence. |
| Administration | Checks | Queue | Authorised human decision queue + selected record. |
| Administration | Policies & rules | Settings | Current rule + successor Composer + collapsed history. |
| Administration | Connected Apps | Settings | Provider connection state and actions. |
| Administration | Authority | Settings | Person + current grants + collapsed history + Composer actions. |
| Administration | Organisation settings | Settings | Office, thresholds and advanced configuration. |
| Administration | Cost | Ledger | Append-only spending evidence. |
| Administration | Record | Record | Attributable personal record detail. |
| Administration | Announcements | Queue | Published/draft organisational notices. |
| Executive | Overview | Overview | Needs your attention first. |
| Executive | Work | Queue | Executive-authorised Work-family view. |
| Executive | Ministry | Record | Direction/objective leadership record and Composer. |
| Executive | Portfolio | Ledger | Leadership-altitude portfolio with drill-down. |
| Executive | Organisation | Overview | Read-only leadership context and exceptions. |
| Executive | Finance | Ledger | Leadership financial context, currencies separate. |
| Executive | Payroll | Ledger | Protected approval surface; no Administration preparation authority. |
| Executive | Reports | Ledger | Leadership reporting view. |
| Executive | Messages | Queue | Deliberate Unit/Sub-team Room access and communication. |
| Executive | My Hub | Overview | Personal Executive hub. |
| Executive | Your account | Settings | Self-only account/session controls. |
| Executive | Record | Record | Personal attributable record detail. |
| Executive | Announcements | Queue | Organisational announcements and authorised creation. |

## OCR5H sweep contract

- Desktop route inventory captures every route above that is reachable by the role fixture.
- Mobile route sweep checks the same route inventory at 390px for page/body overflow and route render failure.
- Existing family-specific tests continue to cover 320–430px phone widths where the family has denser interaction.
- Desktop route screenshots plus OCR5H mobile representative screenshots provide visual evidence.
- OCR6D performs the final side-by-side comparison with `reference/APPROVED_REFERENCE.html`.
- No route may invent data or weaken authority to satisfy visual parity.

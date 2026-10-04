# CEAC OS — Administration / Cross-role Workspace Audit

Date: 2026-10-04  
Mode: read-only inspection of PR #99 head `89062b7d2baa7baa16ca1950c3b78ad9f1167bc5`

## Conclusion

The Product Owner observation is confirmed.

The shared Shell V2 is already role-aware across Staff, Manager, Administration and Executive. The strongest inconsistency is not the outer shell; it is the page bodies and interaction patterns behind the navigation.

The Manager Work family and several Experience V2 families show the newer direction. Administration/HR still contains multiple legacy-style surfaces that expose long forms, history, configuration and operational data together.

## Current strong / reusable patterns

- Manager Work and Administration Work already share the Work-family structure.
- People and Workforce have newer Experience V2 family components that should be extended rather than replaced.
- Payroll already uses a useful list/detail ledger direction.
- Shell navigation grouping is shared and role-aware.

These should be reused to keep the next phase fast.

## Confirmed Administration / HR problem areas

### Administration Overview
Current page combines operational inbox, setup/access, reporting, organisation pulse, workforce context, cross-unit attention, meetings, personal work and organisation structure. The information is individually valid but the page has too many equal-weight sections.

### People
The roster and employee-data model are correct, but a selected employee can expose many sequential sections and fact rows. It needs stronger grouping, collapsed history and clear drill-down.

### Workforce
Operational attendance/leave/calendar data and advanced policy configuration live in the same broad surface. The policy form carries many fields and should become a dedicated advanced composer/settings path.

### Protected HR
Current screen combines employee selection, several protected record histories and the record/create/correct form on the same page. This is secure but cognitively heavy.

### Lifecycle
Uses case records plus a start-case form and selected-step detail in one surface. Better as queue/list-detail plus composer.

### Checks / Workflows
Uses a queue but also exposes substantial explanatory/detail content. Better as a clean decision queue + selected record.

### Authority
Current grants, revocation history, grant form and revoke form compete in the same surface. Better as person record + current grants + collapsed history + compact actions.

### Policies
Current rule list, selected rule editing and history are functional but visually legacy. Better as list/detail + version history + compact revision composer.

### Control Center / Office Settings
Contains grouped settings but also long vertical sections and navigation hints such as “Managed in Workforce ↑”. Those arrows are evidence of page architecture doing navigation work that the interface should express more directly.

### Payroll
Underlying direction is materially stronger than most legacy Admin surfaces. Preserve list/detail. Harmonise headers, readiness, decision sheets and history rather than redesigning the domain.

## Executive

The previously locked Executive findings remain valid:
- overview hierarchy too technical;
- Ministry form too form-heavy;
- Portfolio too operational by default;
- Organisation too card-wall oriented;
- announcement discoverability weak;
- destination-only search inadequate.

## Manager and Staff

The Manager experience is currently the strongest page-level reference, particularly Work. It should guide interaction grammar, not become a literal template for every role.

A final route-by-route pass is still required because role consistency cannot be inferred only from Home/Work.

## Locked response

The next phase must include a route-by-route workspace harmonisation pass using six page archetypes:

1. Overview
2. Queue
3. Record
4. Ledger
5. Composer
6. Settings

This is a presentation/information-architecture correction unless a separately locked feature requires backend work.

It must preserve all canonical authority, HR, Payroll, Leave, Finance and Work Engine contracts.


## 2026-10-04 Product-owner elevation: People + Control Center

The earlier “refine People / grouped Control Center” recommendation is superseded by a stronger lock.

### People
People is elevated from a cleaner Record page to a complete Administration people workspace:
- Directory;
- Organisation;
- Needs attention;
- employee photos where securely uploaded;
- master-detail employee browsing;
- grouped employee record;
- actionable Administration exceptions.

### Control Center
Control Center is elevated from collapsible settings to CEAC's configuration/governance command centre:
- truthful system-state summary;
- Needs attention first;
- domain status;
- focused category workspaces;
- deep-links to authoritative configuration;
- progressive disclosure for advanced forms.

This still reuses the existing backend and authority contracts. The transformation is primarily information architecture, interaction design and presentation.

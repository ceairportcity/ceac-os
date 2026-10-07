# CEAC OS — Executive Panel Redesign Visual/Product Lock

**Date:** 7 October 2026
**Status:** OWNER-APPROVED / LITERAL VISUAL AUTHORITY
**Implementation branch:** `chatgpt/executive-product-redesign-2026-10-07`
**Stack base:** Phase 6 branch `chatgpt/phase6-volunteer-planning-attendance-2026-10-07`
**Approved visual reference:** `docs/design/executive-redesign/CEAC_EXECUTIVE_PANEL_APPROVED_REFERENCE.webp`
**Reference SHA-256:** `435c5efaa88a78ffbadc8ac1f481eeef49a792e0ff5b6d8c3a935e2e640be737`
**Reference Git blob:** `7a238716aa759ee0f55f7bc6f7d68019e6ab1ad8`

## Owner instruction — no compromise

The approved visual reference is a literal implementation authority, not inspiration and not a loose design-language guide.

The delivered Executive panel MUST visibly reproduce the approved composition, hierarchy, density, spacing logic, card treatment, colour differentiation, mobile recomposition and destination-family grammar.

A materially different interpretation, generic premium redesign, simplified substitute layout, monochrome approximation, or “same idea” is NOT accepted.

If implementation constraints require a visible deviation, that deviation requires explicit product-owner approval before it is treated as accepted.

Automated tests do not waive visual non-conformity.

## Invariants

The redesign changes presentation, information hierarchy and interaction composition only.

It MUST preserve:
- current Executive authority and capability boundaries;
- RLS and privacy;
- existing source-of-truth records;
- Work Engine semantics;
- Ministry / Strategy hierarchy and attributable change history;
- Payroll approval authority;
- reporting read-only boundaries where already defined;
- Finance currency separation;
- announcement draft/publish semantics;
- existing Phase 5/6 product and security boundaries.

It MUST NOT:
- invent data to make the screen look populated;
- hard-code mockup sample metrics;
- manufacture Executive authority;
- weaken security;
- create automatic scoring, discipline, absence or Payroll consequences;
- modify the separately owned security programme.

Mockup numbers and names are layout examples only. Real product values must come from truthful CEAC records. When data is absent, use the same approved visual system with intentional empty states rather than fake sample data.

## Executive navigation — exact visible family

Desktop Executive navigation must present this ordered family:

1. Overview
2. Work
3. Ministry
4. Portfolio
5. Organisation
6. Calendar
7. Finance
8. Payroll
9. Reports
10. Messages
11. My Hub
12. Account

Desktop shell:
- dark navy left rail;
- CEAC OS brand at the top;
- compact icon + label rows;
- selected destination uses the approved purple active treatment;
- Executive identity block at the bottom;
- no competing legacy Executive sidebar styling.

Mobile shell:
- compact CEAC OS top bar;
- notification and Executive avatar actions;
- bottom primary navigation: Overview, Work, Ministry, More;
- remaining destinations available through More;
- no shrunken desktop sidebar.

## Overview — exact hierarchy

### Top frame
The desktop content area uses:
- page title: **Overview**;
- supporting line: **Executive Dashboard**;
- global CEAC search field in the top bar;
- notification control;
- Executive avatar.

### Hero
Directly below the page header:
- broad soft sunrise / warm-lilac hero banner;
- left aligned greeting: **Good morning, <Executive name>**;
- supporting line: **Here’s what matters today across your ministry, people and operations.**
- current date aligned to the upper-right of the hero.

The hero is calm and premium, not a dark command centre.

### Four summary cards
Exactly four summary cards overlap / sit across the lower hero edge on desktop.

Approved visual roles:
1. purple people card;
2. green objective card;
3. amber meeting card;
4. blue report/action card.

Each card uses:
- semantic icon tile;
- compact title;
- large primary value;
- short factual supporting context;
- optional factual change/attention indicator where the underlying record supports it.

The cards must not all use one colour.

### Middle grid
Directly below metrics, three equal-quality cards:

**Needs your attention**
- priority factual rows;
- semantic red / amber / blue / purple icon tiles;
- title + short supporting line;
- chevron action;
- “View all” action.

**Ministry direction**
- active Ministry direction / objective rows;
- icon;
- objective name;
- factual status text;
- progress bar only where an explicit numeric measure exists;
- percentage only when mathematically supported by recorded target/current data;
- “View all” action.

**Organisational overview**
- departments / units;
- teams;
- active volunteers;
- active staff;
- semantic icon tiles;
- factual counts only;
- “View all” action.

### Lower grid
Two cards:

**Recent activity**
- attributable CEAC activity only;
- semantic icon;
- activity title;
- source / person / context where authorised;
- relative or factual timestamp;
- “View all”.

**Upcoming meetings**
- time column;
- meeting title;
- location / provider / duration when known;
- chevron;
- “View calendar”.

## Overview responsive contract

At phone width:
- hero becomes a compact greeting section, not a cropped desktop banner;
- summary cards become a clean 2 × 2 grid;
- Needs your attention follows immediately;
- no horizontal overflow;
- touch controls remain at least 44 px;
- semantic colours/icons remain;
- bottom navigation follows the approved reference;
- no desktop tables are squeezed into the phone.

## Shared destination grammar

The following destinations must look like one Executive product family, not separate historical stages.

### Work
- concise page introduction;
- clear task/work state tabs;
- list/card rows with icon, title, context, status;
- strong empty state using same Executive family;
- preserve current Given out / Needs review / Mine authority where applicable.

### Ministry
- unified tabs / filters for appropriate ministry views;
- objective/programme/announcement context composed in the same card language;
- progress only when supported by explicit numeric data;
- preserve existing Strategy hierarchy and audit requirements.

### Portfolio
- programme / initiative cards;
- clear status and ownership;
- no fabricated portfolio scoring.

### Organisation
- tabs or segmented controls for Departments / Teams / People where supported;
- icon + name + factual membership / leadership context;
- structural exceptions intentionally surfaced;
- remove the old isolated `exec-page-head / exec-org-grid` visual language.

### Calendar
- use the Phase 6 shared Calendar/Day Workspace interaction grammar;
- Executive-authorised organisation context remains distinct from private planning;
- the Executive visual shell must match this locked redesign.

### Finance
- compact Executive summary metrics;
- factual income/spend/request context;
- currencies never combined;
- small trend visual only where supported;
- same cards, spacing and header grammar as Overview.

### Payroll
- preserve existing Group Pastor approval authority;
- presentation must visually join the Executive family;
- no approval automation.

### Reports
- compact Executive reporting summary;
- useful filters;
- factual report rows;
- no giant unused desktop voids;
- no ranking/performance inference from filing coverage.

### Messages / My Hub / Account
- shared product surfaces may remain functionally shared;
- when entered from Executive shell, header spacing, container width, mobile treatment and shell continuity must remain coherent.

## Creation surfaces already locked

Do not regress the owner-approved compact Executive composers:

- **Give out work** — narrow progressive composer;
- **New Ministry Objective** — compact hierarchy-first composer;
- **New Announcement** — compact audience-first composer.

These forms should visually harmonise with the new Executive family but retain their existing authority/workflow contracts.

## Visual system

The approved reference requires:
- dark navy shell;
- white / very-light-neutral content canvas;
- purple primary Executive accent;
- semantic green, amber/orange, blue, red and purple support colours;
- subtle soft shadows;
- rounded cards and controls;
- restrained borders;
- clear icon tiles;
- generous but not wasteful whitespace;
- strong hierarchy;
- compact executive density;
- no monochrome-everything treatment;
- no oversized empty panels.

Legacy `premium-executive.css` must not continue to impose conflicting Executive layout rules on redesigned surfaces. Remove or isolate obsolete Executive-only legacy styling only after the replacement contract is in place; do not disturb non-Executive surfaces.

## Acceptance evidence

Acceptance requires rendered evidence from the actual CEAC product, not only source assertions.

Required minimum captures:
- Overview desktop 1440 × 900;
- Overview laptop 1366 × 768;
- Overview phone 390 × 844;
- Work desktop + phone;
- Ministry desktop + phone;
- Portfolio desktop + phone;
- Organisation desktop + phone;
- Calendar desktop + phone;
- Finance desktop + phone;
- Reports desktop + phone.

Each capture must be directly reviewed against `CEAC_EXECUTIVE_PANEL_APPROVED_REFERENCE.webp`.

Required technical checks:
- no horizontal overflow;
- 44 px mobile touch floor;
- truthful empty states;
- no mockup sample data hard-coded;
- no authority/RLS/security regression;
- existing Phase 5/6 contracts preserved.

## Acceptance rule

The implementation is not accepted because it is “clean”, “modern”, or “similar”.

It is accepted only when the rendered Executive panel visibly matches this approved reference composition and visual language across the applicable destinations while using truthful CEAC data.

**No compromise: the owner must see this design, not an interpretation of it.**

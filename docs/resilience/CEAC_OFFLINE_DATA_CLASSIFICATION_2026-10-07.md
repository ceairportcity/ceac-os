# CEAC offline data classification

Date: 7 October 2026  
Default: **deny business-data persistence**

## Class O0 — cacheable public shell

Permitted: versioned JavaScript/CSS, icons, manifest, generic fonts/images, `index.html` shell and the offline page. These resources contain no user or organisation records.

## Class O1 — local-only low-risk drafts

Potentially eligible only after a named feature review: personal planning text or task/calendar drafts that have not become authoritative records. A feature must define user scoping, expiry, clear unsent status, deletion, reconciliation and conflict behaviour before storing a draft. No generic draft queue is enabled by this programme.


Approved low-risk exception — CEAC Guide checklist preference:
- the static Guide itself is Class O0 application content bundled with versioned shell assets;
- Getting Started progress may use a profile-scoped local preference key;
- the stored value is limited to Guide version, role, completed checklist step IDs, dismissal state and an expiry timestamp;
- maximum retained lifetime is 90 days, after which the client discards it;
- a Guide version or role mismatch resets it;
- Reset/Dismiss/Show controls are user-visible;
- it contains no Work, People, Leave, Finance, HR, Payroll, attendance, security or communication record and is never treated as authoritative organisation data.

## Class O2 — online-only ordinary business data

Work, projects, meetings, rooms, attendance, leave, finance, people and organisational records remain online-only even if a user could normally view them. Do not store API responses in Cache Storage, IndexedDB or localStorage for offline browsing.

## Class O3 — prohibited offline persistence

Never cache or persist for offline convenience:

- payroll, salary, payment and protected HR data;
- disciplinary, medical or compliance-sensitive records;
- authority, capability, account-security, MFA or audit evidence;
- Supabase sessions, access/refresh tokens, secrets or service credentials;
- unrestricted REST, Auth, Realtime, Storage or Edge Function responses.

## Offline mutation rule

Authoritative organisational actions require live server authorization. CEAC has no general offline mutation queue. A future queue must be feature-specific, idempotent, attributable, conflict-aware, revocable and accepted through the normal security programme. Until then, offline input is either an explicitly labelled local O1 draft or unavailable.

## User communication

Offline state must say that the shell is available, identify the last connected time where known, and explain that live records and authorised actions need a secure connection. An unsent draft must never look submitted.

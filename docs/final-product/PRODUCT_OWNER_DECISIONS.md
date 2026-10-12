# Product Owner Decisions

## Binding first-release authentication decision — 12 October 2026

**Owner override of the earlier privileged-only MFA scope, pending implementation and full isolated acceptance.** CEAC first release must use **Google-only interactive sign-in for exact HR/Administration-authorised Google email identities** and require a CEAC-controlled, verified **TOTP authenticator MFA session (Supabase AAL2) for every enabled account**, including Staff, Managers, Administrators, Executives, Volunteers and Technical Support. Google Workspace is a future option and is **not** required to exist before go-live. No arbitrary Google user, uninvited email, unverified identity, title, or provider metadata may grant CEAC membership or permissions.

The owner ordered a **minimum-safe assessment before any application/security release-candidate mutation**. The prior frozen app SHA remains `51223157f28e16e90acda6a35dd71389513b6d6f`; this document does not assert Google OAuth/MFA-all has been implemented or tested. No production Auth setting, OAuth provider, secrets, database, source, or deployment is authorised to change by this decision alone.

**Implementation guardrails:**
- Keep Supabase Auth and the CEAC server-authorised identity/role model. HR's approved email/invitation is a prerequisite; a verified Google login authenticates identity only, and must not create permissions. Enforce invitation/allowlist server-side **before account creation** as well as active profile and role checks after login.
- Preserve verified existing users' `auth.users.id`, employee-roster records, profile foreign keys, audit history, unit memberships, capability grants, private files and invitation history. Reconcile existing password identities with Google through verified same-email identity linking; never create a second workforce record or silently link an unverified/mismatched email. Any account without a proven match needs an audited, owner-approved recovery/mapping process.
- Implement one canonical Google OAuth callback to a fixed, allowlisted HTTPS application origin; scope Google sign-in to minimal OpenID/email/profile permissions. Do not trust arbitrary preview domains, URL redirect parameters, Google display names, unverified email or job titles as authority.
- Replace password/magic-link user-facing sign-in and activation with authorised Google entry plus mandatory TOTP enrollment/challenge. An existing Supabase password route may not remain an unaudited bypass merely because its button is hidden; provider/config/session-level rejection and legacy-session revocation require explicit verification.
- Require **Supabase AAL2** for every protected CEAC row, RPC, Storage object, and sensitive Edge Function/API, not just privileged UI; provide a narrowly restricted AAL1 pre-enrollment path to Auth's own factor APIs, with no protected staff data available until AAL2. Google account MFA alone does not establish a CEAC AAL2 session.
- Define safe lost-device/TOTP recovery, new-phone replacement, Google account/email change, terminated employee revocation and emergency admin recovery without opening an email/password fallback for routine business access.
- Before cutover, test in an isolated approved Auth/Storage-capable fixture: invited/uninvited and expired accounts; first Google OAuth and MFA enrollment; repeated/new sessions, stale sessions, bypass attempts at AAL1; verified existing-user linking and stable IDs; every role, org/tenant, unit, HR/Support access; Storage signed links; invitation/recovery; account switch; and genuine mobile/desktop redirects. Fail closed on ambiguity.
- Do not apply the Google-only or MFA-all policy to production, migrate users, disable legacy sign-in, or merge release code until dedicated review, authenticated end-to-end evidence, backup/restore readiness and explicit production GO.

The 12 October owner-ordered release freeze continues to prohibit unrelated changes; this owner-requested authentication requirement is the sole newly approved first-release scope change.

## Binding decisions — 2 October 2026
- FPG supersedes conflicting older visual/VF sequencing.
- Approved references are literal visible authorities, not inspiration.
- Material visible deviations require owner approval before implementation.
- Exact gold-standard Project/Task and Finance screens precede component extraction.
- Finance remains an operational CEAC surface, not a replacement accounting system.
- Administration prepares payroll; Group Pastor approves; automatic approval is prohibited.
- Staff cannot open/download protected HR documents; Administration manages them; Group Pastor may see all protected employee information.
- Employment types: permanent, fixed-term contract, volunteer. Hybrid is a work pattern, not an employment type.
- Leave approval: Employee → Manager → Administration final approval.
- Organisational classifications follow GO_LIVE_ORG_MAPPING.md.

## Binding continuity decisions — 3 October 2026
- Employee identity is independent of login/account identity.
- The production employee roster must continue to represent all 18 supplied staff rows; unresolved login/email state must not remove an employee.
- No fabricated email, auth user, salary, bank/payment value, statutory value or protected identifier is allowed.
- Payroll population must use the employee roster, not auth profiles.
- Roster-only employees must remain eligible for protected-HR and Payroll representation.
- Job-title wording never grants application authority.
- Leave categories confirmed by the owner: annual, sick, maternity where relevant, paternity where relevant, and study leave where CEAC uses it.
- Leave requests must be possible whether or not a work session has started.
- No work session recorded does not equal absence.
- Leave/attendance must not automatically create a Payroll deduction.
- The independent visual audit remains binding: Home/shell, Project/Task, Finance, People/Workforce, Work/BrandBook and Mobile Home require final literal reference-parity correction.
- Future visual acceptance must compare rendered output directly against the designated reference rather than accepting a generic premium/design-language match.

Canonical cross-session detail:
`docs/continuity/CEAC_OS_CANONICAL_OWNER_CONTINUITY_2026-10-03.md`

## Binding go-live owner decisions — 7 October 2026

### Identity, authority and onboarding
- Privileged accounts must use MFA at production go-live. Privilege is capability/authority based, not title based.
- Only confirmed real email addresses may be used for account activation/invitation. Employees without a confirmed email remain represented in the employee roster and must not receive fabricated accounts.
- Job title never grants CEAC authority.
- Technical Support remains organisationally associated with Media & Technical but operates as an autonomous service team for its technical-support mandate, reporting directly to Administration & HR and the Group Pastor. Technical Support is capability-scoped and is not a hidden super-admin.

### Annual leave
- Organisation-wide annual-leave entitlement is 24 working days per leave year.
- Annual leave accrues quarterly at 6 working days per completed quarter.
- Joiners during a quarter receive an appropriately pro-rated entitlement; the implementation must not award a full completed-quarter credit to a person who did not serve the full quarter.
- Accrued unused annual leave remains available during the same leave year.
- Ordinary unused annual leave expires at the end of the applicable leave year; there is no routine automatic carry-forward.
- Expiry logic must preserve any exception that CEAC is legally or contractually required to preserve and must not destroy an approved leave period merely because it crosses a year boundary.
- Sick leave remains separate from annual leave. Maternity, paternity and study-leave quantities/eligibility remain governed by their applicable policy and must not be invented.

### Unpaid leave, unauthorised absence and consequences
- Approved unpaid leave and unauthorised absence are distinct states.
- Missing attendance evidence alone does not create unpaid leave, misconduct, discipline or a salary deduction.
- Potential unauthorised absence is factual evidence for human review.
- For a staff member, the relevant Manager must be kept in the review loop; Compliance and Administration/HR review the matter; the Group Pastor/CEO is the final authority for disciplinary or salary-deduction consequences.
- Where the person under review is the Manager, escalation must not depend on that Manager approving their own case; the Group Pastor/CEO remains the final authority.
- CEAC may calculate a proposed deduction only after an authorised human decision establishes that a deduction applies. Attendance evidence itself must never post a Payroll deduction automatically.

### In-product CEAC Guide and adoption
- CEAC must include a permanent in-product Guide that is broader than a generic FAQ and reduces staff dependence on the product owner for ordinary system use.
- Desktop placement is in the left rail immediately above the signed-in user/profile block.
- Mobile exposes the Guide under More; contextual page help may also open the relevant Guide topic.
- Guide content is searchable, role-aware and context-aware. A user must not be taught features or authorities outside the role/capability experience they are meant to use.
- The Guide explains what a feature means, how to use it, who can act, what happens next and how to recover when something does not work.
- Core coverage includes Getting Started, Work/Tasks, Projects, Calendar/Planning, Attendance/Leave, Messages, My Hub/Account, Documents/Files and Notifications/Updates, plus role-specific Manager, Administration and Executive guidance.
- Getting Started is a restrained role-specific checklist with progress, resume, reset and dismiss/show behavior. It is guidance only and never becomes an authoritative work/performance record.
- Guide content is versioned with the product.
- Static Guide content may be part of the non-sensitive offline application shell. No business/API record may be cached merely to make Guide help work offline.
- Minimal local Getting Started preference state may be retained only under the reviewed low-risk offline classification; it must contain no CEAC business record and must expire/reset according to the product contract.

Canonical Guide contract:
`docs/guide/CEAC_GUIDE_PRODUCT_LOCK_2026-10-07.md`

### Data ownership and handover
- CEAC controls its organisational and staff data.
- The Standard Institute / Standard Solution is the implementation technology provider during build, testing and handover; hosting data in the builder's current Supabase project does not transfer ownership/control of CEAC staff data to the builder.
- After completion and tested handover, the intended production state is migration to a CEAC-owned Supabase account/project.
- CEAC Technical Support becomes the day-to-day technical custodian after handover, subject to CEAC authority and least privilege.
- The Standard Institute must not retain standing production access after handover unless CEAC explicitly authorises support access.
- Staff onboarding must include a plain-language privacy notice describing relevant processing, access and protection. DPC registration/compliance remains an organisational governance action and must not be falsely represented as complete merely because the technical platform is deployed.

## Binding mockup-conformity decision — 5 October 2026
- The product owner explicitly requires the live Executive Overview and Executive creation forms to visually conform to the supplied CEAC mockup rather than merely share its design language.
- Executive Overview authority: compact greeting → four summary metrics → Needs your attention + Ministry direction + Organisational overview → Recent activity + Upcoming meetings.
- Give out work authority: narrow right-side composer, compact work-type control, What needs doing → Assignee / Due date / Project / Team → Why this matters → progressive Attachments / Subtasks / Instructions / Finished result → one full-width primary action.
- New ministry objective authority: compact narrow composer with Objective name → Statement → Measurement → Start/Target dates → Status; CEAC-required parent direction and attributable reason remain preserved but visually subordinate through progressive disclosure.
- New announcement authority: compact narrow composer with Title → audience pills → Message → Attachments → availability/advanced options → one full-width primary action.
- Existing RLS, capability authority, draft/publish workflow, strategy parent requirement, audit history, truthful data, Work Engine semantics and all protected security/domain rules remain binding. Visual conformity may not fabricate values or weaken workflow truth.
- Mockup-only sample values, rich-text controls or actions that do not exist in CEAC OS must not be faked merely for visual similarity.

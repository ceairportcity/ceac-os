# CEAC OS — Messages, Memos and work corrections, 28 October 2026

Status: implemented development candidate; **not production acceptance or release GO**.

Base: `5a02f3c0caef73e0589a482d6de1174a7cd1e91f` (merged PR #150). Application checkpoint: `93a0a28ee9c7684c1402aa3b8e23bcb105fd8690`. One continuation branch, no replacement project, dependencies or infrastructure. Production Supabase `efjljhftsesssumtshvp` was inspected read-only. No production migration, Auth change, message removal, main merge or deployment was performed.

## Approved decisions and reference

The owner authorised continuing development and said “Stay on it”. The latest conversation supersedes conflicting older navigation/message-removal proposals:

- Messages contains **Rooms | Memos**. No Direct Messaging, Requests/Submissions destination, voice recording or microphone control.
- Room authors may remove their own messages. HR has no blanket removal power. Preserve append-only originals and a separate private removal event. The four specifically identified historical messages are separately owner-authorised for removal; keep the account.
- Cross-department proposals require the Group Pastor. Department proposals require an actual department manager (or Group Pastor); receiving or being copied on a Memo grants no decision authority. Team-lead membership alone grants none.
- Confidential correspondence is restricted to the sender and selected To/Cc participants. HR, IT, administrators and unrelated executives receive no ambient content access.
- Retain the Gmail identity; retire access to the duplicate iCloud identity safely, preserving employee/HR history. Never use employee offboarding as a shortcut for duplicate-account reconciliation.
- Preserve existing work approvals, eligible self-certification, executive drill-down access and separate budget/execution authority.

The actual approved composite image was recovered from the private reference collection and visually inspected. Original SHA256: `f88c49a8c22649332ea19cff7e962d81ace3ad2ae8abd0d8ebe78cc0987de435` (363,424-byte JPEG). It is deliberately not copied into this repository. It establishes the compact Room directory, restrained timeline, optional Room details, expanding composer and document-style Memo composition/reading. The synthetic desktop/mobile renders were inspected against it; this is not a claim of owner product-fidelity acceptance or production parity.

## Verified current behaviour and defects

| Area | Verified finding | Resulting approach |
| --- | --- | --- |
| Organisation | Technical Support already has IT as its parent; IT has no memberships. Gabriel's retained identity manages Technical Support and is also a Media team lead. | Preserve both units and existing assignments. A guarded release operation adds the existing person as IT manager and sets IT Head; no merge or new layer. |
| Self-certification | The work screen used the currently selected department role. Server eligibility instead checks the actual work department. | Derive the displayed action from the actor's actual manager membership for the item; retain server authority. |
| Historical work | Reverified the 28 October 09:56 elsewhere session, Camp Website submission/Rebecca review and PFCC APP self-certification. Completed diary entries retained next-action text. | Preserve historical decisions. Do not claim the IT relationship proved automatic HR routing: the ordinary resolver prioritises assigning authority, team lead, then a different same-unit manager; HR can independently review. |
| Diary | Activity state is already separate from whole-assignment status. Only the latest next action was prominent. | Show all unsuperseded recorded next actions and optional dates; explain whole-assignment completion explicitly. No auto-close. |
| Executive | Recent activity was an unfiltered individual event feed. | Limit Significant updates to actual emitted project-created/reopened, submitted-report and blocker events. Retain the other performance, attention, project and departmental drill-down sources. |
| Historical removal | Exactly four messages by the specified test account across two Rooms, with no replies, references or attachments at inspection. Original mutation trigger blocked deletion. | Keep the trigger. Use the same removal overlay for author removal and a separately guarded database-owner historical operation. Recheck scope before execution. |
| Duplicate identity | All 301 profile foreign-key columns inventoried. Duplicate identity holds the active roster link, employment record/history, appraisals, payroll and asset references; retained identity has its own employment record but no roster link. | Hard deletion or casual profile deactivation is unsafe. Existing deactivation triggers also close authority and mark employment inactive. Roster relinking, current schedule identity, HR history presentation and Auth session revocation require controlled release reconciliation. |

## Implemented changes

- `src/screens/Inbox.jsx`, `Room.jsx`, `MessagesWorkspace.css`: searchable two-panel Rooms; actual per-Room preview/unread query; mobile list/back; collapsible details; sender initials/date separators; existing replies, mentions, collaboration actions, project links and private attachments; expanding IME-safe composer with inline attachment picker. Own removal is permission-checked by RPC. Failed sends retain text/files and attachment retry does not duplicate the sent message. Existing work-attention actions remain accessible in a compact disclosure.
- `src/screens/Memos.jsx`, `src/lib/memos.js`: compact Received/Sent/Drafts/Awaiting Decision/Completed views; searchable organisational recipient directory; optional Cc and progressive decision fields; safe basic formatting; draft saves and optimistic version checks; secure existing operational attachments; immutable sent versions; replies, revisions and decisions. Refresh retains a typed reply and focus; leaving unsaved composition prompts first. Participant-only unread indicators/polling avoid an email or push-notification subsystem.
- Explicit project creation reuses existing project authority, requires a separately reviewed shareable project title/summary and is idempotent. It never copies private Memo content/attachments automatically. Both sides link back where authorised through `MemoProjectOrigin.jsx` / `Stage2ProjectOverview.jsx`; the App routes each role to its existing Projects workspace.
- `src/lib/workCompletion.js`, `Item.jsx`, `WorkActivityDiary.jsx`: work-department eligibility, optional dated next actions, correction-chain preservation and clear activity versus assignment completion.
- `ExecutiveHome.jsx`, `ExecutiveOverviewV2.jsx`, `src/lib/executiveExceptions.js`: focused Significant updates, preserved drill-down, and corrected the employment-record count projection to its real `profile_id` key.
- Retired obsolete Room/Inbox styles from `styles.css`, `premium-staff.css` and the exact obsolete Executive selectors. Unrelated shared Executive styles remain intact. Existing bundle ceilings are unchanged.

Database: `supabase/migrations/20261028181026_messages_memos_work_followups.sql` adds `next_action_on`, private `room_message_removals`, `memos`, `memo_recipients`, `memo_versions`, `memo_exchanges`, participant RLS and validated write RPCs. Extends existing private operational-file context/relation checks, freezes a sent version's attachment set and serialises sends/decisions/conversion. Client table writes are denied. Ten newly authenticated public SECURITY DEFINER functions are individually inventoried; the reviewed surface becomes 174, not an unrestricted count increase. `my_room_directory` is SECURITY INVOKER. Existing original-message append-only and unrelated file context policies remain in force. Production hook markers were independently checked read-only; schema replay is still required.

Release-only operations (not executed):

- `scripts/ops/messages-account-dependencies-readonly.sql`: read-only dependency preflight.
- `scripts/ops/owner-it-structure-correction.sql`: parameterised, guarded IT title/membership correction. Aborts if identity, unit names, existing Support management or parent relationship differ.
- `scripts/ops/owner-room-message-removal.sql`: parameterised trusted-owner removal, requires exactly the four reviewed messages across two Rooms and aborts on changed dependencies. Inserts audit events; never disables the append-only trigger.

There is deliberately no unsafe account-deletion script. The linked roster's existing verified-link RPC rejects overwriting an existing identity link, and the schedule backfill trigger only handles previously unlinked rows. These must be reconciled with history preservation before retiring access. The owner's account decision is already approved; this is a technical release dependency, not a request to reapprove it.

## Validation evidence and limits

Commands used Node 22.23.4 with the repository lockfile. No application dependencies were added.

| Check | Result |
| --- | --- |
| `npm ci && npm run build` | Passed, including sealed script policy. |
| `npm run verify:source` | 656/656 passed on the frozen application checkpoint (same tree as the cited application SHA). |
| Focused source tests after final correction | `node --test tests/stage2OwnerWorkCorrections.test.mjs tests/messages-memos.test.mjs`: 45/45 passed. |
| `playwright test tests/messages-workspace.spec.js tests/hr-operations-repair.spec.js --workers=1` | 18/18 passed: actual components, synthetic intercepted API, 390/1440 px. |
| Final focused Messages browser run | 8/8 passed after refreshing a typed clarification/focus and the compact mobile action correction. |
| `playwright test tests/visual-fidelity-performance-closure.spec.js --workers=1` | 2/2 passed; final aggregate CSS 631,761 bytes; unchanged aggregate CSS cap 631,808 bytes. |
| `CEAC_PGLITE_MODULE=... node scripts/test-messages-memos-isolated.mjs` | Forward migration compiled/applied and `messages_memos_gate.sql` passed all assertions on isolated PostgreSQL fixture, transaction rolled back. |
| Diff, visual-reference contract and Actions supply-chain policy | Passed. |

The isolated SQL fixture deliberately substitutes base Auth/authority functions and does not replay all 210 migrations. Browser tests intercept every external API/WebSocket; they do not establish live Auth, RLS, Storage or production acceptance. Disposable verification tooling was outside the repository: PGlite 0.3.14 and Playwright 1.55/Chromium 1187, with no application subscription or dependency. The existing full SQL runner now includes the new gate. Older browser assertions were reconciled to the approved Rooms/Memos navigation; role-dependent suites beyond the listed focused flows were not locally claimed as passed.

Earlier failed checks were corrected, not waived: obsolete layout/string assertions were updated while retaining authority/stale-load checks; expected migration/definer inventories were explicitly updated; an actual mention-caret defect was repaired. A bundle check first counted stale generated CSS files; after a clean output directory, the true final size was measured against the original ceiling. No baselines or thresholds were relaxed.

## Release gates and continuation

1. Review the single draft PR and its exact head; await CI, full migration replay, account-security and cumulative SQL gates. No repeated CI dispatches or preview builds merely for incremental edits.
2. On an authorised disposable Supabase environment, verify real Staff/Manager/Group Pastor/Cc/unrelated HR roles, cross-tenant denials, actual private attachment upload/download, revisions and project idempotency. Test real Room subscriptions, same-timestamp history, read/unread, replies and removal attachment revocation.
3. Complete desktop/mobile owner fidelity review against the recovered original, including real phone keyboard behaviour. Fixture screenshots are supporting evidence only.
4. Reverify the account/roster/schedule dependencies and prepare controlled identity reconciliation, preserving historical profile references and audit records. Use existing Auth administration for ban/session revocation, not cascaded user deletion or invented offboarding.
5. Release only through established safeguards: schema before matching UI, exact tested SHA, verified backup/recovery, separately reviewed IT data operation and four-message removal. Verify affected rows and unrelated records after each operation. Keep prior UI rollback available; do not drop Memo/history tables as rollback.

Outstanding production work remains explicit: IT Head membership/title, duplicate-account retirement with roster reconciliation, Frank's four removals, schema application, real role/Storage acceptance and production deployment. HR review was observed, but automatic fallback causation was not proven; do not replace the established reviewer hierarchy on that assumption.

## Initial remote qualification — exact PR head `fb3c6bb`

- [CI 40752307116](https://github.com/ceairportcity/ceac-os/actions/runs/40752307116): SUCCESS.
- [Migration Replay 40752307018](https://github.com/ceairportcity/ceac-os/actions/runs/40752307018): SUCCESS, including the new forward migration in the 210-file bundle.
- [Account Security 40752307002](https://github.com/ceairportcity/ceac-os/actions/runs/40752307002): SUCCESS.
- [Quality Gate 40752307026](https://github.com/ceairportcity/ceac-os/actions/runs/40752307026): cumulative SQL/authority job SUCCESS, including `messages_memos_gate.sql` on the real replayed schema. This supersedes the earlier isolated-fixture-only SQL limitation for that head; live production acceptance remains outstanding.
- Initial full browser shard 2 failed two stale source assertions expecting the old Recent activity wording. Their related runtime heading expectations were reconciled to Significant updates; authority, ministry-number and evidence-empty checks remain. The two corrected source contracts pass locally. The completed run also exposed stale generic page-container checks, an obsolete attachment-picker selector and exact-text matching across icon whitespace. Messages-specific route roots and accessible attachment controls now replace those selectors without weakening original width, real-file, authority or layout assertions. The downstream missing-message assertion followed the failed upload/send setup; it remains enforced. This is not a full-browser PASS.
- Additional focused SQL coverage verifies wrong-department manager denial, denial for a copied Group Pastor and successful approval by the designated actual department head. The isolated PostgreSQL gate passes with these assertions; the fixture now models both seeded manager departments.

Application code remains frozen at `93a0a28`. The follow-up qualification correction changes acceptance assertions/fixtures and this ledger only. Final PR status is authoritative for later exact-head CI outcomes.

## Consolidated qualification repair — 29 October 2026

All eight initial browser shards were collected before another push. Four passed (507 tests); the other four failed on the obsolete labels/container/picker assumptions above. Corrected source contracts pass 2/2 locally. Expanded Messages fixture checks pass 10/10 at 320/390/1440 px, including draft/focus retention, own removal, selected-recipient decision controls and the compact composer. Screenshots now use the established `test-artifacts` directory so existing CI uploads retain them. Generated test artifacts are ignored by git.

A new `messages-memos-live.spec.js` exercises Staff draft reopening, actual private attachment bytes, Manager Cc clarification, Group Pastor approval, no automatic project creation, subsequent explicit project creation with reviewed shareable content, two-way origin links and unrelated HR content denial through the actual app/API/Storage. It explicitly refuses non-loopback database environments and restores its temporary fixture job title. It is skipped locally because this host has no disposable Supabase stack; only a successful CI result may establish that journey as passed. This adds verification coverage, not new production infrastructure.

### Preserving newer approved work

On 29 October, `main` advanced to `e41abdc9475f6b4437c4097cc64df9500da58aa2` through PR #159 (approved Start Work popup and off-site work without a project). This existing Messages branch integrates that release, preserving all source changes and both owner-decision sections. The source-test command and SQL runner retain both feature gates. The explicit migration inventory becomes 211 (153 original plus 58 later migrations); no security-definer count or permission ceiling is waived. The earlier 210-migration evidence remains a record of its original head. Integrated-candidate verification is required before any release claim.

The integrated local checks pass 658 source tests and 58 focused browser checks (Messages at 320/390/1440 px plus the preserved Start Work recovery/popup suite and Executive source contracts). Both isolated PostgreSQL feature gates pass. The initial integrated CSS measurement exceeded the unchanged budget by 240 bytes; only unused legacy Inbox selectors were removed from shared selector lists, preserving every active destination and declaration. The repaired integrated bundle check passes 2/2, measuring 631,805 bytes against the unchanged 631,808-byte ceiling. The post-cleanup registered source suite remains 658/658 and the focused Executive contracts pass 2/2.

### Reader fidelity correction and integrated results

At `6724362`, CI, Migration Replay, Account Security, cumulative SQL/authority and seven browser shards passed. The remaining shard passed 144 tests but the new live Memo journey stopped before entering the application: its exact `Sign in` selector did not match the existing `Sign in to CEAC OS` button. The helper now uses the same partial accessible-name selection as the established role suites. Its actual Memo/Storage/project assertions are retained and are not yet claimed as passed.

A separate desktop reader inspection caught run-together metadata and document-wide action buttons. The reader now follows the approved document plus compact action-column arrangement, with a single-column mobile flow, distinct sender/To/Cc lines, and no empty reply-history section or repeated single-version subject. Historical versions and decision/reply chronology remain visible when present. Draft/revision controls retain the same author checks. No decision authority, RPC, RLS or workflow changed. Two geometry tests verify the desktop action column, mobile reading width and separated sender date. Pending-reader screenshots are retained in the established CI artifact directory.

Focused Messages/HR browser checks pass 22/22, the registered source suite passes 658/658, and the original bundle/lazy-route gate passes 2/2 at 631,791 bytes. Redundant Room ancestor selectors were removed only after confirming the component class names have no competing definitions; no active layout declaration or size ceiling was weakened. Final exact-head live Memo acceptance remains required.

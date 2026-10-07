# CEAC OS — Phase 4 Notification & Work-State Communication Build Contract

**Date:** 6 October 2026
**Status:** ACTIVE IMPLEMENTATION CONTRACT
**Baseline protected main:** `3feb68e9fa46da9888a7dfa9cef942b1f6133f7c`
**Phase 3 application baseline:** `4179b71ed8757ece726c4282363edaacc8b158b6`
**Branch:** `codex/phase4-notification-work-state`

## 1. Accepted boundary

Phase 4 closes master-register items 34 and 39 without reopening accepted messaging, announcement, Work Engine, role, RLS or visual-fidelity contracts.

The implementation will make these states obvious in the existing Messages destination:

- a work assignment that has not started;
- work returned for correction;
- a submission the signed-in person is authorised to review;
- unread Room messages and mentions;
- unread announcements and acknowledgement requirements.

The surface must always distinguish communication state from business state. Opening a Room or announcement may update its established receipt, but it must never submit, approve, return, complete or otherwise resolve work. Opening a work row must not mutate either work state or communication-read state.

## 2. Audit findings

CEAC already has the necessary authoritative records:

- `work_items.status`, `assigned_by`, `assignee_id`, `origin` and `last_movement_at` hold work/action state;
- `submissions` and `app_can_review_item(uuid)` hold review state and decision authority;
- `room_reads` and `room_mentions` hold Room read and mention state;
- `announcement_receipts` holds announcement read and acknowledgement state;
- `alerts` holds deterministic threshold exceptions and follow-ups;
- `activity_events` and `platform_events` are audit/event streams, not recipient inbox receipts.

The current gap is composition and routing, not missing message storage. `Inbox.jsx` currently combines Rooms, mentions and announcements but does not expose authoritative assignment, returned-work or review-required actions. Manager Work checks review authority per item, while Administration and Executive review lists derive display rows from visible submissions without applying the same decision-authority check.

Phase 4 will not create a duplicate notification/event table or treat the audit streams as a user inbox.

## 3. Responsible-reviewer contract

The database will expose one deterministic responsible-reviewer function for approval-loop work.

1. For non-private Task, Deliverable and Meeting outcome work assigned by another active authorised person, the recorded assigner is the responsible reviewer. This preserves the locked Frank-to-Nana route and executive upward review.
2. When an explicit assigner route is unavailable, self-created staff work falls back to its active Sub-team lead, then its active Unit Head, excluding the assignee.
3. A person can be the reviewer for one item and the assignee for another. Authority is evaluated per item, not inferred from the current screen or a generic role label.
4. A person can never approve their own submission.
5. Existing Administration review authority remains an explicit organisation recovery/oversight boundary; it does not rewrite the responsible reviewer shown for ordinary operations.
6. Private work and kinds outside the existing approval loop do not gain a reviewer.

`app_can_review_item(uuid)` remains the mutation authority used by approve/return RPCs, but will derive ordinary review authority from this responsible-reviewer route. Review lists and the Phase 4 action queue must consume the same server authority so a displayed Review required row always opens to a permitted decision surface.

## 4. Action-and-update query contract

Add one authenticated, organisation-bound, read-only RPC that composes current state and returns only:

- `new_assignment` for the signed-in assignee's non-private `not_started` assigned work;
- `returned_work` for the signed-in assignee's `returned` work;
- `review_required` for current `in_review` submissions the signed-in person can lawfully review.

Each row includes the work ID/reference/title, action kind, current work status, event timestamp, assignee context and responsible reviewer context where available. The query does not write receipts and does not claim that a work item is unread. The labels are action labels based on current authoritative state.

The RPC must:

- reject anonymous callers;
- bind all results to `app_org_id()` and `auth.uid()`;
- rely on the existing approval-loop kinds and server review authority;
- expose no private work to another person;
- grant execution only to `authenticated` and `service_role` after revoking `PUBLIC`/`anon` access.

## 5. Product surface

The accepted Messages destination remains the one door for contextual communication. Its Phase 4 composition is:

1. an **Actions** queue with an explicit count, plain action labels and timestamps;
2. an **Updates** queue with an independent unread count for Rooms, mentions and announcements;
3. existing All, Rooms, Mentions, Work and Announcements views, with Work showing both action rows and work-linked communication;
4. work rows deep-link to Work Detail; communication rows retain their current Room or announcement destination;
5. helper copy states that opening is not completion or approval.

Manager, Administration and Executive Work review lists will use the same server-composed review rows instead of re-deriving a broader client-only list.

No unrestricted direct messages, new shell destination, generic dashboard, fabricated notification, or Telegram dependency is introduced.

## 6. Visual and accessibility boundary

This phase reuses the accepted Experience V2 components, typography, spacing, semantic badges and focus behaviour. It does not formalise master-register item 35's proposed palette; that item remains **DISCUSS BEFORE BUILD**.

State is communicated with text, count and timestamp, never colour alone. Controls retain the accepted minimum target size, keyboard operation, focus visibility, responsive behaviour and reduced-motion support.

## 7. Verification and acceptance

Required evidence before Phase 4 acceptance:

- migration replay and a dedicated SQL/security gate covering anonymous denial, organisation isolation, per-item reviewer routing, self-review denial and action/read separation;
- source and browser tests for Staff new assignment, Staff returned work, Manager review required and independent unread updates;
- Administration and Executive review lists contain only rows their current server authority permits;
- opening a work action changes no Room/announcement receipt and changes no work status;
- opening a communication changes no work status or review decision;
- desktop and narrow responsive inspection across Staff, Manager, Administration and Executive roles;
- Level B complete gate, Level C product-fidelity inspection, protected merge, exact-main gates and production verification.

Phase 5 Administration redesign, exact policy colours, Telegram delivery expansion, compliance scoring and any new disciplinary/policy engine remain outside this contract.

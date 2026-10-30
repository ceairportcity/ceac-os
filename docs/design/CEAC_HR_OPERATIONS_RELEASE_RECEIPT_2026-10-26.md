# CEAC OS Administration/HR operational repair — production release receipt (26 October 2026)

**Status: source + database released; genuine signed-in HR acceptance PENDING.** This is an interim release receipt, not final feature acceptance. Update via this docs-only PR after actual existing-account browser checks. Do not weaken or reclassify unrun tests as passed.

## Qualified application and independent checks

- Implementation: [PR #152](https://github.com/ceairportcity/ceac-os/pull/152), qualification head `91f382d89e9e14313216c1e7099ac20a98b63171`.
- [Quality Gate 40416524272](https://github.com/ceairportcity/ceac-os/actions/runs/40416524272): success, eight of eight browser shards successful; SQL/authority contracts, merge evidence and aggregate role-and-rls successful.
- CI, Migration Replay and Account Security also reported success for the exact qualified head (commits/runs preserved on PR #152).
- Approved correction scope: sequential keyboard focus in Add employee; actual Admin cross-department assignment/Rooms/member mentions; HR Projects sidebar, composer and reused Manager operational workspace; approved identity, visual, privacy and permissions preserved.
- Earlier run 40385778630 had one Admin navigation-order failure. Later qualified head already contains the narrow fix and final full gate passed. Do not rerun that failed candidate or treat its historical failures as final.

## Atomic production database cutover

- Project: `efjljhftsesssumtshvp` (CE AIRPORT CITY connection).
- Forward migration: `supabase/migrations/20261026155352_hr_room_authority.sql`; canonical source SHA-256 `d50d7ab41970638d9ef348b3496b5d6cc7b6268b6a93fa733d9c05ae1b77c83a`.
- Applied as one atomic guarded SQL transaction against the canonical timestamp, comparing the previous two production function-definition hashes, preventing a newer/duplicate migration, checking existing business counts and source checksum before any DDL, then verifying the new room-function guards, authenticated grants and anonymous denial before journaling and COMMIT.
- Read-after-write proved canonical journal version `20261026155352`, journaled statement source SHA-256 matching the approved file, and new function-definition SHA-256 hashes:
  - `app_can_access_room(uuid)`: `0501e7ab6e8be9ab9545d0ad54c5f6a4d3284a7e11fd447bef81acdca825a405`.
  - `send_room_message(uuid,text,uuid,jsonb,uuid[])`: `a98189c2fa585c70b0376b8f52b1aca27de7b235b5394ecf4146946e2925f3ab`.
- `anon` EXECUTE denied for both functions. Existing counts unchanged before/after: Auth users20, profiles20, roster18, projects4, room messages6, unit memberships22. No real business test rows, messages or invitations were created.
- Supabase security advisors remain one INFO category and two WARN categories (12 RLS-no-policy findings, 164 authenticated definer findings, 1 leaked-password-protection finding). These advisory categories were present at owner preflight; this release does not purport to remedy all existing advisories.
- A complete encrypted production backup and verified restore **were not performed**. Owner previously waived that prerequisite. Exact old function-definition hashes were checked before cutover; the earlier prepared rollback script remains in the prior Work workspace, not mounted in this chat session.

## Production Git + deployment proof

- Expected-head, normal merge of #152: `13379eb93da8054bb8d2b5e85fb02fc12d851680`.
- Parent commits: pre-release main `90cf6f89e347dfac388d27bd4edd6722383c991f` and qualified head `91f382d89e9e14313216c1e7099ac20a98b63171`.
- Exact full source Git tree on **both** merge and qualified PR head: `176ad4e75c71e3285a4dd787c50f72fb8b3f92e7`.
- Vercel project `ceac-os`, production deployment `dpl_8FZnqAKpvJ8MKmzF8gMjLvKbQU6E`: inspected **READY**, environment **production**, source Git SHA `13379eb93da8054bb8d2b5e85fb02fc12d851680`, alias `ceac-os-git.vercel.app` listed on deployment with `aliasError: null`.
- Direct request to the live URL from this execution container was DNS-blocked; ordinary page-fetch returned empty JS content. Neither constitutes a user-session smoke result. Connected Vercel error/log APIs returned 403 (not a clean/no-errors observation).
- PR #150 (independent Start Work) was not merged/included; PR #148 and #149/#151 existing released work preserved.

## Required genuine signed-in HR acceptance before closure

A prior ChatGPT Work cloud Chrome session had logged in as the existing Administration/HR account. This text/chat connector runtime **cannot access the original Work CUA browser session**; the separate browser connector has no CEAC authenticated profile and a metered user wallet, so it was not used for an unauthorised-cost/new-login workaround.

In Work, reuse the previous existing signed-in cloud Chrome tab if it remains available; call `cua.rewriteDocumentation()` on summary continuation as specified in the owner handoff. Otherwise use the existing authorised account session without requesting credentials in chat. On live `https://ceac-os-git.vercel.app/`, check no-write flows:

1. Verify HR Projects navigation visible on desktop/phone.
2. Add employee: sequentially type complete values, verify focus remains, cancel without save.
3. Give out work: select real cross-department choices and assignees, cancel.
4. Open an authorised shared room; People resolves a real person mention, cancel without sending a message.
5. Open Projects creation drawer, select genuine departments, cancel; open an existing project and check tabs/context/back/reload without saving.
6. Inspect visible/browser errors and any accessible production logs. Confirm source binding/production alias remains correct.

After completing **all** checks, update this docs-only PR with exact timestamp, verified actor/role, observable results (not fabricated successes) and merge it separately from implementation. Do not mark HR feature acceptance completed until then.

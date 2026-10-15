# CEAC resilience architecture

Date: 7 October 2026
Status: implementation contract
Product base: Executive redesign lineage after Phase 5 and Phase 6

## Locked principle

> Loss of GitHub must not terminate the currently deployed CEAC service. GitHub availability governs engineering/change delivery, not routine staff access to the last accepted CEAC release.

CEAC separates three failure domains:

1. **Source control availability** — GitHub stores active engineering history. Its loss stops new releases, not the already deployed release.
2. **Frontend runtime availability** — Vercel is primary and serves the accepted static frontend independently of GitHub after deployment.
3. **Backend availability** — Supabase provides authentication, live data and server-side authority. The PWA cannot replace it.

## Runtime design

- The manifest and CEAC icons provide standards-based installation on supported Android, desktop and iOS/iPadOS Add to Home Screen flows.
- `/sw.js` stores only same-origin application-shell documents and static assets.
- Supabase, auth, REST, Realtime, Storage, Functions, same-origin API routes, non-GET requests and cross-origin responses are network-only.
- Navigation uses network-first delivery. The last shell document or the explicit offline page is used only when the network fails.
- A waiting service worker never activates silently. CEAC announces an update and activates it only after the user chooses **Reload CEAC**.
- Offline UI states the boundary plainly and records only a non-sensitive last-connected timestamp.

## Failure behaviour

| Failure | Safe behaviour |
|---|---|
| GitHub unavailable | Existing Vercel release and Supabase-backed use continue; new releases pause. |
| Vercel unavailable | A verified prebuilt artifact can be served by the standby path after an authorised cutover. Installed clients may open the cached shell, but live work still needs Supabase. |
| Supabase unavailable | Shell may open; sign-in, reads and authoritative actions fail closed. No cached business record is substituted. |
| Short network loss | Cached shell remains available; CEAC clearly shows Offline and disables naturally failing server actions. |

## Non-goals

This programme does not create Electron, APK or native iOS builds; duplicate production databases; client-side authorization; background offline replay of authoritative mutations; or a second active production CEAC environment.

## Security invariants

RLS, RPC authorization, MFA/AAL2, protected HR, payroll, audit and capability boundaries remain server contracts. Service-worker code may not cache API responses, tokens, sessions or protected records. Recovery packages never contain environment values or credentials.

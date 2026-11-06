# Push foundation verification — 5 November 2026

Owner-authorised boundary: implement isolated server delivery helpers; pause before actual/potential overlap with PR #201. No application/shared files, database, service worker, credentials, preferences UI or production changed.

Source commit: 20930fbc88752f37967a518d948d78e67d6c86dd. Base main: 293dc13da2bd626593d4ec27c1152d3a963d6e5f. Source directory: tools/push-foundation. Code was tested locally before creation of the source commit; GitHub fetch of delivery.mjs confirmed identical source (blob cfd92d90e77ee4c93ac4aa5771f2ea75cdb056c4). This ledger is a documentation-only continuation of that source.

Verification completed 2026-11-05 approximately 19:12 UTC, Linux scratch clone:
- npm ci --ignore-scripts: exit 0 (initial host Node 24 emitted engine warning).
- Node 22.12.0 via npx package: node --test tools/push-foundation/delivery.test.mjs: exit 0, 14 tests passed, 0 failed.
- Same Node 22.12.0 environment: npm run build: exit 0; Vite built; script policy seal completed. These dormant files are not bundled/imported.
- git diff --check: exit 0. New files also read back through GitHub; no tracked application files modified.
- Isolated test coverage: HTTPS/provider/key validation, confidential/default previews, opt-in sender/department previews, control-character sanitisation, retries, expired devices, denied/revoked access, transient access failure, lease completion and event lifetime.

PENDING: durable queue/lease implementation and race tests; encrypted signed Web Push adapter; account/device lifecycle and RLS; real source state/recipient validation; service-worker/tap handling; UI, devices, locked-phone delivery, exact-head required CI and full release acceptance. No live push, device receipt, exactly-once guarantee or measured performance improvement claimed.

Resume only on owner instruction: inspect PR #201 and main afresh, then coordinate shared integration according to README.md. Do not merge or enable as an operational push feature. Existing Work writer and branch remain untouched.

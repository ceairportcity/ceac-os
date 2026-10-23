# Live audit A2 — People search correction

Owner scope: correct and release each live audit finding separately. On 23 October the owner explicitly directed moving to A2 after A1 was released. A1 remains deployed as `9829441c6822770168543fd52a1c9ce704565486`; its signed-in production screen check remains unverified after secure browser sign-in timed out. Do not convert that evidence gap into a pass.

A2 changes only the global people-search projection and its regression coverage. `profiles.unit_id` does not exist in production and is not used to construct a profile search result. Removing it preserves organisation filtering, name matching, the six-result bound, current database RLS, account navigation and the separately authorised HR roster source. It does not link employees, change memberships, widen access or alter any later audit finding.

## Verification before publication

- Live read-only schema check: all four retained fields exist, `unit_id` does not, and the corrected projection can select matching existing profiles. This is database/schema evidence, not signed-in browser acceptance.
- Added a behavioral regression to the existing product-closure source suite. The simulated provider rejects unknown profile columns. Existing code fails to return the account-only person; the corrected code returns the person and retains organisation/name filters and the result limit. The non-administrative case also refuses HR roster access.
- Reproduced failure before the code change: one targeted test, 0 pass / 1 fail, exit 1.
- Affected suite after correction: 38/38 pass, exit 0 (initial local Node 24.19.0 run; not the release runtime evidence).
- Supported Node 22.16.0: `npm ci`, `npm run verify:source` (604/604 pass, 0 fail), and `npm run build` all completed, combined exit 0. Local log: `/tmp/ceac-a2-validation.log` (transient; final candidate CI supplies durable exact-commit evidence).
- `git diff --check` passed. No migration or backend permission change.

Current base is `9829441c6822770168543fd52a1c9ce704565486`. Exact candidate SHA, terminal GitHub checks, production deployment identity and actual live acceptance must be recorded from their results. At this entry they are pending. Do not begin employee identity reconciliation under this A2 correction.

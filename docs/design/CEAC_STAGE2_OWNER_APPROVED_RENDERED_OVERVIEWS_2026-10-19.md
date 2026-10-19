# CEAC OS — Approved exact rendered Stage 2 Overviews (19 October 2026)

**Owner decision: ACCEPTED.** The owner answered **“yes”** to the explicit choice whether the **exact rendered Staff Overview and Executive Overview** are acceptable as the Stage 2 visual references, or require corrections. This supersedes the old Staff / R4 Executive *visual fingerprints only*. The overall Stage 2 design, role permissions and feature specifications remain unchanged.

## Immutable screenshot identity (private synthetic fixture evidence)

Both images were rendered at a **1440 x 960** desktop browser viewport from the Stage 2 implementation at commit `0e941532300824b7eca3e2c06a1ae8154f7f56be`, [full Quality Gate run 39181278509](https://github.com/ceairportcity/ceac-os/actions/runs/39181278509), **browser shard 4 artifact 12156692483**:

| Approved role render | Screenshot inside private artifact | Exact PNG SHA-256 |
| --- | --- | --- |
| Staff Overview | `visual-home-staff-desktop-1440.png` | `072078b9f0107955f38f7230b50269326dea25c14b3376a526ae6283f170ed87` |
| Executive Overview | `visual-home-executive-desktop-1440.png` | `abf5f955af0a962b985f39326e1ec23b1a74f03049d770958415e5fc21cfe3ee` |

The PNG images were inspected and their SHA-256 hashes checked. They are **synthetic fixtures**, not proof of live production state. Do not commit either entire image to this temporarily public repository, or publish screenshots containing genuine HR, volunteer or employee data. The only publicly recorded reference representation is the existing coarse 12x12 RGB fingerprint, computed from these pinned PNGs using the unchanged whole-cell averaging algorithm in `tests/visual-regression.spec.js`.

## Consequences and boundaries

- The owner accepts the **current image-backed, photo-rich Staff and Executive role Overview compositions**, including the visible genuine individual Start/End Work session controls. Do not revert them to older simpler screenshots to satisfy obsolete tests.
- Replace only `staff` and `executive` 1440x960 RGB arrays in `tests/visual-home-baselines.js`. Preserve **Manager** and **Administration** arrays unchanged.
- The exact rendered Stage 2 image is now the comparator: compare **all 330 role-content RGB channels** (11 rows x 10 columns x 3), including scenic-photo cells. Retire old photo-masking logic without weakening the established left-shell exclusion.
- Maintain the original strict **mean absolute RGB error <= 6**, viewport dimensions, upper-right scenic geometry bounds, ten legitimately sourced daily rotating scenic landscapes (stabilize bitmap only in the test), functional Work session flows and the **631,808-byte aggregate emitted-CSS budget**. No blank baselines, runtime self-snapshots or widened tolerances are permitted.
- This **specific two-screen reference approval** does not accept all other role routes, mobile variants, MFA/Access/Storage/Edge/RLS security, reporting/HR/Compliance/Executive workflows, or P7 as a stage. P8 remains one exact-SHA full acceptance and P9 requires a **separate owner production GO**. Preserve the live Stage 1 deployment.

Decision record: [PR #118, comment 6257392203](https://github.com/ceairportcity/ceac-os/pull/118#issuecomment-6257392203). No additional owner visual decision is needed for these same two rendered Overview references.

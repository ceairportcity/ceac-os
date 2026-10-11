import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const script = readFileSync("scripts/ops/prepare-ceac-db-backup.sh", "utf8");
const runbook = readFileSync(
  "docs/security/CEAC_RECOVERY_REAL_MFA_ACCEPTANCE_2026-10-11.md",
  "utf8"
);

test("encrypted backup refuses wrong source or project and writes outside repository", () => {
  assert.match(script, /CEAC_EXPECTED_SHA/);
  assert.match(script, /ceairportcity\/ceac-os/);
  assert.match(script, /efjljhftsesssumtshvp/);
  assert.match(script, /backup destination is inside Git working tree/);
  assert.match(script, /passphrase file is inside Git working tree/);
  assert.match(script, /CEAC_BACKUP_PASSPHRASE_FILE/);
  assert.match(script, /--cipher-algo AES256/);
  assert.match(script, /sha256sum/);
});

test("default Supabase dump explicitly refuses full-restore certification", () => {
  assert.match(script, /auth_managed_schema_data=NOT_IN_DEFAULT_EXPORT/);
  assert.match(script, /storage_managed_schema_data=NOT_IN_DEFAULT_EXPORT/);
  assert.match(script, /storage_object_blobs=NOT_INCLUDED/);
  assert.match(script, /complete_recovery_backup=NO/);
  assert.match(script, /restore_status=NOT_TESTED/);
  assert.match(script, /ENCRYPTED_PARTIAL_LOGICAL_EXPORT_CREATED/);
  assert.doesNotMatch(script, /RESTORE_VERIFIED=true|complete_recovery_backup=YES/);
  assert.match(runbook, /managed.+auth.+storage.+schema/i);
  assert.match(runbook, /actual isolated restoration/i);
});

test("MFA runbook requires verified TOTP challenge, genuine AAL2 and safe recovery", () => {
  assert.match(runbook, /auth\.mfa_factors/);
  assert.match(runbook, /aal2/);
  assert.match(runbook, /totp/);
  assert.match(runbook, /zero real enrolled factors/);
  assert.match(runbook, /privileged_mfa_required=false/);
  assert.match(runbook, /Do not toggle/i);
});

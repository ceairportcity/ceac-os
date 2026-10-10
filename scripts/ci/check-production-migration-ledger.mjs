// Read-only, name/version-only pre-cutover parity contract.
// Never claims that the production SQL content equals Git history or that
// pending migrations have been replayed. Execution verification is separate.
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const snapshot = JSON.parse(readFileSync("docs/continuity/CEAC_PRODUCTION_MIGRATION_LEDGER_SNAPSHOT_2026-10-10.json", "utf8"));
assert.equal(snapshot.projectRef, "efjljhftsesssumtshvp");
assert.equal(snapshot.snapshotDate, "2026-10-10");
assert.equal(snapshot.appliedCount, snapshot.applied.length);
const files = readdirSync("supabase/migrations").filter((file) => /^[0-9]{14}_.+\.sql$/.test(file)).sort();
assert.equal(files.length, snapshot.sourceFileCount, "migration file count diverges from read-only production-boundary snapshot");

const byVersion = new Map();
for (const filename of files) {
  const [, version, name] = filename.match(/^([0-9]{14})_(.+)\.sql$/) || [];
  assert.ok(version, `invalid migration filename: ${filename}`);
  assert.ok(!byVersion.has(version), `duplicate migration version: ${version}`);
  const sql = readFileSync(join("supabase/migrations", filename), "utf8").trim();
  assert.ok(sql.length > 0, `empty migration: ${filename}`);
  assert.ok(!/^(<{7}|={7}|>{7})/m.test(sql), `unresolved merge conflict: ${filename}`);
  byVersion.set(version, { version, name });
}
const seenApplied = new Set();
for (const row of snapshot.applied) {
  assert.match(row.version, /^[0-9]{14}$/);
  assert.ok(!seenApplied.has(row.version), `duplicate snapshot migration: ${row.version}`);
  seenApplied.add(row.version);
  assert.deepEqual(byVersion.get(row.version), row, `already-applied production migration version/name omitted or renamed: ${row.version}`);
}
const pending = [...byVersion.keys()].filter(v => !seenApplied.has(v)).sort();
assert.deepEqual(pending, snapshot.pendingAtSnapshot, "pending migration manifest changed; re-reconcile read-only live production first");
assert.equal(snapshot.appliedCount + pending.length, files.length);
assert.equal(pending.length, 10);
console.log(`Read-only production LEDGER NAME PARITY PASS: ${snapshot.appliedCount} applied version/name entries; ${pending.length} unapplied source migration files; ${files.length} total source versions. No database execution, SQL-content parity or release approval implied.`);

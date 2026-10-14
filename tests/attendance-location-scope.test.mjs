import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const session = read("../src/lib/session.js");
const home = read("../src/screens/Home.jsx");
const issuer = read("../src/components/AttendanceCodeIssuer.jsx");
const workforce = read("../src/screens/Workforce.jsx");
const evidence = read("../src/components/AttendanceEvidence.jsx");
const migration = read("../supabase/migrations/20261014211500_140_attendance_code_location_scope.sql");

test("office work sessions validate a selected duty location within the organisation and record its ID", () => {
  assert.match(session, /officeLocationId = null/);
  assert.match(session, /\.from\("office_locations"\)/);
  assert.match(session, /\.eq\("org_id", orgId\)/);
  assert.match(session, /\.eq\("id", officeLocationId\)/);
  assert.match(session, /office_location_id: verifiedOfficeLocationId/);
  assert.match(session, /if \(place === "office"\)/);
});

test("on-site work starts require a deliberate registered office or programme selection", () => {
  assert.match(home, /aria-label="Authorised duty location"/);
  assert.match(home, /place === "office" && \(officeLocationStatus !== "ready" \|\| !officeLocationId\)/);
  assert.match(home, /place === "office" \? officeLocationId : null/);
  assert.match(home, /select\("id,name"\)/);
});

test("rotation is capability-gated, venue-specific and its displayed secret expires", () => {
  assert.match(issuer, /p_office_location_id: locationId/);
  assert.match(issuer, /data\.office_location_id !== locationId/);
  assert.match(issuer, /setTimeout\(\(\) => setIssued\(null\), remaining\)/);
  assert.match(issuer, /generation\.current/);
  assert.equal((workforce.match(/<AttendanceCodeIssuer me=\{me\} \/>/g) || []).length, 3);
  assert.match(workforce, /\{tab==="setup"&&canManage&&/);
});

test("the next-bundle SQL binds every valid code to the session's recorded duty location", () => {
  assert.match(migration, /alter column office_location_id set not null/);
  assert.match(migration, /office_location_id=v_session\.office_location_id/);
  assert.match(migration, /v_session\.office_location_id is null/);
  assert.match(migration, /p_office_location_id uuid/);
  assert.match(migration, /where org_id=v_org\s+and office_location_id=v_session\.office_location_id/);
  assert.match(migration, /revoke all on function public\.attendance_verify_office_code\(text,uuid\) from public,anon/);
  assert.doesNotMatch(migration, /drop table|delete from public\.attendance_verification_codes/i);
});

test("a legacy unbound session is not falsely presented as location-code verified", () => {
  assert.match(evidence, /office_location_id,started_at,ended_at/);
  assert.match(evidence, /ownOpenSession\?\.office_location_id/);
  assert.match(evidence, /older session has no registered duty location/);
});

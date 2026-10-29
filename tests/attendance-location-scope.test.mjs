import test from "node:test";
import assert from "node:assert/strict";
import { getPositionOnce } from "../src/lib/locationEvidence.js";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const session = read("../src/lib/session.js");
const home = read("../src/screens/Home.jsx");
const startDialog = read("../src/components/StartWorkDialog.jsx");
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
  assert.match(startDialog, /aria-label="Authorised duty location"/);
  assert.match(home, /<StartWorkDialog/);
  assert.match(home, /locationId=\{officeLocationId\}/);
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

const venues = read("../src/components/DutyLocationSettings.jsx");
const settings = read("../src/screens/OfficeSettings.jsx");

test("Administration registers programme venues with an explicit non-primary flag and organisation scope", () => {
  assert.match(venues, /is_primary: false/);
  assert.match(venues, /\.eq\("org_id", me\.org_id\)/);
  assert.match(venues, /!location\.is_primary/);
  assert.match(venues, /Number\.isFinite\(latitude\)/);
  assert.match(venues, /Number\.isFinite\(longitude\)/);
  assert.match(venues, /busyRef\.current/);
  assert.match(settings, /<DutyLocationSettings me=\{me\} \/>/);
});

test("browser location falls back to standard accuracy after high-accuracy positioning fails", async () => {
  const attempts = [];
  const result = await getPositionOnce({
    getCurrentPosition(ok, fail, options) {
      attempts.push(options.enableHighAccuracy);
      if (options.enableHighAccuracy) return fail({ code: 2 });
      ok({ coords: { latitude: 5.6037, longitude: -0.1870, accuracy: 850 },
        timestamp: Date.now() });
    },
  });
  assert.deepEqual(attempts, [true, false]);
  assert.equal(result.failure, undefined);
  assert.equal(result.lat, 5.6037);
  assert.equal(result.lng, -0.1870);
  assert.equal(result.accuracy, 850, "Browser-provided accuracy must not be hidden or upgraded");
  assert.ok(result.capturedAt);
});

test("browser location never retries a denied geolocation permission", async () => {
  let attempts = 0;
  const result = await getPositionOnce({
    getCurrentPosition(_ok, fail) { attempts++; fail({ code: 1 }); },
  });
  assert.equal(attempts, 1);
  assert.match(result.failure, /permission was denied/);
  assert.equal(result.lat, undefined);
});

test("a silent high-accuracy browser request falls back and ignores its late callback", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const attempts = [];
  let lateHigh, completeFallback;
  const pending = getPositionOnce({ getCurrentPosition(ok, _fail, options) {
    attempts.push(options.enableHighAccuracy);
    if(options.enableHighAccuracy) lateHigh=ok; else completeFallback=ok;
  }});
  t.mock.timers.tick(6500);
  assert.deepEqual(attempts,[true,false]);
  lateHigh({coords:{latitude:0,longitude:0,accuracy:1},timestamp:Date.now()});
  completeFallback({coords:{latitude:5.6037,longitude:-0.187,accuracy:850},timestamp:Date.now()});
  const result=await pending;
  assert.equal(result.lat,5.6037);
  assert.equal(result.accuracy,850);
});

test("two silent browser requests end with a bounded failure rather than a stuck Start", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const attempts=[];
  const pending=getPositionOnce({getCurrentPosition(_ok,_fail,options){attempts.push(options.enableHighAccuracy);}});
  t.mock.timers.tick(6500);t.mock.timers.tick(6500);
  assert.deepEqual(attempts,[true,false]);
  assert.match((await pending).failure,/timed out/);
});

test("invalid browser coordinates are not used and fall back to a fresh real result", async () => {
  const result=await getPositionOnce({getCurrentPosition(ok,_fail,options){
    ok({coords:{latitude:options.enableHighAccuracy?999:5.6037,longitude:-0.187,accuracy:900},timestamp:Date.now()});
  }});
  assert.equal(result.lat,5.6037);assert.equal(result.accuracy,900);
});

test("pre-insert location failure allows retry while uncertain Start writes remain fail-closed", () => {
  const clock = read("../src/components/EmployeeWorkSession.jsx");
  assert.match(session, /class WorkStartPreflightError extends Error/);
  assert.match(session, /throw new WorkStartPreflightError/);
  assert.match(clock, /e instanceof WorkStartPreflightError/);
  assert.match(clock, /setVerified\(false\); setEditor\(false\); setReady\(false\)/);
  assert.match(home, /err instanceof WorkStartPreflightError/);
  assert.match(home, /setVerifiedSessionScope\(null\); setAsk\(false\)/);
  assert.match(home, /busy=\{busy\} error=\{error\}/);
  assert.match(startDialog, /\{error && <p className="cw-error" style=\{layout.error\} role="alert">\{error\}<\/p>\}/);
});

test("manager and HR off-site work remains available if office locations fail to load", () => {
  const ownSession = read("../src/components/EmployeeWorkSession.jsx");
  assert.match(ownSession, /Optional responsibility loading cannot hold up/);
  assert.match(ownSession, /setLocationsUnavailable\(Boolean\(error\)\)/);
  assert.match(ownSession, /setOwnWorkUnavailable\(Boolean\(error\)\)/);
  assert.match(ownSession, /!offsiteLocationName\.trim\(\)/);
  assert.match(startDialog, /No responsibility is required to start off-site/);
});

test("staff off-site picker reads authorised live work independently of Overview widgets", () => {
  assert.match(home, /setOffsiteWorkStatus\("loading"\)/);
  assert.match(home, /supabase\.from\("work_items"\)\.select\("id,ref,title,status"\)/);
  assert.match(home, /\.eq\("org_id",me\.org_id\)\.eq\("assignee_id",me\.id\)/);
  assert.match(home, /workItems=\{offsiteWork\} workStatus=\{offsiteWorkStatus\}/);
  assert.match(startDialog, /workItems\.map\(item =>/);
  assert.match(startDialog, /workStatus === "error"/);
  assert.match(startDialog, /workStatus === "ready" && workItems\.length === 0/);
  assert.match(startDialog, /Continue without linking work/);
  assert.match(home, /offsiteWork\.some\(\(item\) => item\.id === sessionWorkItem\)/);
});

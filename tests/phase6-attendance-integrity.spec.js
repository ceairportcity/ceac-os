import { mkdirSync, readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

const password = process.env.ROLE_FIXTURE_PASSWORD;
const supabaseUrl = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;

function client() {
  return createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

async function signedIn(email) {
  const api = client();
  const result = await api.auth.signInWithPassword({ email, password });
  expect(result.error).toBeNull();
  return api;
}

async function openAttendance(browser, email, viewport = { width: 390, height: 844 }) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  await page.goto("/");
  await page.getByPlaceholder("Work email").fill(email);
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button", { name: "Sign in to CEAC OS", exact: true }).click();
  await expect(page.locator(".app")).toBeVisible({ timeout: 15000 });
  await page.goto("/?tab=attendance");
  await expect(page.getByRole("heading", { name: "Today’s work location evidence", exact: true })).toBeVisible({ timeout: 15000 });
  await expect(page.getByText("Loading attendance evidence…")).toHaveCount(0);
  return { context, page };
}

test("Phase 6C corroboration remains additive evidence with no automatic consequence path", () => {
  const base = readFileSync("supabase/migrations/20261007103000_123_phase6_attendance_integrity.sql", "utf8");
  const reconcile = readFileSync("supabase/migrations/20261007104000_124_phase6_attendance_integrity_reconcile.sql", "utf8");
  const evidence = readFileSync("src/components/AttendanceEvidence.jsx", "utf8");
  const settings = readFileSync("src/screens/OfficeSettings.jsx", "utf8");
  const issuer = readFileSync("src/components/AttendanceCodeIssuer.jsx", "utf8");

  expect(base).toContain("attendance_corroboration_events");
  expect(base).toContain("attendance_record_network_corroboration");
  expect(base).toContain("Trusted infrastructure");
  expect(reconcile).toContain("v_session.place is distinct from 'office'");
  expect(reconcile).toContain("p_ttl_minutes not between 5 and 30");
  expect(reconcile).toContain("auth.role(),'')<>'service_role'");
  expect(reconcile).toContain("No absence, pay or disciplinary state was created");
  expect(reconcile).not.toContain("payroll_set_line");
  expect(reconcile).not.toContain("payroll_create_run");
  expect(settings).toContain("integrityAvailable?<AttendanceCodeIssuer me={me}");
  expect(issuer).toContain('supabase.rpc("attendance_set_office_code"');
  expect(issuer).toContain("p_office_location_id: locationId");
  expect(issuer).toContain("corroborating evidence, not proof of physical presence or a disciplinary decision");
  expect(settings).toContain("do not decide attendance, pay or disciplinary action");
  expect(evidence).toContain("attendance_verify_office_code");
  expect(evidence).toContain("attendance_corroboration_for_day");
  expect(evidence).toContain("attendance_integrity_status");
  expect(evidence).toContain("ownOpenSession?.place==='office'");
  expect(evidence).toContain("integrity?.front_desk_code_enabled");
  expect(evidence).toContain("do not prove presence or create attendance, pay or disciplinary conclusions");
  expect(evidence).toContain("No attendance obligation");
  expect(evidence).toContain("Not required");
});

test("Phase 6C invalid code does not close work and a valid code appears as corroborating evidence", async ({ browser }) => {
  const admin = await signedIn("admin@ceac.local.test");
  const staff = await signedIn("staff@ceac.local.test");

  const codeResult = await admin.rpc("attendance_set_office_code", {
    p_enabled: true,
    p_ttl_minutes: 10,
  });
  expect(codeResult.error).toBeNull();
  expect(codeResult.data?.code).toHaveLength(6);

  // Starting a real office session requires recent location evidence inside
  // the organisation's configured geofence. Keep that security control active
  // during the attendance-corroboration acceptance test.
  const office = await admin.from("office_locations")
    .select("lat,lng").eq("is_primary",true).limit(1).single();
  expect(office.error).toBeNull();
  const capturedAt = new Date().toISOString();
  const session = await staff.from("work_sessions").insert({
    org_id: "10000000-0000-4000-8000-000000000010",
    profile_id: "31000000-0000-4000-8000-000000000001",
    place: "office",
    lat: Number(office.data.lat),
    lng: Number(office.data.lng),
    location_accuracy_m: 10,
    location_captured_at: capturedAt,
    device_time: capturedAt,
  }).select("id").single();
  expect(session.error).toBeNull();

  const bad = await staff.rpc("attendance_verify_office_code", {
    p_code: "ZZZZZZ",
    p_session_id: session.data.id,
  });
  expect(bad.error).toBeNull();
  expect(bad.data?.verified).toBe(false);
  expect(bad.data?.message).toMatch(/No absence, pay or disciplinary state was created/i);

  const stillOpen = await staff.from("work_sessions").select("ended_at").eq("id", session.data.id).single();
  expect(stillOpen.error).toBeNull();
  expect(stillOpen.data.ended_at).toBeNull();

  const { context, page } = await openAttendance(browser, "staff@ceac.local.test");
  mkdirSync("test-artifacts", { recursive: true });
  await expect(page.getByRole("button", { name: "Verify office presence", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Verify office presence", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText(/corroborating evidence only/i)).toBeVisible();
  await dialog.getByLabel("Office presence code").fill(codeResult.data.code);
  await dialog.getByRole("button", { name: "Record corroboration", exact: true }).click();

  await expect(page.getByText(/Office verification recorded as corroborating evidence only/i)).toBeVisible();
  await expect(page.getByText(/Recorded · Front desk code/i)).toBeVisible();

  const history = page.locator("details").filter({ hasText: "Corroborating evidence" }).first();
  await expect(history).toBeVisible();
  await history.locator("summary").click();
  await expect(history).toContainText("support review only");
  await expect(history).toContainText("corroborated");
  await page.screenshot({ path: "test-artifacts/phase6c-attendance-integrity-staff-mobile.png", fullPage: true });

  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);

  await staff.rpc("end_work_session_with_location", {
    p_session_id: session.data.id,
    p_lat: null,
    p_lng: null,
    p_accuracy_m: null,
    p_captured_at: null,
    p_device_time: new Date().toISOString(),
    p_failure: "Phase 6C test cleanup",
  });
  await admin.rpc("attendance_set_office_code", { p_enabled: false, p_ttl_minutes: 10 });
  await context.close();
  await staff.auth.signOut();
  await admin.auth.signOut();
});

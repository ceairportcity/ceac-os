import { readFileSync } from "node:fs";
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

async function signInApi(email) {
  const api = client();
  const { error } = await api.auth.signInWithPassword({ email, password });
  expect(error).toBeNull();
  return api;
}

async function openCalendar(browser, email, viewport) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  await page.goto("/");
  await page.getByPlaceholder("Work email").fill(email);
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.locator(".staff-app")).toBeVisible({ timeout: 15000 });
  await page.goto("/?tab=calendar");
  await expect(page.locator(".phase6-calendar-page")).toBeVisible({ timeout: 15000 });
  return { context, page };
}

test("Phase 6B private day-planning contract is owner-only and does not create a shared Work object", () => {
  const migration = readFileSync("supabase/migrations/20261007093000_120_phase6_private_day_planning.sql", "utf8");
  const calendar = readFileSync("src/screens/StaffCalendar.jsx", "utf8");

  expect(migration).toContain("personal_day_tasks_owner_all");
  expect(migration).toContain("profile_id=auth.uid()");
  expect(migration).toContain("personal_day_notes_owner_all");
  const extensionMigration = readFileSync("supabase/migrations/20261007094500_121_phase6_personal_planning_extensions.sql", "utf8");
  const eventMigration = readFileSync("supabase/migrations/20261007095500_122_phase6_personal_event_note_primitives.sql", "utf8");
  expect(extensionMigration).toContain("personal_day_task_checklist_owner_all");
  expect(extensionMigration).toContain("linked_work_item_id");
  expect(extensionMigration).toContain("linked_project_id");
  expect(extensionMigration).toContain("reminder_at");
  expect(eventMigration).toContain("personal_calendar_events_owner_all");
  expect(eventMigration).toContain("profile_id=auth.uid()");
  expect(migration).not.toContain("app_managed_units()");
  expect(migration).not.toContain("app_is_admin()");
  expect(calendar).toContain("Private planning protected");
  expect(calendar).toContain('role="tab" aria-selected={dayTab==="schedule"}');
  expect(calendar).toContain('role="tab" aria-selected={dayTab==="tasks"}');
  expect(calendar).toContain('role="tab" aria-selected={dayTab==="notes"}');
  expect(calendar).toContain('from("personal_day_tasks")');
  expect(calendar).toContain('from("personal_day_notes")');
  expect(calendar).toContain('from("personal_day_task_checklist")');
  expect(calendar).toContain('from("meeting_private_notes")');
  expect(calendar).toContain("phase6-schedule-rail");
});

test("Phase 6B one Staff account cannot read or mutate another account's personal day plan", async () => {
  const staff = await signInApi("staff@ceac.local.test");
  const other = await signInApi("sameunit@ceac.local.test");

  const day = "2026-10-07";
  const title = "Phase 6 private RLS fixture";
  const { data: task, error: insertError } = await staff.from("personal_day_tasks").insert({
    org_id: "10000000-0000-4000-8000-000000000010",
    profile_id: "31000000-0000-4000-8000-000000000001",
    plan_date: day,
    title,
  }).select("id").single();
  expect(insertError).toBeNull();

  const { data: note, error: noteError } = await staff.from("personal_day_notes").upsert({
    org_id: "10000000-0000-4000-8000-000000000010",
    profile_id: "31000000-0000-4000-8000-000000000001",
    note_date: day,
    body: "Staff private day note",
  }, { onConflict: "profile_id,note_date" }).select("id").single();
  expect(noteError).toBeNull();

  const otherTask = await other.from("personal_day_tasks").select("id,title").eq("id", task.id);
  expect(otherTask.error).toBeNull();
  expect(otherTask.data).toEqual([]);

  const otherNote = await other.from("personal_day_notes").select("id,body").eq("id", note.id);
  expect(otherNote.error).toBeNull();
  expect(otherNote.data).toEqual([]);

  const otherUpdate = await other.from("personal_day_tasks").update({ title: "Cross-account mutation" }).eq("id", task.id).select("id");
  expect(otherUpdate.error).toBeNull();
  expect(otherUpdate.data).toEqual([]);

  const { data: personalEvent, error: eventInsertError } = await staff.from("personal_calendar_events").insert({
    org_id: "10000000-0000-4000-8000-000000000010",
    profile_id: "31000000-0000-4000-8000-000000000001",
    title: "Private calendar event",
    starts_at: "2026-10-07T10:00:00Z",
    ends_at: "2026-10-07T11:00:00Z",
  }).select("id").single();
  expect(eventInsertError).toBeNull();

  const otherEvent = await other.from("personal_calendar_events").select("id,title").eq("id", personalEvent.id);
  expect(otherEvent.error).toBeNull();
  expect(otherEvent.data).toEqual([]);

  const { data: checklist, error: checklistInsertError } = await staff.from("personal_day_task_checklist").insert({
    org_id: "10000000-0000-4000-8000-000000000010",
    profile_id: "31000000-0000-4000-8000-000000000001",
    task_id: task.id,
    title: "Private checklist row",
  }).select("id").single();
  expect(checklistInsertError).toBeNull();

  const otherChecklist = await other.from("personal_day_task_checklist").select("id,title").eq("id", checklist.id);
  expect(otherChecklist.error).toBeNull();
  expect(otherChecklist.data).toEqual([]);

    const staffRead = await staff.from("personal_day_tasks").select("title").eq("id", task.id).single();
  expect(staffRead.error).toBeNull();
  expect(staffRead.data.title).toBe(title);

  await staff.from("personal_calendar_events").delete().eq("id", personalEvent.id);
  await staff.from("personal_day_task_checklist").delete().eq("id", checklist.id);
  await staff.from("personal_day_tasks").delete().eq("id", task.id);
  await staff.from("personal_day_notes").delete().eq("id", note.id);
  await staff.auth.signOut();
  await other.auth.signOut();
});

for (const fixture of [
  { label: "Staff mobile", email: "staff@ceac.local.test", width: 390, height: 844 },
  { label: "Volunteer desktop", email: "sameunit@ceac.local.test", width: 1366, height: 900 },
]) {
  test(`Phase 6B ${fixture.label} calendar composes as the approved day workspace`, async ({ browser }) => {
    const { context, page } = await openCalendar(browser, fixture.email, { width: fixture.width, height: fixture.height });

    await expect(page.getByRole("heading", { name: "Calendar", exact: true })).toBeVisible();
    await expect(page.getByText("Day workspace", { exact: true })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Schedule", exact: true })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Tasks", exact: true })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Notes", exact: true })).toBeVisible();
    await expect(page.getByText("Private planning protected", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "+ Add", exact: true })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Schedule", exact: true })).toHaveAttribute("aria-selected", "true");

    await page.getByRole("button", { name: "+ Add", exact: true }).click();
    await expect(page.getByRole("tab", { name: "Event", exact: true })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Task", exact: true })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Note", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Cancel", exact: true }).click();

    await page.getByRole("tab", { name: "Notes", exact: true }).click();
    await expect(page.getByLabel("Private day notes")).toBeVisible();
    await expect(page.getByText("Daily journal", { exact: true })).toBeVisible();

    await page.getByRole("tab", { name: "Tasks", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Unscheduled tasks", exact: true })).toBeVisible();
    await expect(page.getByLabel("New private task")).toBeVisible();

    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    await page.screenshot({ path: `test-artifacts/phase6b-calendar-${fixture.email.startsWith("sameunit") ? "volunteer-desktop" : "staff-mobile"}.png`, fullPage: true });
    await context.close();
  });
}


test("Phase 6B role calendars keep private and authorised scopes explicit", () => {
  const manager = readFileSync("src/screens/ManagerCalendar.jsx", "utf8");
  const admin = readFileSync("src/screens/AdminCalendar.jsx", "utf8");
  const navigation = readFileSync("src/experience-v2/shell/navigation.js", "utf8");
  const app = readFileSync("src/App.jsx", "utf8");

  expect(manager).toContain('>My calendar</button>');
  expect(manager).toContain('>Unit calendar</button>');
  expect(manager).toContain('import StaffCalendar from "./StaffCalendar"');
  expect(admin).toContain('>My calendar</button>');
  expect(admin).toContain('"Organisation calendar"');
  expect(admin).toContain('roleMode==="executive"');
  expect(navigation).toContain('{ key: "admin-calendar", label: "Calendar"');
  expect(navigation).toContain('{ key: "exec-calendar", label: "Calendar"');
  expect(app).toContain('tab === "exec-calendar"');
  expect(app).toContain('roleMode="executive"');
});

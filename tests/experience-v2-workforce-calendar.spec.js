import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

const password = process.env.ROLE_FIXTURE_PASSWORD;

async function openAs(browser, email, app, route, viewport) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  await page.goto("/");
  await page.getByPlaceholder("Work email").fill(email);
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.locator(app)).toBeVisible({ timeout: 15000 });
  await page.goto(route);
  await expect(page.locator(".body")).toBeVisible({ timeout: 15000 });
  return { context, page };
}

async function expectNoPageOverflow(page, width, label) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, `${label} overflowed ${width}px viewport`).toBeLessThanOrEqual(1);
}

test("Stage 11C migrates the existing Calendar role contracts without changing authority", async () => {
  const staff = readFileSync("src/screens/StaffCalendar.jsx", "utf8");
  const manager = readFileSync("src/screens/ManagerCalendar.jsx", "utf8");
  const admin = readFileSync("src/screens/AdminCalendar.jsx", "utf8");
  const app = readFileSync("src/App.jsx", "utf8");
  const css = readFileSync("src/experience-v2/calendar/calendar.css", "utf8");

  for (const source of [staff, manager, admin]) {
    expect(source).toContain('experience-v2/calendar/CalendarFamilyV2');
  }

  expect(staff).toContain('supabase.from("work_items")');
  expect(staff).toContain('supabase.from("meeting_sessions")');
  expect(staff).toContain('supabase.from("ministry_events")');
  expect(staff).toContain('supabase.from("leave_requests")');
  expect(staff).toContain("<CalendarMonthGrid");
  expect(staff).toContain("<CalendarAgenda");
  expect(staff).not.toContain("staff-calendar-toolbar");
  expect(staff).not.toContain("staff-calendar-event");

  expect(manager).toContain('supabase.from("projects")');
  expect(manager).toContain('supabase.from("work_items")');
  expect(manager).toContain('supabase.from("unit_memberships")');
  expect(manager).toContain('supabase.from("leave_requests")');
  expect(manager).toContain('supabase.from("ministry_events")');
  expect(manager).toContain('supabase.from("ministry_event_units")');
  expect(manager).toContain('supabase.from("meeting_sessions")');
  expect(manager).toContain("Automatic personal sync is not connected yet");
  expect(manager).toContain("Open Google Calendar");
  expect(manager).toContain("<CalendarViewTabs");
  expect(manager).toContain("<CalendarMonthGrid");
  expect(manager).toContain("<CalendarAgenda");
  expect(manager).not.toContain("calendar-filter-trigger");
  expect(manager).not.toContain("manager-calendar-period");

  expect(admin).toContain('supabase.from("meeting_sessions")');
  expect(admin).toContain('supabase.from("projects")');
  expect(admin).toContain('supabase.from("ministry_events")');
  expect(admin).toContain('supabase.from("leave_requests")');
  expect(admin).toContain("<CalendarTimeline");
  expect(admin).toContain('label:"Next 14 days"');
  expect(admin).toContain('label:"Next 30 days"');
  expect(admin).toContain('label:"Next 90 days"');
  expect(admin).not.toContain("<CalendarMonthGrid");
  expect(admin).not.toContain("calendar-window-switch");

  expect(app).toContain('tab === "exec-calendar" && isExec');
  expect(css).toContain(".ev2cal-role-page");
  expect(css).toContain(".ev2cal-role-layout");
  expect(css).not.toContain("!important");
});

test("Stage 11C Staff Calendar keeps selected-date context and factual non-actionable schedule rows", async ({ browser }) => {
  const { context, page } = await openAs(
    browser,
    "staff@ceac.local.test",
    ".staff-app",
    "/?tab=staff-calendar",
    { width: 390, height: 844 },
  );

  await expect(page.locator(".ev2cal-staff-page")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Calendar", exact: true })).toBeVisible();
  await expect(page.getByLabel("Personal month calendar")).toBeVisible();
  const day = page.locator(".ev2cal-day-button").nth(10);
  await day.click();
  await expect(day).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".ev2cal-agenda").first()).toBeVisible();
  await expectNoPageOverflow(page, 390, "Staff Calendar");
  await context.close();
});

test("Stage 11C Manager Calendar preserves month/week, filters, selected date, scheduling and Google truth", async ({ browser }) => {
  const { context, page } = await openAs(
    browser,
    "manager@ceac.local.test",
    ".manager-app",
    "/?tab=calendar",
    { width: 390, height: 844 },
  );

  const calendar = page.locator(".ev2cal-manager-page");
  await expect(calendar).toBeVisible();
  await expect(calendar.getByRole("tab", { name: "Month", exact: true })).toBeVisible();
  await expect(calendar.getByRole("tab", { name: "Week", exact: true })).toBeVisible();
  await calendar.getByRole("tab", { name: "Week", exact: true }).click();
  await expect(calendar.locator(".ev2cal-day")).toHaveCount(7);

  await expect(calendar.getByRole("button", { name: "View All", exact: true })).toBeVisible();
  await calendar.getByRole("button", { name: "View All", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("tab", { name: "Meetings", exact: true })).toBeVisible();
  await dialog.getByRole("tab", { name: "Meetings", exact: true }).click();
  await expect(calendar.getByRole("button", { name: "View Meetings", exact: true })).toBeVisible();

  const day = calendar.locator(".ev2cal-day-button").nth(2);
  await day.click();
  await expect(day).toHaveAttribute("aria-pressed", "true");

  await expect(calendar.getByText("Your Google Calendar", { exact: true })).toBeVisible();
  await expect(calendar.getByText(/Automatic personal sync is not connected yet/i)).toBeVisible();
  await expect(calendar.getByRole("link", { name: "Open Google Calendar", exact: true })).toBeVisible();
  await expect(calendar.getByRole("button", { name: "Schedule meeting", exact: true })).toBeVisible();

  await expectNoPageOverflow(page, 390, "Manager Calendar");
  await context.close();
});

test("Stage 11C Administration Calendar remains a 14/30/90 day operating timeline rather than an invented grid", async ({ browser }) => {
  const { context, page } = await openAs(
    browser,
    "admin@ceac.local.test",
    ".office-app",
    "/?tab=admin-calendar",
    { width: 390, height: 844 },
  );

  const calendar = page.locator(".ev2cal-admin-page");
  await expect(calendar).toBeVisible();
  await expect(calendar.getByText("Calendar could not finish loading", { exact: true })).toHaveCount(0);
  await expect(calendar.getByRole("tab", { name: "Next 14 days", exact: true })).toBeVisible();
  await expect(calendar.getByRole("tab", { name: "Next 30 days", exact: true })).toBeVisible();
  await expect(calendar.getByRole("tab", { name: "Next 90 days", exact: true })).toBeVisible();
  await calendar.getByRole("tab", { name: "Next 14 days", exact: true }).click();
  await expect(calendar.getByRole("tab", { name: "Month", exact: true })).toHaveCount(0);
  await expect(calendar.getByRole("tab", { name: "Week", exact: true })).toHaveCount(0);
  await expect(calendar.getByRole("button", { name: "Schedule meeting", exact: true })).toBeVisible();

  await expectNoPageOverflow(page, 390, "Administration Calendar");
  await context.close();
});

const calendarViewports = [
  { name: "phone-320", width: 320, height: 844 },
  { name: "phone-360", width: 360, height: 800 },
  { name: "phone-375", width: 375, height: 812 },
  { name: "phone-390", width: 390, height: 844 },
  { name: "phone-414", width: 414, height: 896 },
  { name: "phone-430", width: 430, height: 932 },
  { name: "intermediate-900", width: 900, height: 900 },
  { name: "laptop-1366", width: 1366, height: 768 },
  { name: "desktop-1440", width: 1440, height: 900 },
];

for (const viewport of calendarViewports) {
  test(`Stage 11C calendar family composes across roles at ${viewport.name}`, async ({ browser }) => {
    test.setTimeout(120000);

    const staff = await openAs(browser, "staff@ceac.local.test", ".staff-app", "/?tab=staff-calendar", viewport);
    await expect(staff.page.locator(".ev2cal-staff-page")).toBeVisible();
    await expect(staff.page.getByLabel("Personal month calendar")).toBeVisible();
    await expectNoPageOverflow(staff.page, viewport.width, "Staff Calendar");
    await staff.page.screenshot({
      path: `test-artifacts/redesign-r7-stage11c-staff-${viewport.name}.png`,
      fullPage: true,
    });
    await staff.context.close();

    const manager = await openAs(browser, "manager@ceac.local.test", ".manager-app", "/?tab=calendar", viewport);
    await expect(manager.page.locator(".ev2cal-manager-page")).toBeVisible();
    await expect(manager.page.getByText("Your Google Calendar", { exact: true })).toBeVisible();
    await expectNoPageOverflow(manager.page, viewport.width, "Manager Calendar");
    await manager.page.screenshot({
      path: `test-artifacts/redesign-r7-stage11c-manager-${viewport.name}.png`,
      fullPage: true,
    });
    await manager.context.close();

    const admin = await openAs(browser, "admin@ceac.local.test", ".office-app", "/?tab=admin-calendar", viewport);
    await expect(admin.page.locator(".ev2cal-admin-page")).toBeVisible();
    await expect(admin.page.getByRole("tab", { name: "Next 30 days", exact: true })).toBeVisible();
    await expectNoPageOverflow(admin.page, viewport.width, "Administration Calendar");
    await admin.page.screenshot({
      path: `test-artifacts/redesign-r7-stage11c-admin-${viewport.name}.png`,
      fullPage: true,
    });
    await admin.context.close();
  });
}


test("VF6C cross-role Calendar surfaces stay top-anchored and context-led", async ({ browser }) => {
  const css = readFileSync("src/experience-v2/calendar/calendar.css", "utf8");
  expect(css).toContain("/* VF6C — Cross-role Calendar / schedule / meetings closure.");
  expect(css).not.toContain("!important");

  const roles = [
    { key: "staff", email: "staff@ceac.local.test", app: ".staff-app", route: "/?tab=staff-calendar", root: ".ev2cal-staff-page" },
    { key: "manager", email: "manager@ceac.local.test", app: ".manager-app", route: "/?tab=calendar", root: ".ev2cal-manager-page" },
    { key: "admin", email: "admin@ceac.local.test", app: ".office-app", route: "/?tab=admin-calendar", root: ".ev2cal-admin-page" },
  ];

  for (const viewport of [
    { name: "phone-390", width: 390, height: 844 },
    { name: "laptop-1366", width: 1366, height: 768 },
  ]) {
    for (const role of roles) {
      const { context, page } = await openAs(
        browser,
        role.email,
        role.app,
        role.route,
        { width: viewport.width, height: viewport.height },
      );

      const root = page.locator(role.root);
      await expect(root).toBeVisible({ timeout: 15000 });

      const layout = await root.evaluate((node) => ({
        alignContent: getComputedStyle(node).alignContent,
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      }));
      expect(layout.alignContent).toBe("start");
      expect(layout.overflow).toBeLessThanOrEqual(1);

      if (role.key === "staff" || role.key === "manager") {
        const agenda = root.locator(".ev2cal-agenda").first();
        await expect(agenda).toBeVisible({ timeout: 15000 });
        expect(await agenda.evaluate((node) => getComputedStyle(node).boxShadow)).toBe("none");
      } else {
        await expect(root.getByRole("tab", { name: "Next 30 days", exact: true })).toBeVisible();
        const range = root.locator(".ev2cal-admin-range");
        await expect(range).toBeVisible();
        if (viewport.width >= 1040) {
          expect(await range.evaluate((node) => getComputedStyle(node).borderBottomStyle)).toBe("solid");
        }
      }

      await page.screenshot({
        path: `test-artifacts/vf6c-${role.key}-calendar-${viewport.name}.png`,
        fullPage: true,
      });
      await context.close();
    }
  }
});

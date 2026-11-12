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

test("Calendar roles share views without changing private or authorised scope",()=>{
 const staff=readFileSync("src/screens/StaffCalendar.jsx","utf8"),manager=readFileSync("src/screens/ManagerCalendar.jsx","utf8"),admin=readFileSync("src/screens/AdminCalendar.jsx","utf8"),explorer=readFileSync("src/experience-v2/calendar/CalendarExplorer.jsx","utf8"),meeting=readFileSync("src/screens/Meeting.jsx","utf8");
 for(const source of [staff,manager,admin])expect(source).toContain("<CalendarExplorer");
 for(const table of ["work_items","meeting_sessions","ministry_events","leave_requests"])for(const source of [staff,manager,admin])expect(source).toContain(table);
 expect(staff).toContain("personal_day_tasks");expect(staff).toContain("PersonalPlanningEditor");
 expect(manager).toContain("calendarWorkStatus(event.workStatus)");expect(manager).toContain("Unit calendar");expect(admin).toContain("Organisation calendar");
 expect(explorer).toContain("CalendarMonthGrid");expect(explorer).toContain("CalendarTimeline");expect(explorer).toContain("layoutCalendarDay");expect(explorer).toContain("Show together");
 expect(meeting).toContain("will not sync automatically");expect(meeting).toContain("downloadMeetingCalendar");
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
  // Select a date inside the current month so the grid retains its identity.
  const day = page.locator(".ev2cal-day:not(.is-muted) .ev2cal-day-button").nth(2);
  await expect(day).toBeVisible();
  await day.click();
  await expect(day).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".ev2cal-agenda").first()).toBeVisible();
  await expectNoPageOverflow(page, 390, "Staff Calendar");
  await context.close();
});

test("Manager Calendar preserves time views, combined filters, selected date and scheduling",async({browser})=>{
 const {context,page}=await openAs(browser,"manager@ceac.local.test",".manager-app","/?tab=calendar",{width:390,height:844});
 const calendar=page.locator(".ev2cal-manager-page");
 await calendar.getByRole("tab",{name:"Week",exact:true}).click();await expect(calendar.locator(".ceac-calendar-week-date")).toHaveCount(7);
 await calendar.getByRole("button",{name:/^Filter/}).click();const dialog=page.getByRole("dialog");await expect(dialog.getByRole("checkbox",{name:"Meetings",exact:true})).toBeChecked();await dialog.getByRole("button",{name:"Done",exact:true}).click();
 await calendar.locator(".ceac-calendar-week-date").nth(2).click();await expect(calendar.locator(".ceac-calendar-week-date").nth(2)).toHaveAttribute("aria-pressed","true");
 await expect(calendar.getByRole("button",{name:"Schedule meeting",exact:true})).toBeVisible();await expectNoPageOverflow(page,390,"Manager Calendar");await context.close();
});
test("Administration Calendar offers the same Month, Week and Agenda controls",async({browser})=>{
 const {context,page}=await openAs(browser,"admin@ceac.local.test",".office-app","/?tab=admin-calendar",{width:390,height:844});
 const calendar=page.locator(".ev2cal-admin-page");for(const name of ["Month","Week","Agenda"])await expect(calendar.getByRole("tab",{name,exact:true})).toBeVisible();
 await expect(calendar.getByRole("button",{name:"Schedule meeting",exact:true})).toBeVisible();await expectNoPageOverflow(page,390,"Administration Calendar");await context.close();
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
    await expect(admin.page.getByRole("tab", { name: "Month", exact: true })).toBeVisible();
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

      // Lazy Calendar styles may settle after route mount. Still require
      // the exact top-anchored computed layout, with no relaxed criterion.
      await expect.poll(() => root.evaluate((node) => getComputedStyle(node).alignContent)).toBe("start");
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
        await expect(root.getByRole("tab", { name: "Month", exact: true })).toBeVisible();
        const range = root.locator(".ceac-calendar-controls");
        await expect(range).toBeVisible();
        if (viewport.width >= 1040) {
          expect(await range.evaluate((node) => getComputedStyle(node).display)).toBe("flex");
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

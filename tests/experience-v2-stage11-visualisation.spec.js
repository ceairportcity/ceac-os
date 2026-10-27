import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

const password = process.env.ROLE_FIXTURE_PASSWORD;
const unitA = "20000000-0000-4000-8000-000000000011";
const staffId = "31000000-0000-4000-8000-000000000001";

const pad = (value) => String(value).padStart(2, "0");
const dateKey = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const addDays = (date, days) => { const next = new Date(date); next.setDate(next.getDate() + days); return next; };
const weekStart = (now = new Date()) => {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  return start;
};

async function loginManager(browser, viewport) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  await page.goto("/");
  await page.getByPlaceholder("Work email").fill("manager@ceac.local.test");
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.locator(".manager-app")).toBeVisible({ timeout: 15000 });
  return { context, page };
}

async function installFactualReportFixture(page) {
  const start = weekStart();
  const day = dateKey(addDays(start, 1));
  const completedAt = `${day}T10:00:00Z`;
  const dueAt = `${day}T17:00:00Z`;
  const projects = [
    { id:"25000000-0000-4000-8000-000000000101", name:"Fixture Project Alpha", starts_on:day, ends_on:null, status:"active", lead_unit_id:unitA, project_units:[] },
    { id:"25000000-0000-4000-8000-000000000102", name:"Fixture Project Beta", starts_on:day, ends_on:null, status:"active", lead_unit_id:unitA, project_units:[] },
  ];
  const base = [
    ["26000000-0000-4000-8000-000000000101","RPT-101","Completed fixture A","completed",projects[0].id,completedAt],
    ["26000000-0000-4000-8000-000000000102","RPT-102","Completed fixture B","completed",projects[1].id,completedAt],
    ["26000000-0000-4000-8000-000000000103","RPT-103","Completed fixture C","self_certified",projects[0].id,completedAt],
    ["26000000-0000-4000-8000-000000000104","RPT-104","Work in progress fixture","in_progress",projects[0].id,null],
    ["26000000-0000-4000-8000-000000000105","RPT-105","Waiting fixture","waiting_on",projects[1].id,null],
    ["26000000-0000-4000-8000-000000000106","RPT-106","Returned fixture","returned",projects[1].id,null],
  ];
  const work = base.map(([id,ref,title,status,project_id,completed_at]) => ({
    id, ref, title, kind:"task", status, due_at:dueAt, completed_at, project_id,
    assignee_id:staffId, origin:"assigned",
    projects:{ name:projects.find((project) => project.id === project_id)?.name || "Fixture project" },
    profiles:{ full_name:"Staff Fixture" },
  }));

  const fulfill = (body) => async (route) => {
    // A legitimate HTTP 200 with count=exact must identify the complete
    // result cardinality. Missing Content-Range is intentionally rejected by
    // the Manager reporting source and must not be a successful zero fixture.
    const count = body.length;
    await route.fulfill({
      status:200,
      contentType:"application/json",
      headers:{ "content-range": count ? `0-${count-1}/${count}` : "*/0",
        "access-control-allow-origin": "*",
        "access-control-expose-headers": "content-range" },
      body:JSON.stringify(body),
    });
  };

  await page.route("**/rest/v1/projects*", fulfill(projects));
  await page.route("**/rest/v1/report_periods*", fulfill([]));
  await page.route("**/rest/v1/work_items*", fulfill(work));
  await page.route("**/rest/v1/objectives*", fulfill([]));
  const fixtureWorkSessions = [
    {
      id:"28000000-0000-4000-8000-000000000101",
      profile_id:staffId,
      work_item_id:work[0].id,
      started_at:`${day}T08:00:00Z`,
      ended_at:`${day}T12:00:00Z`,
      end_reason:"manual",
      profiles:{ full_name:"Staff Fixture" },
    },
  ];
  await page.route("**/rest/v1/work_sessions*", (route) => {
    const fields = new URL(route.request().url()).searchParams.get("select") || "";
    // The bootstrap owner-only openSession lookup is not a Manager report.
    if (!fields.includes("end_reason") || !fields.includes("profile_id")) return route.continue();
    return fulfill(fixtureWorkSessions)(route);
  });
  await page.route("**/rest/v1/submissions*", fulfill([]));
  return { day };
}

test("Stage 11D replaces Manager Reports one-off visuals with the shared factual chart contract", async () => {
  const manager = readFileSync("src/screens/ManagerReports.jsx", "utf8");
  const viz = readFileSync("src/experience-v2/data-viz/DataVizV2.jsx", "utf8");
  const css = readFileSync("src/experience-v2/data-viz/data-viz.css", "utf8");

  expect(manager).toContain('import { DataVizChart } from "../experience-v2/data-viz/DataVizV2";');
  expect(manager).toContain('title="Completed work trend"');
  expect(manager).toContain('title="Completed by project"');
  expect(manager).toContain('title="Current work composition"');
  expect(manager).toContain('title="Recorded work-session activity"');
  expect(manager).toContain("openFrozenSection");
  expect(manager).toContain("openLive");
  expect(manager).not.toContain("function Trend(");
  expect(manager).not.toContain("function Bars(");
  expect(manager).not.toContain("function ActivityHeat(");
  expect(manager).not.toContain("function WorkStatusDistribution(");
  expect(manager).not.toContain("StatusDistribution");

  expect(viz).toContain("onOpen");
  expect(viz).toContain('role: "button"');
  expect(viz).toContain("ev2dv-record-button");
  expect(viz).toContain('event.key === "Enter" || event.key === " "');
  expect(css).toContain(".ev2dv-mark.is-actionable");
  expect(css).toContain(".ev2dv-record-button");
  expect(css).not.toContain("!important");
});

for (const viewport of [
  { name:"phone-390", width:390, height:844 },
  { name:"laptop-1366", width:1366, height:768 },
]) {
  test(`Stage 11D Manager Reports factual charts compose at ${viewport.name}`, async ({ browser }) => {
    const { context, page } = await loginManager(browser, viewport);
    const fixture = await installFactualReportFixture(page);
    await page.goto("/?tab=manager-reports");

    await expect(page.locator(".ev2-reporting-manager")).toBeVisible({ timeout:15000 });
    await page.getByRole("button", { name:"Show charts and tables", exact:true }).click();
    const charts = page.locator(".report-analysis .ev2dv-chart");
    await expect(charts).toHaveCount(4);
    await expect(page.getByText("Completed work trend", { exact:true })).toBeVisible();
    await expect(page.getByText("Completed by project", { exact:true })).toBeVisible();
    await expect(page.getByText("Current work composition", { exact:true })).toBeVisible();
    await expect(page.getByText("Recorded work-session activity", { exact:true })).toBeVisible();
    await expect(page.getByText(/not a performance, productivity or ranking score/i)).toBeVisible();
    await expect(page.getByText(/not an attendance or performance score/i)).toBeVisible();

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `Manager Reports analysis overflowed ${viewport.width}px viewport`).toBeLessThanOrEqual(1);

    await page.screenshot({
      path:`test-artifacts/redesign-r7-stage11d-manager-reports-${viewport.name}.png`,
      fullPage:true,
    });

    if (viewport.width >= 1000) {
      const first = charts.first();
      await first.getByRole("button", { name:/Show Completed work trend as table/ }).click();
      await expect(first.getByRole("table")).toBeVisible();
      await first.getByRole("button", { name:fixture.day, exact:true }).click();
      await expect(page.getByText("Completed fixture A", { exact:true })).toBeVisible();

      await first.getByRole("button", { name:/Show Completed work trend as chart/ }).click();
      const mark = first.getByRole("button", { name:new RegExp(`Open ${fixture.day} · Completed work: 3`) });
      await mark.focus();
      await expect(mark).toBeFocused();
      await mark.press("Enter");
      await expect(page.getByText("Completed fixture B", { exact:true })).toBeVisible();
    }

    await context.close();
  });
}

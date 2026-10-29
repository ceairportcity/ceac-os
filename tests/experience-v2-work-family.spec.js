import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

const password = process.env.ROLE_FIXTURE_PASSWORD;

const roles = [
  {
    key: "staff",
    email: "staff@ceac.local.test",
    app: ".staff-app",
    tabs: ["My work", "Assigned", "Created by me", "Private"],
  },
  {
    key: "manager",
    email: "manager@ceac.local.test",
    app: ".manager-app",
    tabs: ["My work", "Created by me", "Given out", "For review", "Completed", "Team work", "Routines"],
  },
  {
    key: "administration",
    email: "admin@ceac.local.test",
    app: ".office-app",
    tabs: ["My work", "Created by me", "Given out", "For review", "Completed", "Organisation"],
  },
  {
    key: "executive",
    email: "exec@ceac.local.test",
    app: ".executive-app",
    tabs: ["My work", "Created by me", "Given out", "For review", "Completed"],
  },
];

async function openWork(browser, role, viewport) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  await page.goto("/");
  await page.getByPlaceholder("Work email").fill(role.email);
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.locator(role.app)).toBeVisible({ timeout: 15000 });
  await page.goto("/?tab=work");
  await expect(page.locator(".ev2-work-page")).toBeVisible({ timeout: 15000 });
  return { context, page };
}

test("Stage 10 Family A1 uses one shared V2 Work presentation layer", async () => {
  const shared = readFileSync("src/experience-v2/work-family/WorkFamilyV2.jsx", "utf8");
  const css = readFileSync("src/experience-v2/work-family/work-family.css", "utf8");
  const main = readFileSync("src/main.jsx", "utf8");

  for (const symbol of ["WorkPageHeader", "WorkTabs", "WorkRow", "WorkReviewRow", "WorkEmpty"]) {
    expect(shared).toContain(`export function ${symbol}`);
  }
  expect(css).toContain(".ev2-work-page");
  expect(css).toContain(".ev2w-row");
  const staffWork = readFileSync("src/screens/Work.jsx", "utf8");
  expect(staffWork).toContain("BRAND_BOOK_DASHBOARD_CSS");
  expect(staffWork).toContain('from("meeting_sessions")');
  expect(staffWork).toContain('from("work_sessions")');
  expect(staffWork).toContain('from("feedback_notes")');
  expect(staffWork).toContain("This is not payroll or performance time.");
  expect(staffWork).toContain("audio not recorded");
  expect(css).not.toContain("!important");
  expect(main).toContain('import "./experience-v2/work-family/work-family.css";');

  for (const screen of ["Work", "ManagerWork", "AdminWork", "ExecutiveWork"]) {
    const source = readFileSync(`src/screens/${screen}.jsx`, "utf8");
    expect(source).toContain("experience-v2/work-family/WorkFamilyV2");
    expect(source).toContain("ev2-work-page");
  }
});

for (const viewport of [
  { name: "phone-320", width: 320, height: 844 },
  { name: "laptop", width: 1366, height: 768 },
]) {
  for (const role of roles) {
    test(`Stage 10 Family A1 ${role.key} Work composes at ${viewport.name}`, async ({ browser }) => {
      const { context, page } = await openWork(browser, role, { width: viewport.width, height: viewport.height });

      await expect(page.getByRole("heading", { name: "Work", exact: true })).toBeVisible();
      for (const label of role.tabs) {
        await expect(page.getByRole("tab", { name: new RegExp(label) }).first()).toBeVisible();
      }

      if (role.key === "staff") {
        await expect(page.locator(".fpg-brandbook-dashboard")).toBeHidden();
        await page.getByText("Schedule and recorded work context", { exact: true }).click();
        await expect(page.locator(".fpg-brandbook-dashboard")).toBeVisible();
        await expect(page.locator(".fpg-brandbook-schedule")).toBeVisible();
        await expect(page.locator(".fpg-brandbook-hours")).toBeVisible();
        await expect(page.locator(".fpg-brandbook-note")).toBeVisible();
      }

      if (role.key === "manager" && viewport.width <= 320) {
        const managerTabs = await page.locator(".ev2-work-manager .ev2w-tabs").evaluate((node) => ({
          clientWidth: node.clientWidth,
          scrollWidth: node.scrollWidth,
          visibleTabs: [...node.querySelectorAll('[role="tab"]')].filter((tab) => {
            const rect = tab.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0;
          }).length,
        }));
        // The approved register tabs scroll inside their own navigation region.
        // All destinations remain keyboard reachable without page overflow.
        expect(managerTabs.visibleTabs).toBe(role.tabs.length);
        await page.getByRole("tab", { name: /^Routines/ }).click();
        await expect(page.getByRole("tab", { name: /^Routines/ })).toBeInViewport();
      }

      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);

      const rows = page.locator(".s2-register-row:visible");
      if (await rows.count()) {
        const first = rows.first();
        const box = await first.boundingBox();
        expect(box?.height || 0).toBeGreaterThanOrEqual(44);
        const smallest = await first.locator("strong").evaluateAll((nodes) =>
          Math.min(...nodes.map((node) => parseFloat(getComputedStyle(node).fontSize)))
        );
        expect(smallest).toBeGreaterThanOrEqual(12);
      }

      await page.screenshot({
        path: `test-artifacts/redesign-r7-stage10a1-${role.key}-${viewport.name}.png`,
        fullPage: true,
      });
      await context.close();
    });
  }
}


test("Stage 10 Family A2 Work Detail follows the approved working hierarchy", async () => {
  const source = readFileSync("src/screens/Item.jsx", "utf8");
  const shared = readFileSync("src/experience-v2/work-family/WorkFamilyV2.jsx", "utf8");
  const css = readFileSync("src/experience-v2/work-family/work-family.css", "utf8");

  expect(source).toContain("WorkDetailHeader");
  expect(source).toContain("WorkDetailSection");
  expect(source).toContain("ev2-work-detail");
  expect(source).not.toContain("statusPill(item.status)");

  const purpose = source.indexOf('title="Why this matters"');
  const finished = source.indexOf('title="What finished looks like"');
  const instructions = source.indexOf('title="What to do"');
  expect(purpose).toBeGreaterThan(-1);
  expect(finished).toBeGreaterThan(purpose);
  expect(instructions).toBeGreaterThan(finished);

  for (const symbol of ["WorkDetailHeader", "WorkDetailSection", "WorkDetailCopy"]) {
    expect(shared).toContain(`export function ${symbol}`);
  }
  expect(css).toContain("/* Stage 10A2 — Work Detail */");
  expect(css).toContain(".ev2wd-header");
  expect(css).toContain(".ev2wd-section");
  expect(source).toContain("fpg-brandbook-task-card");
  expect(source).toContain("BRAND_BOOK_TASK_CSS");
  expect(css).not.toContain("!important");
});

for (const viewport of [
  { name: "phone-320", width: 320, height: 844 },
  { name: "laptop", width: 1366, height: 768 },
]) {
  test(`Stage 10 Family A2 Staff Work Detail composes at ${viewport.name}`, async ({ browser }) => {
    const role = roles[0];
    const { context, page } = await openWork(browser, role, { width: viewport.width, height: viewport.height });

    const firstRow = page.locator(".s2-register-row:visible th button").first();
    await expect(firstRow).toBeVisible();
    await firstRow.click();
    await expect(page.getByRole("complementary", { name: "Selected responsibility" })).toBeVisible();
    await page.getByRole("button", { name: /Open full work record/ }).click();

    await expect(page.locator(".ev2-work-detail")).toBeVisible();
    await expect(page.locator(".ev2wd-header")).toBeVisible();
    await expect(page.getByRole("button", { name: "← Back" })).toBeVisible();

    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);

    const tiny = await page.locator(".ev2-work-detail").evaluate((root) => {
      const values = [...root.querySelectorAll("*")]
        .filter((node) => {
          const style = getComputedStyle(node);
          const rect = node.getBoundingClientRect();
          return style.visibility !== "hidden" && style.display !== "none" && rect.width > 0 && rect.height > 0 && (node.textContent || "").trim();
        })
        .map((node) => parseFloat(getComputedStyle(node).fontSize))
        .filter((value) => Number.isFinite(value));
      return Math.min(...values);
    });
    expect(tiny).toBeGreaterThanOrEqual(12);

    await page.screenshot({
      path: `test-artifacts/redesign-r7-stage10a2-staff-detail-${viewport.name}.png`,
      fullPage: true,
    });
    await context.close();
  });
}


test("Stage 10 Family A3 preserves assignment review return and dependency authority", async () => {
  const assign = readFileSync("src/screens/Assign.jsx", "utf8");
  const detail = readFileSync("src/screens/Item.jsx", "utf8");
  const css = readFileSync("src/experience-v2/work-family/work-family.css", "utf8");

  expect(assign).toContain("ev2-work-assignment");
  expect(assign).toContain("ComposerDrawer");
  expect(assign).toContain('aria-label="Work type"');
  for (const kind of ["task", "deliverable", "request", "routine", "decision", "case", "meeting_outcome"]) {
    expect(assign).toContain(`["${kind}"`);
  }

  expect(detail).toContain('supabase.rpc("submit_work_for_review"');
  expect(detail).toContain('supabase.rpc("approve_work_submission"');
  expect(detail).toContain('supabase.rpc("return_work_for_correction"');
  expect(detail).toContain('supabase.rpc("raise_work_blocker"');
  expect(detail).toContain('supabase.rpc("resolve_blocker"');
  expect(detail).toContain('title="Review submitted work"');
  expect(detail).toContain('sheet === "manager-review-return"');
  expect(detail).toContain('sheet === "manager-review-approve"');
  expect(detail).toContain("WorkReturnedNotice");
  expect(detail).toContain("WorkDependencyNotice");

  expect(css).toContain("/* Stage 10A3 — Assignment / review / dependency */");
  expect(css).toContain(".ev2-work-assignment");
  expect(css).toContain(".ev2wr-panel");
  expect(css).toContain(".ev2ws-panel");
  expect(css).not.toContain("!important");
});

for (const viewport of [
  { name: "phone-320", width: 320, height: 844 },
  { name: "laptop", width: 1366, height: 768 },
]) {
  test(`Stage 10 Family A3 Manager assignment composes at ${viewport.name}`, async ({ browser }) => {
    const role = roles[1];
    const { context, page } = await openWork(browser, role, { width: viewport.width, height: viewport.height });

    await page.getByRole("button", { name: "Give out work", exact: true }).first().click();
    await expect(page.locator(".ev2-work-assignment")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Give out work", exact: true })).toBeVisible();
    await expect(page.getByLabel("Work type")).toBeVisible();
    await page.getByText("Attachments", { exact: true }).first().click();
    await expect(page.getByText("Attach source files", { exact: true })).toBeVisible();

    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);

    const tiny = await page.locator(".ev2-work-assignment").evaluate((root) => {
      const values = [...root.querySelectorAll("*")]
        .filter((node) => {
          const style = getComputedStyle(node);
          const rect = node.getBoundingClientRect();
          return style.visibility !== "hidden" && style.display !== "none" && rect.width > 0 && rect.height > 0 && (node.textContent || "").trim();
        })
        .map((node) => parseFloat(getComputedStyle(node).fontSize))
        .filter((value) => Number.isFinite(value));
      return Math.min(...values);
    });
    expect(tiny).toBeGreaterThanOrEqual(12);

    await page.screenshot({
      path: `test-artifacts/redesign-r7-stage10a3-assignment-manager-${viewport.name}.png`,
      fullPage: true,
    });
    await context.close();
  });
}


test("Stage 10 Family A4 shared Work family acceptance contract", async () => {
  const shared = readFileSync("src/experience-v2/work-family/WorkFamilyV2.jsx", "utf8");
  const css = readFileSync("src/experience-v2/work-family/work-family.css", "utf8");
  const detail = readFileSync("src/screens/Item.jsx", "utf8");
  const assign = readFileSync("src/screens/Assign.jsx", "utf8");

  for (const symbol of [
    "WorkPageHeader",
    "WorkTabs",
    "WorkRow",
    "WorkReviewRow",
    "WorkDetailHeader",
    "WorkReturnedNotice",
    "WorkDependencyNotice",
  ]) {
    expect(shared).toContain(`export function ${symbol}`);
  }

  expect(css).toContain("/* Stage 10A3 — Assignment / review / dependency */");
  expect(css).not.toContain("!important");
  expect(detail).toContain('supabase.rpc("approve_work_submission"');
  expect(detail).toContain('supabase.rpc("return_work_for_correction"');
  expect(detail).toContain('supabase.rpc("raise_work_blocker"');
  expect(detail).toContain('supabase.rpc("resolve_blocker"');
  expect(assign).toContain("WORK_INTENTS");
});

for (const viewport of [
  { name: "phone-390", width: 390, height: 844 },
  { name: "desktop-1440", width: 1440, height: 900 },
]) {
  for (const role of roles) {
    test(`Stage 10 Family A4 ${role.key} Work acceptance at ${viewport.name}`, async ({ browser }) => {
      const { context, page } = await openWork(browser, role, { width: viewport.width, height: viewport.height });

      await expect(page.locator(".ev2-work-page")).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);

      const tabs = page.locator(".ev2w-tabs").first().getByRole("tab");
      await expect.poll(() => tabs.count(), { message: role.key + " Work source tabs must be rendered" }).toBeGreaterThanOrEqual(3);
      for (const tab of role.tabs.slice(0, 3)) {
        await expect(page.getByRole("tab", { name: tab, exact: true }).first()).toBeVisible();
      }

      const tabLines = await tabs.evaluateAll(nodes => [...new Set(nodes.map(node => Math.round(node.getBoundingClientRect().top)))]);
      expect(tabLines, 'Responsibility source tabs remain one horizontally scrollable row').toHaveLength(1);
      const registerColumns = await page.locator('.s2-register-table-region').evaluate(region => {
        const bounds = region.getBoundingClientRect();
        const headings = [...region.querySelectorAll('thead th')].filter(node => node.getBoundingClientRect().width > 0);
        return headings.map(node => {
          const rect = node.getBoundingClientRect();
          return { name: node.textContent.trim(), inside: rect.left >= bounds.left - 1 && rect.right <= bounds.right + 1 };
        });
      });
      expect(registerColumns.every(column => column.inside), 'Every displayed register column fits inside the register').toBe(true);
      expect(registerColumns.map(column => column.name)).toEqual(viewport.width < 560
        ? ['Responsibility', 'Status'] : ['Responsibility', 'Project', 'Due', 'Status']);

      const smallest = await page.locator(".ev2-work-page").evaluate((root) => {
        const values = [...root.querySelectorAll("*")]
          .filter((node) => {
            const style = getComputedStyle(node);
            const rect = node.getBoundingClientRect();
            return style.visibility !== "hidden" && style.display !== "none" && rect.width > 0 && rect.height > 0 && (node.textContent || "").trim();
          })
          .map((node) => parseFloat(getComputedStyle(node).fontSize))
          .filter((value) => Number.isFinite(value));
        return Math.min(...values);
      });
      expect(smallest).toBeGreaterThanOrEqual(12);

      await page.screenshot({
        path: `test-artifacts/redesign-r7-stage10a4-${role.key}-${viewport.name}.png`,
        fullPage: true,
      });
      await context.close();
    });
  }
}

for (const viewport of [
  { name: "phone-360", width: 360, height: 800 },
  { name: "phone-375", width: 375, height: 812 },
  { name: "phone-414", width: 414, height: 896 },
  { name: "phone-430", width: 430, height: 932 },
  { name: "tablet-900", width: 900, height: 900 },
]) {
  test(`Stage 10 Family A4 shared Work geometry at ${viewport.name}`, async ({ browser }) => {
    const role = roles[0];
    const { context, page } = await openWork(browser, role, { width: viewport.width, height: viewport.height });

    await expect(page.locator(".ev2-work-page")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);

    await page.screenshot({
      path: `test-artifacts/redesign-r7-stage10a4-shared-${viewport.name}.png`,
      fullPage: true,
    });
    await context.close();
  });
}

for (const viewport of [
  { name: "phone-390", width: 390, height: 844 },
  { name: "desktop-1440", width: 1440, height: 900 },
]) {
  test(`Stage 10 Family A4 Staff Work Detail acceptance at ${viewport.name}`, async ({ browser }) => {
    const { context, page } = await openWork(browser, roles[0], { width: viewport.width, height: viewport.height });
    const firstRow = page.locator(".s2-register-row:visible th button").first();
    await expect(firstRow).toBeVisible();
    await firstRow.click();
    await expect(page.getByRole("complementary", { name: "Selected responsibility" })).toBeVisible();
    await page.getByRole("button", { name: /Open full work record/ }).click();
    await expect(page.locator(".ev2-work-detail")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    await page.screenshot({
      path: `test-artifacts/redesign-r7-stage10a4-staff-detail-${viewport.name}.png`,
      fullPage: true,
    });
    await context.close();
  });

  test(`Stage 10 Family A4 Manager assignment acceptance at ${viewport.name}`, async ({ browser }) => {
    const { context, page } = await openWork(browser, roles[1], { width: viewport.width, height: viewport.height });
    await page.getByRole("button", { name: "Give out work", exact: true }).first().click();
    await expect(page.locator(".ev2-work-assignment")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    await page.screenshot({
      path: `test-artifacts/redesign-r7-stage10a4-manager-assignment-${viewport.name}.png`,
      fullPage: true,
    });
    await context.close();
  });
}

import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

const password = process.env.ROLE_FIXTURE_PASSWORD;

async function openManagerProjects(browser, viewport) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  await page.goto("/");
  await page.getByPlaceholder("Work email").fill("manager@ceac.local.test");
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.locator(".manager-app")).toBeVisible({ timeout: 15000 });
  await page.goto("/?tab=projects");
  await expect(page.locator(".ev2-project-manager")).toBeVisible({ timeout: 15000 });
  await expect(page.getByText("Unit delivery", { exact: true })).toBeVisible();
  return { context, page };
}

test("Stage 10 Family C2 uses the shared V2 Project family without changing project authority paths", async () => {
  const shared = readFileSync("src/experience-v2/project-family/ProjectFamilyV2.jsx", "utf8");
  const css = readFileSync("src/experience-v2/project-family/project-family.css", "utf8");
  const manager = readFileSync("src/screens/ManagerProjects.jsx", "utf8");
  const main = readFileSync("src/main.jsx", "utf8");

  for (const symbol of [
    "ProjectPageHeader",
    "ProjectWorkspaceHeader",
    "ProjectTabs",
    "ProjectListRow",
    "ProjectAttentionCard",
    "ProjectSectionHeader",
    "ProjectIssueTable",
    "ProjectWorkDrawer",
  ]) {
    expect(shared).toContain(`export function ${symbol}`);
  }

  expect(css).toContain(".ev2-project-page");
  expect(css).toContain(".ev2-project-workspace");
  expect(css).not.toContain("!important");
  expect(main).toContain('import "./experience-v2/project-family/project-family.css";');

  expect(manager).toContain("create_project_with_participants");
  expect(manager).toContain("decide_project_proposal");
  expect(manager).toContain('neq("visibility", "private")');
  expect(manager).toContain("ProjectParticipantRegister");
  expect(manager).toContain("ManagerProjectClose");
  expect(manager).toContain("ev2-project-manager");
  expect(manager).toContain("ev2-project-workspace");
});

for (const viewport of [
  { name: "phone-320", width: 320, height: 844 },
  { name: "phone-390", width: 390, height: 844 },
  { name: "laptop", width: 1366, height: 768 },
  { name: "desktop-1440", width: 1440, height: 900 },
]) {
  test(`Stage 10 Family C2 Manager Projects composes at ${viewport.name}`, async ({ browser }) => {
    const { context, page } = await openManagerProjects(browser, { width: viewport.width, height: viewport.height });

    await expect(page.getByRole("heading", { name: "Projects", exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);

    const rows = page.locator(".ev2p-row:visible");
    expect(await rows.count()).toBeGreaterThan(0);
    const first = rows.first();
    const box = await first.boundingBox();
    expect(box?.height || 0).toBeGreaterThanOrEqual(44);

    if (viewport.width <= 760) {
      const sectionBox = await page.locator(".ev2-project-manager .ev2p-section-head").last().boundingBox();
      expect(sectionBox?.height || 0).toBeLessThanOrEqual(72);
    }

    const smallest = await page.locator(".ev2-project-manager").evaluate((root) => {
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
      path: `test-artifacts/redesign-r7-stage10c2-manager-projects-${viewport.name}.png`,
      fullPage: true,
    });
    await context.close();
  });
}

for (const viewport of [
  { name: "phone-320", width: 320, height: 844 },
  { name: "laptop", width: 1366, height: 768 },
]) {
  test(`Stage 10 Family C2 Manager project workspace composes at ${viewport.name}`, async ({ browser }) => {
    const { context, page } = await openManagerProjects(browser, { width: viewport.width, height: viewport.height });

    await page.locator(".ev2p-row:visible").first().click();
    await expect(page.locator(".ev2-project-workspace")).toBeVisible();
    await expect(page.getByRole("tab", { name: /^Overview/ })).toBeVisible();
    await expect(page.getByRole("tab", { name: /^Work/ })).toBeVisible();
    await expect(page.getByRole("tab", { name: /^Files/ })).toBeVisible();
    await expect(page.getByRole("tab", { name: /^Objectives/ })).toBeVisible();
    await expect(page.getByRole("tab", { name: /^Register/ })).toBeVisible();
    await expect(page.getByRole("tab", { name: /^Collaboration/ })).toBeVisible();
    await expect(page.getByRole("tab", { name: /^Close & record/ })).toBeVisible();

    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);

    const smallest = await page.locator(".ev2-project-workspace").evaluate((root) => {
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

    await page.getByRole("tab", { name: /^Work/ }).click();
    const workRows = page.locator(".fpg-work-table tbody tr").filter({ has: page.locator(".fpg-work-title") });
    expect(await workRows.count()).toBeGreaterThan(0);
    await workRows.first().click();
    const drawer = page.locator(".fpg-work-drawer");
    await expect(drawer).toBeVisible();
    await expect(drawer.getByText("Priority", { exact: true })).toBeVisible();
    await expect(drawer.getByText("Progress", { exact: true })).toBeVisible();
    await expect(drawer.getByText("Assignees", { exact: true })).toBeVisible();
    await expect(drawer.getByText("Attachments", { exact: true })).toBeVisible();
    await expect(drawer.getByRole("button", { name: "Open full record ↗", exact: true })).toBeVisible();

    await page.screenshot({
      path: `test-artifacts/redesign-r7-stage10c2-manager-project-workspace-${viewport.name}.png`,
      fullPage: true,
    });
    await context.close();
  });
}


async function openAdminProjects(browser, viewport) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  await page.goto("/");
  await page.getByPlaceholder("Work email").fill("admin@ceac.local.test");
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.locator(".office-app")).toBeVisible({ timeout: 15000 });
  await page.goto("/?tab=admin-projects");
  await expect(page.locator(".ev2-project-admin")).toBeVisible({ timeout: 15000 });
  return { context, page };
}

test("Administration Projects keeps contextual records and uses owner-authorised creation and management", async () => {
  const shared = readFileSync("src/experience-v2/project-family/ProjectFamilyV2.jsx", "utf8");
  const admin = readFileSync("src/screens/AdminProjects.jsx", "utf8");

  expect(shared).toContain("export function ProjectContextRow");
  expect(admin).toContain("ProjectContextRow");
  expect(admin).toContain('supabase.from("projects")');
  expect(admin).toContain('supabase.from("objectives")');
  expect(admin).toContain('supabase.from("project_units")');
  expect(admin).toContain("scheduleMeeting?.({scope:\"project\"");

  const composer = readFileSync("src/components/AdminProjectComposer.jsx", "utf8");
  const app = readFileSync("src/App.jsx", "utf8");
  expect(admin).toContain("ManagerProjects");
  expect(admin).toContain("AdminProjectComposer");
  expect(admin).toContain("projectUnitId={selected.lead_unit_id}");
  expect(composer).toContain('supabase.rpc("create_project_with_participants"');
  expect(composer).toContain('p_lead_unit_id:form.leadUnitId');
  expect(app).toContain('tab === "admin-projects" && isAdmin');

  expect(admin).not.toMatch(/\.rpc\(/);
  expect(admin).not.toMatch(/\.insert\(/);
  expect(admin).not.toMatch(/\.update\(/);
  expect(admin).not.toMatch(/\.delete\(/);
  expect(admin).not.toMatch(/\.upsert\(/);
});

for (const viewport of [
  { name: "phone-320", width: 320, height: 844 },
  { name: "phone-360", width: 360, height: 800 },
  { name: "phone-375", width: 375, height: 812 },
  { name: "phone-390", width: 390, height: 844 },
  { name: "phone-414", width: 414, height: 896 },
  { name: "phone-430", width: 430, height: 932 },
  { name: "intermediate-900", width: 900, height: 900 },
  { name: "laptop", width: 1366, height: 768 },
  { name: "desktop-1440", width: 1440, height: 900 },
]) {
  test(`Stage 10 Family C3 Administration Projects composes at ${viewport.name}`, async ({ browser }) => {
    const { context, page } = await openAdminProjects(browser, { width: viewport.width, height: viewport.height });

    await expect(page.getByRole("heading", { name: "Projects", exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);

    // A project list may legitimately be empty; never seed invented
    // project records simply to make a viewport screenshot green.
    const rows = page.locator(".ev2p-context-row:visible");
    const empty = page.locator(".ev2-project-admin .ev2p-empty");
    await expect.poll(async () => (await rows.count()) > 0 || await empty.isVisible(),
      { timeout: 15000 }).toBe(true);
    await expect(page.getByRole("button", { name: "Create project", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /Add objective/i })).toHaveCount(0);

    if (await rows.count()) {
      const row = rows.first();
      await expect(row.getByRole("button", { name: "Open project", exact: true })).toBeVisible();
      const more = row.locator(".ev2p-context-more > summary");
      await expect(more).toBeVisible();
      const moreBox = await more.boundingBox();
      expect(moreBox?.height || 0).toBeGreaterThanOrEqual(44);
      await more.click();
      const schedule = row.getByRole("button", { name: "Schedule project meeting", exact: true });
      await expect(schedule).toBeVisible();
      const scheduleBox = await schedule.boundingBox();
      expect(scheduleBox?.height || 0).toBeGreaterThanOrEqual(44);
    } else {
      await expect(empty).toContainText("No projects recorded");
      await expect(page.getByRole("button", { name: "Schedule project meeting", exact: true })).toHaveCount(0);
    }

    const smallest = await page.locator(".ev2-project-admin").evaluate((root) => {
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
      path: `test-artifacts/redesign-r7-stage10c3-admin-projects-${viewport.name}.png`,
      fullPage: true,
    });
    await context.close();
  });
}


async function openExecutiveInsights(browser, viewport) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  await page.goto("/");
  await page.getByPlaceholder("Work email").fill("exec@ceac.local.test");
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.locator(".executive-app")).toBeVisible({ timeout: 15000 });
  await page.goto("/?tab=exec-projects");
  await expect(page.locator(".executive-projects-consolidated .ev2-project-admin")).toBeVisible({ timeout: 15000 });
  await expect(page.getByRole("tab", { name: "All projects", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Create project", exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Delivery insights", exact: true }).click();
  await expect(page.locator(".ev2-project-delivery")).toBeVisible({ timeout: 15000 });
  return { context, page };
}

test("Stage 10 Family C4 preserves Delivery authority while migrating Executive Portfolio presentation", async () => {
  const shared = readFileSync("src/experience-v2/project-family/ProjectFamilyV2.jsx", "utf8");
  const delivery = readFileSync("src/screens/Delivery.jsx", "utf8");

  expect(shared).toContain("selected = false");
  expect(delivery).toContain("ev2-project-delivery");
  expect(delivery).toContain("ProjectPageHeader");
  expect(delivery).toContain("ProjectSummary");
  expect(delivery).toContain("ProjectContextRow");
  expect(delivery).toContain("ProjectListRow");

  for (const table of [
    "delivery_groups",
    "delivery_group_projects",
    "project_milestones",
    "project_dependencies",
    "milestone_dependencies",
    "work_dependencies",
    "project_register_items",
  ]) {
    expect(delivery).toContain(`supabase.from("${table}")`);
  }

  expect(delivery).toContain('capabilities.includes("delivery.manage")');
  expect(delivery).toContain("managedUnitIds.includes(selectedProject.lead_unit_id)");
  expect(delivery).toContain("delivery_change_reason");
  expect(delivery).toContain("change_reason");
  expect(delivery).toContain("ProjectParticipantRegister");
  expect(delivery).toContain("CEAC OS does not generate a hidden project score.");
  expect(delivery).not.toContain("compositeProjectScore");
  expect(delivery).not.toContain("riskProbability");
});

for (const viewport of [
  { name: "phone-320", width: 320, height: 844 },
  { name: "phone-360", width: 360, height: 800 },
  { name: "phone-375", width: 375, height: 812 },
  { name: "phone-390", width: 390, height: 844 },
  { name: "phone-414", width: 414, height: 896 },
  { name: "phone-430", width: 430, height: 932 },
  { name: "intermediate-900", width: 900, height: 900 },
  { name: "laptop", width: 1366, height: 768 },
  { name: "desktop-1440", width: 1440, height: 900 },
]) {
  test(`Stage 10 Family C4 Executive Portfolio composes at ${viewport.name}`, async ({ browser }) => {
    const { context, page } = await openExecutiveInsights(browser, { width: viewport.width, height: viewport.height });

    await expect(page.getByRole("heading", { name: "Delivery insights", exact: true })).toBeVisible();
    await expect(page.getByText(/See recorded project risks, delivery milestones and coordinated programmes/i)).toBeVisible();
    await expect(page.getByRole("tab", { name: "Delivery insights", exact: true })).toHaveAttribute("aria-selected", "true");
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);

    // Delivery insights must not duplicate the canonical All projects register.
    await expect(page.locator(".ev2-project-delivery .ev2p-context-list")).toHaveCount(0);
    await expect(page.locator(".ev2-project-delivery .ev2p-list")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Coordinated programmes", exact: true })).toBeVisible();
    const createGroup = page.getByRole("button", { name: "Create programme group", exact: true });
    await expect(createGroup).toBeVisible();
    const createBox = await createGroup.boundingBox();
    expect(createBox?.height || 0).toBeGreaterThanOrEqual(40);

    // Real programme records or a genuine empty state; no fabricated fixtures.
    const cards = page.locator(".ev2-project-delivery .ev2p-portfolio-card");
    const empty = page.getByText("No Programmes or Portfolios", { exact: true });
    await expect.poll(async () => (await cards.count()) > 0 || await empty.isVisible(), { timeout: 15000 }).toBe(true);

    const smallest = await page.locator(".ev2-project-delivery").evaluate((root) => {
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
      path: `test-artifacts/redesign-r7-stage10c4-executive-portfolio-${viewport.name}.png`,
      fullPage: true,
    });
    await context.close();
  });
}


test("VF6A cross-role Project surfaces share one factual workspace grammar", async ({ browser }) => {
  const css = readFileSync("src/experience-v2/project-family/project-family.css", "utf8");
  expect(css).toContain("/* VF6A — Cross-role Project workspace closure.");
  expect(css).not.toContain("!important");

  for (const viewport of [
    { name: "phone-390", width: 390, height: 844 },
    { name: "laptop-1366", width: 1366, height: 768 },
  ]) {
    {
      const { context, page } = await openManagerProjects(browser, { width: viewport.width, height: viewport.height });
      await page.locator(".ev2p-row:visible").first().click();
      await expect(page.locator(".ev2-project-workspace")).toBeVisible();
      const tabs = page.locator(".ev2-project-workspace .ev2p-tabs");
      const selected = tabs.locator("button.is-selected");
      await expect(selected).toBeVisible();
      const selectedStyle = await selected.evaluate((node) => ({
        radius: getComputedStyle(node).borderRadius,
        shadow: getComputedStyle(node).boxShadow,
        height: node.getBoundingClientRect().height,
      }));
      expect(selectedStyle.radius).toBe("0px");
      expect(selectedStyle.shadow).toBe("none");
      expect(selectedStyle.height).toBeGreaterThanOrEqual(44);
      await page.screenshot({ path: `test-artifacts/vf6a-manager-project-workspace-${viewport.name}.png`, fullPage: true });
      await context.close();
    }

    {
      const { context, page } = await openAdminProjects(browser, { width: viewport.width, height: viewport.height });
      const list = page.locator(".ev2-project-admin .ev2p-context-list");
      await expect(list).toBeVisible();
      const rows = list.locator(":scope > .ev2p-context-row");
      expect(await rows.count()).toBeGreaterThan(1);
      const geometry = await rows.evaluateAll((nodes) => nodes.slice(0, 2).map((node) => {
        const rect = node.getBoundingClientRect();
        const style = getComputedStyle(node);
        return { left: rect.left, top: rect.top, bottom: rect.bottom, radius: style.borderRadius, shadow: style.boxShadow };
      }));
      expect(Math.abs(geometry[0].left - geometry[1].left)).toBeLessThanOrEqual(2);
      // Premium cards are deliberately separated, gently rounded and elevated.
      const gap = geometry[1].top - geometry[0].bottom;
      expect(gap).toBeGreaterThanOrEqual(8);
      expect(gap).toBeLessThanOrEqual(16);
      expect(geometry[0].radius).toBe("13px");
      expect(geometry[0].shadow).not.toBe("none");
      if (viewport.width <= 760) {
        const summary = page.locator(".ev2-project-admin .ev2p-summary");
        const rail = await summary.evaluate((node) => ({ display: getComputedStyle(node).display, scroll: node.scrollWidth, client: node.clientWidth }));
        expect(rail.display).toBe("flex");
        expect(rail.scroll).toBeGreaterThan(rail.client);
      }
      await page.screenshot({ path: `test-artifacts/vf6a-admin-projects-${viewport.name}.png`, fullPage: true });
      await context.close();
    }

    {
      const { context, page } = await openExecutiveInsights(browser, { width: viewport.width, height: viewport.height });
      // The Executive sees one project register (All projects) and a distinct insights view.
      await expect(page.getByRole("heading", { name: "Delivery insights", exact: true })).toBeVisible();
      await expect(page.locator(".ev2-project-delivery .ev2p-context-list")).toHaveCount(0);
      await expect(page.locator(".ev2-project-delivery .ev2p-list")).toHaveCount(0);
      const summary = page.locator(".ev2-project-delivery > .ev2p-summary");
      await expect(summary).toBeVisible();
      await expect(page.getByRole("heading", { name: "Coordinated programmes", exact: true })).toBeVisible();
      const groupCards = page.locator(".ev2-project-delivery .ev2p-portfolio-card");
      const groupEmpty = page.getByText("No Programmes or Portfolios", { exact: true });
      await expect.poll(async () => (await groupCards.count()) > 0 || await groupEmpty.isVisible(), { timeout: 15000 }).toBe(true);
      if (viewport.width <= 760) {
        const rail = await summary.evaluate((node) => ({ display: getComputedStyle(node).display, scroll: node.scrollWidth, client: node.clientWidth }));
        expect(rail.display).toBe("flex");
        expect(rail.scroll).toBeGreaterThan(rail.client);
      }
      await page.screenshot({ path: `test-artifacts/vf6a-executive-portfolio-${viewport.name}.png`, fullPage: true });
      await context.close();
    }
  }
});

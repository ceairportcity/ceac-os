import fs from "node:fs";
import { test, expect } from "@playwright/test";
import { getMobilePrimaryNavigation, getShellNavigation } from "../src/experience-v2/shell/navigation.js";

const password = process.env.ROLE_FIXTURE_PASSWORD;
const reference = "docs/design/executive-redesign/CEAC_EXECUTIVE_PANEL_APPROVED_REFERENCE.webp";
const contract = "docs/design/executive-redesign/CEAC_EXECUTIVE_PANEL_VISUAL_PRODUCT_LOCK_2026-10-07.md";

async function signIn(page, viewport = { width: 1440, height: 900 }) {
  await page.setViewportSize(viewport);
  await page.goto("/");
  await page.getByPlaceholder("Work email").fill("exec@ceac.local.test");
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.locator(".executive-app")).toBeVisible({ timeout: 15000 });
}

test.describe.configure({ mode: "serial" });

test("Executive redesign is bound to the literal owner-approved reference", () => {
  expect(fs.existsSync(reference), reference).toBeTruthy();
  expect(fs.existsSync(contract), contract).toBeTruthy();

  const lock = fs.readFileSync(contract, "utf8");
  const css = fs.readFileSync("src/role-styles/executive-redesign.css", "utf8") + fs.readFileSync("src/role-styles/executive-workspaces.css", "utf8");
  const overview = fs.readFileSync("src/experience-v2/executive-overview/ExecutiveOverviewV2.jsx", "utf8");
  const home = fs.readFileSync("src/screens/ExecutiveHome.jsx", "utf8");
  const shell = fs.readFileSync("src/experience-v2/shell/ShellV2.jsx", "utf8");
  const search = fs.readFileSync("src/experience-v2/shell/GlobalSearch.jsx", "utf8");
  const navigation = fs.readFileSync("src/experience-v2/shell/navigation.js", "utf8");
  const legacy = fs.readFileSync("src/premium-executive.css", "utf8");
  const main = fs.readFileSync("src/main.jsx", "utf8");
  const app = fs.readFileSync("src/App.jsx", "utf8");
  const styleLoader = fs.readFileSync("src/experience-v2/executive-overview/ExecutiveRedesignStyles.jsx", "utf8");

  expect(lock).toContain("literal implementation authority");
  expect(lock).toContain("No compromise");
  expect(lock).toContain("not an interpretation");
  expect(overview).toContain("Executive Dashboard");
  expect(overview).toContain("Volunteers");
  expect(overview).toContain("Ministry Objectives");
  expect(overview).toContain("Upcoming Meetings");
  expect(overview).toContain("Reports / Actions");
  expect(home).toContain('supabase.from("strategy_nodes")');
  expect(home).toContain('supabase.from("activity_events")');
  expect(overview).toContain("recentActivity");
  expect(overview).toContain("Organisational milestones and exceptions");
  expect(overview).toContain("ministryStrategyRows");
  expect(overview).not.toContain("On track or met");
  expect(css).toContain(".executive-app .ev2s-sidebar");
  expect(shell).toContain('aria-label={isExec ? "Open updates" : "Open messages"}');
  expect(shell).toContain('name={isExec ? "notification" : "messages"}');
  expect(shell).toContain('className="ev2s-mobile-profile exec-redesign-mobile-notification"');
  expect(search).toContain('Search across CEAC OS...');
  expect(navigation).toContain('{ key: "account", label: "Account", icon: "account", group: "account" }');
  expect(css).toContain("/* Executive literal shell finishing */");
  expect(css).toContain(".executive-app .ev2s-profile-button > span:last-child");
  expect(css).toContain(".executive-app .ev2-project-delivery.is-executive");
  expect(css).toContain(".ev2cal-role-page");
  expect(css).toContain("--ev2-action:var(--exec-purple)");
  expect(css).toContain(".executive-app .fpg-payroll");
  const work = fs.readFileSync("src/screens/ExecutiveWork.jsx", "utf8");
  const ministry = fs.readFileSync("src/screens/Strategy.jsx", "utf8");
  const portfolio = fs.readFileSync("src/screens/Delivery.jsx", "utf8");
  const organisation = fs.readFileSync("src/screens/ExecutiveOrganisation.jsx", "utf8");
  const calendar = fs.readFileSync("src/screens/AdminCalendar.jsx", "utf8");
  const finance = fs.readFileSync("src/screens/ExecutiveFinance.jsx", "utf8");
  const reports = fs.readFileSync("src/screens/ExecutiveReports.jsx", "utf8");
  const inbox = fs.readFileSync("src/screens/Inbox.jsx", "utf8");
  expect(work).toContain("Plan, record, and finish your work. Keep every contribution connected to the right project.");
  expect(ministry).toContain("Set what CEAC wants to achieve. Departments turn these goals into action, and Projects shows the work being delivered.");
  expect(ministry).toContain('executiveSurface ? "Priorities and goals" : "Strategic hierarchy"');
  expect(portfolio).toContain("See recorded project risks, delivery milestones and coordinated programmes. Open All projects to manage an individual project.");
  expect(organisation).toContain("Find people, explore departments and see how your organisation works together.");
  expect(calendar).toContain("Your meetings, ministry events and project dates in one calendar.");
  expect(finance).toContain("Review income, spending and requests awaiting your decision. Each currency stays separate.");
  expect(finance).toContain('supabase.from("income_lines")');
  expect(finance).toContain('label: "Received"');
  expect(finance).toContain("Reversal-aware recorded income");
  expect(css).toContain(".executive-app {");
  expect(css).toContain("/* Literal semantic summary accents */");
  // The owner rejected the Payroll presentation on 27 October; keep the
  // accepted shell/palette above, and require the new recorded-net hierarchy.
  expect(css).not.toContain(".fpg-payroll-metrics article:nth-child(1)");
  expect(fs.readFileSync("src/premium.css", "utf8")).toContain(".fpg-payroll-main .fpg-payroll-metrics article:first-child>strong");
  expect(fs.readFileSync("src/screens/AdminPayroll.jsx", "utf8")).toContain('aria-label="Recorded payroll totals"');
  expect(fs.readFileSync("src/screens/MessagesWorkspace.css", "utf8")).toContain(".msg-workspace");
  expect(inbox).toContain('className="msg-workspace"');
  expect(inbox).toContain('aria-label="Messages sections"');
  expect(css).toContain(".exec-redesign-shared-head");
  expect(css).toContain(".ev2-personal-page");
  expect(reports).toContain('aria-label="Report filters"');
  expect(reports).toContain('["submitted", "Submitted"');
  expect(reports).toContain('["draft", "Drafts"');
  expect(reports).toContain('["waiting", "Waiting"');
  expect((legacy.match(/!important\b/g) || []).length).toBe(0);

  const primary = getMobilePrimaryNavigation({
    isExec: true,
    isAdmin: false,
    isManager: false,
    me: { capabilities: ["payroll.approve"] },
  });
  // Locked Executive mobile dock: three destinations plus More.
  // Calendar must remain reachable in More, not become a fifth dock item.
  expect(primary.map((item) => item.label)).toEqual(["Overview", "Work", "Ministry"]);

  const desktop = getShellNavigation({
    isExec: true,
    isAdmin: false,
    isManager: false,
    me: { capabilities: ["payroll.approve"] },
  });
  expect(desktop.some((item) => item.label === "Calendar")).toBe(true);
  expect(desktop.map((item) => item.label)).toEqual([
    "Overview",
    "Work",
    "Ministry",
    "Projects",
    "Organisation",
    "Calendar",
    "Finance",
    "Payroll",
    "Reports",
    "Messages",
    "My Hub",
    "Account",
    "Get technical help",
  ]);
  expect(css).toContain("/* Executive phone Payroll cards */");
  expect(css).toContain(".executive-app .fpg-payroll-table thead");
  expect(css).toContain('content: "Additions"');
  expect(css).toContain(".executive-app .fpg-payroll-row-action");
});

test("Executive Overview reproduces the locked desktop composition", async ({ page }) => {
  await signIn(page);
  await expect(page.getByText("Executive Dashboard", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Search across CEAC OS")).toBeVisible();
  await expect(page.getByRole("button", { name: "Open updates", exact: true })).toBeVisible();
  await expect(page.getByLabel("Quick create")).toBeHidden();
  await expect(page.getByLabel("Current date and time in Accra")).toBeHidden();
  await expect(page.locator(".executivev2-hero h2")).toContainText(/Good (morning|afternoon|evening), Executive Fixture/);
  await expect(page.locator(".executivev2-kpi")).toHaveCount(4);
  await expect(page.locator(".executivev2-reference-grid > .executivev2-reference-panel")).toHaveCount(3);
  await expect(page.locator(".executivev2-lower-grid > .executivev2-reference-panel")).toHaveCount(2);
  await expect(page.getByText("Needs your attention", { exact: true })).toBeVisible();
  await expect(page.getByText("Ministry direction", { exact: true })).toBeVisible();
  await expect(page.getByText("People and departments", { exact: true })).toBeVisible();
  await expect(page.getByText("Significant updates", { exact: true })).toBeVisible();
  await expect(page.getByText("Upcoming meetings", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: "test-artifacts/executive-redesign-reference-overview-desktop-1440.png", fullPage: true });
});

test("Executive Overview reproduces the locked phone composition", async ({ page }) => {
  await signIn(page, { width: 390, height: 844 });
  const nav = page.locator(".ev2s-mobile-nav");
  await expect(nav.getByRole("button")).toHaveCount(4);
  await expect(nav.locator("button span")).toHaveText(["Overview", "Work", "Ministry", "More"]);
  await expect(page.locator(".executivev2-kpi")).toHaveCount(4);
  const columns = await page.locator(".executivev2-kpis").evaluate((node) => getComputedStyle(node).gridTemplateColumns.split(" ").length);
  expect(columns).toBe(2);
  await expect(page.locator(".executivev2-attention")).toBeVisible();
  await expect(page.getByRole("button", { name: "Open updates", exact: true })).toBeVisible();
  await expect(page.locator(".executivev2-direction")).toBeHidden();
  await expect(page.locator(".executivev2-organisation")).toBeHidden();
  await expect(page.locator(".executivev2-activity")).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: "test-artifacts/executive-redesign-reference-overview-phone-390.png", fullPage: true });
});

const destinations = [
  ["work", ".ev2-work-executive", "Work"],
  ["strategy", ".ev2-executive-ministry", "Ministry goals"],
  ["exec-projects", ".executive-projects-consolidated", "Projects"],
  ["exec-organisation", ".ev2-exec-organisation", "Organisation"],
  ["exec-calendar", ".ev2cal-admin-page", "Calendar"],
  ["exec-finance", ".ev2-finance-executive", "Finance"],
  ["payroll", ".fpg-payroll", "Payroll"],
  ["exec-reports", ".ev2-reporting-executive", "Reports"],
  ["messages", ".msg-workspace", "Messages"],
  ["me", ".ev2-personal-hub", "My Hub"],
  ["account", ".ev2-personal-account", "Your account"],
];

for (const [tab, selector, label] of destinations) {
  test(`Executive ${label} keeps the unified redesign on desktop and phone`, async ({ browser }) => {
    for (const viewport of [
      { width: 1440, height: 900, name: "desktop" },
      { width: 390, height: 844, name: "phone" },
    ]) {
      const context = await browser.newContext({ viewport });
      const page = await context.newPage();
      await page.goto("/");
      await page.getByPlaceholder("Work email").fill("exec@ceac.local.test");
      await page.getByPlaceholder("Password").fill(password);
      await page.getByRole("button", { name: "Sign in" }).click();
      await expect(page.locator(".executive-app")).toBeVisible({ timeout: 15000 });
      await page.goto(`/?tab=${tab}`);
      await expect(page.locator(selector)).toBeVisible({ timeout: 15000 });
      await expect(page.getByRole("heading", { name: label, exact: true }).first()).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
      await page.screenshot({ path: `test-artifacts/executive-redesign-${tab}-${viewport.name}.png`, fullPage: true });
      await context.close();
    }
  });
}

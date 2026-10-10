import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

const password = process.env.ROLE_FIXTURE_PASSWORD;

const modernCss = [
  "src/experience-v2.css",
  "src/experience-v2/components/components.css",
  "src/experience-v2/shell/shell.css",
  "src/experience-v2/staff-today/staff-today.css",
  "src/experience-v2/admin-overview/admin-overview.css",
  "src/experience-v2/work-family/work-family.css",
  "src/experience-v2/executive-overview/executive-surfaces.css",
  "src/experience-v2/project-family/project-family.css",

  "src/experience-v2/workforce-family/workforce-family.css",
  "src/experience-v2/finance-family/finance-family.css",
  "src/experience-v2/personal-family/personal-family.css",

  "src/experience-v2/data-viz/data-viz.css",
  "src/experience-v2/integrations/integrations.css",
];

const routeLazyCss = [
  "src/experience-v2/people-family/people-family.css",
  "src/experience-v2/calendar/calendar.css",
  "src/experience-v2/manager-overview/manager-overview.css",
  "src/experience-v2/executive-overview/executive-overview.css",
];

const legacyCss = [
  "src/styles.css",
  "src/premium.css",
  "src/premium-staff.css",
  "src/premium-manager.css",
  "src/premium-admin.css",
  "src/premium-executive.css",
  "src/premium-parity.css",
];

async function signIn(page, role) {
  await page.goto("/");
  await page.getByPlaceholder("Work email").fill(role.email);
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.locator(role.app)).toBeVisible({ timeout: 15000 });
  await page.evaluate(() => document.fonts.ready);
}

test("VF9B keeps legacy compatibility CSS before the low-specificity Experience V2 cascade", async () => {
  const main = readFileSync("src/main.jsx", "utf8");

  const legacyLast = Math.max(...legacyCss.map((path) => {
    const token = path.replace("src/", "./");
    const index = main.indexOf(`import "${token}"`);
    expect(index, `missing ${path} import`).toBeGreaterThanOrEqual(0);
    return index;
  }));

  const modernFirst = Math.min(...modernCss.map((path) => {
    const token = path.replace("src/", "./");
    const index = main.indexOf(`import "${token}"`);
    expect(index, `missing ${path} import`).toBeGreaterThanOrEqual(0);
    return index;
  }));

  expect(modernFirst).toBeGreaterThan(legacyLast);

  const managerView = readFileSync("src/experience-v2/manager-overview/ManagerOverviewV2.jsx", "utf8");
  const executiveView = readFileSync("src/experience-v2/executive-overview/ExecutiveOverviewV2.jsx", "utf8");
  expect(managerView).toContain('import "./manager-overview.css";');
  expect(executiveView).toContain('import "./executive-overview.css";');
  const peopleView = readFileSync("src/experience-v2/people-family/PeopleFamilyV2.jsx", "utf8");
  const calendarView = readFileSync("src/experience-v2/calendar/CalendarFamilyV2.jsx", "utf8");
  expect(peopleView).toContain('import "./people-family.css";');
  expect(calendarView).toContain('import "./calendar.css";');
  expect(main).not.toContain('import "./experience-v2/people-family/people-family.css";');
  expect(main).not.toContain('import "./experience-v2/calendar/calendar.css";');

  for (const path of routeLazyCss) {
    const css = readFileSync(path, "utf8");
    expect(css, `${path} route-lazy CSS must not escalate the VF cascade with !important`).not.toContain("!important");
  }

  for (const path of modernCss) {
    const css = readFileSync(path, "utf8");
    expect(css, `${path} must not escalate the VF cascade with !important`).not.toContain("!important");
  }

  for (const path of legacyCss) {
    const css = readFileSync(path, "utf8");
    for (const block of css.split("}")) {
      if (!block.includes("!important")) continue;
      expect(
        block,
        `${path} must not directly override Experience V2/VF selectors with !important`,
      ).not.toMatch(/\.(?:ev2|staffv2|managerv2|adminv2|executivev2)[\w-]*/);
    }
  }
});

test("VF9B accepted Manager composition wins the live cascade at 1366", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const page = await context.newPage();
  await signIn(page, { email: "manager@ceac.local.test", app: ".manager-app" });

  await expect(page.locator(".managerv2")).toBeVisible();
  const reference = page.locator(".fpg9-home-reference");
  const nextCard = page.locator(".fpg9-next-card");
  await expect(reference).toBeVisible();
  await expect(nextCard).toBeVisible();

  const geometry = await page.evaluate(() => {
    const reference = document.querySelector(".fpg9-home-reference");
    const nextCard = document.querySelector(".fpg9-next-card");
    const body = document.querySelector(".app-content .body");
    const sidebar = document.querySelector(".ev2s-sidebar");
    const workspace = document.querySelector(".ev2s-workspace");
    const bodyRect = body?.getBoundingClientRect();
    const sidebarRect = sidebar?.getBoundingClientRect();
    const workspaceRect = workspace?.getBoundingClientRect();
    return {
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      referenceDisplay: reference ? getComputedStyle(reference).display : "",
      nextCardDisplay: nextCard ? getComputedStyle(nextCard).display : "",
      bodyWidth: bodyRect?.width || 0,
      seam: Math.abs((sidebarRect?.right || 0) - (workspaceRect?.left || 0)),
      controlMin: getComputedStyle(document.documentElement).getPropertyValue("--ev2-control-min").trim(),
    };
  });

  expect(geometry.overflow).toBeLessThanOrEqual(1);
  expect(geometry.referenceDisplay).toBe("grid");
  expect(geometry.nextCardDisplay).toBe("grid");
  expect(geometry.bodyWidth).toBeLessThanOrEqual(1281);
  expect(geometry.seam).toBeLessThanOrEqual(1);
  expect(geometry.controlMin).toBe("2.75rem");

  await page.screenshot({
    path: "test-artifacts/vf9b-manager-cascade-laptop-1366.png",
    fullPage: true,
  });
  await context.close();
});

test("VF9B accepted Administration composition remains deliberate on phone", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await signIn(page, { email: "admin@ceac.local.test", app: ".office-app" });

  await expect(page.locator(".adminv2")).toBeVisible();
  const panel = page.locator(".adminv2-panel").first();
  await expect(panel).toBeVisible();

  const state = await page.evaluate(() => {
    const panel = document.querySelector(".adminv2-panel");
    const style = panel ? getComputedStyle(panel) : null;
    const navButtons = [...document.querySelectorAll(".ev2s-mobile-nav button")];
    return {
      htmlOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      bodyOverflow: document.body.scrollWidth - document.body.clientWidth,
      panelShadow: style?.boxShadow || "",
      minNavHeight: navButtons.length
        ? Math.min(...navButtons.map((button) => button.getBoundingClientRect().height))
        : 0,
    };
  });

  expect(state.htmlOverflow).toBeLessThanOrEqual(1);
  expect(state.bodyOverflow).toBeLessThanOrEqual(1);
  expect(state.panelShadow).toBe("none");
  expect(state.minNavHeight).toBeGreaterThanOrEqual(44);

  await page.screenshot({
    path: "test-artifacts/vf9b-administration-cascade-phone-390.png",
    fullPage: true,
  });
  await context.close();
});

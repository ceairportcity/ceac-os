import { test, expect } from "@playwright/test";
import {
  getMobilePrimaryNavigation,
  getShellNavigation,
  hasMultipleUnits,
} from "../src/experience-v2/shell/navigation.js";

const password = process.env.ROLE_FIXTURE_PASSWORD;
const unitA = "20000000-0000-4000-8000-000000000011";

const roles = [
  { key: "staff", email: "staff@ceac.local.test", app: ".staff-app" },
  { key: "manager", email: "manager@ceac.local.test", app: ".manager-app" },
  { key: "admin", email: "admin@ceac.local.test", app: ".office-app" },
  { key: "executive", email: "exec@ceac.local.test", app: ".executive-app" },
];

async function signIn(page, role) {
  await page.goto("/");
  await page.getByPlaceholder("Work email").fill(role.email);
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.locator(role.app)).toBeVisible({ timeout: 15000 });
}

function roleContext(key, me = { capabilities: [] }) {
  return {
    me,
    isAdmin: key === "admin",
    isExec: key === "executive",
    isManager: key === "manager",
  };
}

test.describe.configure({ mode: "serial" });

test("Stage 4C capability and multi-unit policies remain explicit", async () => {
  const limitedAdmin = getShellNavigation(roleContext("admin", { capabilities: [] }));
  const limitedAdminLabels = limitedAdmin.map((item) => item.label);

  expect(limitedAdminLabels).not.toContain("People & Access");
  for (const label of ["Reviews & Development", "Learning", "Compliance"]) expect(limitedAdminLabels).not.toContain(label);
  const scoped = getShellNavigation(roleContext("admin", {capabilities:["performance.admin"],capability_grants:[{capability:"performance.admin",scope_unit_id:unitA}]}));
  expect(scoped.some(item=>item.key==="performance")).toBe(false);
  for (const label of [
    "Overview",
    "Work",
    "Time & Leave",
    "Finance",
    "Reports",
    "Control Center",
    "Messages",
    "My Hub",
    "Your account",
  ]) {
    expect(limitedAdminLabels).toContain(label);
  }

  const authorisedAdmin = getShellNavigation(
    roleContext("admin", { capabilities: ["people.manage"] })
  );
  expect(authorisedAdmin.map((item) => item.label)).toContain("People & Access");

  const limitedAdminPrimary = getMobilePrimaryNavigation(
    roleContext("admin", { capabilities: [] })
  );
  expect(limitedAdminPrimary.map((item) => item.label)).toEqual([
    "Overview",
    "Time & Leave",
    "Finance",
  ]);

  const twoUnits = {
    memberships: [
      { unit_id: "unit-a", unit_name: "Unit A", role: "staff" },
      { unit_id: "unit-b", unit_name: "Unit B", role: "staff" },
    ],
  };
  expect(hasMultipleUnits(twoUnits, roleContext("staff"))).toBe(true);
  expect(hasMultipleUnits(twoUnits, roleContext("admin"))).toBe(false);
  expect(hasMultipleUnits(twoUnits, roleContext("executive"))).toBe(false);
  expect(hasMultipleUnits({ memberships: twoUnits.memberships.slice(0, 1) }, roleContext("staff"))).toBe(false);

  for (const key of ["staff", "manager", "admin", "executive"]) {
    expect(getMobilePrimaryNavigation(roleContext(key, key === "admin"
      ? { capabilities: ["people.manage"] }
      : { capabilities: [] })).length).toBeLessThanOrEqual(4);
  }
});

test("Stage 4C Staff shell holds every supported phone width", async ({ browser }) => {
  test.setTimeout(120000);
  const widths = [320, 360, 375, 390, 414, 430];

  for (const width of widths) {
    const context = await browser.newContext({ viewport: { width, height: 844 } });
    const page = await context.newPage();
    await signIn(page, roles[0]);

    const mobileTopbar = page.locator(".ev2s-mobile-topbar");
    const mobileNav = page.locator(".ev2s-mobile-nav");

    await expect(mobileTopbar).toBeVisible();
    await expect(mobileNav).toBeVisible();
    await expect(page.locator(".ev2s-sidebar")).toBeHidden();
    await expect(page.locator(".ev2s-topbar")).toBeHidden();
    await expect(mobileNav.getByRole("button")).toHaveCount(5);

    const geometry = await page.evaluate(() => {
      const nav = document.querySelector(".ev2s-mobile-nav");
      const topbar = document.querySelector(".ev2s-mobile-topbar");
      const buttons = [...document.querySelectorAll(".ev2s-mobile-nav button")];
      return {
        documentOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        bodyOverflow: document.body.scrollWidth - document.body.clientWidth,
        navRight: nav ? nav.getBoundingClientRect().right - window.innerWidth : 0,
        navBottom: nav ? nav.getBoundingClientRect().bottom - window.innerHeight : 0,
        topbarRight: topbar ? topbar.getBoundingClientRect().right - window.innerWidth : 0,
        minButtonHeight: buttons.length
          ? Math.min(...buttons.map((button) => button.getBoundingClientRect().height))
          : 0,
      };
    });

    expect(geometry.documentOverflow, `document overflow at ${width}px`).toBeLessThanOrEqual(1);
    expect(geometry.bodyOverflow, `body overflow at ${width}px`).toBeLessThanOrEqual(1);
    expect(Math.abs(geometry.navRight), `mobile nav right edge at ${width}px`).toBeLessThanOrEqual(1);
    expect(Math.abs(geometry.navBottom), `mobile nav bottom edge at ${width}px`).toBeLessThanOrEqual(1);
    expect(Math.abs(geometry.topbarRight), `mobile topbar right edge at ${width}px`).toBeLessThanOrEqual(1);
    expect(geometry.minButtonHeight, `mobile touch target at ${width}px`).toBeGreaterThanOrEqual(44);

    await page.screenshot({
      path: `test-artifacts/redesign-r7-stage4c-staff-${width}.png`,
      fullPage: true,
    });
    await context.close();
  }
});

test("Stage 4C Administration keeps essential bottom-nav labels readable at 320px", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await signIn(page, roles[2]);

  const mobileNav = page.locator(".ev2s-mobile-nav");
  await expect(mobileNav).toBeVisible();
  await expect(mobileNav.getByRole("button")).toHaveCount(5);

  const labels = await mobileNav.locator("button span").evaluateAll((nodes) =>
    nodes.map((node) => ({
      text: (node.textContent || "").trim(),
      clientWidth: node.clientWidth,
      scrollWidth: node.scrollWidth,
      whiteSpace: getComputedStyle(node).whiteSpace,
    }))
  );

  for (const label of labels) {
    expect(
      label.scrollWidth - label.clientWidth,
      `mobile label "${label.text}" is visually clipped`
    ).toBeLessThanOrEqual(1);
  }

  await page.screenshot({
    path: "test-artifacts/redesign-r7-stage4c-admin-320.png",
    fullPage: true,
  });
});

test("Stage 4C narrow-phone More drawer preserves viewport and focus", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await signIn(page, roles[0]);

  const mobileNav = page.locator(".ev2s-mobile-nav");
  const more = mobileNav.getByRole("button", { name: "More", exact: true });
  await more.click();

  const drawer = page.getByRole("dialog", { name: "More" });
  await expect(drawer).toBeVisible();

  const geometry = await page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"][aria-label="More"]')
      || document.querySelector('[role="dialog"]');
    const rect = dialog?.getBoundingClientRect();
    return {
      documentOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      bodyOverflow: document.body.scrollWidth - document.body.clientWidth,
      left: rect?.left ?? 0,
      right: rect ? rect.right - window.innerWidth : 0,
    };
  });

  expect(geometry.documentOverflow).toBeLessThanOrEqual(1);
  expect(geometry.bodyOverflow).toBeLessThanOrEqual(1);
  expect(geometry.left).toBeGreaterThanOrEqual(-1);
  expect(geometry.right).toBeLessThanOrEqual(1);

  await page.screenshot({
    path: "test-artifacts/redesign-r7-stage4c-staff-more-320.png",
    fullPage: false,
  });

  await page.keyboard.press("Escape");
  await expect(drawer).toBeHidden();
  await expect(more).toBeFocused();
});

test("Stage 4C all four mobile role shells stay within the 390px viewport", async ({ browser }) => {
  test.setTimeout(120000);
  for (const role of roles) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    await signIn(page, role);

    const mobileNav = page.locator(".ev2s-mobile-nav");
    await expect(mobileNav).toBeVisible();
    await expect(mobileNav.getByRole("button")).toHaveCount(role.key === "executive" ? 4 : 5);

    const overflow = await page.evaluate(() => ({
      document: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      body: document.body.scrollWidth - document.body.clientWidth,
    }));
    expect(overflow.document, `${role.key} document overflow`).toBeLessThanOrEqual(1);
    expect(overflow.body, `${role.key} body overflow`).toBeLessThanOrEqual(1);

    const labels = await mobileNav.locator("button span").evaluateAll((nodes) =>
      nodes.map((node) => ({
        text: (node.textContent || "").trim(),
        clientWidth: node.clientWidth,
        scrollWidth: node.scrollWidth,
      }))
    );
    for (const label of labels) {
      expect(
        label.scrollWidth - label.clientWidth,
        `${role.key} mobile label "${label.text}" is visually clipped`
      ).toBeLessThanOrEqual(1);
    }

    await page.screenshot({
      path: `test-artifacts/redesign-r7-stage4c-${role.key}-390.png`,
      fullPage: true,
    });
    await context.close();
  }
});

test("Stage 4C 1366x768 laptop shell keeps navigation and account chrome stable", async ({ browser }) => {
  test.setTimeout(120000);
  for (const role of roles) {
    const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    const page = await context.newPage();
    await signIn(page, role);

    const sidebar = page.locator(".ev2s-sidebar");
    const topbar = page.locator(".ev2s-topbar");
    const nav = page.locator(".ev2s-sidebar-nav");
    const profile = page.locator(".ev2s-sidebar-profile");

    await expect(sidebar).toBeVisible();
    await expect(topbar).toBeVisible();
    await expect(profile).toBeVisible();

    const geometry = await page.evaluate(() => {
      const side = document.querySelector(".ev2s-sidebar");
      const navNode = document.querySelector(".ev2s-sidebar-nav");
      const profileNode = document.querySelector(".ev2s-sidebar-profile");
      const top = document.querySelector(".ev2s-topbar");
      const rect = (node) => node?.getBoundingClientRect();
      return {
        documentOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        sidebarOverflow: side ? side.scrollWidth - side.clientWidth : 0,
        navOverflowY: navNode ? getComputedStyle(navNode).overflowY : "",
        navBottom: rect(navNode)?.bottom || 0,
        profileBottom: rect(profileNode)?.bottom || 0,
        viewportHeight: window.innerHeight,
        topbarRight: (rect(top)?.right || window.innerWidth) - window.innerWidth,
      };
    });

    expect(geometry.documentOverflow, `${role.key} laptop document overflow`).toBeLessThanOrEqual(1);
    expect(geometry.sidebarOverflow, `${role.key} laptop sidebar overflow`).toBeLessThanOrEqual(1);
    expect(["auto", "scroll"]).toContain(geometry.navOverflowY);
    expect(geometry.navBottom).toBeLessThanOrEqual(geometry.profileBottom);
    expect(geometry.profileBottom).toBeLessThanOrEqual(geometry.viewportHeight + 1);
    expect(Math.abs(geometry.topbarRight)).toBeLessThanOrEqual(1);

    await page.screenshot({
      path: `test-artifacts/redesign-r7-stage4c-${role.key}-laptop.png`,
      fullPage: true,
    });
    await context.close();
  }
});

test("Stage 4C 1440x900 desktop shell remains stable across all roles", async ({ browser }) => {
  test.setTimeout(120000);
  for (const role of roles) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await signIn(page, role);

    await expect(page.locator(".ev2s-sidebar")).toBeVisible();
    await expect(page.locator(".ev2s-topbar")).toBeVisible();
    await expect(page.locator(".ev2s-mobile-topbar")).toBeHidden();
    await expect(page.locator(".ev2s-mobile-nav")).toBeHidden();

    const geometry = await page.evaluate(() => ({
      documentOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      bodyOverflow: document.body.scrollWidth - document.body.clientWidth,
      sidebarOverflow:
        (document.querySelector(".ev2s-sidebar")?.scrollWidth || 0)
        - (document.querySelector(".ev2s-sidebar")?.clientWidth || 0),
    }));

    expect(geometry.documentOverflow, `${role.key} desktop document overflow`).toBeLessThanOrEqual(1);
    expect(geometry.bodyOverflow, `${role.key} desktop body overflow`).toBeLessThanOrEqual(1);
    expect(geometry.sidebarOverflow, `${role.key} desktop sidebar overflow`).toBeLessThanOrEqual(1);

    await page.screenshot({
      path: `test-artifacts/redesign-r7-stage4c-${role.key}-desktop.png`,
      fullPage: true,
    });
    await context.close();
  }
});

test("Stage 4C long identity strings cannot widen shell chrome", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await signIn(page, roles[1]);

  await page.evaluate(() => {
    const longName = "A Deliberately Very Long CEAC Team Member Name That Must Truncate Safely";
    const longUnit = "A Deliberately Very Long Ministry Unit Name That Must Never Widen The Shell";
    document.querySelectorAll(".ev2s-sidebar-profile-copy strong, .ev2s-profile-button strong")
      .forEach((node) => { node.textContent = longName; });
    document.querySelectorAll(".ev2s-sidebar-profile-copy small, .ev2s-profile-button small")
      .forEach((node) => { node.textContent = longUnit; });
  });

  const desktop = await page.evaluate(() => {
    const side = document.querySelector(".ev2s-sidebar");
    const top = document.querySelector(".ev2s-topbar");
    const name = document.querySelector(".ev2s-sidebar-profile-copy strong");
    return {
      documentOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      sidebarOverflow: side ? side.scrollWidth - side.clientWidth : 0,
      topbarOverflow: top ? top.scrollWidth - top.clientWidth : 0,
      textOverflow: name ? getComputedStyle(name).textOverflow : "",
      whiteSpace: name ? getComputedStyle(name).whiteSpace : "",
    };
  });

  expect(desktop.documentOverflow).toBeLessThanOrEqual(1);
  expect(desktop.sidebarOverflow).toBeLessThanOrEqual(1);
  expect(desktop.topbarOverflow).toBeLessThanOrEqual(1);
  expect(desktop.textOverflow).toBe("ellipsis");
  expect(desktop.whiteSpace).toBe("nowrap");

  await page.setViewportSize({ width: 320, height: 844 });
  await page.evaluate(() => {
    const context = document.querySelector(".ev2s-mobile-identity small");
    if (context) context.textContent =
      "A Deliberately Very Long Ministry Unit Name That Must Truncate Safely · Manager";
  });

  const mobile = await page.evaluate(() => {
    const top = document.querySelector(".ev2s-mobile-topbar");
    const context = document.querySelector(".ev2s-mobile-identity small");
    return {
      documentOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      topbarOverflow: top ? top.scrollWidth - top.clientWidth : 0,
      textOverflow: context ? getComputedStyle(context).textOverflow : "",
      whiteSpace: context ? getComputedStyle(context).whiteSpace : "",
    };
  });

  expect(mobile.documentOverflow).toBeLessThanOrEqual(1);
  expect(mobile.topbarOverflow).toBeLessThanOrEqual(1);
  expect(mobile.textOverflow).toBe("ellipsis");
  expect(mobile.whiteSpace).toBe("nowrap");
});

test("Stage 4C destination search stays keyboard-usable and truthful", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await signIn(page, roles[0]);

  await page.keyboard.press("Control+K");
  const search = page.getByPlaceholder("Search CEAC…");
  await expect(search).toBeFocused();

  await search.fill("Messages");
  const palette = page.getByRole("dialog", { name: "Search CEAC results" });
  await expect(palette).toBeVisible();
  await expect(palette.getByRole("button", { name: "Messages", exact: true })).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(palette).toBeHidden();
  await expect(search).toBeFocused();

  await page.keyboard.press("Control+K");
  await expect(palette).toBeVisible();
  await palette.getByRole("button", { name: "Messages", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Messages", exact: true })).toBeVisible();
  expect(new URL(page.url()).searchParams.get("tab")).toBe("messages");
});

test("Stage 4C canonical mobile overlays hide bottom navigation and return cleanly", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page, roles[0]);

  await page.goto(`/?roomKind=unit&room=${unitA}`);
  await expect(page.locator(".room-screen")).toBeVisible({ timeout: 15000 });
  await expect(page.locator(".ev2s-mobile-nav")).toHaveCount(0);

  await page.locator(".room-back").click();
  await expect(page.locator(".room-screen")).toHaveCount(0);
  await expect(page.locator(".ev2s-mobile-nav")).toBeVisible();
  expect(new URL(page.url()).searchParams.has("roomKind")).toBe(false);
  expect(new URL(page.url()).searchParams.has("room")).toBe(false);
});

/* iPad Mini/standard iPad portrait and landscape acceptance, same
   role fixtures as the existing laptop and phone quality gates. */
test("Tablet 768-1180px keeps laptop navigation, role overview and no sideways overflow", async ({ browser }) => {
  test.setTimeout(180000);
  const widths = [768, 820, 1024, 1180];
  const overviewByRole = {
    staff: ".staffv2",
    manager: ".managerv2",
    admin: ".adminv2",
    executive: ".executivev2",
  };
  for (const role of roles) {
    for (const width of widths) {
      const context = await browser.newContext({ viewport: { width, height: 1024 } });
      try {
        const page = await context.newPage();
        await signIn(page, role);
        const sidebar = page.locator(".ev2s-sidebar");
        await expect(sidebar).toBeVisible();
        await expect(page.locator(".ev2s-topbar")).toBeVisible();
        await expect(page.locator(".ev2s-mobile-topbar")).toBeHidden();
        await expect(page.locator(".ev2s-mobile-nav")).toBeHidden();
        await sidebar.getByRole("button", { name: "Overview", exact: true }).click();
        await expect(page.locator(overviewByRole[role.key])).toBeVisible({ timeout: 15000 });
        const geometry = await page.evaluate(() => {
          const sidebar = document.querySelector(".ev2s-sidebar");
          const workspace = document.querySelector(".ev2s-workspace");
          const side = sidebar?.getBoundingClientRect();
          const main = workspace?.getBoundingClientRect();
          return {
            scrollOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
            sidebarWidth: side?.width || 0,
            sidebarBottom: side?.bottom || 0,
            workspaceLeft: main?.left || 0,
            workspaceRight: main?.right || 0,
            viewport: window.innerWidth,
          };
        });
        expect(geometry.scrollOverflow, `${role.key} at ${width}px: document overflow`).toBeLessThanOrEqual(1);
        expect(geometry.sidebarWidth, `${role.key} at ${width}px: sidebar width`).toBeGreaterThan(60);
        expect(geometry.workspaceLeft, `${role.key} at ${width}px: sidebar overlap`).toBeGreaterThanOrEqual(geometry.sidebarWidth - 1);
        expect(geometry.workspaceRight, `${role.key} at ${width}px: workspace overflow`).toBeLessThanOrEqual(width + 1);
        if (width < 1024) expect(geometry.sidebarWidth).toBeLessThanOrEqual(90);
        await page.screenshot({
          path: `test-artifacts/tablet-${role.key}-${width}.png`,
          fullPage: true,
        });
      } finally {
        await context.close();
      }
    }
  }
});

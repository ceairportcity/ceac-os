import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

const password = process.env.ROLE_FIXTURE_PASSWORD;

const roles = [
  { key: "staff", email: "staff@ceac.local.test", app: ".staff-app", ready: ".staffv2" },
  { key: "manager", email: "manager@ceac.local.test", app: ".manager-app", ready: ".managerv2-main" },
  { key: "administration", email: "admin@ceac.local.test", app: ".office-app", ready: ".adminv2-main" },
  { key: "executive", email: "exec@ceac.local.test", app: ".executive-app", ready: ".executivev2-main" },
];

async function signIn(page, role) {
  await page.goto("/");
  await page.getByPlaceholder("Work email").fill(role.email);
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.locator(role.app)).toBeVisible({ timeout: 15000 });
  await expect(page.locator(role.ready).first()).toBeVisible({ timeout: 15000 });
}

test("VF8A Administration phone composition does not use unequal-height full-panel rails", async () => {
  const css = readFileSync("src/experience-v2/admin-overview/admin-overview.css", "utf8");
  expect(css).toContain("@media (max-width: 599px)");
  expect(css).toContain("grid-template-columns: 1fr");
  expect(css).not.toContain("flex: 0 0 calc(100% - 2rem)");
  expect(css).not.toContain("scroll-snap-type: x proximity");
});

test("VF8A 320–430 phone matrix preserves all four role shells and deliberate mobile composition", async ({ browser }) => {
  test.setTimeout(300000);
  const widths = [320, 360, 375, 390, 414, 430];

  for (const width of widths) {
    for (const role of roles) {
      const context = await browser.newContext({ viewport: { width, height: 844 } });
      const page = await context.newPage();
      await signIn(page, role);
      await page.evaluate(() => document.fonts.ready);

      await expect(page.locator(".ev2s-mobile-topbar")).toBeVisible();
      await expect(page.locator(".ev2s-mobile-nav")).toBeVisible();
      await expect(page.locator(".ev2s-sidebar")).toBeHidden();
      await expect(page.locator(".ev2s-topbar")).toBeHidden();

      const geometry = await page.evaluate(() => {
        const body = document.querySelector(".app-content .body");
        const nav = document.querySelector(".ev2s-mobile-nav");
        const topbar = document.querySelector(".ev2s-mobile-topbar");
        const navButtons = [...document.querySelectorAll(".ev2s-mobile-nav button")];
        const bodyRect = body?.getBoundingClientRect();
        return {
          documentOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          bodyOverflow: document.body.scrollWidth - document.body.clientWidth,
          bodyLeft: bodyRect?.left ?? 0,
          bodyRight: bodyRect ? bodyRect.right - window.innerWidth : 0,
          navRight: nav ? nav.getBoundingClientRect().right - window.innerWidth : 0,
          topbarRight: topbar ? topbar.getBoundingClientRect().right - window.innerWidth : 0,
          navCount: navButtons.length,
          minNavHeight: navButtons.length
            ? Math.min(...navButtons.map((button) => button.getBoundingClientRect().height))
            : 0,
        };
      });

      expect(geometry.documentOverflow, `${role.key} document overflow at ${width}px`).toBeLessThanOrEqual(1);
      expect(geometry.bodyOverflow, `${role.key} body overflow at ${width}px`).toBeLessThanOrEqual(1);
      expect(geometry.bodyLeft, `${role.key} body starts outside ${width}px`).toBeGreaterThanOrEqual(-1);
      expect(geometry.bodyRight, `${role.key} body ends outside ${width}px`).toBeLessThanOrEqual(1);
      expect(Math.abs(geometry.navRight), `${role.key} nav edge at ${width}px`).toBeLessThanOrEqual(1);
      expect(Math.abs(geometry.topbarRight), `${role.key} topbar edge at ${width}px`).toBeLessThanOrEqual(1);
      expect(geometry.navCount).toBe(role.key === "executive" ? 4 : 5);
      expect(geometry.minNavHeight, `${role.key} mobile nav touch floor at ${width}px`).toBeGreaterThanOrEqual(44);

      if (role.key === "administration") {
        const grids = page.locator(".adminv2-context-grid, .adminv2-support-grid");
        expect(await grids.count()).toBeGreaterThanOrEqual(3);
        const layouts = await grids.evaluateAll((nodes) => nodes.map((node) => ({
          display: getComputedStyle(node).display,
          columns: getComputedStyle(node).gridTemplateColumns,
          overflow: node.scrollWidth - node.clientWidth,
        })));
        for (const layout of layouts) {
          expect(layout.display).toBe("grid");
          expect(layout.columns.split(" ").filter(Boolean)).toHaveLength(1);
          expect(layout.overflow).toBeLessThanOrEqual(1);
        }
      }

      if (width === 320 || width === 430) {
        await page.screenshot({
          path: `test-artifacts/vf8a-${role.key}-phone-${width}.png`,
          fullPage: true,
        });
      }

      await context.close();
    }
  }
});


test("VF8B iPad 744–1133 and small-laptop matrix preserves desktop-style tablet shell and role overviews", async ({ browser }) => {
  test.setTimeout(300000);
  const viewports = [
    { name: "ipad-mini-744", width: 744, height: 900 },
    { name: "tablet-768", width: 768, height: 900 },
    { name: "tablet-820", width: 820, height: 900 },
    { name: "small-laptop-900", width: 900, height: 900 },
    { name: "small-laptop-980", width: 980, height: 820 },
    { name: "small-laptop-1024", width: 1024, height: 820 },
    { name: "ipad-landscape-1133", width: 1133, height: 820 },
  ];

  for (const viewport of viewports) {
    for (const role of roles) {
      const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
      const page = await context.newPage();
      await signIn(page, role);
      await page.evaluate(() => document.fonts.ready);

      const mobileShell = viewport.width <= 720;
      if (mobileShell) {
        await expect(page.locator(".ev2s-mobile-topbar")).toBeVisible();
        await expect(page.locator(".ev2s-mobile-nav")).toBeVisible();
        await expect(page.locator(".ev2s-sidebar")).toBeHidden();
        await expect(page.locator(".ev2s-topbar")).toBeHidden();
      } else {
        await expect(page.locator(".ev2s-sidebar")).toBeVisible();
        await expect(page.locator(".ev2s-topbar")).toBeVisible();
        await expect(page.locator(".ev2s-mobile-topbar")).toBeHidden();
        await expect(page.locator(".ev2s-mobile-nav")).toBeHidden();
      }

      const geometry = await page.evaluate(() => {
        const body = document.querySelector(".app-content .body");
        const workspace = document.querySelector(".ev2s-workspace");
        const side = document.querySelector(".ev2s-sidebar");
        const top = document.querySelector(".ev2s-topbar");
        const bodyRect = body?.getBoundingClientRect();
        const workspaceRect = workspace?.getBoundingClientRect();
        return {
          documentOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          bodyOverflow: document.body.scrollWidth - document.body.clientWidth,
          bodyLeft: bodyRect?.left ?? 0,
          bodyRight: bodyRect ? bodyRect.right - window.innerWidth : 0,
          workspaceRight: workspaceRect ? workspaceRect.right - window.innerWidth : 0,
          sidebarOverflow: side ? side.scrollWidth - side.clientWidth : 0,
          topbarOverflow: top ? top.scrollWidth - top.clientWidth : 0,
        };
      });

      expect(geometry.documentOverflow, `${role.key} document overflow at ${viewport.width}px`).toBeLessThanOrEqual(1);
      expect(geometry.bodyOverflow, `${role.key} body overflow at ${viewport.width}px`).toBeLessThanOrEqual(1);
      expect(geometry.bodyLeft, `${role.key} body starts outside ${viewport.width}px`).toBeGreaterThanOrEqual(-1);
      expect(geometry.bodyRight, `${role.key} body ends outside ${viewport.width}px`).toBeLessThanOrEqual(1);
      expect(geometry.workspaceRight, `${role.key} workspace ends outside ${viewport.width}px`).toBeLessThanOrEqual(1);
      expect(geometry.sidebarOverflow, `${role.key} sidebar overflow at ${viewport.width}px`).toBeLessThanOrEqual(1);
      expect(geometry.topbarOverflow, `${role.key} topbar overflow at ${viewport.width}px`).toBeLessThanOrEqual(1);

      if (mobileShell) {
        const navHeights = await page.locator(".ev2s-mobile-nav button").evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().height));
        expect(navHeights).toHaveLength(role.key === "executive" ? 4 : 5);
        expect(Math.min(...navHeights)).toBeGreaterThanOrEqual(44);
      } else {
        await expect(page.locator(".ev2s-sidebar-profile")).toBeVisible();
        const sideGeometry = await page.locator(".ev2s-sidebar").evaluate((node) => ({
          width: node.getBoundingClientRect().width,
          right: node.getBoundingClientRect().right,
        }));
        if (viewport.width <= 1023) {
          expect(sideGeometry.width, "compact tablet navigation").toBeGreaterThan(60);
          expect(sideGeometry.width, "compact tablet navigation").toBeLessThanOrEqual(90);
        } else {
          expect(sideGeometry.width, "standard laptop navigation").toBeGreaterThan(180);
        }
        expect(sideGeometry.right).toBeLessThanOrEqual(viewport.width);
      }

      // Use the established role readiness selector (Administration's key is
      // "administration", not "admin"); signIn already verifies this too.
      await expect(page.locator(role.ready).first()).toBeVisible();
      if ([744, 768, 1024, 1133].includes(viewport.width)) {
        await page.screenshot({
          path: `test-artifacts/vf8b-${role.key}-${viewport.name}.png`,
          fullPage: true,
        });
      }

      await context.close();
    }
  }
});


test("VF8C exact 1366×768 laptop matrix preserves all four role command surfaces", async ({ browser }) => {
  test.setTimeout(240000);
  const viewport = { width: 1366, height: 768 };

  for (const role of roles) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    await signIn(page, role);
    await page.evaluate(() => document.fonts.ready);

    await expect(page.locator(".ev2s-sidebar")).toBeVisible();
    await expect(page.locator(".ev2s-topbar")).toBeVisible();
    await expect(page.locator(".ev2s-mobile-topbar")).toBeHidden();
    await expect(page.locator(".ev2s-mobile-nav")).toBeHidden();
    await expect(page.locator(".ev2s-sidebar-profile")).toBeVisible();

    const geometry = await page.evaluate(() => {
      const body = document.querySelector(".app-content .body");
      const side = document.querySelector(".ev2s-sidebar");
      const top = document.querySelector(".ev2s-topbar");
      const workspace = document.querySelector(".ev2s-workspace");
      const profile = document.querySelector(".ev2s-sidebar-profile");
      const bodyRect = body?.getBoundingClientRect();
      const sideRect = side?.getBoundingClientRect();
      const topRect = top?.getBoundingClientRect();
      const workspaceRect = workspace?.getBoundingClientRect();
      const profileRect = profile?.getBoundingClientRect();
      return {
        documentOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        bodyOverflow: document.body.scrollWidth - document.body.clientWidth,
        sidebarOverflow: side ? side.scrollWidth - side.clientWidth : 0,
        topbarOverflow: top ? top.scrollWidth - top.clientWidth : 0,
        bodyRight: bodyRect ? bodyRect.right - window.innerWidth : 0,
        sidebarRight: sideRect?.right || 0,
        workspaceLeft: workspaceRect?.left || 0,
        topbarRight: topRect ? topRect.right - window.innerWidth : 0,
        profileBottom: profileRect?.bottom || 0,
        viewportHeight: window.innerHeight,
      };
    });

    expect(geometry.documentOverflow, `${role.key} 1366 document overflow`).toBeLessThanOrEqual(1);
    expect(geometry.bodyOverflow, `${role.key} 1366 body overflow`).toBeLessThanOrEqual(1);
    expect(geometry.sidebarOverflow, `${role.key} 1366 sidebar overflow`).toBeLessThanOrEqual(1);
    expect(geometry.topbarOverflow, `${role.key} 1366 topbar overflow`).toBeLessThanOrEqual(1);
    expect(geometry.bodyRight, `${role.key} 1366 body right edge`).toBeLessThanOrEqual(1);
    expect(Math.abs(geometry.topbarRight), `${role.key} 1366 topbar right edge`).toBeLessThanOrEqual(1);
    expect(Math.abs(geometry.sidebarRight - geometry.workspaceLeft), `${role.key} sidebar/workspace seam`).toBeLessThanOrEqual(1);
    expect(geometry.profileBottom, `${role.key} profile chrome below viewport`).toBeLessThanOrEqual(geometry.viewportHeight + 1);

    await page.screenshot({
      path: `test-artifacts/vf8c-${role.key}-laptop-1366x768.png`,
      fullPage: true,
    });
    await context.close();
  }
});


test("VF8D 1440×900+ desktop matrix preserves role hierarchy and bounded working measure", async ({ browser }) => {
  test.setTimeout(300000);
  const viewports = [
    { name: "desktop-1440x900", width: 1440, height: 900, capture: true },
    { name: "wide-1600x900", width: 1600, height: 900, capture: false },
  ];

  for (const viewport of viewports) {
    for (const role of roles) {
      const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
      const page = await context.newPage();
      await signIn(page, role);
      await page.evaluate(() => document.fonts.ready);

      await expect(page.locator(".ev2s-sidebar")).toBeVisible();
      await expect(page.locator(".ev2s-topbar")).toBeVisible();
      await expect(page.locator(".ev2s-mobile-topbar")).toBeHidden();
      await expect(page.locator(".ev2s-mobile-nav")).toBeHidden();
      await expect(page.locator(".ev2s-sidebar-profile")).toBeVisible();

      const geometry = await page.evaluate(() => {
        const body = document.querySelector(".app-content .body");
        const side = document.querySelector(".ev2s-sidebar");
        const top = document.querySelector(".ev2s-topbar");
        const workspace = document.querySelector(".ev2s-workspace");
        const bodyRect = body?.getBoundingClientRect();
        const sideRect = side?.getBoundingClientRect();
        const topRect = top?.getBoundingClientRect();
        const workspaceRect = workspace?.getBoundingClientRect();
        return {
          documentOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          bodyOverflow: document.body.scrollWidth - document.body.clientWidth,
          sidebarOverflow: side ? side.scrollWidth - side.clientWidth : 0,
          topbarOverflow: top ? top.scrollWidth - top.clientWidth : 0,
          bodyWidth: bodyRect?.width || 0,
          bodyLeft: bodyRect?.left || 0,
          bodyRight: bodyRect ? bodyRect.right - window.innerWidth : 0,
          sidebarRight: sideRect?.right || 0,
          workspaceLeft: workspaceRect?.left || 0,
          workspaceRight: workspaceRect ? workspaceRect.right - window.innerWidth : 0,
          topbarRight: topRect ? topRect.right - window.innerWidth : 0,
        };
      });

      expect(geometry.documentOverflow, `${role.key} ${viewport.width} document overflow`).toBeLessThanOrEqual(1);
      expect(geometry.bodyOverflow, `${role.key} ${viewport.width} body overflow`).toBeLessThanOrEqual(1);
      expect(geometry.sidebarOverflow, `${role.key} ${viewport.width} sidebar overflow`).toBeLessThanOrEqual(1);
      expect(geometry.topbarOverflow, `${role.key} ${viewport.width} topbar overflow`).toBeLessThanOrEqual(1);
      expect(geometry.bodyWidth, `${role.key} ${viewport.width} unbounded body measure`).toBeLessThanOrEqual(1281);
      expect(geometry.bodyLeft, `${role.key} ${viewport.width} body starts before workspace`).toBeGreaterThanOrEqual(geometry.workspaceLeft - 1);
      expect(geometry.bodyRight, `${role.key} ${viewport.width} body ends beyond viewport`).toBeLessThanOrEqual(1);
      expect(geometry.workspaceRight, `${role.key} ${viewport.width} workspace ends beyond viewport`).toBeLessThanOrEqual(1);
      expect(Math.abs(geometry.topbarRight), `${role.key} ${viewport.width} topbar right edge`).toBeLessThanOrEqual(1);
      expect(Math.abs(geometry.sidebarRight - geometry.workspaceLeft), `${role.key} ${viewport.width} sidebar/workspace seam`).toBeLessThanOrEqual(1);

      if (viewport.capture) {
        await page.screenshot({
          path: `test-artifacts/vf8d-${role.key}-desktop-1440x900.png`,
          fullPage: true,
        });
      }
      await context.close();
    }
  }
});

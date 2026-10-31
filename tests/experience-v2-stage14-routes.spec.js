import { expect, test } from "@playwright/test";

const password = process.env.ROLE_FIXTURE_PASSWORD;

const VIEWPORTS = [
  { name:"phone-320", width:320, height:844 },
  { name:"phone-360", width:360, height:800 },
  { name:"phone-375", width:375, height:812 },
  { name:"phone-390", width:390, height:844 },
  { name:"phone-414", width:414, height:896 },
  { name:"phone-430", width:430, height:932 },
  { name:"intermediate-900", width:900, height:900 },
  { name:"laptop-1366", width:1366, height:768 },
  { name:"desktop-1440", width:1440, height:900 },
];

const ROLES = [
  {
    key:"staff",
    email:"staff@ceac.local.test",
    app:".staff-app",
    routes:[
      { key:"home", label:"Today", mobileLabel:"Home" },
      { key:"work", label:"Work" },
      { key:"team", label:"Team" },
      { key:"staff-calendar", label:"Calendar" },
      { key:"messages", label:"Messages" },
      { key:"me", label:"My Hub", mobileLabel:"Me" },
      { key:"account", label:"Your account" },
    ],
  },
  {
    key:"manager",
    email:"manager@ceac.local.test",
    app:".manager-app",
    routes:[
      { key:"home", label:"Overview", mobileLabel:"Home" },
      { key:"work", label:"Work" },
      { key:"team", label:"Team" },
      { key:"projects", label:"Projects" },
      { key:"calendar", label:"Calendar" },
      { key:"manager-finance", label:"Finance" },
      { key:"manager-reports", label:"Reports" },
      { key:"messages", label:"Messages" },
      { key:"me", label:"My Hub" },
      { key:"account", label:"Your account" },
    ],
  },
  {
    key:"admin",
    email:"admin@ceac.local.test",
    app:".office-app",
    routes:[
      { key:"home", label:"Overview", mobileLabel:"Home" },
      { key:"people", label:"People & Access" },
      { key:"work", label:"Work" },
      { key:"attendance", label:"Time & Leave" },
      { key:"finance", label:"Finance" },
      { key:"reporting", label:"Reports" },
      { key:"settings", label:"Control Center" },
      { key:"messages", label:"Messages" },
      { key:"me", label:"My Hub" },
      { key:"account", label:"Your account" },
    ],
  },
  {
    key:"executive",
    email:"exec@ceac.local.test",
    app:".executive-app",
    routes:[
      { key:"home", label:"Overview", mobileLabel:"Home" },
      { key:"work", label:"Work" },
      { key:"strategy", label:"Priorities" },
      { key:"exec-projects", label:"Projects" },
      { key:"exec-organisation", label:"Organisation" },
      { key:"exec-finance", label:"Finance" },
      { key:"exec-reports", label:"Reports" },
      { key:"messages", label:"Messages" },
      { key:"me", label:"My Hub" },
      { key:"account", label:"Account" },
    ],
  },
];

async function signIn(browser, role, viewport) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  await page.goto("/");
  await page.getByPlaceholder("Work email").fill(role.email);
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button", { name:"Sign in" }).click();
  await expect(page.locator(role.app)).toBeVisible({ timeout:15000 });
  return { context, page };
}

async function routeKey(page) {
  return page.evaluate(() => new URL(window.location.href).searchParams.get("tab") || "home");
}

async function expectNoPageOverflow(page, role, viewport, route) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  expect(
    overflow,
    `${role.key} ${route.key} overflowed ${viewport.name}`
  ).toBeLessThanOrEqual(1);
}

async function expectBoundedInnerScrolling(page, role, viewport, route) {
  const offenders = await page.evaluate(() => {
    const width = document.documentElement.clientWidth;
    return [...document.querySelectorAll("*")]
      .filter((element) => {
        const style = getComputedStyle(element);
        const canScrollX = /(auto|scroll)/.test(style.overflowX);
        return canScrollX && element.scrollWidth > element.clientWidth + 1;
      })
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          tag: element.tagName,
          className: typeof element.className === "string" ? element.className : "",
          left: rect.left,
          right: rect.right,
          width,
        };
      })
      .filter((item) => item.left < -1 || item.right > item.width + 1);
  });

  expect(
    offenders,
    `${role.key} ${route.key} has an intentionally scrollable control escaping the viewport at ${viewport.name}`
  ).toEqual([]);
}

async function navigateDesktop(page, route) {
  const nav = page.locator(".ev2s-sidebar-nav");
  const button = nav.getByRole("button", { name:route.label, exact:true });
  await expect(button).toBeVisible();
  await button.click();
  await expect(button).toHaveAttribute("aria-current", "page");
}

async function navigateMobile(page, route) {
  const nav = page.locator(".ev2s-mobile-nav");
  await expect(nav).toBeVisible();

  const direct = nav.getByRole("button", {
    name:route.mobileLabel || route.label,
    exact:true,
  });

  if (await direct.count()) {
    await direct.click();
    await expect(direct).toHaveAttribute("aria-current", "page");
    return;
  }

  const more = nav.getByRole("button", { name:"More", exact:true });
  await more.click();
  const drawer = page.getByRole("dialog", { name:"More" });
  await expect(drawer).toBeVisible();
  const target = drawer.getByRole("button", { name:route.label, exact:true });
  await expect(target).toBeVisible();
  await target.click();
  await expect(drawer).toBeHidden();
  await expect(more).toHaveClass(/is-active/);
}

async function navigate(page, role, route, viewport) {
  if (viewport.width >= 900) await navigateDesktop(page, route);
  else await navigateMobile(page, route);

  await expect.poll(() => routeKey(page)).toBe(route.key);
  await expect(page.locator(role.app)).toBeVisible();
  await expect(page.locator(route.key === "messages" ? ".app-content .msg-workspace" : ".app-content .body").first()).toBeVisible();
  await expect(page.locator(".auth-shell")).toHaveCount(0);

  if (viewport.width >= 900) {
    await expect(page.locator(".ev2s-sidebar")).toBeVisible();
    await expect(page.locator(".ev2s-mobile-nav")).toBeHidden();
  } else {
    await expect(page.locator(".ev2s-mobile-nav")).toBeVisible();
  }

  await page.waitForTimeout(80);
  await expectNoPageOverflow(page, role, viewport, route);
  await expectBoundedInnerScrolling(page, role, viewport, route);
}

test("Stage 14B route matrix mirrors the accepted shell destination contract", async () => {
  expect(ROLES.find((role)=>role.key==="staff").routes.map((r)=>r.key)).toEqual([
    "home","work","team","staff-calendar","messages","me","account",
  ]);
  expect(ROLES.find((role)=>role.key==="manager").routes.map((r)=>r.key)).toEqual([
    "home","work","team","projects","calendar","manager-finance","manager-reports","messages","me","account",
  ]);
  expect(ROLES.find((role)=>role.key==="admin").routes.map((r)=>r.key)).toEqual([
    "home","people","work","attendance","finance","reporting","settings","messages","me","account",
  ]);
  expect(ROLES.find((role)=>role.key==="executive").routes.map((r)=>r.key)).toEqual([
    "home","work","strategy","exec-projects","exec-organisation","exec-finance","exec-reports","messages","me","account",
  ]);
});

for (const role of ROLES) {
  for (const viewport of VIEWPORTS) {
    test(`Stage 14B ${role.key} shell routes compose at ${viewport.name}`, async ({ browser }) => {
      test.setTimeout(120000);
      const { context, page } = await signIn(browser, role, viewport);

      for (const route of role.routes) {
        await navigate(page, role, route, viewport);
      }

      if (["phone-390","intermediate-900","laptop-1366","desktop-1440"].includes(viewport.name)) {
        await navigate(page, role, role.routes[0], viewport);
        await page.screenshot({
          path:`test-artifacts/redesign-r7-stage14b-${role.key}-${viewport.name}.png`,
          fullPage:true,
        });
      }

      await context.close();
    });
  }
}

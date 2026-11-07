import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

const password = process.env.ROLE_FIXTURE_PASSWORD;
const unitA = "20000000-0000-4000-8000-000000000011";

async function signInManager(page, viewport = { width: 1366, height: 768 }) {
  await page.setViewportSize(viewport);
  await page.goto("/");
  await page.getByPlaceholder("Work email").fill("manager@ceac.local.test");
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.locator(".manager-app")).toBeVisible({ timeout: 15000 });
}

test("VF7A route continuity uses the accepted motion vocabulary without changing routing", async () => {
  const route = readFileSync("src/experience-v2/RouteTransition.jsx", "utf8");
  const app = readFileSync("src/App.jsx", "utf8");
  const shell = readFileSync("src/experience-v2/shell/shell.css", "utf8");

  expect(route).toContain('from "motion/react"');
  expect(route).not.toContain("AnimatePresence");
  expect(route).toContain("useReducedMotion");
  expect(route).toContain("EV2_TRANSITIONS.fast");
  expect(route).toContain("key={routeKey}");
  expect(route).not.toMatch(/duration:\s*0\.[0-9]+/);

  for (const key of ["item:", "project:", "person:", "room:", "meeting:", "tab:"]) {
    expect(app).toContain(key);
  }
  expect(app).toContain("<RouteTransition routeKey={routeTransitionKey}>");
  expect(shell).toContain(".ev2-route-transition");
  expect(shell).not.toContain(".ev2-route-transition *");
});

test("VF7A preserves destination and Room URL/back context on the live shell", async ({ page }) => {
  await signInManager(page);

  const homeTransition = page.locator('.ev2-route-transition[data-route-key="tab:home"]');
  await expect(homeTransition).toBeVisible();

  await page.locator(".ev2s-sidebar").getByRole("button", { name: "Projects", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Projects", exact: true })).toBeVisible();
  await expect(page.locator('.ev2-route-transition[data-route-key="tab:projects"]')).toBeVisible();
  expect(new URL(page.url()).searchParams.get("tab")).toBe("projects");

  // A destination must mount without waiting for the previous heavy screen's exit.
  await page.locator(".ev2s-sidebar").getByRole("button",{name:"Messages",exact:true}).click();
  await expect(page.locator(".msg-workspace")).toBeVisible({timeout:10000});
  await expect(page.locator('.ev2-route-transition[data-route-key="tab:messages"]')).toBeVisible();
  expect(new URL(page.url()).searchParams.get("tab")).toBe("messages");

  await page.goto(`/?tab=messages&roomKind=unit&room=${unitA}`);
  await expect(page.locator(".room-screen")).toBeVisible({ timeout: 15000 });
  await expect(page.locator(`.ev2-route-transition[data-route-key="room:unit:${unitA}"]`)).toBeVisible();
  expect(new URL(page.url()).searchParams.get("roomKind")).toBe("unit");
  expect(new URL(page.url()).searchParams.get("room")).toBe(unitA);

  await page.locator(".room-back").click();
  await expect(page.locator(".room-screen")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Messages", exact: true })).toBeVisible();
  await expect(page.locator('.ev2-route-transition[data-route-key="tab:messages"]')).toBeVisible();
  expect(new URL(page.url()).searchParams.has("roomKind")).toBe(false);
  expect(new URL(page.url()).searchParams.has("room")).toBe(false);

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);

  await page.screenshot({ path: "test-artifacts/vf7a-route-context-laptop-1366.png", fullPage: true });
});


test("VF7B legacy Sheet shares the semantic motion vocabulary and touch floor", async () => {
  const bits = readFileSync("src/components/bits.jsx", "utf8");
  const styles = readFileSync("src/styles.css", "utf8");

  expect(bits).toContain('AnimatePresence, motion, useReducedMotion');
  expect(bits).toContain('EV2_TRANSITIONS');
  expect(bits).toContain('EV2_TRANSITIONS.fast');
  expect(bits).toContain('EV2_TRANSITIONS.panel');
  expect(bits).toContain('onExitComplete');
  expect(bits).toContain('requestClose');
  expect(bits).not.toMatch(/duration:\s*0\.[0-9]+/);

  expect(styles).not.toContain("ev2-sheet-backdrop-in");
  expect(styles).not.toContain("ev2-sheet-surface-in");
  expect(styles).toContain(".sheet-close{position:absolute;top:10px;right:12px;width:44px;height:44px");
});

for (const viewport of [
  { name: "phone-390", width: 390, height: 844 },
  { name: "laptop-1366", width: 1366, height: 768 },
]) {
  test(`VF7B Sheet and operational details preserve focused-work semantics at ${viewport.name}`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
    const page = await context.newPage();
    await page.goto("/");
    await page.getByPlaceholder("Work email").fill("manager@ceac.local.test");
    await page.getByPlaceholder("Password").fill(password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.locator(".manager-app")).toBeVisible({ timeout: 15000 });

    await page.goto("/?tab=calendar");
    const calendar = page.locator(".ev2cal-manager-page");
    await expect(calendar).toBeVisible({ timeout: 15000 });
    const trigger = calendar.getByRole("button", { name: /^Filter/ });
    await expect(trigger).toBeVisible();
    await trigger.click();

    const sheet = page.getByRole("dialog");
    await expect(sheet).toBeVisible();
    await expect(sheet).toHaveCSS("opacity", "1");
    await expect(sheet).toHaveCSS("transform", "none");
    const close = sheet.getByRole("button", { name: "Close", exact: true });
    const closeBox = await close.boundingBox();
    expect(closeBox?.width || 0).toBeGreaterThanOrEqual(44);
    expect(closeBox?.height || 0).toBeGreaterThanOrEqual(44);
    await expect(sheet).toHaveCSS("opacity", "1");

    const pageOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(pageOverflow).toBeLessThanOrEqual(1);

    await page.screenshot({
      path: `test-artifacts/vf7b-manager-calendar-sheet-${viewport.name}.png`,
      fullPage: false,
    });

    await page.keyboard.press("Escape");
    await expect(sheet).toHaveCount(0);
    await expect(trigger).toBeFocused();

    await page.goto("/?tab=manager-finance");
    const finance = page.locator(".ev2-finance-manager");
    await expect(finance).toBeVisible({ timeout: 15000 });
    const summaries = finance.locator("details.finance-section > summary");
    await expect(summaries.first()).toBeVisible({ timeout: 15000 });
    expect(await summaries.count()).toBeGreaterThan(0);
    const heights = await summaries.evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().height));
    expect(Math.min(...heights)).toBeGreaterThanOrEqual(44);

    await context.close();
  });
}


test("VF7C feedback primitives use live-region semantics and the shared reduced-motion vocabulary", async () => {
  const bits = readFileSync("src/components/bits.jsx", "utf8");
  const interactions = readFileSync("src/experience-v2/components/Interactions.jsx", "utf8");

  expect(bits).toContain("export function ProductNotice");
  expect(bits).toContain("useReducedMotion");
  expect(bits).toContain("EV2_TRANSITIONS.fast");
  expect(bits).toContain('role={tone === "error" ? "alert" : "status"}');
  expect(bits).toContain('aria-live={tone === "error" ? "assertive" : "polite"}');
  expect(bits).toContain('aria-atomic="true"');

  expect(interactions).toContain("export function Toast");
  expect(interactions).toContain("useReducedMotion");
  expect(interactions).toContain("EV2_TRANSITIONS.panel");
  expect(interactions).toContain('role={tone === "danger" ? "alert" : "status"}');
  expect(interactions).toContain('aria-live={tone === "danger" ? "assertive" : "polite"}');
  expect(interactions).toContain('aria-atomic="true"');
  expect(interactions).not.toMatch(/duration:\s*0\.[0-9]+/);
});

test("VF7C operational error and success feedback remain explicit and non-blocking", async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  await page.goto("/");
  await page.getByPlaceholder("Work email").fill("manager@ceac.local.test");
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.locator(".manager-app")).toBeVisible({ timeout: 15000 });

  let failBudgets = true;
  await page.route("**/rest/v1/budgets*", async (route) => {
    if (failBudgets && route.request().method() === "GET") {
      failBudgets = false;
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ message: "fixture finance read failed" }),
      });
      return;
    }
    await route.continue();
  });

  await page.goto("/?tab=manager-finance");
  const errorNotice = page.locator(".product-notice[role='alert']").first();
  await expect(errorNotice).toBeVisible({ timeout: 15000 });
  await expect(errorNotice).toHaveAttribute("aria-live", "assertive");
  await expect(errorNotice).toHaveCSS("opacity", "1");

  await page.unroute("**/rest/v1/budgets*");
  await page.goto("/?tab=manager-finance");
  await expect(page.locator(".ev2-finance-manager")).toBeVisible({ timeout: 15000 });

  await page.route("**/rest/v1/finance_requests*", async (route) => {
    if (route.request().method() === "POST") {
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
      return;
    }
    await route.continue();
  });

  const trigger = page.getByRole("button", { name: "Request funds", exact: true });
  await trigger.click();
  const sheet = page.getByRole("dialog");
  await expect(sheet).toBeVisible();
  await sheet.getByPlaceholder("Short request title").fill("VF7C fixture request");
  await sheet.getByPlaceholder("e.g. 850.00").fill("25.00");
  await sheet.getByRole("button", { name: "Submit request", exact: true }).click();

  const successNotice = page.locator(".product-notice[role='status']").filter({
    hasText: "Finance request updated",
  });
  await expect(successNotice).toBeVisible({ timeout: 15000 });
  await expect(successNotice).toHaveAttribute("aria-live", "polite");
  await expect(successNotice).toHaveCSS("opacity", "1");
  await expect(page.locator(".sheet[role='dialog']")).toHaveCount(0);

  const overflow = await page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  expect(overflow).toBeLessThanOrEqual(1);

  await page.screenshot({
    path: "test-artifacts/vf7c-manager-finance-success-phone-390.png",
    fullPage: true,
  });

  await context.close();
});


test("VF7D reduced-motion contract is explicit across the accepted interaction layer", async () => {
  const provider = readFileSync("src/experience-v2/ExperienceV2MotionProvider.jsx", "utf8");
  const route = readFileSync("src/experience-v2/RouteTransition.jsx", "utf8");
  const calendar = readFileSync("src/experience-v2/calendar/CalendarFamilyV2.jsx", "utf8");
  const disclosure = readFileSync("src/experience-v2/components/MotionDisclosure.jsx", "utf8");
  const bits = readFileSync("src/components/bits.jsx", "utf8");
  const interactions = readFileSync("src/experience-v2/components/Interactions.jsx", "utf8");
  const foundation = readFileSync("src/experience-v2.css", "utf8");
  const premium = readFileSync("src/premium.css", "utf8");
  const room = readFileSync("src/screens/Room.jsx", "utf8");

  expect(provider).toContain('reducedMotion="user"');
  for (const source of [route, calendar, disclosure, bits]) {
    expect(source).toContain("useReducedMotion");
  }
  expect(interactions).toContain("useReducedMotion");
  expect(interactions).toContain("export function Toast");
  expect(room).toContain("useReducedMotion");
  expect(room).toContain('behavior: reduceMotion ? "auto" : "smooth"');
  expect(foundation).toContain("@media (prefers-reduced-motion: reduce)");
  expect(foundation).toContain("--ev2-duration-fast: 0ms");
  expect(foundation).toContain("--ev2-duration-surface: 0ms");
  expect(premium).toContain("@media (prefers-reduced-motion: reduce)");
});

for (const viewport of [
  { name: "phone-390", width: 390, height: 844 },
  { name: "laptop-1366", width: 1366, height: 768 },
]) {
  test(`VF7D reduced motion preserves destination, Calendar and Sheet state at ${viewport.name}`, async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    await page.goto("/");
    await page.getByPlaceholder("Work email").fill("manager@ceac.local.test");
    await page.getByPlaceholder("Password").fill(password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.locator(".manager-app")).toBeVisible({ timeout: 15000 });

    expect(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches)).toBe(true);

    await page.goto("/?tab=projects");
    const projectRoute = page.locator('.ev2-route-transition[data-route-key="tab:projects"]');
    await expect(projectRoute).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole("heading", { name: "Projects", exact: true })).toBeVisible();
    await expect(projectRoute).toHaveCSS("opacity", "1");

    await page.goto("/?tab=calendar");
    const calendar = page.locator(".ev2cal-manager-page");
    await expect(calendar).toBeVisible({ timeout: 15000 });

    const periodLabel = calendar.locator(".ev2cal-period-label");
    const before = (await periodLabel.innerText()).trim();
    await calendar.getByRole("button", { name: "Next period", exact: true }).click();
    await expect.poll(async () => (await periodLabel.innerText()).trim()).not.toBe(before);

    const day = calendar.locator(".ev2cal-day-button").nth(8);
    await day.click();
    await expect(day).toHaveAttribute("aria-pressed", "true");
    await expect(day.locator(".ev2cal-selection-indicator")).toBeVisible();

    const trigger = calendar.getByRole("button", { name: /^Filter/ }).first();
    await trigger.click();
    const sheet = page.getByRole("dialog");
    await expect(sheet).toBeVisible();
    await expect(sheet).toHaveCSS("opacity", "1");
    await page.keyboard.press("Escape");
    await expect(sheet).toHaveCount(0);
    await expect(trigger).toBeFocused();

    const overflow = await page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow).toBeLessThanOrEqual(1);

    await page.screenshot({
      path: `test-artifacts/vf7d-reduced-motion-manager-calendar-${viewport.name}.png`,
      fullPage: true,
    });

    await context.close();
  });
}

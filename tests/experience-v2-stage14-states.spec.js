// Stage 14C cumulative acceptance boundary: preserve accepted family evidence and add only proven whole-system gaps.
import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

const password = process.env.ROLE_FIXTURE_PASSWORD;

async function signIn(browser, {
  email = "staff@ceac.local.test",
  app = ".staff-app",
  viewport = { width: 390, height: 844 },
  contextOptions = {},
} = {}) {
  const context = await browser.newContext({ viewport, ...contextOptions });
  const page = await context.newPage();
  await page.goto("/");
  await page.getByPlaceholder("Work email").fill(email);
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.locator(app)).toBeVisible({ timeout: 15000 });
  return { context, page };
}

async function expectNoPageOverflow(page, label) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  expect(overflow, label).toBeLessThanOrEqual(1);
}

test("Stage 14C inventories accepted state and interaction coverage before adding gaps", async () => {
  const personal = readFileSync("tests/experience-v2-personal-family.spec.js", "utf8");
  const interactions = readFileSync("tests/experience-v2-interactions.spec.js", "utf8");
  const shell = readFileSync("tests/experience-v2-shell-responsive.spec.js", "utf8");
  const people = readFileSync("tests/experience-v2-people-family.spec.js", "utf8");
  const acceptance = readFileSync("tests/acceptance-core.spec.js", "utf8");
  const routes = readFileSync("tests/experience-v2-stage14-routes.spec.js", "utf8");

  // Populated shell/route rendering remains the accepted 14B responsibility.
  expect(routes).toContain(".app-content .body");
  expect(routes).toContain("staff@ceac.local.test");
  expect(routes).toContain("manager@ceac.local.test");
  expect(routes).toContain("admin@ceac.local.test");
  expect(routes).toContain("exec@ceac.local.test");

  // Empty and error stay distinct on a real account surface.
  expect(personal).toContain("keeps a sessions read failure distinct from a truthful empty account");
  expect(personal).toContain("keeps an activity read failure distinct from a truthful empty audit trail");

  // Partial/unconfigured and permission-limited states are already deterministic.
  expect(personal).toContain("Confirm CEAC’s leave rules before assigning entitlements.");
  expect(personal).toContain("Administration cannot be reached from ordinary Staff or Manager roles");

  // Completed/success evidence and destructive/reversal confirmation already exist in the
  // accepted end-to-end suite and are not duplicated here.
  expect(acceptance).toContain("Module completion recorded.");
  expect(acceptance).toContain("Completed");
  expect(acceptance).toContain('page.once("dialog"');

  // Existing accepted interaction contracts remain part of the cumulative Stage 14 evidence.
  expect(interactions).toContain('page.keyboard.press("Escape")');
  expect(interactions).toContain("confirmation can be dismissed safely");
  expect(shell).toContain("long identity strings cannot widen shell chrome");
  expect(shell).toContain('page.keyboard.press("Control+K")');
  expect(shell).toContain("mobile touch target");
  expect(people).toContain("touchTargets");
});

test("Stage 14C renders loading explicitly rather than presenting an empty My Hub", async ({ browser }) => {
  const { context, page } = await signIn(browser);

  let releaseGoals;
  const goalGate = new Promise((resolve) => { releaseGoals = resolve; });
  let intercepted = false;

  await page.route("**/rest/v1/personal_goals*", async (route) => {
    intercepted = true;
    await goalGate;
    await route.continue();
  });

  await page.goto("/?tab=me", { waitUntil: "domcontentloaded" });

  const loading = page.getByLabel("Loading My Hub");
  await expect(loading).toBeVisible({ timeout: 10000 });
  await expect(loading).toHaveAttribute("aria-busy", "true");
  await expect(page.locator(".ev2pf-empty")).toHaveCount(0);
  await expect.poll(() => intercepted).toBe(true);
  await expectNoPageOverflow(page, "My Hub loading state overflowed the phone viewport");

  await page.screenshot({
    path: "test-artifacts/redesign-r7-stage14c-loading-staff-phone-390.png",
    fullPage: true,
  });

  releaseGoals();
  await expect(loading).toHaveCount(0, { timeout: 15000 });
  await expect(page.getByRole("heading", { name: "My Hub", exact: true })).toBeVisible();

  await context.close();
});

test("Stage 14C long content recomposes on a 320px product surface without page overflow", async ({ browser }) => {
  const { context, page } = await signIn(browser, {
    viewport: { width: 320, height: 844 },
  });

  const heading = page.locator(".staffv2-intro h1");
  await expect(heading).toBeVisible();
  await expect(heading).toHaveText(/Good (morning|afternoon|evening), Staff/);

  await heading.evaluate((node) => {
    node.textContent =
      "Good afternoon, A Deliberately Very Long CEAC Team Member Name That Must Recompose Without Widening The Product Surface";
  });

  await expectNoPageOverflow(page, "Long Staff Today heading widened the 320px page");

  const geometry = await heading.evaluate((node) => {
    const rect = node.getBoundingClientRect();
    return {
      left: rect.left,
      right: rect.right,
      viewport: document.documentElement.clientWidth,
      whiteSpace: getComputedStyle(node).whiteSpace,
    };
  });

  expect(geometry.left).toBeGreaterThanOrEqual(-1);
  expect(geometry.right).toBeLessThanOrEqual(geometry.viewport + 1);
  expect(geometry.whiteSpace).not.toBe("nowrap");

  await page.screenshot({
    path: "test-artifacts/redesign-r7-stage14c-long-content-staff-phone-320.png",
    fullPage: true,
  });

  await context.close();
});

test("Stage 14C keyboard and touch expose the same authorised Staff Calendar destination", async ({ browser }) => {
  const touch = await signIn(browser, {
    viewport: { width: 390, height: 844 },
    contextOptions: { hasTouch: true },
  });

  const touchMore = touch.page.locator(".ev2s-mobile-nav").getByRole("button", { name: "More", exact: true });
  await touchMore.tap();
  const touchDrawer = touch.page.getByRole("dialog", { name: "More" });
  await expect(touchDrawer).toBeVisible();
  await touchDrawer.getByRole("button", { name: "Calendar", exact: true }).tap();
  await expect.poll(() => new URL(touch.page.url()).searchParams.get("tab")).toBe("staff-calendar");
  await expectNoPageOverflow(touch.page, "Touch Calendar navigation overflowed the phone viewport");
  await touch.context.close();

  const keyboard = await signIn(browser, {
    viewport: { width: 390, height: 844 },
  });

  const keyboardMore = keyboard.page.locator(".ev2s-mobile-nav").getByRole("button", { name: "More", exact: true });
  await keyboardMore.focus();
  await keyboard.page.keyboard.press("Enter");
  const keyboardDrawer = keyboard.page.getByRole("dialog", { name: "More" });
  await expect(keyboardDrawer).toBeVisible();
  const calendar = keyboardDrawer.getByRole("button", { name: "Calendar", exact: true });
  await calendar.focus();
  await keyboard.page.keyboard.press("Enter");
  await expect.poll(() => new URL(keyboard.page.url()).searchParams.get("tab")).toBe("staff-calendar");
  await expectNoPageOverflow(keyboard.page, "Keyboard Calendar navigation overflowed the phone viewport");
  await keyboard.context.close();
});

test("Stage 14C destructive global sign-out requires confirmation and cancellation preserves the session", async ({ browser }) => {
  const { context, page } = await signIn(browser);

  await page.goto("/?tab=account");
  await expect(page.getByRole("heading", { name: "Your account", exact: true })).toBeVisible();

  let confirmationSeen = false;
  page.once("dialog", async (dialog) => {
    confirmationSeen = true;
    expect(dialog.type()).toBe("confirm");
    expect(dialog.message()).toContain("Sign out on every device");
    await dialog.dismiss();
  });

  await page.getByRole("button", { name: "Sign out on every device", exact: true }).click();
  await expect.poll(() => confirmationSeen).toBe(true);
  await expect(page.locator(".staff-app")).toBeVisible();
  await expect(page.locator(".auth-shell")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Your account", exact: true })).toBeVisible();

  await context.close();
});

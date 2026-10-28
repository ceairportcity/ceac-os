import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

const password = process.env.ROLE_FIXTURE_PASSWORD;

async function login(browser, email, app, viewport, reducedMotion = "no-preference") {
  const context = await browser.newContext({ viewport, reducedMotion });
  const page = await context.newPage();
  await page.goto("/");
  await page.getByPlaceholder("Work email").fill(email);
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button", { name:"Sign in" }).click();
  await expect(page.locator(app)).toBeVisible({ timeout:15000 });
  return { context, page };
}

async function expectNoPageOverflow(page, label) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, `${label} has page-level horizontal overflow`).toBeLessThanOrEqual(1);
}

test("Stage 12B keeps one ratified motion system with reduced-motion support", async () => {
  const pkg = JSON.parse(readFileSync("package.json", "utf8"));
  const main = readFileSync("src/main.jsx", "utf8");
  const provider = readFileSync("src/experience-v2/ExperienceV2MotionProvider.jsx", "utf8");
  const motionContract = readFileSync("src/experience-v2/motion.js", "utf8");
  const foundation = readFileSync("src/experience-v2.css", "utf8");
  const segmented = readFileSync("src/experience-v2/components/SegmentedControl.jsx", "utf8");
  const disclosure = readFileSync("src/experience-v2/components/MotionDisclosure.jsx", "utf8");
  const calendar = readFileSync("src/experience-v2/calendar/CalendarFamilyV2.jsx", "utf8");
  const componentsCss = readFileSync("src/experience-v2/components/components.css", "utf8");
  const calendarCss = readFileSync("src/experience-v2/calendar/calendar.css", "utf8");

  expect(pkg.dependencies.motion).toBeTruthy();
  expect(main).toContain("ExperienceV2MotionProvider");
  expect(provider).toContain('reducedMotion="user"');
  expect(motionContract).toContain("EV2_TRANSITIONS");
  expect(motionContract).toContain("reflow");
  expect(foundation).toContain("@media (prefers-reduced-motion: reduce)");
  expect(foundation).toContain("--ev2-duration-complex: 0ms");

  expect(segmented).toContain("layoutId");
  expect(segmented).toContain("ev2c-segmented-indicator");
  expect(segmented).toContain("EV2_TRANSITIONS.reflow");

  expect(disclosure).toContain("useReducedMotion");
  expect(disclosure).toContain('height: "auto"');
  expect(disclosure).toContain("AnimatePresence");

  expect(calendar).toContain("ev2cal-selection-indicator");
  expect(calendar).toContain("ev2cal-period-label");
  expect(calendar).toContain("useReducedMotion");

  expect(componentsCss).not.toContain("!important");
  expect(calendarCss).not.toContain("!important");
});

test("Stage 12B shared selection and disclosure motion work in the protected proof", async ({ browser }) => {
  const { context, page } = await login(
    browser,
    "admin@ceac.local.test",
    ".office-app",
    { width:390, height:844 },
  );
  await page.goto("/?tab=primitives");

  const segmented = page.getByRole("tablist", { name:"Reference component state" });
  await expect(segmented).toBeVisible();
  await expect(segmented.locator(".ev2c-segmented-indicator")).toHaveCount(1);

  const waiting = segmented.getByRole("tab", { name:"Waiting", exact:true });
  await waiting.focus();
  await expect(waiting).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(waiting).toHaveAttribute("aria-selected", "true");
  await expect(waiting.locator(".ev2c-segmented-indicator")).toHaveCount(1);

  const trigger = page.getByRole("button", { name:/Reference state compact/ });
  await trigger.click();
  const expandedTrigger = page.getByRole("button", { name:/Reference state expanded/ });
  await expect(expandedTrigger).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByLabel("Reference motion detail")).toBeVisible();

  await expandedTrigger.click();
  await expect(page.getByLabel("Reference motion detail")).toHaveCount(0);

  await expectNoPageOverflow(page, "Stage 12B phone proof");
  await page.screenshot({
    path:"test-artifacts/redesign-r7-stage12b-motion-proof-phone-390.png",
    fullPage:true,
  });
  await context.close();
});

test("Stage 12B calendar continuity remains functional under reduced motion", async ({ browser }) => {
  const { context, page } = await login(
    browser,
    "manager@ceac.local.test",
    ".manager-app",
    { width:390, height:844 },
    "reduce",
  );
  await page.goto("/?tab=calendar");

  expect(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches)).toBeTruthy();

  const month = page.getByRole("tab", { name:"Month", exact:true });
  const week = page.getByRole("tab", { name:"Week", exact:true });
  await expect(month).toHaveAttribute("aria-selected", "true");
  await expect(month.locator(".ev2c-segmented-indicator")).toHaveCount(1);

  await week.click();
  await expect(week).toHaveAttribute("aria-selected", "true");
  await expect(week.locator(".ev2c-segmented-indicator")).toHaveCount(1);
  await expect(page.locator(".ev2cal-day")).toHaveCount(7);

  const selected = page.locator(".ev2cal-day-button[aria-pressed='true']");
  await expect(selected).toHaveCount(1);
  await expect(selected.locator(".ev2cal-selection-indicator")).toHaveCount(1);

  const period = page.locator(".ev2cal-period-label");
  const before = await period.textContent();
  await page.getByRole("button", { name:"Next period", exact:true }).click();
  await expect(period).not.toHaveText(before || "");

  await expectNoPageOverflow(page, "Stage 12B reduced-motion calendar");
  await page.screenshot({
    path:"test-artifacts/redesign-r7-stage12b-calendar-reduced-phone-390.png",
    fullPage:true,
  });
  await context.close();
});

test("Stage 12B shared motion proof remains composed on laptop", async ({ browser }) => {
  const { context, page } = await login(
    browser,
    "admin@ceac.local.test",
    ".office-app",
    { width:1366, height:768 },
  );
  await page.goto("/?tab=primitives");

  await expect(page.getByRole("heading", { name:"Foundation quality proof", exact:true })).toBeVisible();
  await page.getByRole("button", { name:/Reference state compact/ }).click();
  await expect(page.getByLabel("Reference motion detail")).toBeVisible();
  await expectNoPageOverflow(page, "Stage 12B laptop proof");

  await page.screenshot({
    path:"test-artifacts/redesign-r7-stage12b-motion-proof-laptop-1366.png",
    fullPage:true,
  });
  await context.close();
});


test("Stage 12C applies shared motion to accepted operational flows without changing authority", async () => {
  const reports = readFileSync("src/screens/ManagerReports.jsx", "utf8");
  const bits = readFileSync("src/components/bits.jsx", "utf8");
  const legacyCss = readFileSync("src/styles.css", "utf8");

  expect(reports).toContain('MotionDisclosure');
  expect(reports).toContain('aria-expanded={showAnalysis}');
  expect(reports).toContain('aria-controls="manager-report-supporting-analysis"');
  expect(reports).toContain('<MotionDisclosure open={showAnalysis} ariaLabel="Supporting analysis">');
  expect(reports).not.toContain('{showAnalysis && <div className="report-analysis">');

  expect(bits).toContain('event.key === "Escape"');
  expect(bits).toContain("previousFocus?.focus?.()");
  expect(bits).toContain('role="dialog"');
  expect(bits).toContain('aria-modal="true"');
  expect(bits).toContain('AnimatePresence, motion, useReducedMotion');
  expect(bits).toContain('EV2_TRANSITIONS.fast');
  expect(bits).toContain('EV2_TRANSITIONS.panel');
  expect(bits).toContain('onExitComplete');

  expect(legacyCss).not.toContain("ev2-sheet-backdrop-in");
  expect(legacyCss).not.toContain("ev2-sheet-surface-in");
  expect(legacyCss).toContain(".sheet-close{position:absolute;top:10px;right:12px;width:44px;height:44px");
});

for (const viewport of [
  { name:"phone-390", width:390, height:844 },
  { name:"laptop-1366", width:1366, height:768 },
]) {
  test(`Stage 12C Manager Reports disclosure remains interruptible at ${viewport.name}`, async ({ browser }) => {
    const { context, page } = await login(
      browser,
      "manager@ceac.local.test",
      ".manager-app",
      viewport,
    );
    await page.goto("/?tab=manager-reports");

    const show = page.getByRole("button", { name:"Show charts and tables", exact:true });
    await expect(show).toBeVisible({ timeout:15000 });
    await expect(show).toHaveAttribute("aria-expanded", "false");
    await show.click();

    const hide = page.getByRole("button", { name:"Hide charts and tables", exact:true });
    await expect(hide).toHaveAttribute("aria-expanded", "true");
    await expect(hide).toHaveAttribute("aria-controls", "manager-report-supporting-analysis");
    await expect(page.getByLabel("Supporting analysis")).toBeVisible();
    await expect(page.locator("#manager-report-supporting-analysis")).toBeVisible();

    await expectNoPageOverflow(page, `Stage 12C Manager Reports ${viewport.name}`);
    await page.screenshot({
      path:`test-artifacts/redesign-r7-stage12c-manager-reports-${viewport.name}.png`,
      fullPage:true,
    });

    await hide.click();
    await expect(page.getByLabel("Supporting analysis")).toHaveCount(0);
    await context.close();
  });
}

test("Stage 12C legacy Sheet keeps focus and Escape behaviour under reduced motion", async ({ browser }) => {
  const { context, page } = await login(
    browser,
    "manager@ceac.local.test",
    ".manager-app",
    { width:390, height:844 },
    "reduce",
  );
  await page.goto("/?tab=calendar");

  // A reduced-motion filter sheet only belongs to the settled Manager Calendar,
  // not a similarly named control elsewhere while the route is still loading.
  await expect(page.locator(".ev2cal-toolbar")).toBeVisible({ timeout: 15000 });
  await expect(page.locator(".ev2cal-role-layout")).toBeVisible({ timeout: 15000 });
  const trigger = page.locator(".ev2cal-toolbar").getByRole("button", { name:"View All", exact:true });
  await trigger.click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog).toBeFocused();

  const motion = await page.evaluate(() => {
    const dialog = document.querySelector(".sheet");
    const backdrop = document.querySelector(".sheet-bg");
    const dialogStyle = dialog ? getComputedStyle(dialog) : null;
    const backdropStyle = backdrop ? getComputedStyle(backdrop) : null;
    return {
      reduce: matchMedia("(prefers-reduced-motion: reduce)").matches,
      dialogAnimation: dialogStyle?.animationName || "none",
      backdropAnimation: backdropStyle?.animationName || "none",
      dialogTransform: dialogStyle?.transform || "none",
      backdropTransform: backdropStyle?.transform || "none",
      dialogOpacity: dialogStyle?.opacity || "0",
      backdropOpacity: backdropStyle?.opacity || "0",
    };
  });

  expect(motion.reduce).toBeTruthy();
  expect(motion.dialogAnimation).toBe("none");
  expect(motion.backdropAnimation).toBe("none");
  expect(motion.dialogTransform).toBe("none");
  expect(motion.backdropTransform).toBe("none");
  expect(Number.parseFloat(motion.dialogOpacity)).toBeGreaterThan(0.99);
  expect(Number.parseFloat(motion.backdropOpacity)).toBeGreaterThan(0.99);

  await page.screenshot({
    path:"test-artifacts/redesign-r7-stage12c-sheet-reduced-phone-390.png",
    fullPage:true,
  });

  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await context.close();
});

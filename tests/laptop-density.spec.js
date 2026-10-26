import { test, expect } from "@playwright/test";

const password = process.env.ROLE_FIXTURE_PASSWORD;

async function signIn(browser, email, viewport) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  await page.goto("/");
  await page.getByPlaceholder("Work email").fill(email);
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.locator(".app")).toBeVisible({ timeout: 15000 });
  await expect(page.locator(".app-content .body").first()).toBeVisible({ timeout: 15000 });
  return { context, page };
}

async function expectNoPageOverflow(page) {
  const overflow = await page.evaluate(() => ({
    html: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    body: document.body.scrollWidth - document.body.clientWidth,
  }));
  expect(overflow.html).toBeLessThanOrEqual(1);
  expect(overflow.body).toBeLessThanOrEqual(1);
}

test.describe.configure({ mode: "serial" });

for (const width of [1024, 1180, 1366]) {
  test(`Manager Overview keeps laptop proportions at ${width}px`, async ({ browser }) => {
    const { context, page } = await signIn(browser, "manager@ceac.local.test", { width, height: 820 });

    const overview = page.locator(".manager-app .managerv2");
    const main = page.locator(".manager-app .managerv2-main");
    await expect(overview).toBeVisible();
    await expect(main).toBeVisible({ timeout: 15000 });
    await expect(page.locator(".manager-app .fpg9-home-reference")).toBeVisible();
    await expect(page.locator(".manager-app .fpg9-workspace-previews")).toBeVisible();
    await expect(page.locator(".manager-app .managerv2-decisions")).toHaveCount(0);

    const geometry = await page.evaluate(() => {
      const body = document.querySelector(".manager-app .app-content .body");
      const overview = document.querySelector(".manager-app .managerv2");
      const home = document.querySelector(".manager-app .fpg9-home-reference");
      const previews = document.querySelector(".manager-app .fpg9-workspace-previews");
      return {
        bodyWidth: body?.getBoundingClientRect().width || 0,
        overviewWidth: overview?.getBoundingClientRect().width || 0,
        homeColumns: home ? getComputedStyle(home).gridTemplateColumns.split(" ").filter(Boolean).length : 0,
        homeTop: home?.getBoundingClientRect().top || 0,
        previewsTop: previews?.getBoundingClientRect().top || 0,
      };
    });

    expect(geometry.bodyWidth).toBeLessThanOrEqual(1281);
    expect(geometry.overviewWidth).toBeLessThanOrEqual(1217);
    expect(geometry.homeColumns).toBe(2);
    expect(geometry.previewsTop).toBeGreaterThan(geometry.homeTop);
    await expect(page.locator(".manager-app .reference-rail")).toHaveCount(0);
    await expect(page.locator(".manager-app .reference-module-strip")).toHaveCount(0);
    await expectNoPageOverflow(page);

    if (width === 1180) {
      await page.screenshot({ path: "test-artifacts/laptop-density-manager-1180.png", fullPage: true });
    }
    if (width === 1366) {
      await page.screenshot({ path: "test-artifacts/laptop-density-manager-1366.png", fullPage: true });
    }

    await context.close();
  });
}

test("Administration Learning remains centred and readable on a laptop", async ({ browser }) => {
  const { context, page } = await signIn(browser, "admin@ceac.local.test", { width: 1180, height: 820 });
  await page.goto("/?tab=learning");
  // A route heading can mount before the full authorised Learning workspace
  // has rendered. Verify the actual Learning h1 before sampling its font.
  const learningHeading = page.locator(".office-app .learning-page .ev2w-header h1");
  await expect(learningHeading).toBeVisible({ timeout: 15000 });
  await expect(learningHeading).toHaveText("Learning");

  const geometry = await page.evaluate(() => {
    const body = document.querySelector(".office-app .app-content .body");
    const heading = document.querySelector(".office-app .learning-page .ev2w-header h1");
    return {
      bodyWidth: body?.getBoundingClientRect().width || 0,
      headingSize: heading ? parseFloat(getComputedStyle(heading).fontSize) : 0,
    };
  });

  expect(geometry.bodyWidth).toBeLessThanOrEqual(1281);
  expect(geometry.headingSize).toBeGreaterThanOrEqual(30);
  await expectNoPageOverflow(page);
  await page.screenshot({ path: "test-artifacts/laptop-density-admin-learning-1180.png", fullPage: true });

  await context.close();
});

test("Wide desktop content still respects the 1280px reading measure", async ({ browser }) => {
  const { context, page } = await signIn(browser, "manager@ceac.local.test", { width: 1600, height: 900 });
  const width = await page.locator(".manager-app .app-content .body").evaluate((el) => el.getBoundingClientRect().width);
  expect(width).toBeLessThanOrEqual(1281);
  await expectNoPageOverflow(page);
  await context.close();
});

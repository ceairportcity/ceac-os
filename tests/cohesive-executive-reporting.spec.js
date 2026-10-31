import { expect, test } from "@playwright/test";

async function enterExecutive(page) {
  await page.goto("/");
  await page.getByPlaceholder("Work email").fill("exec@ceac.local.test");
  await page.getByPlaceholder("Password").fill(process.env.ROLE_FIXTURE_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.locator(".executive-app")).toBeVisible({ timeout: 15000 });
  await expect(page.locator(".executivev2-main").first()).toBeVisible({ timeout: 15000 });
}

test("Cohesive Executive Reports fits iPad and desktop without overlapping tabs", async ({ browser }) => {
  test.setTimeout(120000);
  for (const width of [744, 1366]) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    try {
      const page = await context.newPage();
      await enterExecutive(page);
      await page.locator(".ev2s-sidebar").getByRole("button", { name: "Reports", exact: true }).click();
      await expect(page.locator(".ev2-reporting-executive")).toBeVisible({ timeout: 15000 });
      const tabs = page.locator('.ev2rep-tabs[aria-label="Executive reporting workspace"] [role="tab"]');
      await expect(tabs).toHaveCount(4);
      {
        const rects = await tabs.evaluateAll(nodes => nodes.map(node => {
          const box = node.getBoundingClientRect();
          return { left:box.left, right:box.right, top:box.top, bottom:box.bottom, width:box.width, height:box.height };
        }));
        for (let i = 0; i < rects.length; i++) {
          expect(rects[i].width, `tab width at ${width}`).toBeGreaterThan(60);
          expect(rects[i].height, `tab touch height at ${width}`).toBeGreaterThanOrEqual(44);
          for (let j = i+1; j < rects.length; j++) {
            const overlap = Math.min(rects[i].right, rects[j].right) - Math.max(rects[i].left, rects[j].left);
            const vertical = Math.min(rects[i].bottom, rects[j].bottom) - Math.max(rects[i].top, rects[j].top);
            expect(Math.min(overlap,vertical), `tab collision at ${width}`).toBeLessThanOrEqual(1);
          }
        }
        await tabs.nth(2).click();
        await expect(tabs.nth(2)).toHaveAttribute("aria-selected", "true");
        await tabs.nth(0).click();
        await expect(tabs.nth(0)).toHaveAttribute("aria-selected", "true");
      }
      const sideways = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(sideways, `Executive Reports scroll overflow at ${width}`).toBeLessThanOrEqual(1);
      await page.screenshot({ path:`test-artifacts/cohesive-exec-reports-${width}.png`, fullPage:true });
    } finally {
      await context.close();
    }
  }
});

test("Executive can reach quarterly reporting before a period opens", async ({ browser }) => {
  test.setTimeout(90000);
  const context = await browser.newContext({ viewport: { width:390, height:844 } });
  try {
    const page = await context.newPage();
    await page.route("**/rest/v1/report_periods?*", route => route.fulfill({
      status:200, contentType:"application/json", headers:{"content-range":"*/0"}, body:"[]"
    }));
    await enterExecutive(page);
    await page.goto("/?tab=exec-reports");
    await expect(page.getByRole("heading",{name:"Reports",exact:true})).toBeVisible();
    const nav=page.locator(".ev2rep-tabs[aria-label='Executive reporting workspace']");
    await expect(nav.getByRole("tab")).toHaveCount(4);
    await nav.getByRole("tab",{name:"Quarterly reports"}).click();
    await expect(page.getByText("No reporting period is recorded",{exact:true})).toBeVisible();
    await expect(page.getByRole("region",{name:"Quarterly leadership review schedule"})).toBeVisible();
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  } finally {await context.close();}
});

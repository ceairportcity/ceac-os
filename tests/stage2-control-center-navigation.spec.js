import { expect, test } from '@playwright/test';

for (const viewport of [{ width: 390, height: 844 }, { width: 1366, height: 900 }]) {
  test(`Control Center has one entry per domain and working return routes at ${viewport.width}px`, async ({ browser }) => {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    expect(process.env.SUPABASE_URL).toBe("http://127.0.0.1:54321");
    // Presentation fixture only: narrow the grants received by the UI.
    // Server authority is unchanged; this is not a database-denial test.
    await page.route("**/rest/v1/capability_grants?*", async route => {
      const url = new URL(route.request().url());
      if (url.hostname !== "127.0.0.1" || url.port !== "54321" || route.request().method() !== "GET") return route.continue();
      const response = await route.fetch();
      const grants = await response.json();
      expect(Array.isArray(grants)).toBe(true);
      await route.fulfill({ response, json: grants.filter(grant => !["payroll.prepare", "payroll.approve"].includes(grant.capability)) });
    });
    try {
      await page.goto('/');
      await page.getByPlaceholder('Work email').fill('admin@ceac.local.test');
      await page.getByPlaceholder('Password').fill(process.env.ROLE_FIXTURE_PASSWORD);
      await page.getByRole('button', { name: 'Sign in to CEAC OS', exact: true }).click();
      await expect(page.locator('.office-app')).toBeVisible();
      await page.goto('/?tab=settings');
      const center = page.locator('.control-center');
      await expect(center.getByRole('heading', { name: 'Control Center', exact: true })).toBeVisible();
      await expect(center.getByLabel('Find a setting')).toBeVisible();
      await expect(center.getByRole('heading', { name: 'Organisation', exact: true })).toHaveCount(1);
      await page.screenshot({ path: "test-artifacts/stage2-control-center-" + viewport.width + ".png", fullPage: true });
      await center.getByLabel('Find a setting').fill('Office');
      await expect(center.locator('.control-setting-row')).toHaveCount(1);
      await center.getByRole('button', { name: /^Attendance & locations/ }).click();
      await expect(page).toHaveURL(/tab=office-settings/);
      await expect(page.getByRole('heading',{name:'Attendance & locations',exact:true})).toBeVisible();
      await page.getByRole('button', {name:/^Office location/}).click();
      await expect(page).toHaveURL(/setting=office/);
      await expect(page.getByLabel('Office name',{exact:true})).toBeVisible();
      await page.getByRole('button',{name:'Back to Attendance & locations',exact:true}).click();
      await page.getByRole('button',{name:'Back to Control Center',exact:true}).click();
      await expect(center.getByRole('heading',{name:'Control Center',exact:true})).toBeVisible();
      await center.getByRole('button',{name:/^Departments & reporting/}).click();
      await expect(page).toHaveURL(/tab=units/);
      await page.getByRole('button',{name:'Back to Control Center',exact:true}).click();
      await expect(center.getByRole('button',{name:'Payroll',exact:true})).toHaveCount(0);
      await center.getByRole('button',{name:'Finance',exact:true}).click();
      await expect(page).toHaveURL(/tab=finance/);
      await expect(page.getByRole('button',{name:'Back to Control Center',exact:true})).toHaveCount(0);
      await expect(page.locator('.control-center-trail')).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);

    } finally { await context.close().catch(() => {}); }
  });
}

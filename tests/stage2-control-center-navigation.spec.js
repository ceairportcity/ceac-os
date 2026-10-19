import { expect, test } from '@playwright/test';

for (const viewport of [{ width: 390, height: 844 }, { width: 1366, height: 900 }]) {
  test(`Control Center has one entry per domain and working return routes at ${viewport.width}px`, async ({ browser }) => {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
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
      await center.getByLabel('Find a setting').fill('Office');
      await expect(center.getByRole('heading', { name: 'Organisation', exact: true })).toBeVisible();
      await expect(center.getByRole('heading', { name: 'People & access', exact: true })).toHaveCount(0);
      await center.getByRole('button', { name: 'Office settings', exact: true }).click();
      const returnLink = page.getByRole('navigation', { name: 'Settings navigation' }).getByRole('link', { name: /Control Center/ });
      await expect(returnLink).toBeVisible();
      await expect(page).toHaveURL(/tab=office-settings/);
      await returnLink.click();
      await expect(center.getByLabel('Find a setting')).toHaveValue('');
      await center.getByRole('button', { name: 'Units', exact: true }).click();
      await expect(page).toHaveURL(/tab=units/);
      await page.getByRole('navigation', { name: 'Settings navigation' }).getByRole('link', { name: /Control Center/ }).click();
      await expect(center.getByRole('heading', { name: 'Control Center', exact: true })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
      await center.getByRole('button', { name: /Overview/ }).click();
      await expect(center).toHaveCount(0);
    } finally { await context.close().catch(() => {}); }
  });
}

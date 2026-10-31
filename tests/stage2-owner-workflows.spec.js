import { expect, test } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

const password = process.env.ROLE_FIXTURE_PASSWORD;
const actors = ['staff', 'manager', 'admin', 'exec'];

for (const actor of actors) {
  test(`${actor} creates their responsibility and records an attributable correction without completing the parent`, async ({ browser }) => {
    expect(process.env.SUPABASE_URL).toBe('http://127.0.0.1:54321');
    const context = await browser.newContext({ viewport: { width: 1536, height: 1105 } });
    const page = await context.newPage();
    const email = `${actor}@ceac.local.test`;
    const title = `Owner workflow ${actor} ${Date.now()}`;
    const original = `Original attributable action by ${actor}`;
    const corrected = `Corrected attributable action by ${actor}`;
    const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    try {
      await page.route('**/*', route => {
        const url = new URL(route.request().url());
        return url.hostname === '127.0.0.1' && ['5173', '54321'].includes(url.port)
          ? route.continue() : route.abort('blockedbyclient');
      });
      await page.goto('/');
      await page.getByPlaceholder('Work email').fill(email);
      await page.getByPlaceholder('Password').fill(password);
      await page.getByRole('button', { name: 'Sign in to CEAC OS', exact: true }).click();
      await expect(page.locator('.ev2s-sidebar')).toBeVisible();
      await page.goto('/?tab=work');
      await page.getByRole('button', { name: 'Add my work', exact: true }).click();
      if (actor === 'staff') {
        await page.getByPlaceholder('What are you doing?').fill(title);
        await page.getByPlaceholder('What should be true when this is finished?').fill('Document a specific contribution and preserve its history.');
        await page.getByRole('checkbox', { name: /No steps needed/ }).check();
        await page.getByRole('button', { name: 'Add to my work', exact: true }).click();
      } else {
        await page.getByLabel('My responsibility title', { exact: true }).fill(title);
        await page.getByLabel('Expected result', { exact: true }).fill('Document a specific contribution and preserve its history.');
        await page.getByRole('checkbox', { name: 'No steps needed yet' }).check();
        await page.locator('form').getByRole('button', { name: 'Add my work', exact: true }).click();
      }
      const row = page.locator('.s2-register-row').filter({ hasText: title });
      await expect(row).toBeVisible();
      const inspector = page.getByRole('complementary', { name: 'Selected responsibility' });
      await expect(inspector.getByRole('heading', { name: title, exact: true })).toBeVisible();
      const diary = inspector.getByRole('region', { name: 'Responsibility activity diary' });
      await diary.getByRole('button', { name: /Add work update/ }).click();
      await diary.getByLabel('Activity date', { exact: true }).fill('2026-09-30');
      await diary.getByLabel('What did you do?').fill(original);
      await diary.getByLabel('What was the result?').fill('A verifiable action was recorded.');
      await diary.getByLabel('What happens next?', { exact: true }).fill('Confirm the next collection date.');
      await diary.getByRole('button', { name: 'Save work update', exact: true }).click();
      await expect(diary.locator('li').filter({ hasText: original })).toBeVisible();
      await diary.getByRole('button', { name: 'Correct this entry', exact: true }).click();
      await diary.getByLabel('Activity date', { exact: true }).fill('2026-10-01');
      await diary.getByLabel('What did you do?').fill(corrected);
      await diary.getByRole('button', { name: 'Save correction', exact: true }).click();
      await expect(diary.locator('li').filter({ hasText: corrected })).toBeVisible();
      await expect(diary.locator('li').filter({ hasText: original })).toHaveCount(0);
      await expect(diary.getByText('Corrected entry · prior version preserved', { exact: true })).toBeVisible();

      const signedIn = await client.auth.signInWithPassword({ email, password });
      expect(signedIn.error).toBeNull();
      const saved = await client.from('work_items').select('id,assignee_id,origin,visibility,status').eq('title', title).single();
      expect(saved.error).toBeNull();
      expect(saved.data.assignee_id).toBe(signedIn.data.user.id);
      expect(saved.data.origin).toBe('self_created');
      expect(saved.data.visibility).toBe('unit');
      expect(['completed', 'self_certified', 'cancelled']).not.toContain(saved.data.status);
      const history = await client.from('work_activity_records').select('id,contributor_id,activity_date,action_summary,supersedes_id')
        .eq('work_item_id', saved.data.id).order('recorded_at');
      expect(history.error).toBeNull();
      expect(history.data).toHaveLength(2);
      expect(history.data[0].action_summary).toBe(original);
      expect(history.data[1].supersedes_id).toBe(history.data[0].id);
      expect(history.data[1].activity_date).toBe('2026-10-01');
      expect(history.data.every(entry => entry.contributor_id === signedIn.data.user.id)).toBe(true);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: `test-artifacts/owner-work-${actor}-desktop.png`, fullPage: true });
      await page.setViewportSize({ width: 390, height: 844 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: `test-artifacts/owner-work-${actor}-phone.png`, fullPage: true });
    } finally {
      await client.auth.signOut();
      await context.close().catch(() => {});
    }
  });
}

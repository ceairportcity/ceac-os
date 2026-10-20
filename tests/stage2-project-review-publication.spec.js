import { expect, test } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

test('project evidence reaches an employee only through the existing reviewer and independent HR publication flow', async ({ browser }) => {
  test.setTimeout(90000); // Four separate authenticated roles/visits form one review journey.
  expect(process.env.SUPABASE_URL).toBe('http://127.0.0.1:54321');
  const password = process.env.ROLE_FIXTURE_PASSWORD;
  const staffId = '31000000-0000-4000-8000-000000000001';
  const projectId = '25000000-0000-4000-8000-000000000011';
  const now = new Date();
  const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);
  const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
  const cycleName = `Owner project review ${Date.now()}`;
  const narrative = `Specific project contribution for independent HR review ${Date.now()}.`;
  const ratingReason = `Observation deferred pending the next delivery evidence ${Date.now()}.`;
  const contexts = [];
  const clients = [];
  async function api(role) {
    const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } });
    clients.push(client);
    const login = await client.auth.signInWithPassword({ email: `${role}@ceac.local.test`, password });
    expect(login.error).toBeNull();
    return client;
  }
  async function open(role) {
    const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
    contexts.push(context);
    const page = await context.newPage();
    await page.route('**/*', route => {
      const url = new URL(route.request().url());
      return url.hostname === '127.0.0.1' && ['5173', '54321'].includes(url.port)
        ? route.continue() : route.abort('blockedbyclient');
    });
    await page.goto('/');
    await page.getByPlaceholder('Work email').fill(`${role}@ceac.local.test`);
    await page.getByPlaceholder('Password').fill(password);
    await page.getByRole('button', { name: 'Sign in to CEAC OS', exact: true }).click();
    await expect(page.locator('.ev2s-sidebar')).toBeVisible();
    await page.goto(`/?tab=performance&reviewPerson=${staffId}`);
    await expect(page.getByRole('heading', { name: 'Reviews & development', exact: true })).toBeVisible();
    return page;
  }
  try {
    const hr = await api('admin');
    const opened = await hr.rpc('open_performance_review_cycle', {
      p_name: cycleName, p_starts_on: periodStart, p_ends_on: periodEnd,
      p_reason: 'Synthetic monthly evidence review through the standard release controls.',
    });
    expect(opened.error).toBeNull();
    const manager = await api('manager');
    const recorded = await manager.rpc('stage2_record_project_person_assessment', {
      p_project_id: projectId, p_subject_profile_id: staffId, p_narrative: narrative,
      p_evidence_note: 'Source-linked project work already assigned to this person.',
      p_next_action: 'Agree the next delivery date.', p_period_start: periodStart, p_period_end: periodEnd,
    });
    expect(recorded.error).toBeNull();

    const reviewerPage = await open('manager');
    await reviewerPage.getByText(/^Project contribution drafts/).click();
    const projectNote = reviewerPage.locator('.performance-history article').filter({ hasText: narrative });
    await expect(projectNote).toBeVisible();
    await projectNote.getByRole('button', { name: 'Include in assessment draft', exact: true }).click();
    await expect(reviewerPage.getByLabel('Manager assessment', { exact: true })).toHaveValue(new RegExp(`Project contribution source: ${recorded.data}`));
    expect(await reviewerPage.getByLabel('Manager assessment', { exact: true }).inputValue()).toContain(narrative);
    await reviewerPage.getByRole('button', { name: 'Record assessment', exact: true }).click();
    await expect(reviewerPage.getByText('Manager assessment recorded.', { exact: true })).toBeVisible();
    const ratings = reviewerPage.getByRole('region', { name: 'Human-entered Manager appraisal ratings' });
    await ratings.getByRole('button', { name: 'Enter ratings', exact: true }).click();
    const delivery = ratings.locator('.s2-rating-row').filter({ hasText: 'Delivery of responsibilities' });
    await delivery.getByLabel('Human rating', { exact: true }).selectOption('N/O');
    await delivery.getByLabel('Explanation', { exact: true }).fill(ratingReason);
    await ratings.getByRole('button', { name: 'Record human ratings', exact: true }).click();
    await expect(ratings.getByText(ratingReason, { exact: true })).toBeVisible();
    const ratingSaved = await manager.from('appraisal_human_rating_versions')
      .select('id,appraisal_id,profile_id').eq('profile_id', staffId)
      .contains('category_ratings', { delivery: { reason: ratingReason } }).single();
    expect(ratingSaved.error).toBeNull();
    await reviewerPage.getByLabel('Performance release request reason').fill('Manager reviewed the attributable contribution and requests independent HR publication.');
    await reviewerPage.getByRole('button', { name: 'Submit release request to HR', exact: true }).click();
    await expect(reviewerPage.getByText(/release request was recorded for HR review/)).toBeVisible();

    const employeeBefore = await open('staff');
    await expect(employeeBefore.locator('.performance-narrative p').filter({ hasText: narrative })).toHaveCount(0);
    const employee = await api('staff');
    const privateRead = await employee.from('project_person_contribution_assessments').select('id').eq('id', recorded.data);
    expect(privateRead.error).toBeNull();
    expect(privateRead.data).toHaveLength(0);
    const pendingRating = await employee.from('stage2_employee_published_human_ratings')
      .select('id').eq('id',ratingSaved.data.id);
    expect(pendingRating.error).toBeNull();
    expect(pendingRating.data).toHaveLength(0);
    expect((await employee.schema('private').rpc('stage2_self_published_human_ratings')).error?.code).toBe('PGRST106');
    expect((await employee.rpc('stage2_self_published_human_ratings')).error?.code).toBe('PGRST202');

    const hrPage = await open('admin');
    const queueNote = hrPage.locator('.s2-hr-project-reviews details').filter({ hasText: narrative });
    await queueNote.locator('summary').click();
    await queueNote.getByRole('button', { name: `Open formal review · ${cycleName}`, exact: true }).click();
    await hrPage.getByLabel('HR assessment publication decision reason').fill('Independent HR review confirmed the factual evidence and approved this specific narrative version.');
    await hrPage.getByRole('button', { name: 'HR approve publication', exact: true }).click();
    await expect(hrPage.getByText('HR approved publication of this manager assessment version.', { exact: true })).toBeVisible();

    await employeeBefore.reload();
    await expect(employeeBefore.locator('.performance-narrative p').filter({ hasText: narrative })).toBeVisible();
    await expect(employeeBefore.getByRole('region', { name: 'Human-entered Manager appraisal ratings' })
      .getByText(ratingReason, { exact: true })).toBeVisible();
    const released = await employee.from('stage2_employee_published_human_ratings')
      .select('id,profile_id').eq('id',ratingSaved.data.id);
    expect(released.error).toBeNull();
    expect(released.data).toEqual([{ id:ratingSaved.data.id, profile_id:staffId }]);
    const colleague = await api('sameunit');
    const otherRead = await colleague.from('stage2_employee_published_human_ratings')
      .select('id').eq('id',ratingSaved.data.id);
    expect(otherRead.error).toBeNull();
    expect(otherRead.data).toHaveLength(0);
    await employeeBefore.getByLabel('Review response', { exact: true }).fill('I have read the released review and confirm the next action.');
    await employeeBefore.getByRole('button', { name: 'Record response', exact: true }).click();
    await expect(employeeBefore.getByText('Your response was recorded.', { exact: true })).toBeVisible();
  } finally {
    for (const client of clients) await client.auth.signOut();
    for (const context of contexts) await context.close().catch(() => {});
  }
});

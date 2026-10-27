import { test, expect } from '@playwright/test';

async function fixtureApi(page) {
  const writes = [];
  await page.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    if (!url.pathname.includes('/rest/v1/')) {
      return ['localhost', '127.0.0.1'].includes(url.hostname) ? route.continue() : route.abort();
    }
    const name = url.pathname.split('/').pop();
    if (!['GET', 'HEAD'].includes(request.method())) {
      writes.push({ name, body: request.postDataJSON() });
      return route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ message: 'Synthetic save denied' }) });
    }
    const rows = {
      learning_courses: [
        { id: 'draft', title: 'Draft orientation', summary: 'Prepare an orientation course', state: 'draft' },
        { id: 'published', title: 'Published orientation', summary: 'Existing learning', state: 'published' },
      ],
      learning_modules: [
        { id: 'draft-module', course_id: 'draft', title: 'Draft module', position: 1, required: true },
        { id: 'published-module', course_id: 'published', title: 'Published module', position: 1, required: true },
      ],
      learning_assignments: [{ id: 'assignment', profile_id: 'person', course_id: 'published', state: 'completed' }],
      learning_module_progress: [{ assignment_id: 'assignment', module_id: 'published-module', state: 'completed' }],
      profiles: [{ id: 'person', full_name: 'Synthetic employee', active: true }],
      units: [{ id: 'unit', name: 'Synthetic department' }],
      appraisal_cycles: [{ id: 'cycle', name: 'Quarterly fixture', starts_on: '2026-07-01', ends_on: '2026-09-30', status: 'open' }],
      appraisals: [{ id: 'review', cycle_id: 'cycle', profile_id: 'person', manager_id: 'synthetic-admin', status: 'evidence', profiles: { full_name: 'Synthetic employee' } }],
    };
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rows[name] || []) });
  });
  return writes;
}

test('Admin Learning retains readable laptop heading and width after header replacement', async ({ page }) => {
  await page.setViewportSize({ width: 1180, height: 820 });
  await fixtureApi(page);
  await page.goto('/tests/fixtures/hr-overview-review.html?audit=screen&screen=learning');
  const heading = page.locator('.learning-page .ev2w-header h1');
  await expect(heading).toHaveText('Learning');
  expect(await heading.evaluate(node => parseFloat(getComputedStyle(node).fontSize))).toBeGreaterThanOrEqual(30);
  expect(await page.locator('.app-content .body').evaluate(node => node.getBoundingClientRect().width)).toBeLessThanOrEqual(1281);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
});

for (const width of [390, 1440]) {
  test(`Admin Learning uses named modern forms and retains failed drafts at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    const writes = await fixtureApi(page);
    await page.goto('/tests/fixtures/hr-overview-review.html?audit=screen&screen=learning');
    await expect(page.locator('.ev2w-header')).toContainText('Learning');
    await page.getByRole('button',{name:/Draft orientation.*modules/}).click();
    await expect(page.getByRole('button', { name: 'Publish course', exact: true })).toBeDisabled();
    await expect(page.getByText('Before publishing, add at least one required module and a resource to every module.', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Create course', exact: true }).click();
    let dialog = page.getByRole('dialog', { name: 'Create a draft course', exact: true });
    await expect(dialog).toHaveClass(/ev2c-composer-drawer/);
    await dialog.getByLabel('Learning course title', { exact: true }).fill('Retain this draft');
    await dialog.getByLabel('Learning course summary', { exact: true }).fill('Explain the course purpose');
    await dialog.getByRole('button', { name: 'Create draft course', exact: true }).click();
    await expect(dialog).toContainText('Learning change not recorded');
    await expect(dialog.getByLabel('Learning course title', { exact: true })).toHaveValue('Retain this draft');
    expect(writes[0]).toMatchObject({ name: 'learning_courses', body: { title: 'Retain this draft', state: 'draft' } });
    await page.screenshot({ path: `test-artifacts/admin-learning-draft-${width}.png`, fullPage: true });
    await dialog.getByRole('button', { name: 'Close', exact: true }).click();
    await page.getByRole('button', { name: 'Add module', exact: true }).click();
    dialog = page.getByRole('dialog', { name: 'Add a module', exact: true });
    await expect(dialog.getByLabel('Learning module title', { exact: true })).toBeVisible();
    await expect(dialog.getByText('Learning change not recorded', { exact: true })).toHaveCount(0);
    await dialog.getByRole('button', { name: 'Close', exact: true }).click();
    await page.getByRole('button', { name: 'Add resource', exact: true }).click();
    dialog = page.getByRole('dialog', { name: 'Add a resource', exact: true });
    await dialog.getByLabel('Learning resource type', { exact: true }).selectOption('text');
    await expect(dialog.getByLabel('Learning resource text', { exact: true })).toBeVisible();
    await expect(dialog.getByLabel('Learning resource URL', { exact: true })).toHaveCount(0);
    await dialog.getByRole('button', { name: 'Close', exact: true }).click();
    await page.getByRole('button', { name: 'Assignment rules', exact: true }).click();
    await page.getByRole('button', { name: 'Create assignment rule', exact: true }).click();
    dialog = page.getByRole('dialog', { name: 'Create an assignment rule', exact: true });
    await dialog.getByLabel('Learning target kind', { exact: true }).selectOption('unit');
    await expect(dialog.getByLabel('Learning target unit', { exact: true })).toBeVisible();
    await dialog.getByRole('button', { name: 'Close', exact: true }).click();
    await page.getByRole('button', { name: 'Completed learning', exact: true }).click();
    await page.getByRole('button', { name: 'Record historical completion', exact: true }).click();
    dialog = page.getByRole('dialog', { name: 'Record historical completion', exact: true });
    await expect(dialog.getByLabel('Historical learning date', { exact: true })).toBeVisible();
    await dialog.getByRole('button', { name: 'Close', exact: true }).click();
    await page.getByRole('button', { name: 'Progress', exact: true }).click();
    await page.getByRole('button', { name: 'Correct completion', exact: true }).click();
    dialog = page.getByRole('dialog', { name: 'Learning record correction', exact: true });
    await expect(dialog.getByLabel('Learning administration reason', { exact: true })).toBeVisible();
    expect(writes).toHaveLength(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  });

  test(`Admin review drawers preserve steps, reasons and denied saves at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    const writes = await fixtureApi(page);
    await page.goto('/tests/fixtures/hr-overview-review.html?audit=screen&screen=performance');
    await expect(page.locator('.ev2w-header')).toContainText('Reviews & development');
    await expect(page.getByText(/Quarterly formal reviews require/)).toBeVisible();
    await page.getByRole('button', { name: 'Open review period', exact: true }).click();
    let dialog = page.getByRole('dialog', { name: 'Open review period', exact: true });
    await expect(dialog).toHaveClass(/ev2c-composer-drawer/);
    await dialog.getByLabel('Review period name', { exact: true }).fill('Quarterly draft');
    await dialog.getByRole('button', { name: 'Continue', exact: true }).click();
    await dialog.getByLabel('Review period start', { exact: true }).fill('2026-07-01');
    await dialog.getByLabel('Review period end', { exact: true }).fill('2026-09-30');
    await dialog.getByRole('button', { name: 'Continue', exact: true }).click();
    await dialog.getByLabel('Review period reason', { exact: true }).fill('Formal quarterly review');
    await dialog.getByRole('button', { name: 'Open review period', exact: true }).click();
    await expect(dialog).toContainText('Review change not recorded');
    await expect(dialog.getByLabel('Review period reason', { exact: true })).toHaveValue('Formal quarterly review');
    expect(writes[0]).toMatchObject({ name: 'open_performance_review_cycle', body: { p_name: 'Quarterly draft', p_starts_on: '2026-07-01', p_ends_on: '2026-09-30', p_reason: 'Formal quarterly review' } });
    await dialog.getByRole('button', { name: 'Back', exact: true }).click();
    await expect(dialog.getByLabel('Review period start', { exact: true })).toHaveValue('2026-07-01');
    await dialog.getByRole('button', { name: 'Close', exact: true }).click();
    await page.getByRole('button', { name: 'Close selected period', exact: true }).click();
    dialog = page.getByRole('dialog', { name: 'Close review period', exact: true });
    await expect(dialog.getByRole('button', { name: 'Close review period', exact: true })).toBeDisabled();
    await dialog.getByRole('button', { name: 'Close', exact: true }).click();
    await page.getByRole('tab',{name:'2 · Assessment',exact:true}).click();
    await page.getByRole('button', { name: 'Create plan', exact: true }).click();
    dialog = page.getByRole('dialog', { name: 'Development plan', exact: true });
    await expect(dialog.getByLabel('Development focus', { exact: true })).toBeVisible();
    await page.screenshot({ path: `test-artifacts/admin-development-drawer-${width}.png`, fullPage: false });
    expect(writes).toHaveLength(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  });
}

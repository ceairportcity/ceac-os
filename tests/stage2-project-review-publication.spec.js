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
    await delivery.getByRole('combobox', { name: 'Delivery of responsibilities: human rating', exact: true }).selectOption('N/O');
    await delivery.getByRole('textbox', { name: 'Delivery of responsibilities: explanation', exact: true }).fill(ratingReason);
    await ratings.getByRole('button', { name: 'Record human ratings', exact: true }).click();
    // The editor already contains this text before its asynchronous insert.
    // Wait for the fetched recorded version, then keep the database assertion.
    await expect(ratings.locator('.s2-rating-summary').getByText(ratingReason, { exact: true })).toBeVisible();
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
    await hrPage.getByRole('tab',{name:'3 · Publication',exact:true}).click();
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

test('assigned Group Pastor publishes only the HR head exact review without broader HR authority', async ({ browser }) => {
  test.setTimeout(120000);
  expect(process.env.SUPABASE_URL).toBe('http://127.0.0.1:54321');
  const url=process.env.SUPABASE_URL, key=process.env.SUPABASE_ANON_KEY;
  const options={auth:{persistSession:false,autoRefreshToken:false}};
  const service=createClient(url,process.env.SUPABASE_SERVICE_ROLE_KEY,options);
  const hr=createClient(url,key,options), pastor=createClient(url,key,options);
  const hrId='31000000-0000-4000-8000-000000000003', pastorId='31000000-0000-4000-8000-000000000004';
  const org='10000000-0000-4000-8000-000000000010', unit='20000000-0000-4000-8000-000000000011';
  const ok=result=>{expect(result.error).toBeNull();return result.data;};
  const contexts=[];
  const oldProfile=ok(await service.from('profiles').select('job_title').eq('id',pastorId).single());
  const oldEmployment=ok(await service.from('employment_records').select('*').eq('profile_id',hrId).maybeSingle());
  async function open(role){
    const context=await browser.newContext({viewport:{width:1366,height:900}});contexts.push(context);
    const page=await context.newPage();
    await page.route('**/*',route=>{
      const target=new URL(route.request().url());
      return target.hostname==='127.0.0.1' && ['5173','54321'].includes(target.port) ? route.continue() : route.abort('blockedbyclient');
    });
    await page.goto('/');
    await page.getByPlaceholder('Work email').fill(`${role}@ceac.local.test`);
    await page.getByPlaceholder('Password').fill(process.env.ROLE_FIXTURE_PASSWORD);
    await page.getByRole('button',{name:'Sign in to CEAC OS',exact:true}).click();
    await expect(page.locator('.ev2s-sidebar')).toBeVisible();
    await page.goto(`/?tab=performance&reviewPerson=${hrId}`);
    return page;
  }
  try {
    ok(await service.from('profiles').update({job_title:'Group Pastor'}).eq('id',pastorId));
    ok(await service.from('employment_records').upsert({profile_id:hrId,org_id:org,employment_type:'staff',job_title:'Administration and Head of HR',unit_id:unit,membership_role:'staff',employment_status:'active'}));
    ok(await hr.auth.signInWithPassword({email:'admin@ceac.local.test',password:process.env.ROLE_FIXTURE_PASSWORD}));
    ok(await pastor.auth.signInWithPassword({email:'exec@ceac.local.test',password:process.env.ROLE_FIXTURE_PASSWORD}));
    const cycle=ok(await hr.rpc('open_performance_review_cycle',{p_name:`Assigned HR head publication ${Date.now()}`,p_starts_on:'2026-08-01',p_ends_on:'2026-08-31',p_reason:'Synthetic owner-authorised assigned HR-head publication acceptance.'}));
    const review=ok(await hr.from('appraisals').select('id').eq('cycle_id',cycle).eq('profile_id',hrId).single());
    ok(await hr.rpc('assign_performance_reviewer',{p_appraisal_id:review.id,p_reviewer_id:pastorId,p_reason:'Owner approved this Group Pastor to review and publish the HR head exact assigned case.'}));
    const narrative=`Independent HR-head assessment ${Date.now()}`;
    ok(await pastor.rpc('record_appraisal_entry',{p_appraisal_id:review.id,p_entry_type:'manager_assessment',p_body:narrative,p_supersedes_id:null}));
    const request=ok(await pastor.rpc('performance_request_release',{p_appraisal_id:review.id,p_reason:'Exact assigned HR-head assessment prepared for a separate publication decision.'}));
    const denied=await hr.rpc('performance_hr_decide_release',{p_request_id:request,p_approve:true,p_reason:'The HR subject must remain unable to publish their own assessment.'});
    expect(denied.error?.code).toBe('42501');
    const before=await open('admin');
    await expect(before.locator('.performance-narrative p').filter({hasText:narrative})).toHaveCount(0);
    const page=await open('exec');
    await expect(page.getByText('Assigned HR-head publication decision',{exact:true})).toBeVisible();
    await page.getByLabel('HR assessment publication decision reason').fill('As the assigned Group Pastor I approve publication of this exact HR-head review under owner authority.');
    await page.getByRole('button',{name:'Publish assigned HR-head review',exact:true}).click();
    await expect(page.getByText('Group Pastor approved publication of the assigned HR-head assessment version.',{exact:true})).toBeVisible();
    const published=ok(await service.from('performance_review_release_requests').select('state,decided_by,requested_by').eq('id',request).single());
    expect(published).toEqual({state:'approved',decided_by:pastorId,requested_by:pastorId});
    expect((await pastor.rpc('admin_employment_detail',{p_profile_id:hrId})).error?.code).toBe('42501');
    await before.reload();
    await before.getByRole("tab",{name:"2 · Assessment",exact:true}).click();
    await expect(before.locator('.performance-narrative p').filter({hasText:narrative})).toBeVisible();
    await page.screenshot({path:'test-artifacts/assigned-hr-head-pastor-publication.png',fullPage:true});
    await page.setViewportSize({width:390,height:844});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    await page.screenshot({path:'test-artifacts/assigned-hr-head-pastor-publication-phone.png',fullPage:true});
  } finally {
    for(const context of contexts)await context.close().catch(()=>{});
    ok(await service.from('profiles').update({job_title:oldProfile.job_title}).eq('id',pastorId));
    if(oldEmployment)ok(await service.from('employment_records').upsert(oldEmployment));
    await hr.auth.signOut();await pastor.auth.signOut();
  }
});

import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

for (const actor of ['staff', 'manager', 'admin', 'exec']) {
  test(`${actor} creates, records and manages their own organisational routine without colleague credit`, async ({ browser }) => {
    expect(process.env.SUPABASE_URL).toBe('http://127.0.0.1:54321');
    const password = process.env.ROLE_FIXTURE_PASSWORD;
    const today = new Date().toISOString().slice(0,10);
    const title = `Own daily responsibility ${actor} ${Date.now()}`;
    const context = await browser.newContext({ viewport: { width:390, height:844 } });
    const page = await context.newPage();
    const client = createClient(process.env.SUPABASE_URL,process.env.SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
    const colleague = createClient(process.env.SUPABASE_URL,process.env.SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
    try {
      await page.route('**/*', route => {
        const url = new URL(route.request().url());
        return url.hostname === '127.0.0.1' && ['5173','54321'].includes(url.port) ? route.continue() : route.abort('blockedbyclient');
      });
      await page.goto('/');
      await page.getByPlaceholder('Work email').fill(`${actor}@ceac.local.test`);
      await page.getByPlaceholder('Password').fill(password);
      await page.getByRole('button',{name:'Sign in to CEAC OS',exact:true}).click();
      await expect(page.locator('.ev2s-workspace')).toBeVisible();
      await page.goto('/?tab=work');
      await page.getByRole('button',{name:'Add my work',exact:true}).click();
      if (actor === 'staff') {
        await page.getByPlaceholder('What are you doing?').fill(title);
        await page.getByPlaceholder('What should be true when this is finished?').fill('Confirm the venue is ready each day.');
        await page.getByPlaceholder('What must be done?').fill('Inspect the venue');
      } else {
        await page.getByLabel('My responsibility title',{exact:true}).fill(title);
        await page.getByLabel('Expected result',{exact:true}).fill('Confirm the venue is ready each day.');
        await page.getByLabel('Step 1',{exact:true}).fill('Inspect the venue');
      }
      await page.getByRole('checkbox',{name:'Repeat this responsibility'}).check();
      await page.getByRole('combobox',{name:'Repeat frequency'}).selectOption('daily');
      await page.getByLabel('Repeat starts',{exact:true}).fill(today);
      if (actor === 'staff') await page.getByRole('button',{name:'Add to my work',exact:true}).click();
      else await page.locator('form').getByRole('button',{name:'Add my work',exact:true}).click();
      await expect(page.locator('.s2-register-row').filter({hasText:title})).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
      const signedIn = await client.auth.signInWithPassword({email:`${actor}@ceac.local.test`,password});
      expect(signedIn.error).toBeNull();
      const saved = await client.from('work_items').select('id,ref,kind,origin,assignee_id,assigned_by,unit_id,status,visibility').eq('title',title).single();
      expect(saved.error, saved.error?.message).toBeNull();
      expect(saved.data).toMatchObject({kind:'routine',origin:'self_created',visibility:'unit',assignee_id:signedIn.data.user.id,assigned_by:signedIn.data.user.id,status:'in_progress'});
      const steps = await client.from('checklist_items').select('label').eq('work_item_id',saved.data.id);
      expect(steps.error).toBeNull();
      expect(steps.data.map(row=>row.label)).toEqual(['Inspect the venue']);
      const params = {p_work_item_id:saved.data.id,p_occurred_on:today,p_note:'Venue inspected'};
      const colleagueSignIn = await colleague.auth.signInWithPassword({email:'sameunit@ceac.local.test',password});
      expect(colleagueSignIn.error).toBeNull();
      expect((await colleague.rpc('record_routine_occurrence',params)).error?.code).toBe('42501');
      await page.locator('.s2-register-row').filter({hasText:title}).locator('th button').click();
      await page.getByRole('complementary',{name:'Selected responsibility'})
        .getByRole('button',{name:/Open complete work record/}).click();
      await expect(page.getByRole('region',{name:'Routine method'})).toBeVisible();
      await expect(page.getByRole('region',{name:'Task checklist and progress'})).toHaveCount(0);
      await expect(page.getByRole('button',{name:'Change future schedule',exact:true})).toBeVisible();
      await expect(page.getByRole('button',{name:'Pause routine',exact:true})).toBeVisible();
      await page.getByRole('button',{name:'Record occurrence',exact:true}).click();
      const dialog = page.getByRole('dialog');
      await dialog.getByPlaceholder('Note (optional)').fill('Venue inspected');
      await dialog.getByRole('button',{name:'Record occurrence',exact:true}).click();
      await expect(dialog).toHaveCount(0);
      await expect(page.getByText('Venue inspected',{exact:true})).toBeVisible();
      // The separately attributable dated evidence editor reuses the existing
      // immutable Work diary; this does not approve or rewrite the occurrence.
      await page.getByRole('button',{name:`Record evidence for ${today}`}).click();
      const activityDate = page.getByLabel('Activity date',{exact:true});
      await expect(activityDate).toHaveValue(today);
      await page.getByLabel('Action taken or planned',{exact:true}).fill('Inspected venue and verified entrances');
      await page.getByRole('button',{name:'Record activity',exact:true}).click();
      await expect(page.getByText('Your dated activity was recorded.',{exact:true})).toBeVisible();
      const datedEvidence = await client.from('work_activity_records')
        .select('id,contributor_id,activity_date,action_summary')
        .eq('work_item_id',saved.data.id).eq('activity_date',today);
      expect(datedEvidence.error).toBeNull();
      expect(datedEvidence.data).toEqual([expect.objectContaining({
        contributor_id:signedIn.data.user.id,activity_date:today,
        action_summary:'Inspected venue and verified entrances',
      })]);
      expect((await client.rpc('record_routine_occurrence',params)).error?.code).toBe('23505');
      const routine = await client.from('recurring_operations').select('id').eq('work_item_id',saved.data.id).single();
      expect(routine.error).toBeNull();
      const proof = await client.from('operation_occurrences').select('occurred_on,recorded_by,note').eq('operation_id',routine.data.id);
      expect(proof.error).toBeNull();
      expect(proof.data).toEqual([{occurred_on:today,recorded_by:signedIn.data.user.id,note:'Venue inspected'}]);
      const change = {p_work_item_id:saved.data.id,p_paused:true,p_reason:'Venue unavailable'};
      expect((await colleague.rpc('set_routine_paused',change)).error).not.toBeNull();
      expect((await client.rpc('set_routine_paused',change)).error).toBeNull();
      expect((await client.rpc('set_routine_paused',change)).error).toBeNull();
      const paused = await client.from('routine_pause_periods').select('paused_at,paused_by,resumed_at,pause_reason').eq('operation_id',routine.data.id);
      expect(paused.error).toBeNull();
      expect(paused.data).toHaveLength(1);
      expect(paused.data[0]).toMatchObject({paused_by:signedIn.data.user.id,resumed_at:null,pause_reason:'Venue unavailable'});
      expect((await client.from('routine_pause_periods').insert({
        operation_id:routine.data.id,org_id:signedIn.data.user.id,paused_at:new Date().toISOString(),
      })).error?.code).toBe('42501');
      expect((await client.rpc('record_routine_occurrence',params)).error?.code).toBe('22023');
      expect((await client.rpc('set_routine_paused',{...change,p_paused:false,p_reason:'Venue available'})).error).toBeNull();
      expect((await client.rpc('set_routine_paused',{...change,p_paused:false,p_reason:'Resume retry'})).error).toBeNull();
      const resumed = await client.from('routine_pause_periods').select('paused_at,resumed_at,resumed_by,resume_reason').eq('operation_id',routine.data.id);
      expect(resumed.error).toBeNull();
      expect(resumed.data).toHaveLength(1);
      expect(resumed.data[0]).toMatchObject({paused_at:paused.data[0].paused_at,resumed_by:signedIn.data.user.id,resume_reason:'Venue available'});
      expect(resumed.data[0].resumed_at).not.toBeNull();
      const tomorrow = new Date(today+'T12:00:00Z'); tomorrow.setUTCDate(tomorrow.getUTCDate()+1);
      expect((await client.rpc('change_routine_schedule',{p_work_item_id:saved.data.id,p_effective_from:tomorrow.toISOString().slice(0,10),p_schedule_kind:'weekly',p_weekdays:[6]})).error).toBeNull();
      const wrongAssignee = await client.rpc('create_typed_work',{
        p_kind:'routine',p_unit_id:saved.data.unit_id,p_assignee_id:colleagueSignIn.data.user.id,
        p_title:title+' forbidden',p_expected_outcome:'Must not create another person’s self-work',
        p_details:{origin:'self_created',schedule_kind:'daily',starts_on:today},
      });
      expect(wrongAssignee.error?.code).toBe('42501');
      const unchanged = await client.from('work_items').select('status').eq('id',saved.data.id).single();
      expect(unchanged.data.status).toBe('in_progress');
      await page.screenshot({path:`test-artifacts/self-routine-${actor}-phone.png`,fullPage:true});
    } finally {
      await client.auth.signOut(); await colleague.auth.signOut(); await context.close();
    }
  });
}

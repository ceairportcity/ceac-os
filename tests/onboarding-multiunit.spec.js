import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

test('one Manager account keeps two headships across switching and reload', async ({ browser }) => {
  const url=process.env.SUPABASE_URL;
  expect(new URL(url).hostname).toMatch(/^(127\.0\.0\.1|localhost)$/);
  const service=createClient(url,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
  const admin=createClient(url,process.env.SUPABASE_ANON_KEY,{auth:{persistSession:false}});
  const signed=await admin.auth.signInWithPassword({email:'admin@ceac.local.test',password:process.env.ROLE_FIXTURE_PASSWORD});
  expect(signed.error).toBeNull();
  const org='10000000-0000-4000-8000-000000000010', manager=crypto.randomUUID(), first=crypto.randomUUID();
  const email='foundation-'+manager+'@ceac.local.test';
  const unit=crypto.randomUUID();
  const created=await service.from('units').insert({id:unit,org_id:org,name:'Foundation second responsibility',code:'F'+unit.slice(0,7)});
  expect(created.error).toBeNull();
  expect((await service.from('units').insert({id:first,org_id:org,name:'Foundation first responsibility',code:'F'+first.slice(0,7)})).error).toBeNull();
  expect((await service.from('pending_invitations').insert({org_id:org,email,full_name:'Foundation Manager',unit_id:first,role:'staff',invited_by:signed.data.user.id,expires_at:new Date(Date.now()+3600000).toISOString()})).error).toBeNull();
  expect((await service.auth.admin.createUser({id:manager,email,password:process.env.ROLE_FIXTURE_PASSWORD,email_confirm:true})).error).toBeNull();
  expect((await admin.rpc('admin_record_unit_responsibility',{p_profile_id:manager,p_unit_id:first,p_role:'manager',p_action:'add',p_reason:'Isolated first browser headship'})).error).toBeNull();
  expect((await admin.rpc('grant_capability',{p_profile_id:manager,p_capability:'audit.view',p_scope_unit_id:null,p_reason:'Isolated organisation grant persistence check'})).error).toBeNull();
  const before=await service.from('capability_grants').select('id,capability,scope_unit_id,revoked_at').eq('profile_id',manager);
  expect(before.data).toHaveLength(1);
  let context;
  try {
    const added=await admin.rpc('admin_record_unit_responsibility',{p_profile_id:manager,p_unit_id:unit,p_role:'manager',p_action:'add',p_reason:'Isolated browser headship acceptance'});
    expect(added.error).toBeNull();
    context=await browser.newContext(); const page=await context.newPage();
    await page.goto('/');
    await page.getByPlaceholder('Work email').fill(email);
    await page.getByPlaceholder('Password').fill(process.env.ROLE_FIXTURE_PASSWORD);
    await page.getByRole('button',{name:'Sign in'}).click();
    await expect(page.locator('.manager-app')).toBeVisible();
    const switcher=page.getByRole('combobox',{name:'Current unit'}).first();
    await expect(switcher.locator('option')).toHaveCount(2);
    await switcher.selectOption(unit); await expect(switcher).toHaveValue(unit);
    await page.reload(); await expect(page.getByRole('combobox',{name:'Current unit'}).first()).toHaveValue(unit);
    // The Report panel must refresh as a new unit-scoped surface, not reuse
    // evidence or authoring state from the previous Manager headship.
    await page.goto('/?tab=manager-reports');
    await expect(page.locator('.ev2-reporting-manager .ev2rep-eyebrow')).toHaveText('Foundation second responsibility');
    await page.getByRole('combobox',{name:'Current unit'}).first().selectOption(first);
    // A headship switch correctly returns to Overview, not to stale Reports.
    await expect(page).toHaveURL(/tab=home/);
    await page.goto('/?tab=manager-reports');
    await expect(page.locator('.ev2-reporting-manager .ev2rep-eyebrow')).toHaveText('Foundation first responsibility');
    await expect(page.locator('.manager-app')).toBeVisible();
    const memberships=await service.from('unit_memberships').select('unit_id,role').eq('profile_id',manager).eq('role','manager');
    expect(memberships.data).toHaveLength(2);
    const identity=await service.from('profiles').select('id').eq('email',email); expect(identity.data).toHaveLength(1);
    const after=await service.from('capability_grants').select('id,capability,scope_unit_id,revoked_at').eq('profile_id',manager); expect(after.data).toEqual(before.data);
  } finally {
    await context?.close();
    const ended=await admin.rpc('admin_record_unit_responsibility',{p_profile_id:manager,p_unit_id:unit,p_role:'manager',p_action:'remove',p_reason:'End isolated browser headship acceptance'});
    expect(ended.error).toBeNull();
    // Keep the isolated unit inactive so its referenced audit/history remains intact.
    const closed=await service.from('units').update({active:false}).in('id',[unit,first]); expect(closed.error).toBeNull();
    // The strengthened identity trigger rejects service-role deactivation without
    // an attributable CEAC actor. Do not bypass the protection just to erase
    // a disposable test account; prove the denial and preserve history.
    const unattributed = await service.from('profiles')
      .update({active:false}).eq('id',manager);
    expect(unattributed.error?.code).toBe('42501');
    const preserved = await service.from('profiles')
      .select('id,active').eq('id',manager).single();
    expect(preserved.error).toBeNull();
    expect(preserved.data.active).toBe(true);
    await admin.auth.signOut();
  }
});

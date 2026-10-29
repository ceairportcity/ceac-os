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
    const unrelated = createClient(process.env.SUPABASE_URL,process.env.SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
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
        .getByRole('button',{name:/Open full work record/}).click();
      await expect(page.getByRole('region',{name:'Routine method'})).toBeVisible();
      await expect(page.getByRole('region',{name:'Task checklist and progress'})).toHaveCount(0);
      await expect(page.getByRole('button',{name:'Change future schedule',exact:true})).toBeVisible();
      await expect(page.getByRole('button',{name:'Pause routine',exact:true})).toBeVisible();
      const dateProgress=page.getByRole('region',{name:'Progress for a routine date',exact:true});
      await expect(dateProgress.getByRole('button',{name:'Save date progress',exact:true})).toBeVisible();
      await dateProgress.getByRole('checkbox',{name:'Inspect the venue',exact:true}).check();
      await dateProgress.getByRole('combobox',{name:'Status for this date',exact:true}).selectOption('ready_for_review');
      await dateProgress.getByLabel('Progress note',{exact:true}).fill('Checklist checked for this date');
      await dateProgress.getByLabel('Evidence links, one per line',{exact:true}).fill('https://example.org/venue-evidence');
      await dateProgress.getByRole('button',{name:'Save date progress',exact:true}).click();
      await expect(dateProgress.getByText('1 recorded update for '+today,{exact:true})).toBeVisible();
      const datedRoutine=await client.from('recurring_operations').select('id').eq('work_item_id',saved.data.id).single();
      expect(datedRoutine.error).toBeNull();
      const datedProgress=await client.from('routine_date_progress').select('id,actor_id,status,scheduled_on,entry_number,checklist_snapshot,evidence_links')
        .eq('operation_id',datedRoutine.data.id).eq('scheduled_on',today);
      expect(datedProgress.error,datedProgress.error?.message).toBeNull();
      expect(datedProgress.data).toEqual([expect.objectContaining({actor_id:signedIn.data.user.id,status:'ready_for_review',scheduled_on:today,entry_number:1,
        checklist_snapshot:[expect.objectContaining({label:'Inspect the venue',done:true})],evidence_links:['https://example.org/venue-evidence']})]);
      const datedFiles=dateProgress.locator('.operational-files').filter({hasText:'Evidence files for '+today});
      const evidenceName='venue-proof-'+actor+'.txt';
      const evidenceBytes=Buffer.from('Independent '+actor+' venue evidence '+title);
      await datedFiles.locator('input[type=file]').setInputFiles({name:evidenceName,mimeType:'text/plain',buffer:evidenceBytes});
      await expect(datedFiles.getByRole('button').filter({hasText:evidenceName})).toBeVisible();
      const fileLink=await client.from('operational_file_links')
        .select('context_id,relation,file:operational_files!inner(id,storage_bucket,storage_path,state)')
        .eq('context_type','routine_date_progress').eq('context_id',datedProgress.data[0].id).single();
      expect(fileLink.error,fileLink.error?.message).toBeNull();
      expect(fileLink.data.relation).toBe('routine_evidence');
      expect(fileLink.data.file.state).toBe('active');
      expect(fileLink.data.file.storage_path).toContain('/routine-date/'+datedProgress.data[0].id+'/');
      const downloaded=await client.storage.from(fileLink.data.file.storage_bucket).download(fileLink.data.file.storage_path);
      expect(downloaded.error,downloaded.error?.message).toBeNull();
      expect(Buffer.from(await downloaded.data.arrayBuffer())).toEqual(evidenceBytes);
      expect((await unrelated.auth.signInWithPassword({email:'managerb@ceac.local.test',password})).error).toBeNull();
      const hiddenFile=await unrelated.from('operational_files').select('id').eq('id',fileLink.data.file.id);
      expect(hiddenFile.error).toBeNull();expect(hiddenFile.data).toEqual([]);
      expect((await unrelated.storage.from(fileLink.data.file.storage_bucket).download(fileLink.data.file.storage_path)).error).not.toBeNull();
      expect((await unrelated.storage.from(fileLink.data.file.storage_bucket).createSignedUrl(fileLink.data.file.storage_path,60)).error).not.toBeNull();

      expect((await colleague.rpc('register_operational_file',{p_context_type:'routine_date_progress',p_context_id:datedProgress.data[0].id,
        p_relation:'routine_evidence',p_filename:'impersonation.txt',p_mime_type:'text/plain',p_size_bytes:12})).error?.code).toBe('42501');
      expect((await client.from('operation_occurrences').select('id').eq('operation_id',datedRoutine.data.id)).data).toEqual([]);
      expect((await colleague.from('routine_date_progress').insert({org_id:'10000000-0000-4000-8000-000000000010',operation_id:datedRoutine.data.id,
        scheduled_on:today,entry_number:2,actor_id:colleagueSignIn.data.user.id,status:'in_progress'})).error?.code).toBe('42501');
      await dateProgress.getByLabel('Scheduled date',{exact:true}).fill(new Date(Date.parse(today+'T12:00:00Z')-86400000).toISOString().slice(0,10));
      await expect(dateProgress.getByRole('alert')).toContainText('not scheduled');
      await expect(dateProgress.getByRole('checkbox',{name:'Inspect the venue',exact:true})).toHaveCount(0);
      await dateProgress.getByLabel('Scheduled date',{exact:true}).fill(today);
      await expect(dateProgress.getByRole('checkbox',{name:'Inspect the venue',exact:true})).toBeChecked();
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
      await client.auth.signOut(); await colleague.auth.signOut(); await unrelated.auth.signOut(); await context.close();
    }
  });
}


test("custom self routine keeps exact interval/count/timezone and future edits preserve the earlier date", async ({browser})=>{
 expect(process.env.SUPABASE_URL).toBe("http://127.0.0.1:54321");
 const context=await browser.newContext({viewport:{width:390,height:844}});
 const page=await context.newPage();
 const client=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
 const day=(offset)=>{const d=new Date();d.setUTCDate(d.getUTCDate()+offset);return d.toISOString().slice(0,10);};
 const title="Custom two-day venue check "+Date.now();
 try {
  await page.route("**/*",route=>{const u=new URL(route.request().url());return u.hostname==="127.0.0.1"&&["5173","54321"].includes(u.port)?route.continue():route.abort("blockedbyclient");});
  await page.goto("/");
  await page.getByPlaceholder("Work email").fill("staff@ceac.local.test");
  await page.getByPlaceholder("Password").fill(process.env.ROLE_FIXTURE_PASSWORD);
  await page.getByRole("button",{name:"Sign in to CEAC OS",exact:true}).click();
  await expect(page.locator(".ev2s-workspace")).toBeVisible();
  await page.goto("/?tab=work");
  await page.getByRole("button",{name:"Add my work",exact:true}).click();
  await page.getByPlaceholder("What are you doing?").fill(title);
  await page.getByPlaceholder("What should be true when this is finished?").fill("Inspect the venue on each scheduled date.");
  await page.getByPlaceholder("What must be done?").fill("Inspect venue");
  await page.getByRole("checkbox",{name:"Repeat this responsibility"}).check();
  await page.getByRole("combobox",{name:"Repeat frequency"}).selectOption("daily");
  await page.getByLabel("Repeat starts",{exact:true}).fill(day(1));
  await page.getByLabel("Repeat every",{exact:true}).fill("2");
  await page.getByLabel("Schedule time zone",{exact:true}).fill("Europe/Amsterdam");
  await page.getByLabel("Occurrence due time",{exact:true}).fill("09:30");
  await page.getByLabel("End after scheduled dates",{exact:true}).fill("3");
  await page.getByRole("button",{name:"Add to my work",exact:true}).click();
  const register=page.locator(".s2-register-row").filter({hasText:title});
  await expect(register).toBeVisible();
  expect((await client.auth.signInWithPassword({email:"staff@ceac.local.test",password:process.env.ROLE_FIXTURE_PASSWORD})).error).toBeNull();
  const work=await client.from("work_items").select("id").eq("title",title).single();
  expect(work.error).toBeNull();
  const preview=await client.rpc("routine_schedule_preview",{p_work_item_ids:[work.data.id],p_from_date:day(0),p_through_date:day(14)});
  expect(preview.error,preview.error?.message).toBeNull();
  expect(preview.data.map(row=>row.scheduled_on)).toEqual([day(1),day(3),day(5)]);
  for(const row of preview.data) expect(new Intl.DateTimeFormat("en-GB",{timeZone:"Europe/Amsterdam",hour:"2-digit",minute:"2-digit"}).format(new Date(row.due_at))).toBe("09:30");
  expect((await client.schema("private").rpc("change_routine_schedule_options",{p_work_item_id:work.data.id,p_effective_from:day(2),p_options:{schedule_kind:"daily"}})).error?.code).toBe("PGRST106");
  await register.locator("th button").click();
  await page.getByRole("complementary",{name:"Selected responsibility"}).getByRole("button",{name:/Open full work record/}).click();
  await page.getByRole("button",{name:"Change future schedule",exact:true}).click();
  const dialog=page.getByRole("dialog");
  await dialog.getByLabel("Effective from").fill(day(2));
  await dialog.getByLabel("Repeat every",{exact:true}).fill("3");
  await dialog.getByRole("button",{name:"Save schedule",exact:true}).click();
  await expect(dialog).toHaveCount(0);
  const changed=await client.rpc("routine_schedule_preview",{p_work_item_ids:[work.data.id],p_from_date:day(0),p_through_date:day(14)});
  expect(changed.error,changed.error?.message).toBeNull();
  expect(changed.data.map(row=>row.scheduled_on)).toEqual([day(1),day(2),day(5),day(8)]);
  expect(changed.data.map(row=>row.schedule_version)).toEqual([1,2,2,2]);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  await page.screenshot({path:"test-artifacts/custom-routine-options-phone.png",fullPage:true});
 } finally {await client.auth.signOut();await context.close();}
});


test('Manager arranges one-date cover; colleague follows Work and Calendar, records actual private proof and receives independent review',async({browser})=>{
 test.setTimeout(90000);
 expect(process.env.SUPABASE_URL).toBe('http://127.0.0.1:54321');
 const password=process.env.ROLE_FIXTURE_PASSWORD,today=new Date().toISOString().slice(0,10);
 const manager=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_ANON_KEY,{auth:{persistSession:false}});
 const colleague=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_ANON_KEY,{auth:{persistSession:false}});
 const original=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_ANON_KEY,{auth:{persistSession:false}});
 for(const [client,email] of [[manager,'manager'],[colleague,'sameunit'],[original,'staff']])expect((await client.auth.signInWithPassword({email:email+'@ceac.local.test',password})).error).toBeNull();
 const title='Dated cover venue '+Date.now();
 const created=await manager.rpc('create_typed_work',{p_kind:'routine',p_unit_id:'20000000-0000-4000-8000-000000000011',p_title:title,p_assignee_id:'31000000-0000-4000-8000-000000000001',p_expected_outcome:'Inspect venue on each scheduled date',p_details:{schedule_kind:'daily',starts_on:today}});
 expect(created.error,created.error?.message).toBeNull();const id=created.data;
 const contexts=[];
 async function signIn(email,width){const context=await browser.newContext({viewport:{width,height:844}});contexts.push(context);const page=await context.newPage();
  await page.goto('/');await page.getByPlaceholder('Work email').fill(email+'@ceac.local.test');await page.getByPlaceholder('Password').fill(password);await page.getByRole('button',{name:'Sign in to CEAC OS',exact:true}).click();await expect(page.locator('.ev2s-workspace')).toBeVisible();return page;}
 try{
  const page=await signIn('manager',1366);await page.goto('/?tab=work&item='+id+'&routineDate='+today);
  const cover=page.getByRole('region',{name:'Cover for this routine date',exact:true});await expect(cover).toBeVisible();
  await cover.locator('summary').filter({hasText:'Arrange or restore date cover'}).click();
  await cover.getByRole('combobox',{name:'Cover person',exact:true}).selectOption('31000000-0000-4000-8000-000000000006');
  await cover.getByLabel('Reason for date cover',{exact:true}).fill('Manager authorised colleague to inspect the venue today');
  await cover.getByRole('button',{name:'Assign date cover',exact:true}).click();await expect(cover.getByText('Cover: Same Unit Fixture. Other dates keep their own assignment.',{exact:true})).toBeVisible();
  const originalPage=await signIn('staff',390);await originalPage.goto('/?tab=work&item='+id+'&routineDate='+today);
  const originalDate=originalPage.getByRole('region',{name:'Progress for a routine date',exact:true});
  await expect(originalDate.getByText('Cover: Same Unit Fixture. Other dates keep their own assignment.',{exact:true})).toBeVisible();
  await expect(originalDate.getByRole('button',{name:'Save date progress',exact:true})).toHaveCount(0);
  await expect(originalPage.getByRole('button',{name:'Record occurrence',exact:true})).toHaveCount(0);
  expect((await original.rpc('record_routine_occurrence',{p_work_item_id:id,p_occurred_on:today,p_note:'Original cannot claim cover'})).error?.code).toBe('42501');
  const coveredPage=await signIn('sameunit',390);await coveredPage.goto('/?tab=work');
  const recurring=coveredPage.getByRole('region',{name:'My scheduled recurring work',exact:true});await expect(recurring.getByRole('button').filter({hasText:title})).toBeVisible();
  await recurring.getByRole('button').filter({hasText:title}).click();
  const date=coveredPage.getByRole('region',{name:'Progress for a routine date',exact:true});await expect(date.getByText('Cover assigned to you. Other dates keep their own assignment.',{exact:true})).toBeVisible();
  await coveredPage.goto('/?tab=staff-calendar');
  const calendarCover=coveredPage.locator('.phase6-schedule-row button').filter({hasText:title});await expect(calendarCover).toBeVisible();
  await calendarCover.click();await expect(date.getByLabel('Scheduled date',{exact:true})).toHaveValue(today);
  await date.getByLabel('Progress note',{exact:true}).fill('Actual cover inspection recorded by the colleague');
  await date.getByRole('combobox',{name:'Status for this date',exact:true}).selectOption('ready_for_review');
  await date.getByRole('button',{name:'Save date progress',exact:true}).click();await expect(date.getByText('1 recorded update for '+today,{exact:true})).toBeVisible();
  const operation=await colleague.from('recurring_operations').select('id').eq('work_item_id',id).single();expect(operation.error).toBeNull();
  const progress=await colleague.from('routine_date_progress').select('id,actor_id,scheduled_on').eq('operation_id',operation.data.id).single();expect(progress.error).toBeNull();expect(progress.data.actor_id).toBe('31000000-0000-4000-8000-000000000006');
  const bytes=Buffer.from('Actual colleague cover proof '+title),filename='dated-cover-proof.txt';
  const files=date.locator('.operational-files').filter({hasText:'Evidence files for '+today});await files.locator('input[type=file]').setInputFiles({name:filename,mimeType:'text/plain',buffer:bytes});await expect(files.getByRole('button').filter({hasText:filename})).toBeVisible();
  const linked=await colleague.from('operational_file_links').select('file:operational_files!inner(storage_bucket,storage_path)').eq('context_type','routine_date_progress').eq('context_id',progress.data.id).single();expect(linked.error).toBeNull();
  const downloaded=await colleague.storage.from(linked.data.file.storage_bucket).download(linked.data.file.storage_path);expect(downloaded.error).toBeNull();expect(Buffer.from(await downloaded.data.arrayBuffer())).toEqual(bytes);
  expect((await original.rpc('register_operational_file',{p_context_type:'routine_date_progress',p_context_id:progress.data.id,p_relation:'routine_evidence',p_filename:'impersonate.txt',p_mime_type:'text/plain',p_size_bytes:12})).error?.code).toBe('42501');
  await date.getByRole('button',{name:'Record occurrence',exact:true}).click();const dialog=coveredPage.getByRole('dialog');await dialog.getByPlaceholder('Note (optional)').fill('Cover colleague completed the inspection');await dialog.getByRole('button',{name:'Record occurrence',exact:true}).click();await expect(dialog).toHaveCount(0);
  const outcome=await colleague.from('operation_occurrences').select('id,recorded_by').eq('operation_id',operation.data.id).single();expect(outcome.error).toBeNull();expect(outcome.data.recorded_by).toBe('31000000-0000-4000-8000-000000000006');
  expect((await colleague.from('routine_occurrence_reviews').insert({org_id:'10000000-0000-4000-8000-000000000010',occurrence_id:outcome.data.id,reviewer_id:outcome.data.recorded_by,decision:'accepted'})).error?.code).toBe('42501');
  await page.reload();await page.getByRole('button',{name:'Review date',exact:true}).click();
  const review=page.getByRole('region',{name:'Routine occurrence review history',exact:true});await review.getByLabel('Review note',{exact:true}).fill('Independently verified the dated cover evidence');await review.getByRole('button',{name:'Record human review',exact:true}).click();
  await expect(page.getByText(/Reviewed · accepted/).first()).toBeVisible();
  expect((await manager.rpc('routine_set_date_cover',{p_work_item_id:id,p_scheduled_on:today,p_assignee_id:null,p_reason:'Cannot replace actual recorded contributor',p_expected_version:1})).error?.code).toBe('22023');
  expect((await manager.from('work_items').select('assignee_id').eq('id',id).single()).data.assignee_id).toBe('31000000-0000-4000-8000-000000000001');
  expect(await coveredPage.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  await coveredPage.screenshot({path:'test-artifacts/stage2-cover-colleague-phone.png',fullPage:true});await page.screenshot({path:'test-artifacts/stage2-cover-independent-manager.png',fullPage:true});
 }finally{await Promise.allSettled(contexts.map(context=>context.close()));}
});

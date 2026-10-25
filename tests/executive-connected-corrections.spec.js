import { test, expect } from '@playwright/test';

test.setTimeout(90000);

const executiveId = '31000000-0000-4000-8000-000000000004';
const unitA = '20000000-0000-4000-8000-000000000011';

async function signIn(page) {
  // Frontend no-membership state. The independent SQL gate proves the same
  // no-membership authority with real membership removal and rollback.
  await page.route('**/rest/v1/unit_memberships?*', async route => {
    const query = new URL(route.request().url()).searchParams;
    if (query.get('profile_id') === `eq.${executiveId}`) {
      await route.fulfill({status:200,contentType:'application/json',headers:{'content-range':'*/0'},body:'[]'});
    } else await route.continue();
  });
  await page.goto('/');
  await page.getByPlaceholder('Work email').fill('exec@ceac.local.test');
  await page.getByPlaceholder('Password').fill(process.env.ROLE_FIXTURE_PASSWORD);
  await page.getByRole('button',{name:'Sign in'}).click();
  await expect(page.locator('.executive-app')).toBeVisible();
}

for (const width of [320,390,430,1440]) {
  test(`Executive replacement destinations and directory journey at ${width}px`, async ({page},testInfo) => {
    await page.setViewportSize({width,height:960});
    await signIn(page);
    await page.goto('/?tab=exec-organisation');
    await expect(page.getByRole('heading',{name:'Organisation',exact:true})).toBeVisible();
    const department = page.getByRole('button',{name:/Test Unit A/});
    await expect(department).toBeVisible();
    expect(await department.evaluate(node => getComputedStyle(node.querySelector('.exec-redesign-icon')).color)).toBe('rgb(113, 72, 232)');
    await page.screenshot({path:testInfo.outputPath(`organisation-${width}.png`),fullPage:true});
    await department.click();
    await expect(page.getByRole('heading',{name:'Test Unit A',exact:true})).toBeVisible();
    await page.getByRole('button',{name:/^Staff Fixture/}).first().click();
    await expect(page.getByRole('heading',{name:'Staff Fixture',exact:true})).toBeVisible();
    await page.reload();
    await expect(page.getByRole('heading',{name:'Staff Fixture',exact:true})).toBeVisible();
    await page.getByRole('button',{name:/Back to previous view/}).click();
    await expect(page.getByRole('heading',{name:'Test Unit A',exact:true})).toBeVisible();
    await page.getByRole('button',{name:'Give out work',exact:true}).click();
    const dialog=page.getByRole('dialog',{name:'Give out work'});
    await expect(dialog.getByRole('combobox',{name:'Assignment department'})).toHaveValue(unitA);
    await expect(dialog.getByRole('combobox',{name:'Work type'})).toBeVisible();
    if (width<900) expect(await dialog.getByRole('textbox',{name:'Work to complete'}).evaluate(node=>getComputedStyle(node).fontSize)).toBe('16px');
    for (const kind of ['routine','case','request','decision','meeting_outcome','deliverable','task']) {
      await dialog.getByRole('combobox',{name:'Work type'}).selectOption(kind);
      await expect(dialog.getByRole('combobox',{name:'Work type'})).toHaveValue(kind);
    }
    expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
    for (const [tab,heading] of [['exec-finance','Finance'],['exec-reports','Reports'],['exec-calendar','Calendar'],['account','Your account']]) {
      await page.goto(`/?tab=${tab}`);
      const title=page.getByRole('heading',{name:heading,exact:true}).first();
      await expect(title).toBeVisible();
      if (tab === 'strategy') {
        const primary=page.getByRole('button',{name:'New Ministry Objective',exact:true});
        const secondary=page.getByRole('button',{name:'Add Ministry Direction',exact:true});
        expect(await primary.evaluate(node=>getComputedStyle(node).backgroundImage)).toBe('none');
        expect(await primary.evaluate(node=>getComputedStyle(node).backgroundColor)).toBe('rgb(113, 72, 232)');
        expect(await primary.evaluate(node=>getComputedStyle(node).color)).toBe('rgb(255, 255, 255)');
        expect(await secondary.evaluate(node=>getComputedStyle(node).backgroundColor)).toBe('rgb(255, 255, 255)');
      }
      expect(await title.evaluate(node=>getComputedStyle(node).fontFamily)).toContain('Instrument Sans');
      expect(await title.evaluate(node=>parseFloat(getComputedStyle(node).fontSize))).toBe(width<900?25:28);
      expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
      await page.screenshot({path:testInfo.outputPath(`${tab}-${width}.png`),fullPage:true});
    }
  });
}

test('Executive without department can choose an assignment department and cancel self work',async ({page})=>{
  await signIn(page);
  await page.goto('/?tab=work');
  await page.getByRole('button',{name:'Give out work',exact:true}).first().click();
  let dialog=page.getByRole('dialog',{name:'Give out work'});
  await dialog.getByRole('combobox',{name:'Assignment department'}).selectOption(unitA);
  await expect(dialog.getByRole('combobox',{name:'Work type'})).toBeVisible();
  await dialog.getByRole('textbox',{name:'Work to complete'}).fill('Unsaved department context');
  page.once('dialog',confirmation=>confirmation.accept());
  await dialog.getByRole('combobox',{name:'Assignment department'}).selectOption('20000000-0000-4000-8000-000000000012');
  await expect(dialog.getByRole('textbox',{name:'Work to complete'})).toHaveValue('');
  await expect(dialog.getByRole('combobox',{name:'Responsible person'}).locator('option[value="31000000-0000-4000-8000-000000000005"]')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'Add my work',exact:true}).first().click();
  await expect(page.getByRole('combobox',{name:'Department for my work'})).toBeVisible();
  await page.getByRole('combobox',{name:'Department for my work'}).selectOption(unitA);
  await expect(page.getByText(/Your Executive role does not require department membership/)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('combobox',{name:'Department for my work'})).not.toBeVisible();
});

test('Executive person contact opens a shared room with a verified mention, without sending',async ({page})=>{
  await signIn(page);
  await page.goto('/?tab=exec-organisation');
  await page.getByRole('button',{name:/Test Unit A/}).click();
  await page.getByRole('button',{name:/^Staff Fixture/}).first().click();
  await expect(page.getByText('Room messages are shared with the department.',{exact:false})).toBeVisible();
  const sent=[];
  await page.route('**/rest/v1/rpc/send_room_message',async route=>{
    sent.push(route.request().postData());
    await route.abort();
  });
  // Read-only synthetic message fixture: no real message is posted.
  await page.route('**/rest/v1/room_messages?*',async route=>{
    const roomId=new URL(route.request().url()).searchParams.get('room_id')?.replace(/^eq\./,'');
    await route.fulfill({status:200,contentType:'application/json',headers:{'content-range':'0-0/1'},body:JSON.stringify([{id:'39000000-0000-4000-8000-000000000025',room_id:roomId,author_id:'31000000-0000-4000-8000-000000000001',body:'Room assignment fixture',reply_to_id:null,created_at:new Date().toISOString(),profiles:{full_name:'Staff Fixture'},room_message_refs:[],room_mentions:[]}])});
  });
  await page.getByRole('button',{name:'Message in Test Unit A room',exact:true}).click();
  await expect(page.getByRole('textbox',{name:'Room message'})).toHaveValue('@Staff Fixture ');
  await expect(page.getByRole('button',{name:'Send',exact:true})).toBeEnabled();
  expect(sent).toHaveLength(0);
  await page.getByRole('button',{name:'Make this a responsibility?',exact:true}).click();
  const assignment=page.getByRole('dialog',{name:'Give out work'});
  await expect(assignment.getByRole('combobox',{name:'Assignment department'})).toHaveValue(unitA);
  await expect(assignment.getByRole('textbox',{name:'Work to complete'})).toHaveValue('Room assignment fixture');
  await page.keyboard.press('Escape');
  await expect(assignment).not.toBeVisible();
  expect(sent).toHaveLength(0);
  await page.getByRole('button',{name:'Back from Room'}).click();
  await expect(page.getByRole('heading',{name:'Staff Fixture',exact:true})).toBeVisible();
});

for (const width of [390,1440]) {
  test(`Executive secondary destinations use the replacement family at ${width}px`,async ({page},testInfo)=>{
    await page.setViewportSize({width,height:960});
    await signIn(page);
    for (const [tab,heading] of [['work','Work'],['strategy','Ministry'],['delivery','Portfolio'],['messages','Messages'],['me','My Hub'],['announcements','Announcements'],['payroll','Payroll'],['technical-help','Get technical help'],['guide','Help that matches your work']]) {
      await page.goto(`/?tab=${tab}`);
      const title=page.getByRole('heading',{name:heading,exact:true}).first();
      await expect(title).toBeVisible();
      if (tab === 'strategy') {
        const primary=page.getByRole('button',{name:'New Ministry Objective',exact:true});
        const secondary=page.getByRole('button',{name:'Add Ministry Direction',exact:true});
        expect(await primary.evaluate(node=>getComputedStyle(node).backgroundImage)).toBe('none');
        expect(await primary.evaluate(node=>getComputedStyle(node).backgroundColor)).toBe('rgb(113, 72, 232)');
        expect(await primary.evaluate(node=>getComputedStyle(node).color)).toBe('rgb(255, 255, 255)');
        expect(await secondary.evaluate(node=>getComputedStyle(node).backgroundColor)).toBe('rgb(255, 255, 255)');
      }
      expect(await title.evaluate(node=>getComputedStyle(node).fontFamily)).toContain('Instrument Sans');
      expect(await title.evaluate(node=>parseFloat(getComputedStyle(node).fontSize))).toBe(width<900?25:28);
      expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
      await page.screenshot({path:testInfo.outputPath(`${tab}-${width}.png`),fullPage:true});
    }
  });
}

test('Executive project department, work, Back/reload and calendar date stay connected',async ({page,request})=>{
  const databaseUrl=process.env.SUPABASE_URL;
  // This test writes only to the disposable local fixture or CEAC's named
  // isolated staging. It must fail before any request against production.
  expect(['http://127.0.0.1:54321','https://ugaifpxjgkclmcdvyppx.supabase.co']).toContain(databaseUrl);
  const apiKey=process.env.SUPABASE_ANON_KEY;
  expect(Boolean(apiKey)).toBe(true);
  async function tokenFor(actor) {
    const response=await request.post(`${databaseUrl}/auth/v1/token?grant_type=password`,{
      headers:{apikey:apiKey},data:{email:`${actor}@ceac.local.test`,password:process.env.ROLE_FIXTURE_PASSWORD},
    });
    expect(response.ok()).toBe(true);
    const data=await response.json();
    expect(Boolean(data.access_token)).toBe(true);
    return data.access_token;
  }
  const adminToken=await tokenFor('admin');
  const executiveToken=await tokenFor('exec');
  const title=`Executive connected fixture ${Date.now()}`;
  const today=new Date().toISOString().slice(0,10);
  const headers=token=>({apikey:apiKey,Authorization:`Bearer ${token}`});
  const created=await request.post(`${databaseUrl}/rest/v1/rpc/create_project_with_participants`,{
    headers:headers(adminToken),data:{p_lead_unit_id:unitA,p_name:title,p_purpose:'Isolated connected-journey verification',p_starts_on:today,p_participant_unit_ids:[]},
  });
  expect(created.ok()).toBe(true);
  const projectId=await created.json();
  expect(typeof projectId).toBe('string');
  await signIn(page);
  await page.goto(`/?tab=delivery&project=${projectId}`);
  await expect(page.getByRole('heading',{name:title,exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Assign department',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Assign department to project'});
  await dialog.getByRole('combobox',{name:'Project department'}).selectOption('20000000-0000-4000-8000-000000000012');
  await dialog.getByRole('textbox',{name:'Department assignment reason'}).fill('Test Unit B supports this isolated project.');
  await dialog.getByRole('button',{name:'Assign department',exact:true}).click();
  await expect(dialog).not.toBeVisible();
  const participation=await request.get(`${databaseUrl}/rest/v1/project_units?select=unit_id&project_id=eq.${projectId}&unit_id=eq.20000000-0000-4000-8000-000000000012`,{headers:headers(executiveToken)});
  expect(participation.ok()).toBe(true);
  expect(await participation.json()).toEqual([{unit_id:'20000000-0000-4000-8000-000000000012'}]);
  const taskTitle=`Connected work ${title}`;
  const taskResponse=await request.post(`${databaseUrl}/rest/v1/rpc/create_task_with_checklist`,{
    headers:headers(executiveToken),data:{p_unit_id:'20000000-0000-4000-8000-000000000012',p_assignee_id:'31000000-0000-4000-8000-000000000005',p_title:taskTitle,p_expected_outcome:'Verified project context',p_project_id:projectId,p_purpose:'Verify the return journey',p_due_at:new Date(Date.now()+86400000).toISOString(),p_origin:'assigned_by_exec',p_steps:[]},
  });
  expect(taskResponse.ok()).toBe(true);
  const task=await taskResponse.json();
  await page.reload();
  await page.getByRole('button',{name:new RegExp(`^${taskTitle}`)}).click();
  await expect(page).toHaveURL(new RegExp(`project=${projectId}`));
  await expect(page.getByRole('heading',{name:taskTitle,exact:true})).toBeVisible();
  await page.getByRole('button',{name:'← Back',exact:true}).click();
  await expect(page.getByRole('heading',{name:title,exact:true})).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading',{name:title,exact:true})).toBeVisible();
  await page.goto('/?tab=exec-calendar');
  await page.getByRole('button',{name:new RegExp(title+' starts')}).click();
  await expect(page).toHaveURL(new RegExp(`tab=delivery&project=${projectId}`));
  await expect(page.getByRole('heading',{name:title,exact:true})).toBeVisible();
  test.info().annotations.push({type:'isolated_fixture',description:`project=${projectId};work=${task.id}`});
});

test('Executive own-work failure preserves the draft and allows a deliberate retry',async ({page})=>{
  await page.setViewportSize({width:390,height:844});
  await signIn(page);
  await page.goto('/?tab=work');
  await page.getByRole('button',{name:'Add my work',exact:true}).first().click();
  const dialog=page.getByRole('dialog',{name:'Add my work'});
  await dialog.getByRole('combobox',{name:'Department for my work'}).selectOption(unitA);
  await dialog.getByRole('textbox',{name:'My responsibility title'}).fill('Unsaved retry fixture');
  await dialog.getByRole('textbox',{name:'Expected result',exact:true}).fill('Retain my draft after a failed save.');
  await dialog.getByRole('checkbox',{name:'No steps needed yet'}).check();
  expect(await dialog.getByRole('textbox',{name:'My responsibility title'}).evaluate(node=>getComputedStyle(node).fontSize)).toBe('16px');
  let attempts=0;
  await page.route('**/rest/v1/rpc/create_task_with_checklist',async route=>{
    attempts++;
    await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'Synthetic save unavailable'})});
  });
  const submit=dialog.getByRole('button',{name:'Add my work',exact:true});
  await submit.click();
  await expect(dialog.getByRole('alert')).toContainText('Synthetic save unavailable');
  await expect(dialog.getByRole('textbox',{name:'My responsibility title'})).toHaveValue('Unsaved retry fixture');
  await expect(submit).toBeEnabled();
  await submit.click();
  await expect.poll(()=>attempts).toBe(2);
  await expect(submit).toBeEnabled();
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
});

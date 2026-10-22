import {test,expect} from '@playwright/test';
import {createClient} from '@supabase/supabase-js';
import {randomUUID,createHash} from 'node:crypto';
import {mkdirSync,writeFileSync} from 'node:fs';

const org='10000000-0000-4000-8000-000000000010';
const unit='20000000-0000-4000-8000-000000000011';
const adminId='31000000-0000-4000-8000-000000000003';
const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
function localClient(key){
 expect(process.env.SUPABASE_URL).toBe('http://127.0.0.1:54321');
 return createClient(process.env.SUPABASE_URL,key,options);
}
function ok(result){expect(result.error,result.error?.message).toBeNull();return result.data;}
async function open(browser,email,route){
 const context=await browser.newContext({viewport:{width:1366,height:900}});
 const page=await context.newPage();
 await page.goto('/');
 expect(new URL(page.url()).hostname).toBe('127.0.0.1');
 await page.getByPlaceholder('Work email').fill(email);
 await page.getByPlaceholder('Password').fill(process.env.ROLE_FIXTURE_PASSWORD);
 await page.getByRole('button',{name:'Sign in to CEAC OS',exact:true}).click();
 await expect(page.locator('.ev2s-workspace')).toBeVisible();
 await page.goto(route);
 return {page,context};
}

test('release personal monthly and quarterly PDFs contain visible authorised report content',async({browser})=>{
 // Allow two actual exports and captures; the period selector includes option text
 // in its accessible name, so use its stable role and Period prefix.
 test.setTimeout(60000);
 const {page,context}=await open(browser,'staff@ceac.local.test','/?tab=achievements');
 try{
  const report=page.getByRole('main',{name:'My achievements'});
  await expect(report.getByRole('button',{name:'Print / Save as PDF'})).toBeEnabled();
  mkdirSync('test-artifacts',{recursive:true});
  for(const cadence of ['monthly','quarterly']){
   await report.getByRole('combobox',{name:/^Period/}).selectOption(cadence);
   await expect(report.getByRole('button',{name:'Print / Save as PDF'})).toBeEnabled();
   await page.emulateMedia({media:'print'});
   await expect(report.getByRole('heading',{name:'My achievements',exact:true})).toHaveCSS('visibility','visible');
   await expect(report.locator('.s2-achievement-print-head')).toContainText('Subject: Staff Fixture');
   await expect(report.locator('.s2-achievement-metrics')).toBeVisible();
   const pdf=await page.pdf({path:`test-artifacts/release-personal-${cadence}.pdf`,format:'A4',printBackground:true,preferCSSPageSize:true});
   expect(pdf.subarray(0,5).toString()).toBe('%PDF-');
   expect(pdf.length).toBeGreaterThan(5000);
   await page.screenshot({path:`test-artifacts/release-personal-${cadence}-print.png`,fullPage:true});
   await page.emulateMedia({media:'screen'});
  }
 }finally{await context.close();}
});

test('release Executive PDF prints collapsed milestone content and restores its screen state',async({browser})=>{
 test.setTimeout(60000);
 const service=localClient(process.env.SUPABASE_SERVICE_ROLE_KEY);
 const admin=localClient(process.env.SUPABASE_ANON_KEY);
 ok(await admin.auth.signInWithPassword({email:'admin@ceac.local.test',password:process.env.ROLE_FIXTURE_PASSWORD}));
 const project=ok(await service.from('projects').insert({org_id:org,lead_unit_id:unit,name:'Synthetic PDF milestone project',created_by:adminId}).select('id').single());
 const milestoneName='Synthetic collapsed milestone must appear in the PDF';
 ok(await admin.from('project_milestones').insert({org_id:org,project_id:project.id,name:milestoneName,change_reason:'Isolated PDF acceptance fixture',created_by:adminId,updated_by:adminId}));
 const period=ok(await service.from('report_periods').insert({org_id:org,kind:'project',label:'Synthetic PDF acceptance Q4 2026',starts_on:'2026-10-01',ends_on:'2026-12-31'}).select('id').single());
 const {page,context}=await open(browser,'exec@ceac.local.test','/?tab=exec-reports');
 try{
  await expect(page.locator('.s2-exec-brief')).toBeVisible();
  const picker=page.getByLabel('Reporting period',{exact:true});
  if(await picker.count())await picker.selectOption(period.id);
  const brief=page.locator('.s2-exec-brief');
  await expect(brief.getByRole('button',{name:'Print / Save as PDF'})).toBeEnabled();
  await expect(brief).toContainText('Q4 2026');
  const milestones=brief.locator('details');
  await expect(milestones).not.toHaveAttribute('open','');
  await expect(milestones).toContainText(milestoneName);
  await milestones.evaluate(node=>window.addEventListener('beforeprint',()=>{
   window.__ceacReleasePrintEvidence={opened:node.open,content:node.innerText,visibility:getComputedStyle(node).visibility};
  },{once:true}));
  await page.emulateMedia({media:'print'});
  await expect(brief.getByRole('heading',{name:'Quarterly ministry results and next decisions'})).toHaveCSS('visibility','visible');
  mkdirSync('test-artifacts',{recursive:true});
  const pdf=await page.pdf({path:'test-artifacts/release-executive-quarter.pdf',format:'A4',printBackground:true,preferCSSPageSize:true});
  expect(pdf.subarray(0,5).toString()).toBe('%PDF-');expect(pdf.length).toBeGreaterThan(5000);
  // This bounded synthetic briefing fits one A4 page; hidden screen layout
  // must not create the two blank trailing pages found during PDF inspection.
  expect((pdf.toString('latin1').match(/\/Type\s*\/Page\b/g)||[]).length).toBe(1);
  const printEvidence=await page.evaluate(()=>window.__ceacReleasePrintEvidence);
  expect(printEvidence.opened).toBe(true);expect(printEvidence.visibility).toBe('visible');expect(printEvidence.content).toContain(milestoneName);
  writeFileSync('test-artifacts/release-executive-print-state.json',JSON.stringify(printEvidence,null,2));
  await page.emulateMedia({media:'screen'});
  await expect(milestones).not.toHaveAttribute('open','');
  await expect(brief.getByRole('button',{name:'Print / Save as PDF'})).toBeVisible();
  await page.screenshot({path:'test-artifacts/release-executive-screen-restored.png',fullPage:true});
  const manager=await open(browser,'manager@ceac.local.test','/?tab=projects&project='+project.id);
  try{
   const workspace=manager.page.locator('.s2-owner-approved-projects');
   await expect(workspace.locator('.s2-project')).toBeVisible();
   await expect(workspace).toContainText(milestoneName);
   for(const viewport of [{width:1536,height:1024},{width:390,height:844}]){
    await manager.page.setViewportSize(viewport);
    expect(await manager.page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    await manager.page.screenshot({path:`test-artifacts/release-project-reference-${viewport.width}.png`,fullPage:true});
   }
  }finally{await manager.context.close();}
 }finally{await context.close();}
});

test('release HR uploads private bytes and links existing identities without creating accounts or permissions',async({browser})=>{
 test.setTimeout(60000);
 const service=localClient(process.env.SUPABASE_SERVICE_ROLE_KEY);
 const admin=localClient(process.env.SUPABASE_ANON_KEY);
 const stranger=localClient(process.env.SUPABASE_ANON_KEY);
 const personId=randomUUID(), employeeId=randomUUID();
 const email=`existing-${personId}@ceac.local.test`;
 // Disposable local bootstrap only: no real recipient, provider migration or
 // invitation-delivery claim. All application actions below use ordinary HR.
 ok(await service.from('pending_invitations').insert({org_id:org,email,full_name:'Synthetic Existing Identity',unit_id:unit,role:'staff',expires_at:new Date(Date.now()+86400000).toISOString()}));
 ok(await service.auth.admin.createUser({id:personId,email,password:process.env.ROLE_FIXTURE_PASSWORD,email_confirm:true}));
 ok(await service.from('employee_roster').insert({id:employeeId,org_id:org,full_name:'Synthetic Link Acceptance Employee',employment_status:'active',identity_state:'roster_only',source_system:'role_fixture',source_row_key:employeeId}));
 ok(await service.from('employee_unit_memberships').insert({org_id:org,employee_id:employeeId,unit_id:unit,is_primary:true}));
 ok(await admin.auth.signInWithPassword({email:'admin@ceac.local.test',password:process.env.ROLE_FIXTURE_PASSWORD}));
 ok(await stranger.auth.signInWithPassword({email:'staff@ceac.local.test',password:process.env.ROLE_FIXTURE_PASSWORD}));
 const before=ok(await service.auth.admin.getUserById(personId));
 const grantsBefore=ok(await service.from('capability_grants').select('*').eq('profile_id',personId));
 const membershipsBefore=ok(await service.from('unit_memberships').select('*').eq('profile_id',personId));
 const accountsBefore=ok(await service.auth.admin.listUsers({page:1,perPage:1000})).users.length;
 const {page,context}=await open(browser,'admin@ceac.local.test','/?tab=people');
 try{
  await page.locator('.fpg-people-roster-row').filter({has:page.getByText('Synthetic Link Acceptance Employee',{exact:true})}).click();
  const employee=page.locator('.ev2-admin-person-workspace');
  await expect(employee).toBeVisible();
  await employee.getByRole('tab',{name:'Documents',exact:true}).click();
  const bytes=Buffer.from('Explicitly SYNTHETIC identity proof for isolated release acceptance. No real employee data.\n');
  const filename='synthetic-link-proof.txt';
  await employee.getByLabel('Add employee document',{exact:true}).setInputFiles({name:filename,mimeType:'text/plain',buffer:bytes});
  await expect(employee.getByRole('button').filter({hasText:filename})).toBeVisible();
  const links=ok(await admin.from('operational_file_links').select('file:operational_files!inner(*)').eq('context_type','employee_document').eq('context_id',employeeId));
  expect(links).toHaveLength(1);const file=links[0].file;
  expect(file.state).toBe('active');expect(file.size_bytes).toBe(bytes.length);
  const blob=ok(await admin.storage.from(file.storage_bucket).download(file.storage_path));
  expect(Buffer.from(await blob.arrayBuffer()).equals(bytes)).toBe(true);
  const popupPromise=page.waitForEvent('popup');
  await employee.getByRole('button').filter({hasText:filename}).click();
  const popup=await popupPromise;await popup.waitForURL(/127\.0\.0\.1:54321\/storage\/v1\//);
  const download=await context.request.get(popup.url());expect(download.ok()).toBe(true);
  expect((await download.body()).equals(bytes)).toBe(true);await popup.close();
  expect(ok(await stranger.from('operational_files').select('id').eq('id',file.id))).toHaveLength(0);
  expect((await stranger.storage.from(file.storage_bucket).download(file.storage_path)).error).toBeTruthy();
  expect((await stranger.storage.from(file.storage_bucket).createSignedUrl(file.storage_path,60)).error).toBeTruthy();
  await employee.getByRole('tab',{name:'Access',exact:true}).click();
  const link=employee.getByRole('region',{name:'Verify existing employee account link'});
  await link.getByLabel('Existing account for this employee').selectOption(personId);
  await link.getByLabel('Employee documentary identity evidence').selectOption(file.id);
  await link.getByLabel('Independently confirmed existing account email').fill(email);
  await link.getByLabel('HR reason, evidence and identity verification method').fill('Synthetic proof independently reviewed against the confirmed existing login and matching unit.');
  await link.getByRole('checkbox').check();
  await link.getByRole('button',{name:'Confirm verified existing identity'}).click();
  await expect(employee).toHaveCount(0);
  const linkedRow=page.locator('.fpg-people-roster-row').filter({has:page.getByText('Synthetic Link Acceptance Employee',{exact:true})});
  await expect(linkedRow).not.toContainText('No account linked');
  await linkedRow.click();
  await expect(page.locator('.ev2-admin-person-workspace').getByRole('button',{name:'Account & permissions',exact:true})).toBeVisible();
  await expect.poll(async()=>ok(await admin.from('employee_roster').select('id,profile_id').eq('id',employeeId).single()).profile_id).toBe(personId);
  const after=ok(await service.auth.admin.getUserById(personId));
  expect(after.user.id).toBe(before.user.id);expect(after.user.email).toBe(before.user.email);
  expect(ok(await service.auth.admin.listUsers({page:1,perPage:1000})).users.length).toBe(accountsBefore);
  expect(ok(await service.from('capability_grants').select('*').eq('profile_id',personId))).toEqual(grantsBefore);
  expect(ok(await service.from('unit_memberships').select('*').eq('profile_id',personId))).toEqual(membershipsBefore);
  expect(ok(await admin.from('employee_roster_identity_link_events').select('employee_id,profile_id,evidence_file_id').eq('employee_id',employeeId))).toEqual([{employee_id:employeeId,profile_id:personId,evidence_file_id:file.id}]);
  mkdirSync('test-artifacts',{recursive:true});
  writeFileSync('test-artifacts/release-private-link-proof.json',JSON.stringify({synthetic:true,employeeId,profileId:personId,fileId:file.id,byteLength:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),unchangedAccounts:true,unchangedGrants:true,unchangedMemberships:true,unrelatedMetadataDownloadAndSigningDenied:true},null,2));
 }finally{await context.close();await admin.auth.signOut();await stranger.auth.signOut();}
});

import {test,expect} from '@playwright/test';
import {createClient} from '@supabase/supabase-js';

// Only the disposable loopback fixture may be mutated. Never use production.
const fixtureUrl=process.env.SUPABASE_URL;
const isolated=Boolean(process.env.ROLE_FIXTURE_PASSWORD && process.env.SUPABASE_SERVICE_ROLE_KEY
 && fixtureUrl && ['127.0.0.1','localhost'].includes(new URL(fixtureUrl).hostname));
const service=isolated?createClient(fixtureUrl,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}}):null;
test.skip(!isolated,'Requires the disposable local Supabase role-fixture environment.');
const executive='31000000-0000-4000-8000-000000000004';
async function checked(request){const result=await request;expect(result.error,result.error?.message).toBeNull();return result.data;}
async function openAs(browser,email,url='/?tab=messages'){
 const context=await browser.newContext({viewport:{width:390,height:960}}),page=await context.newPage();
 await page.goto(url);await page.getByPlaceholder('Work email').fill(email);
 await page.getByPlaceholder('Password').fill(process.env.ROLE_FIXTURE_PASSWORD);
 await page.getByRole('button',{name:'Sign in',exact:true}).click();
 await expect(page.locator('.msg-workspace')).toBeVisible();
 if(!url.includes('&memo='))await page.getByRole('button',{name:'Memos',exact:true}).click();
 return {context,page};
}

test('real Staff Memo preserves draft/private bytes, Cc clarification and Group Pastor decision/project link without HR access',async({browser})=>{
 test.setTimeout(120000);
 const original=await checked(service.from('profiles').select('job_title').eq('id',executive).single());
 await checked(service.from('profiles').update({job_title:'Group Pastor'}).eq('id',executive));
 const contexts=[];
 try{
  const subject=`Isolated media proposal ${crypto.randomUUID()}`;
  const filename='memo-proposal-evidence.png';
  const bytes=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZlSIAAAAASUVORK5CYII=','base64');
  const staff=await openAs(browser,'staff@ceac.local.test');contexts.push(staff.context);
  const page=staff.page;
  await page.getByRole('button',{name:'New Memo',exact:true}).first().click();
  await page.getByLabel('To',{exact:true}).fill('Executive Fixture');
  await page.getByRole('button',{name:'Executive Fixture Group Pastor',exact:true}).click();
  await page.getByLabel('Cc (optional)',{exact:true}).fill('Manager Fixture');
  await page.getByRole('button',{name:/^Manager Fixture /}).click();
  await page.getByLabel('Subject',{exact:true}).fill(subject);
  await page.getByLabel('Message',{exact:true}).fill('Media initiative for review. Approval in principle only.');
  await page.getByLabel('Decision required',{exact:true}).check();
  await page.getByLabel('Proposal scope').selectOption('cross_department');
  await page.getByLabel('Decision-maker').selectOption(executive);
  await page.locator('.memo-compose input[type="file"]').setInputFiles({name:filename,mimeType:'image/png',buffer:bytes});
  await page.getByRole('button',{name:'Save Draft',exact:true}).click();
  await expect(page.getByText('Draft saved.',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Back to Memos',exact:true}).click();
  await page.getByRole('button',{name:'Drafts',exact:true}).click();
  await page.getByRole('button',{name:new RegExp(subject)}).click();
  await page.getByRole('button',{name:'Continue draft',exact:true}).click();
  await expect(page.getByLabel('Subject',{exact:true})).toHaveValue(subject);
  await expect(page.locator('.memo-draft-file')).toContainText(filename);
  await page.getByRole('button',{name:'Send Memo',exact:true}).click();
  await expect(page.locator('.memo-status')).toHaveText('Pending decision');
  const version=await checked(service.from('memo_versions').select('id,memo_id').eq('subject',subject).single());
  await staff.context.close();

  const copied=await openAs(browser,'manager@ceac.local.test');contexts.push(copied.context);
  await copied.page.getByRole('button',{name:new RegExp(subject)}).click();
  await expect(copied.page.getByRole('button',{name:'Approve proposal',exact:true})).toHaveCount(0);
  await copied.page.getByLabel('Reply or clarification').fill('Please clarify the equipment scope.');
  await copied.page.getByRole('button',{name:'Send reply',exact:true}).click();
  await expect(copied.page.getByText('Please clarify the equipment scope.',{exact:true})).toBeVisible();
  await copied.context.close();

  const pastor=await openAs(browser,'exec@ceac.local.test');contexts.push(pastor.context);
  await pastor.page.getByRole('button',{name:new RegExp(subject)}).click();
  await expect(pastor.page.getByText('Please clarify the equipment scope.',{exact:true})).toBeVisible();
  const image=pastor.page.getByRole('img',{name:filename,exact:true});await expect(image).toBeVisible();
  const response=await pastor.page.request.get(await image.getAttribute('src'));
  expect(response.ok()).toBeTruthy();expect((await response.body()).equals(bytes)).toBeTruthy();
  await pastor.page.getByRole('button',{name:'Approve proposal',exact:true}).click();
  await expect(pastor.page.locator('.memo-status')).toHaveText('Approved');
  const memo=await checked(service.from('memos').select('status,project_id,current_version_id').eq('id',version.memo_id).single());
  expect(memo).toEqual({status:'approved',project_id:null,current_version_id:version.id});
  const decisions=await checked(service.from('memo_exchanges').select('id').eq('memo_id',version.memo_id).eq('kind','approved'));
  expect(decisions).toHaveLength(1);
  await pastor.page.screenshot({path:'test-artifacts/messages-real-memo-approved-390.png',fullPage:true});
  await pastor.context.close();

  const creator=await openAs(browser,'manager@ceac.local.test');contexts.push(creator.context);
  await creator.page.getByRole('button',{name:new RegExp(subject)}).click();
  const projectName=`Shareable media charter ${crypto.randomUUID()}`;
  await creator.page.getByLabel('Project title',{exact:true}).fill(projectName);
  await creator.page.getByLabel('Shareable project summary',{exact:true}).fill('Reviewed operational charter for project participants.');
  await creator.page.getByLabel('Project lead department',{exact:true}).selectOption('20000000-0000-4000-8000-000000000011');
  await creator.page.getByRole('button',{name:'Create project from approved Memo',exact:true}).click();
  await expect(creator.page.getByRole('button',{name:'Open linked project',exact:true})).toBeVisible();
  const linked=await checked(service.from('memos').select('project_id').eq('id',version.memo_id).single());
  expect(linked.project_id).toBeTruthy();
  const project=await checked(service.from('projects').select('name,purpose').eq('id',linked.project_id).single());
  expect(project).toEqual({name:projectName,purpose:'Reviewed operational charter for project participants.'});
  await creator.page.getByRole('button',{name:'Open linked project',exact:true}).click();
  await expect(creator.page).toHaveURL(new RegExp(`tab=projects.*project=${linked.project_id}`));
  await creator.page.getByRole('link',{name:'Open originating Memo',exact:true}).click();
  await expect(creator.page.getByRole('heading',{name:subject,level:2,exact:true})).toBeVisible();
  await creator.context.close();

  const hr=await openAs(browser,'admin@ceac.local.test',`/?tab=messages&memo=${version.memo_id}`);contexts.push(hr.context);
  await expect(hr.page.getByRole('alert')).toBeVisible();
  await expect(hr.page.getByText(subject,{exact:true})).toHaveCount(0);
  await expect(hr.page.getByRole('img',{name:filename,exact:true})).toHaveCount(0);
 }finally{
  await Promise.allSettled(contexts.map(context=>context.close()));
  await checked(service.from('profiles').update({job_title:original.job_title}).eq('id',executive));
 }
});

import {test,expect} from '@playwright/test';
import {createClient} from '@supabase/supabase-js';
import {mkdirSync,writeFileSync} from 'node:fs';
import {darkSurfaceAudit} from './helpers/darkSurfaceAudit';

const org='10000000-0000-4000-8000-000000000070';
const unit='20000000-0000-4000-8000-000000000070';
const admin='31000000-0000-4000-8000-000000000072';
const personal=['home','work','team','attendance','messages','me','account','account&preference=appearance','account&preference=notifications','account&preference=security','technical-help'];
const manager=[...personal,'projects','calendar','manager-finance','manager-reports'];
const roles=[
 {key:'staff',email:'staff@ceac.local.test',routes:[...personal,'staff-calendar']},
 {key:'manager',email:'manager@ceac.local.test',routes:manager},
 {key:'admin',email:'admin@ceac.local.test',routes:[...personal,'people','admin-projects','admin-calendar','finance','cost','reporting','payroll','settings','office-settings','units','lifecycle','protected-hr','authority','audit','events','workflows','policies','integrations','performance','learning','assets','compliance','delivery','workload']},
 {key:'executive',email:'exec@ceac.local.test',routes:['home','work','strategy','exec-projects','exec-organisation','exec-calendar','exec-finance','exec-reports','payroll','messages','me','account','account&preference=appearance','account&preference=notifications','account&preference=security']},
 {key:'technical_support',email:'dark-support@ceac.local.test',routes:[...manager,'technical-support']},
 {key:'compliance',email:'dark-compliance@ceac.local.test',routes:['home','work','compliance','messages','me','account','account&preference=appearance','account&preference=notifications','account&preference=security']},
];

test.beforeAll(async()=>{
 // Supplementary actors exist only in the disposable local browser database.
 expect(process.env.SUPABASE_URL).toBe('http://127.0.0.1:54321');
 const service=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
 const organisation=await service.from('organisations').select('id').eq('id',org).maybeSingle();
 expect(organisation.error).toBeNull();
 if(!organisation.data){
  expect((await service.from('organisations').insert({id:org,name:'Isolated Dark acceptance',short_code:'DARKQ'})).error).toBeNull();
  expect((await service.from('units').insert({id:unit,org_id:org,name:'Dark acceptance unit',code:'DARK'})).error).toBeNull();
 }
 for(const actor of [
  {id:admin,email:'dark-hr@ceac.local.test',isAdmin:true},
  {id:'31000000-0000-4000-8000-000000000070',email:'dark-support@ceac.local.test',capability:'support.case.manage'},
  {id:'31000000-0000-4000-8000-000000000071',email:'dark-compliance@ceac.local.test',capability:'compliance.manage'},
 ]){
  const existing=await service.auth.admin.getUserById(actor.id);
  if(existing.data?.user)expect(existing.data.user.email).toBe(actor.email);
  else {
  const invitation=await service.from('pending_invitations').insert({org_id:org,email:actor.email,full_name:'Synthetic '+actor.capability,unit_id:unit,role:'staff',invited_by:actor.isAdmin?null:admin,expires_at:new Date(Date.now()+3600000).toISOString()});
  expect(invitation.error,invitation.error?.message).toBeNull();
  const created=await service.auth.admin.createUser({id:actor.id,email:actor.email,password:process.env.ROLE_FIXTURE_PASSWORD,email_confirm:true});
  expect(created.error,created.error?.message).toBeNull();
  }
  if(actor.isAdmin){expect((await service.from('profiles').update({is_admin:true}).eq('id',actor.id)).error).toBeNull();continue;}
  if(actor.capability==='support.case.manage'){
   const promoted=await service.from('unit_memberships').update({role:'manager'}).eq('profile_id',actor.id).eq('unit_id',unit);
   expect(promoted.error,promoted.error?.message).toBeNull();
   const prior=await service.from('support_team_memberships').select('id').eq('profile_id',actor.id).eq('active',true).maybeSingle();
   expect(prior.error).toBeNull();
   if(!prior.data){
   const membership=await service.from('support_team_memberships').insert({org_id:org,profile_id:actor.id,role:'lead',added_by:admin,reason:'Disposable Dark appearance acceptance',associated_unit_id:unit});
   expect(membership.error,membership.error?.message).toBeNull();
   }
  }
  const priorGrant=await service.from('capability_grants').select('id').eq('profile_id',actor.id).eq('capability',actor.capability).maybeSingle();
  expect(priorGrant.error).toBeNull();
  if(!priorGrant.data){
  const grant=await service.from('capability_grants').insert({org_id:org,profile_id:actor.id,capability:actor.capability,scope_unit_id:null,granted_by:admin,grant_reason:'Disposable Dark appearance acceptance'});
  expect(grant.error,grant.error?.message).toBeNull();
  }
 }
 mkdirSync('test-artifacts',{recursive:true});
});

for(const width of [390,1440])for(const role of roles)test(`Dark appearance stays readable across ${role.key} routes at ${width}`,async({browser})=>{
 test.setTimeout(240000);
 const context=await browser.newContext({viewport:{width,height:1000},colorScheme:'dark',reducedMotion:'reduce'});
 const page=await context.newPage();
 page.setDefaultTimeout(15000);
 const results=[];
 try{
  await page.route('**/*',route=>{const u=new URL(route.request().url());return u.hostname==='127.0.0.1'&&['5173','54321'].includes(u.port)?route.continue():route.abort('blockedbyclient');});
  await page.goto('/');
  await page.getByPlaceholder('Work email').fill(role.email);
  await page.getByPlaceholder('Password').fill(process.env.ROLE_FIXTURE_PASSWORD);
  await page.getByRole('button',{name:'Sign in to CEAC OS',exact:true}).click();
  await expect(page.locator('.app')).toBeVisible({timeout:20000});
  const inspect=async(name)=>{
   await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
   const issues=await page.evaluate(darkSurfaceAudit);
   results.push({screen:name,issues});
   await page.screenshot({path:`test-artifacts/dark-audit-${role.key}-${width}-${name.replace(/[^a-z0-9-]/gi,'_')}.png`,fullPage:true});
   expect.soft(issues,`${role.key} ${name} at ${width}`).toEqual([]);
  };
  for(const route of role.routes){
   await page.goto(route==='home'?'/':`/?tab=${route}`);
   await expect(page.locator('.route-fallback')).toHaveCount(0);
   await expect(page.locator('.app')).toBeVisible();
   if(role.key==='compliance'&&route==='home'){
    // Overview can have background requests after its visible content is ready.
    await expect(page.locator('.app-content .staff-home')).toBeVisible();
    await expect(page.getByLabel('Loading Today',{exact:true})).toHaveCount(0);
    await page.evaluate(()=>document.fonts.ready);
   }else{
    await page.waitForLoadState('networkidle');
   }
   await inspect(route);
   if(route==='home'){
    if(width>900&&role.key==='executive'){
     // The approved Executive top frame deliberately hides the shared Create menu.
     await expect(page.locator('.ev2s-topbar').getByRole('button',{name:'Create',exact:true})).toBeHidden();
    }else if(width>900){
     await page.locator('.ev2s-topbar').getByRole('button',{name:'Create',exact:true}).click();
     await expect(page.getByRole('menu')).toBeVisible();
     await inspect('create-menu');
     await page.keyboard.press('Escape');
     await expect(page.getByRole('menu')).toHaveCount(0);
    }else{
     await page.locator('.ev2s-mobile-nav').getByRole('button',{name:'More',exact:true}).click();
     await expect(page.getByRole('dialog',{name:'More',exact:true})).toBeVisible();
     await inspect('more-navigation');
     await page.keyboard.press('Escape');
     await expect(page.getByRole('dialog',{name:'More',exact:true})).toHaveCount(0);
    }
   }
   if(route==='work'){
    await page.getByRole('button',{name:'Add my work',exact:true}).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await inspect('work-create-form');
   }
   if(route==='messages'){
    const memos=page.getByRole('button',{name:'Memos',exact:true});
    if(await memos.isVisible())await memos.click();
    await page.getByRole('button',{name:'New Memo',exact:true}).first().click();
    await expect(page.getByRole('button',{name:'Send Memo',exact:true})).toBeVisible();
    await inspect('memo-compose');
   }
  }
 }finally{
  writeFileSync(`test-artifacts/dark-audit-${role.key}-${width}.json`,JSON.stringify(results,null,2));
  await context.close().catch(()=>{});
 }
});

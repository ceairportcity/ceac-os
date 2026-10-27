import {test,expect} from '@playwright/test';
for(const width of [390,1440])test(`invitation register filters current status without losing follow-up at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:1000});
 await page.route('**/*',route=>{
  const req=route.request(),u=new URL(req.url()),name=u.pathname.split('/').pop();
  if(!u.pathname.includes('/rest/v1/')&&!u.pathname.includes('/auth/v1/'))return ['127.0.0.1','localhost'].includes(u.hostname)?route.continue():route.abort();
  const invitations=['pending','expired','verified','cancelled'].map((state,i)=>({id:`invite-${i}`,full_name:`Synthetic ${state} person`,email:`${state}@example.org`,invited_at:'2026-10-27T09:00:00Z',activation_state:state==='cancelled'?'pending':state,revoked_at:state==='cancelled'?'2026-10-27T09:00:00Z':null}));
  return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(name==='admin_access_invitations'?invitations:[])});
 });
 await page.goto('/tests/fixtures/owner-corrections.html?full=1&screen=access&actor=admin');
 await page.getByRole('tab',{name:/^Invitations/}).click();
 await expect(page.locator('.phase5-invitation-row')).toHaveCount(4);
 for(const state of ['pending','expired','verified','cancelled']){
  await page.getByLabel('Invitation status',{exact:true}).selectOption(state);
  await expect(page.locator('.phase5-invitation-row')).toHaveCount(1);
  await expect(page.locator('.phase5-invitation-row')).toContainText(`Synthetic ${state} person`);
  if(state==='pending')await page.screenshot({path:`test-artifacts/invitation-status-${width}.png`,fullPage:false,animations:"disabled"});
  await expect(page.locator('.phase5-invitation-row').getByRole('button',{name:'Resend',exact:true})).toHaveCount(['pending','expired'].includes(state)?1:0);
 }
 await page.goto('/tests/fixtures/owner-corrections.html?actor=admin');
 await page.getByRole('tab',{name:/^Invitations/}).click();
 await page.getByLabel('Invitation status',{exact:true}).selectOption('cancelled');
 await page.getByRole('button',{name:'Switch fixture actor',exact:true}).click();
 await page.getByRole('tab',{name:/^Invitations/}).click();
 await expect(page.getByLabel('Invitation status',{exact:true})).toHaveValue('all');
});

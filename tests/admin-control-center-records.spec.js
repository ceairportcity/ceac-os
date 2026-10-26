import {test,expect} from '@playwright/test';
// Real components with synthetic, intercepted requests; no live writes.
for(const width of [390,1440]) {
 for(const [screen,table,heading,empty] of [
  ['audit','platform_audit_events','Activity history','No audit events match.'],
  ['events','platform_events','System events','No system events match'],
  ['workflows','workflow_run_steps','Pending decisions','No check is waiting'],
 ]) test(`Admin ${screen} denied-read recovery at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:1000});let denied=true;
  await page.route('**/*',route=>{
   const req=route.request(),url=new URL(req.url());
   if(!url.pathname.includes('/rest/v1/'))return ['localhost','127.0.0.1'].includes(url.hostname)?route.continue():route.abort();
   expect(req.method()).toBe('GET');const fail=denied&&url.pathname.endsWith('/'+table);
   return route.fulfill({status:fail?403:200,contentType:'application/json',body:fail?JSON.stringify({message:'Synthetic read denied'}):'[]'});
  });
  await page.goto(`/tests/fixtures/hr-overview-review.html?audit=screen&screen=${screen}`);
  await expect(page.locator('.ev2w-header h1')).toHaveText(heading);
  await expect(page.getByRole('button',{name:'Try again',exact:true})).toBeVisible();
  await expect(page.getByText(empty,{exact:true})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Complete check',exact:true})).toHaveCount(0);
  denied=false;await page.getByRole('button',{name:'Try again',exact:true}).click();
  await expect(page.getByText(empty,{exact:true})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
 });
 test(`Admin cancelled check is not completed at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:1000});
  await page.route('**/*',route=>{
   const req=route.request(),url=new URL(req.url());
   if(!url.pathname.includes('/rest/v1/'))return ['localhost','127.0.0.1'].includes(url.hostname)?route.continue():route.abort();
   expect(req.method()).toBe('GET');
   const rows={workflow_run_steps:[{id:'cancelled',label:'Stopped check',state:'cancelled',created_at:'2026-10-03'}]};
   return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(rows[url.pathname.split('/').pop()]||[])});
  });
  await page.goto('/tests/fixtures/hr-overview-review.html?audit=screen&screen=workflows');
  await page.getByRole('tab',{name:'All',exact:true}).click();
  const row=page.getByRole('button',{name:/Stopped check/});
  await expect(row).toContainText('Cancelled');await expect(row).not.toContainText('Completed');
  await row.click();await expect(page.getByRole('button',{name:'Complete check',exact:true})).toHaveCount(0);
 });
}

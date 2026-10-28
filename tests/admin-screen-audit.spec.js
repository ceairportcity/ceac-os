import {test,expect} from '@playwright/test';

// Empty/denied presentation inventory, not authenticated functional acceptance.
const screens=['projects','calendar','work','protected','payroll','performance','learning','assets','reports','finance','cost','lifecycle','policies','workflows','integrations','audit','events','authority','units','me','account','inbox'];
for(const width of [390,1440])test(`Admin root presentation inventory at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:1000});
 await page.route('**/*',async route=>{
  const url=new URL(route.request().url());
  if(url.pathname.includes('/rest/v1/')){
   if(!['GET','HEAD'].includes(route.request().method())&&!url.pathname.includes('/rpc/'))throw new Error('Audit attempted a write');
   return route.fulfill({status:200,contentType:'application/json',headers:{'content-range':'*/0'},body:'[]'});
  }
  if(['localhost','127.0.0.1'].includes(url.hostname))return route.continue();
  return route.abort();
 });
 const errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 for(const screen of screens){
  await test.step(screen,async()=>{
   await page.goto(`/tests/fixtures/hr-overview-review.html?audit=screen&screen=${screen}`);
   await expect(page.locator('main.app-content')).not.toBeEmpty();
   await expect(page.locator('main.app-content [aria-busy=true]')).toHaveCount(0);
   // Wait for each actual component's data phase, then inspect resulting empty/error state.
   await expect.poll(async()=>await page.locator('main.app-content').innerText()).not.toMatch(/^(Loading|Opening)/);
   expect(errors,screen+' must not crash').toEqual([]);
   expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth),screen+' viewport').toBeLessThanOrEqual(1);
   await page.screenshot({path:`test-artifacts/admin-audit-${screen}-${width}.png`,fullPage:true});
  });
 }
});

import {test,expect} from '@playwright/test';
const local=url=>['localhost','127.0.0.1'].includes(url.hostname);
for(const width of [390,1440]){
 test(`Admin reporting period drawer preserves invalid and denied drafts at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:1000});const writes=[];
  await page.route('**/*',route=>{
   const req=route.request(),url=new URL(req.url());
   if(!url.pathname.includes('/rest/v1/'))return local(url)?route.continue():route.abort();
   if(url.pathname.endsWith('/report_periods')&&req.method()==='POST'){
    writes.push(req.postDataJSON());return route.fulfill({status:403,contentType:'application/json',body:JSON.stringify({message:'Synthetic period denied'})});
   }
   return route.fulfill({status:200,contentType:'application/json',headers:{'content-range':'*/0','access-control-expose-headers':'content-range'},body:'[]'});
  });
  await page.goto('/tests/fixtures/hr-overview-review.html?audit=screen&screen=reports');
  await page.getByRole('button',{name:'Open reporting period',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Open a reporting period',exact:true});
  await expect(dialog).toHaveClass(/ev2c-composer-drawer/);
  await dialog.getByLabel('Period name',{exact:true}).fill('Retained reporting period');
  await dialog.getByLabel('Start date',{exact:true}).fill('2026-10-26');
  await dialog.getByLabel('End date',{exact:true}).fill('2026-10-25');
  await dialog.getByRole('button',{name:'Open period',exact:true}).click();
  await expect(dialog).toContainText('The end date is before the start date.');expect(writes).toHaveLength(0);
  await dialog.getByLabel('End date',{exact:true}).fill('2026-10-31');
  await dialog.getByRole('button',{name:'Open period',exact:true}).click();
  await expect(dialog).toContainText('Synthetic period denied');
  await expect(dialog.getByLabel('Period name',{exact:true})).toHaveValue('Retained reporting period');
  expect(writes).toEqual([{org_id:'synthetic-org',kind:'week',label:'Retained reporting period',starts_on:'2026-10-26',ends_on:'2026-10-31',status:'open'}]);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
 });
 test(`Admin payroll validates exact cents and shows rejection inside drawer at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:1000});const writes=[];
  const run={id:'run',label:'Synthetic payroll',period_start:'2026-10-01',period_end:'2026-10-31',status:'draft',currency:'GHS',revision:1};
  await page.route('**/*',route=>{
   const req=route.request(),url=new URL(req.url());
   if(!url.pathname.includes('/rest/v1/'))return local(url)?route.continue():route.abort();
   const name=url.pathname.split('/').pop();
   if(name==='payroll_set_line'){
    writes.push(req.postDataJSON());return route.fulfill({status:403,contentType:'application/json',body:JSON.stringify({message:'Synthetic payroll line denied'})});
   }
   const data={payroll_list_runs:[run],payroll_readiness_summary:{employee_count:1},payroll_run_detail:{run,entries:[{employee_id:'employee',employee_name:'Synthetic employee',currency:'GHS',flags:[],lines:[]}]}};
   return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data[name]||[])});
  });
  await page.goto('/tests/fixtures/hr-overview-review.html?audit=screen&screen=payroll');
  await page.getByRole('button',{name:'Adjust',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Employee adjustments',exact:true});
  const amount=dialog.getByLabel('Amount (GHS)',{exact:true}),save=dialog.getByRole('button',{name:'Add Payroll line',exact:true});
  for(const value of ['1.001','1,2','-1','1e3']){await amount.fill(value);await expect(save).toBeDisabled();}
  await amount.fill('1,234.56');await save.click();
  await expect(dialog).toContainText('Synthetic payroll line denied');
  await expect(amount).toHaveValue('1,234.56');
  expect(writes).toHaveLength(1);expect(writes[0]).toMatchObject({p_run_id:'run',p_profile_id:'employee',p_amount_minor:123456});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
 });
}

import {test,expect} from '@playwright/test';
const names=['Media','Technical','First Timers','Worship','Children','Administration','Outreach','Facilities'];
async function records(page,{empty=false,deny=false}={}){
 const units=empty?[]:names.map((name,i)=>({id:`unit-${i}`,name}));
 await page.route('**/*',async route=>{
  const u=new URL(route.request().url());
  if(!u.pathname.includes('/rest/v1/'))return ['127.0.0.1','localhost'].includes(u.hostname)?route.continue():route.abort();
  const table=u.pathname.split('/').pop();
  if(deny&&table==='units')return route.fulfill({status:403,contentType:'application/json',body:JSON.stringify({message:'Synthetic denial'})});
  const reports=units.slice(0,7).map((unit,i)=>({id:`report-${i}`,unit_id:unit.id,status:i<5?'submitted':'draft',version:1,submitted_at:i<5?'2026-10-20T10:00:00Z':null}));
  // An inactive unit's report must not inflate the active-department coverage.
  reports.push({id:'old',unit_id:'inactive-unit',status:'submitted',version:1});
  const rows=table==='units'?units:table==='report_periods'?[{id:'period',label:'October 2026',status:'open',starts_on:'2026-10-01',ends_on:'2026-10-31'}]:table==='reports'?(u.searchParams.has('status')?reports.filter(r=>r.status==='submitted'):reports):[];
  return route.fulfill({status:200,contentType:'application/json',headers:{'content-range':rows.length?`0-${rows.length-1}/${rows.length}`:'*/0','access-control-expose-headers':'content-range'},body:JSON.stringify(rows)});
 });
}
for(const width of [320,390,1440])test(`Executive reporting figures, display choice and register agree at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:1000});await records(page);
 await page.goto('/tests/fixtures/owner-corrections.html?screen=reports&actor=executive');
 const overview=page.getByRole('region',{name:'October 2026',exact:true});
 await expect(overview.locator('.filing-ring strong')).toHaveText('63%');
 await expect(overview.locator('.filing-total>strong')).toHaveText('5 / 8');
 await expect(overview.getByRole('button',{name:'Show draft in progress: 2 of 8 departments'})).toBeVisible();
 await overview.getByRole('button',{name:'Table',exact:true}).click();
 const table=overview.getByRole('table');await expect(table).toBeVisible();
 await expect(table.getByRole('row',{name:'Submitted 5 63%'})).toBeVisible();
 await expect(table.getByRole('row',{name:'Draft in progress 2 25%'})).toBeVisible();
 await table.getByRole('button',{name:'Draft in progress'}).click();
 await expect(page.locator('.filing-register tbody tr')).toHaveCount(2);
 await expect(page.locator('.filing-register')).toContainText('Administration');
 await overview.getByRole('button',{name:'Chart',exact:true}).click();
 await overview.getByRole('button',{name:'Show not started: 1 of 8 departments'}).click();
 await expect(page.locator('.filing-register tbody tr')).toHaveCount(1);
 await expect(page.locator('.filing-register')).toContainText('Facilities');
 await page.getByRole('tab',{name:'All8',exact:true}).click();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
 await page.screenshot({path:`test-artifacts/executive-reporting-redesign-${width}.png`,fullPage:true});
});
test('No active departments has no fabricated zero percentage',async({page})=>{
 await records(page,{empty:true});await page.goto('/tests/fixtures/owner-corrections.html?screen=reports');
 await expect(page.locator('.filing-ring strong')).toHaveText('—');
 await expect(page.getByText('No active departments are recorded.')).toBeVisible();
});
test('Denied reporting context withholds the entire coverage visual',async({page})=>{
 await records(page,{deny:true});await page.goto('/tests/fixtures/owner-corrections.html?screen=reports');
 await expect(page.getByRole('heading',{name:'Reporting context could not be loaded'})).toBeVisible();
 await expect(page.locator('.filing-overview')).toHaveCount(0);
});

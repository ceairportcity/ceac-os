import {test,expect} from '@playwright/test';
const names=['Media','Technical','First Timers','Worship','Children','Administration','Outreach','Facilities'];
async function records(page,{empty=false,deny=false}={}){
 const units=empty?[]:names.map((name,i)=>({id:`unit-${i}`,name}));
 await page.route('**/*',async route=>{
  const u=new URL(route.request().url());
  if(!u.pathname.includes('/rest/v1/'))return ['127.0.0.1','localhost'].includes(u.hostname)?route.continue():route.abort();
  const table=u.pathname.split('/').pop();
  if(deny&&table==='units')return route.fulfill({status:403,contentType:'application/json',body:JSON.stringify({message:'Synthetic denial'})});
  const reports=units.slice(0,7).map((unit,i)=>({id:`report-${i}`,unit_id:unit.id,status:i<5?'submitted':'draft',period_id:'period',scope:'unit',version:1,submitted_at:i<5?'2026-10-20T10:00:00Z':null}));
  // An inactive unit's report must not inflate the active-department coverage.
  reports.push({id:'old',unit_id:'inactive-unit',status:'submitted',version:1});
  const rows=table==='units'?units:table==='report_periods'?[{id:'period',label:'October 2026',status:'open',kind:'month',starts_on:'2026-10-01',ends_on:'2026-10-31'}]:table==='reports'?(u.searchParams.has('status')?reports.filter(r=>r.status==='submitted'):reports):[];
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

for(const width of [390,1440])test(`Department reporting shares accurate figures and filters at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:1000});await records(page);
 await page.goto('/tests/fixtures/owner-corrections.html?screen=department-reports&actor=admin');
 await page.getByRole('button',{name:'Open report',exact:true}).click();
 await expect(page.locator('.filing-total>strong')).toHaveText('5 / 8');
 await page.getByRole('button',{name:'Show draft in progress: 2 of 8 departments'}).click();
 await expect(page.locator('.ev2rep-list .ev2rep-row')).toHaveCount(2);
 await expect(page.getByRole('heading',{name:'What units reported'})).toHaveCount(0);
 await page.getByRole('button',{name:'Show not started: 1 of 8 departments'}).click();
 await expect(page.locator('.ev2rep-list')).toContainText('Facilities');
 await expect(page.locator('.ev2rep-list .ev2rep-row')).toHaveCount(1);
 await page.getByRole('button',{name:'All departments',exact:true}).click();
 await expect(page.getByRole('heading',{name:'What units reported'})).toBeVisible();
 await expect(page.getByRole('heading',{name:'Still outstanding'})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
 await page.screenshot({path:`test-artifacts/department-reporting-redesign-${width}.png`,fullPage:true});
});
for(const width of [390,1440])test(`Personal achievements offers list and table with the same attributed sources at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:1000});
 await page.route('**/*',async route=>{
  const u=new URL(route.request().url());
  if(!u.pathname.includes('/rest/v1/'))return ['127.0.0.1','localhost'].includes(u.hostname)?route.continue():route.abort();
  const table=u.pathname.split('/').pop();
  const works=[{id:'work',ref:'SYN-1',title:'Prepare the synthetic service guide',status:'completed',created_at:'2026-10-01T09:00:00Z',completed_at:'2026-10-20T10:00:00Z',due_at:'2026-10-21',project_id:'project',projects:{name:'Synthetic service preparation'}}];
  const rows=table==='work_items'?works:table==='submissions'?[{id:'proof',work_item_id:'work',profile_id:'actor',note:'Synthetic guide submitted',submitted_at:'2026-10-20T09:00:00Z'}]:[];
  return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(rows)});
 });
 await page.goto('/tests/fixtures/owner-corrections.html?screen=achievements');
 await page.getByLabel('Reporting month').fill('2026-10');
 await expect(page.getByRole('list',{name:'Recorded contributions'})).toContainText('Prepare the synthetic service guide');
 await expect(page.locator('.s2-achievement-metrics article')).toHaveCount(4);
 await page.getByRole('button',{name:'Table',exact:true}).click();
 await expect(page.getByRole('region',{name:'My contribution table'})).toContainText('Prepare the synthetic service guide');
 await expect(page.getByRole('list',{name:'Recorded contributions'})).toHaveCount(0);
 await page.getByRole('button',{name:'List',exact:true}).click();
 await expect(page.getByRole('list',{name:'Recorded contributions'})).toContainText('SYN-1');
 await page.getByRole('searchbox').fill('No matching work');
 await expect(page.getByRole('list',{name:'Recorded contributions'})).toHaveCount(0);
 await expect(page.getByText('No attributable completion or submission is recorded for these filters. This is not evidence of no work.')).toBeVisible();
 await page.getByRole('searchbox').fill('');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
 await page.screenshot({path:`test-artifacts/personal-achievements-redesign-${width}.png`,fullPage:true});
});
for(const width of [390,1440])test(`Payroll foregrounds run totals and filters employees without changing them at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:1000});
 const run={id:'run',label:'Synthetic October payroll',period_start:'2026-10-01',period_end:'2026-10-31',status:'draft',currency:'GHS',revision:1,total_additions_minor:370000,total_deductions_minor:70000,total_net_minor:300000};
 const entries=[{id:'entry-1',employee_id:'employee-1',employee_name:'Synthetic colleague A',currency:'GHS',additions_minor:150000,deductions_minor:20000,net_minor:130000,payment_detail_id:'payment-1',flags:[],lines:[]},{id:'entry-2',employee_id:'employee-2',employee_name:'Synthetic colleague B',currency:'GHS',additions_minor:120000,deductions_minor:30000,net_minor:90000,flags:['payment_detail_missing'],lines:[]},{id:'entry-3',employee_id:'employee-3',employee_name:'Synthetic colleague C',currency:'GHS',additions_minor:100000,deductions_minor:20000,net_minor:80000,payment_detail_id:'payment-3',flags:[],lines:[]}];
 await page.route('**/*',route=>{
  const req=route.request(),u=new URL(req.url());
  if(!u.pathname.includes('/rest/v1/'))return ['127.0.0.1','localhost'].includes(u.hostname)?route.continue():route.abort();
  const name=u.pathname.split('/').pop();
  const data={payroll_list_runs:[run],payroll_readiness_summary:{employee_count:3,compensation_recorded_count:3,payment_recorded_count:2,payment_missing_count:1,compensation_missing_count:0,volunteer_count:1},payroll_run_detail:{run,entries}};
  return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data[name]||[])});
 });
 await page.goto('/tests/fixtures/owner-corrections.html?screen=payroll&actor=admin');
 const totals=page.getByRole('region',{name:'Recorded payroll totals'});
 await expect(totals).toContainText('3,000.00');
 await expect(page.getByRole('heading',{name:'3 of 3 employee entries'})).toBeVisible();
 await page.getByRole('button',{name:'Needs review (1)',exact:true}).click();
 await expect(page.getByRole('heading',{name:'1 of 3 employee entries'})).toBeVisible();
 await expect(page.getByRole('region',{name:'Employee payroll table'})).toContainText('Synthetic colleague B');
 await expect(page.getByRole('region',{name:'Employee payroll table'})).not.toContainText('Synthetic colleague A');
 await expect(totals).toContainText('3,000.00');
 await page.getByRole('button',{name:'All entries (3)',exact:true}).click();
 await page.getByRole('searchbox',{name:'Find payroll employee'}).fill('colleague C');
 await expect(page.getByRole('heading',{name:'1 of 3 employee entries'})).toBeVisible();
 await expect(page.getByRole('region',{name:'Employee payroll table'})).toContainText('800.00');
 await expect(totals).toContainText('3,000.00');
 await page.getByRole('searchbox',{name:'Find payroll employee'}).fill('');
 await page.getByText('Payroll setup · 3 salary-eligible employees',{exact:true}).click();
 await expect(page.getByText('Payment details recorded',{exact:true})).toBeVisible();
 await expect(page.getByText('Volunteers excluded',{exact:true})).toBeVisible();
 await page.getByText('Payroll setup · 3 salary-eligible employees',{exact:true}).click();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
 await page.screenshot({path:`test-artifacts/payroll-redesign-${width}.png`,fullPage:true});
});
for(const width of [390,1440])test(`Manager figures open source records and expose chart/table choice at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:1000});
 await page.clock.install({time:new Date('2026-10-27T12:00:00Z')});
 await page.route('**/*',route=>{
  const u=new URL(route.request().url());
  if(!u.pathname.includes('/rest/v1/'))return ['127.0.0.1','localhost'].includes(u.hostname)?route.continue():route.abort();
  const name=u.pathname.split('/').pop();
  const data={projects:[{id:'project',name:'Synthetic service project',lead_unit_id:'unit',starts_on:'2026-10-01',ends_on:'2026-10-31'}],unit_memberships:[{profile_id:'actor'}],work_items:[{id:'work',ref:'SYN-1',title:'Synthetic completed work',kind:'task',status:'completed',completed_at:'2026-10-27T10:00:00Z',due_at:'2026-10-28',assignee_id:'actor',project_id:'project',profiles:{full_name:'Synthetic colleague'},projects:{name:'Synthetic service project'}}],work_sessions:[],submissions:[],objectives:[],report_periods:[]};
  const rows=data[name]||[];
  return route.fulfill({status:200,contentType:'application/json',headers:{'content-range':rows.length?`0-${rows.length-1}/${rows.length}`:'*/0','access-control-expose-headers':'content-range'},body:JSON.stringify(rows)});
 });
 await page.goto('/tests/fixtures/owner-corrections.html?screen=manager-reports');
 const metric=page.locator('.ev2rep-evidence').filter({hasText:'completed in period'});
 await expect(metric.locator('strong')).toHaveText('1');await metric.click();
 await expect(page.locator('.ev2rep-list')).toContainText('Synthetic completed work');
 await page.getByRole('button',{name:'Show charts and tables',exact:true}).click();
 await page.getByRole('button',{name:'Show Completed work trend as table',exact:true}).click();
 const chart=page.locator('.ev2dv-chart').filter({hasText:'Completed work trend'});
 await expect(chart.getByRole('table')).toBeVisible();
 await chart.getByRole('button',{name:'Show Completed work trend as chart',exact:true}).click();
 await expect(chart.getByRole('img',{name:'Completed work trend',exact:true})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
 await page.screenshot({path:`test-artifacts/manager-reporting-redesign-${width}.png`,fullPage:true});
});

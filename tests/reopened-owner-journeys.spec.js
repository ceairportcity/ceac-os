import {test,expect} from '@playwright/test';

async function payrollApi(page,{denied=false}={}) {
  const writes=[];
  let recorded=false;
  const run={id:'run',label:'Synthetic October payroll',period_start:'2026-10-01',period_end:'2026-10-31',currency:'GHS',revision:1,status:'draft'};
  await page.route('**/*',route=>{
    const req=route.request(),url=new URL(req.url());
    if(!url.pathname.includes('/rest/v1/'))return ['localhost','127.0.0.1'].includes(url.hostname)?route.continue():route.abort();
    const name=url.pathname.split('/').pop();
    const reply=(data,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
    if(['payroll_set_line','hr_employee_protected_record'].includes(name)){
      writes.push({name,body:req.postDataJSON()});
      if(denied)return reply({message:'Synthetic salary denied'},403);
      recorded=true;return reply(null);
    }
    const employee={id:'employee',full_name:'Synthetic colleague',employment_status:'active',employment_type:'permanent'};
    const data={
      payroll_list_runs:[run],payroll_readiness_summary:{employee_count:1,compensation_missing_count:1},
      payroll_run_detail:{run,entries:[{id:'entry',employee_id:'employee',employee_name:'Synthetic colleague',currency:'GHS',flags:recorded?[]:['missing_base_salary'],lines:recorded?[{id:'line',category:'base_salary',direction:'addition',label:'Base salary',amount_minor:123456}]:[]}]},
      admin_employee_roster_summary:[{id:'other',full_name:'Another employee'},employee],
      hr_employee_protected_summary:{identifiers:[],employment_terms:[],compensation:[{id:'salary-record',status:'active',amount_minor:123456,currency:'GHS',basis_label:'Monthly salary',effective_on:'2026-10-01'}],payment_details:[],documents:[]},
    };
    return reply(data[name]||[]);
  });
  return writes;
}

for(const width of [390,1440]) {
  test(`recorded protected salary can be applied without a second salary editor at ${width}px`,async({page})=>{
    await page.setViewportSize({width,height:1000});
    const writes=await payrollApi(page);
    await page.goto('/tests/fixtures/hr-overview-review.html?audit=screen&screen=payroll');
    await page.getByRole('button',{name:'Review recorded salary',exact:true}).click();
    const drawer=page.getByRole('dialog',{name:'Use recorded salary'});
    await expect(drawer).toContainText('1,234.56');
    await expect(drawer.getByRole('textbox')).toHaveCount(0);
    await drawer.getByRole('button',{name:'Apply salary to this draft',exact:true}).click();
    await expect(drawer).toHaveCount(0);
    expect(writes).toEqual([{name:'payroll_set_line',body:{p_run_id:'run',p_profile_id:'employee',p_line_id:null,p_category:'base_salary',p_direction:'addition',p_label:'Base salary',p_amount_minor:123456,p_note:'Applied protected salary record salary-record, effective 2026-10-01, after review for this draft.'}}]);
    await expect(page.locator('.fpg-payroll-flags')).toHaveCount(0);
  });

  test(`denied salary application retains its source and does not claim success at ${width}px`,async({page})=>{
    await page.setViewportSize({width,height:1000});
    const writes=await payrollApi(page,{denied:true});
    await page.goto('/tests/fixtures/hr-overview-review.html?audit=screen&screen=payroll');
    await page.getByRole('button',{name:'Review recorded salary',exact:true}).click();
    const drawer=page.getByRole('dialog',{name:'Use recorded salary'});
    await drawer.getByRole('button',{name:'Apply salary to this draft',exact:true}).click();
    await expect(drawer).toContainText('Synthetic salary denied');
    await expect(drawer).toContainText('1,234.56');
    await expect(drawer.getByRole('textbox')).toHaveCount(0);
    expect(writes).toHaveLength(1);
  });

  test(`Payroll opens the right protected employee and records future salary with the displayed currency at ${width}px`,async({page})=>{
    await page.setViewportSize({width,height:1000});
    const writes=await payrollApi(page);
    await page.goto('/tests/fixtures/hr-overview-review.html?audit=screen&screen=payroll');
    await page.getByRole('button',{name:'Salary & payment details',exact:true}).click();
    await expect(page.getByLabel('Protected HR employee',{exact:true})).toHaveValue('employee');
    await page.getByRole('button',{name:'Record salary',exact:true}).click();
    const drawer=page.getByRole('dialog',{name:'Add protected HR record'});
    await drawer.getByLabel('Compensation amount',{exact:true}).fill('1.001');
    await drawer.getByLabel('Compensation basis',{exact:true}).fill('Monthly');
    await drawer.getByLabel('Compensation effective date',{exact:true}).fill('2026-10-01');
    await drawer.getByLabel('Protected HR reason',{exact:true}).fill('Authorised salary appointment');
    await expect(drawer.getByRole('button',{name:'Save protected record',exact:true})).toBeDisabled();
    await drawer.getByLabel('Compensation amount',{exact:true}).fill('1,234.56');
    await expect(drawer.getByLabel('Compensation currency',{exact:true})).toHaveValue('GHS');
    await drawer.getByRole('button',{name:'Save protected record',exact:true}).click();
    await expect(drawer).toHaveCount(0);
    expect(writes).toEqual([{name:'hr_employee_protected_record',body:{p_employee_id:'employee',p_record_type:'compensation',p_payload:{amount_minor:123456,currency:'GHS',basis_label:'Monthly',effective_on:'2026-10-01',ends_on:'',note:''},p_replaces_id:null,p_reason:'Authorised salary appointment'}}]);
    await page.getByRole('button',{name:'Back to Payroll',exact:true}).click();
    await expect(page.getByRole('heading',{name:'Payroll',exact:true})).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
  });
}
for(const mode of ['missing','currency'])test(`salary application is withheld for ${mode} protected salary`,async({page})=>{
 await payrollApi(page);
 await page.route('**/rest/v1/rpc/hr_employee_protected_summary',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({compensation:mode==='missing'?[]:[{id:'salary-record',status:'active',amount_minor:10000,currency:'USD',effective_on:'2026-10-01'}]})}));
 await page.goto('/tests/fixtures/hr-overview-review.html?audit=screen&screen=payroll');
 await page.getByRole('button',{name:'Review recorded salary',exact:true}).click();
 const drawer=page.getByRole('dialog',{name:'Use recorded salary'});
 await expect(drawer.getByRole('button',{name:'Apply salary to this draft',exact:true})).toBeDisabled();
 await expect(drawer).toContainText(mode==='missing'?'No salary recorded for this period':'Currencies are never converted automatically');
 await expect(drawer.getByRole('textbox')).toHaveCount(0);
 await expect(drawer.getByRole('button',{name:'Update salary in Protected HR',exact:true})).toBeVisible();
});
test('revoked protected-HR access closes a salary preview and cannot revive it on restoration',async({page})=>{
 await payrollApi(page);
 await page.goto('/tests/fixtures/owner-corrections.html?screen=payroll&actor=admin&permissiontest=1');
 await page.getByRole('button',{name:'Review recorded salary',exact:true}).click();
 await expect(page.getByRole('dialog',{name:'Use recorded salary'})).toContainText('1,234.56');
 await page.getByRole('button',{name:'Cancel',exact:true}).click();
 // Delay the next source read so it completes after permission was revoked.
 let release;const pending=new Promise(resolve=>{release=resolve;});
 await page.route('**/rest/v1/rpc/hr_employee_protected_summary',async route=>{await pending;return route.fulfill({contentType:'application/json',body:JSON.stringify({compensation:[{id:'stale',status:'active',amount_minor:99999,currency:'GHS',effective_on:'2026-10-01'}]})});});
 await page.getByRole('button',{name:'Review recorded salary',exact:true}).click();
 await page.getByRole('button',{name:'Toggle review permission',exact:true}).dispatchEvent('click');
 await expect(page.getByRole('dialog',{name:'Use recorded salary'})).toHaveCount(0);
 release();
 await page.getByRole('button',{name:'Toggle review permission',exact:true}).dispatchEvent('click');
 await expect(page.getByRole('button',{name:'Review recorded salary',exact:true})).toBeVisible();
 await expect(page.getByRole('dialog',{name:'Use recorded salary'})).toHaveCount(0);
});

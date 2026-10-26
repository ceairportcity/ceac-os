import {test,expect} from '@playwright/test';
for(const width of [390,1440])test(`Admin lifecycle confirms a recorded step and retains failed drafts at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:1000});let updateCount=0,completed=false;const writes=[];
 await page.route('**/*',route=>{
  const req=route.request(),url=new URL(req.url());
  if(!url.pathname.includes('/rest/v1/'))return ['localhost','127.0.0.1'].includes(url.hostname)?route.continue():route.abort();
  const name=url.pathname.split('/').pop();
  if(req.method()==='PATCH'){
   writes.push(req.postDataJSON());updateCount++;
   expect(url.searchParams.get('state')).toBe('eq.ready');
   expect(url.searchParams.get('org_id')).toBe('eq.synthetic-org');
   completed=updateCount>1;
   return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(completed?[{id:'step',state:'completed',completed_by:'synthetic-admin'}]:[])});
  }
  if(req.method()==='POST')return route.fulfill({status:403,contentType:'application/json',body:JSON.stringify({message:'Synthetic lifecycle creation denied'})});
  const rows={profiles:[{id:'person',full_name:'Synthetic employee',email:'fixture@example.invalid',active:true}],employee_lifecycle_cases:[{id:'case',profile_id:'person',lifecycle_type:'onboarding',planned_effective_on:'2026-10-26',state:'active',reason:'Synthetic onboarding'}],employee_lifecycle_steps:[{id:'step',lifecycle_case_id:'case',label:'Confirm induction',position:1,state:completed?'completed':'ready',required_capability:'people.manage'}]};
  return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(rows[name]||[])});
 });
 await page.goto('/tests/fixtures/hr-overview-review.html?audit=screen&screen=lifecycle');
 await expect(page.locator('.ev2w-header h1')).toHaveText('Employee lifecycle');
 await page.getByLabel('Lifecycle completion note',{exact:true}).fill('Verified induction context');
 await page.getByRole('button',{name:'Complete current step',exact:true}).click();
 await expect(page.getByText('The step was not confirmed as completed. Refresh the case before trying again.',{exact:true})).toBeVisible();
 await expect(page.getByText('Lifecycle step completed.',{exact:true})).toHaveCount(0);
 await expect(page.getByLabel('Lifecycle completion note',{exact:true})).toHaveValue('Verified induction context');
 await page.getByRole('button',{name:'Complete current step',exact:true}).click();
 await expect(page.getByText('Lifecycle step completed.',{exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Complete current step',exact:true})).toHaveCount(0);
 expect(writes).toHaveLength(2);expect(writes[1]).toMatchObject({state:'completed',completed_by:'synthetic-admin',note:'Verified induction context'});
 await page.getByRole('button',{name:'Start lifecycle case',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'Start lifecycle case',exact:true});
 await dialog.getByLabel('Lifecycle reason',{exact:true}).fill('Keep this proposed case');
 await dialog.getByRole('button',{name:'Start lifecycle case',exact:true}).click();
 await expect(dialog).toContainText('Synthetic lifecycle creation denied');
 await expect(dialog.getByLabel('Lifecycle reason',{exact:true})).toHaveValue('Keep this proposed case');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
});

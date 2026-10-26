import {test,expect} from '@playwright/test';
for(const width of [390,1440])test(`Admin day-type and policy drawers preserve denied changes at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:1000});await page.emulateMedia({reducedMotion:'reduce'});const writes=[];
 await page.route('**/*',route=>{
  const req=route.request(),url=new URL(req.url());
  if(!url.pathname.includes('/rest/v1/'))return ['localhost','127.0.0.1'].includes(url.hostname)?route.continue():route.abort();
  const name=url.pathname.split('/').pop();
  if(['workforce_record_day_type','workforce_record_leave_policy'].includes(name)){
   writes.push({name,body:req.postDataJSON()});return route.fulfill({status:403,contentType:'application/json',body:JSON.stringify({message:'Synthetic workforce save denied'})});
  }
  return route.fulfill({status:200,contentType:'application/json',body:'[]'});
 });
 await page.goto('/tests/fixtures/control-center-design.html?tab=attendance&workforce=setup');
 await page.getByRole('button',{name:'Add day type',exact:true}).click();
 let dialog=page.getByRole('dialog',{name:'Add workforce day type',exact:true});
 await expect(dialog).toHaveClass(/ev2c-composer-drawer/);
 await dialog.getByLabel('Day type name',{exact:true}).fill('Synthetic duty day');
 await dialog.getByRole('button',{name:'Record day type',exact:true}).click();
 await expect(dialog).toContainText('Synthetic workforce save denied');
 await expect(dialog.getByLabel('Day type name',{exact:true})).toHaveValue('Synthetic duty day');
 expect(writes[0]).toMatchObject({name:'workforce_record_day_type',body:{p_name:'Synthetic duty day',p_session_expected:true}});
 await dialog.getByRole('button',{name:'Close',exact:true}).click();
 await page.getByRole('button',{name:'Configure leave policy',exact:true}).click();
 dialog=page.getByRole('dialog',{name:'Configure confirmed leave policy',exact:true});
 await expect(dialog.getByText('Synthetic workforce save denied',{exact:true})).toHaveCount(0);
 const activate=dialog.getByRole('button',{name:'Activate confirmed policy',exact:true});await expect(activate).toBeDisabled();
 await dialog.getByLabel('Policy name',{exact:true}).fill('Synthetic confirmed policy');
 await dialog.getByLabel('Policy entitlement amount',{exact:true}).fill('24');
 await dialog.getByLabel('Policy entitlement unit',{exact:true}).selectOption('days');
 await dialog.getByLabel('Policy accrual method',{exact:true}).selectOption('quarterly');
 await dialog.getByLabel('Policy accrual rate',{exact:true}).fill('6');
 await dialog.getByLabel('Policy carryover method',{exact:true}).selectOption('none');
 await dialog.getByLabel('Policy approval route',{exact:true}).selectOption('manager_then_admin');
 await dialog.getByLabel('Policy reason',{exact:true}).fill('Synthetic confirmed source only');
 await activate.click();await expect(dialog).toContainText('Synthetic workforce save denied');
 await expect(dialog.locator('[tabindex="-1"]')).toBeFocused();
 await expect(dialog.getByLabel('Policy name',{exact:true})).toHaveValue('Synthetic confirmed policy');
 expect(writes).toHaveLength(2);expect(writes[1]).toMatchObject({name:'workforce_record_leave_policy',body:{p_activate:true,p_rules:[{leave_kind:'annual',entitlement_amount:24,accrual_rate:6,approval_route:'manager_then_admin'}]}});
 await page.screenshot({path:`test-artifacts/admin-workforce-policy-${width}.png`,fullPage:true});
});

import {test,expect} from '@playwright/test';
for(const width of [390,1440])test(`Admin employment drawer retains reasoned rejected change at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:1000});const writes=[];
 const org='00000000-0000-4000-8000-000000000002';
 const employee={id:'00000000-0000-4000-8000-000000000010',org_id:org,profile_id:'00000000-0000-4000-8000-000000000020',full_name:'Synthetic linked employee',employment_status:'active',employment_type:'permanent',identity_state:'linked',account_active:true,units:[]};
 await page.route('**/*',route=>{
  const req=route.request(),url=new URL(req.url());
  if(!url.pathname.includes('/rest/v1/'))return ['localhost','127.0.0.1'].includes(url.hostname)?route.continue():route.abort();
  const name=url.pathname.split('/').pop();
  if(name==='admin_update_employment'){
   writes.push(req.postDataJSON());return route.fulfill({status:403,contentType:'application/json',body:JSON.stringify({message:'Synthetic employment denied'})});
  }
  const rows={admin_employee_roster_summary:[employee],admin_employee_roster_detail:{employee,units:[]},employee_roster:employee,admin_person_detail:{work:[],sessions:[],leave:[]},admin_employment_detail:{current:{employment_type:'permanent',employment_status:'active',membership_role:'staff'},history:[{id:'historical',change_type:'employment_details_changed',effective_on:'2026-01-01'}]}};
  return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(rows[name]||[])});
 });
 await page.goto('/tests/fixtures/people-layout.html');
 await page.locator('.fpg-people-roster-row').filter({hasText:'Synthetic linked employee'}).click();
 await page.getByRole('tab',{name:'Employment',exact:true}).click();
 await page.getByRole('button',{name:'Record change',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'Record employment change',exact:true});
 await expect(dialog).toHaveClass(/ev2c-composer-drawer/);
 await dialog.getByLabel('Employment status',{exact:true}).selectOption('exited');
 await expect(dialog.getByLabel('Exit date',{exact:true})).toBeVisible();
 await dialog.getByLabel('Employment status',{exact:true}).selectOption('active');
 await dialog.getByLabel('Change',{exact:true}).selectOption('correction');
 await expect(dialog.getByLabel('Event being corrected',{exact:true})).toBeVisible();
 await dialog.getByLabel('Change',{exact:true}).selectOption('employment_details_changed');
 await dialog.getByLabel('Reason / context',{exact:true}).fill('Retain this reasoned change');
 await dialog.getByRole('button',{name:'Record employment change',exact:true}).click();
 await expect(dialog).toContainText('Synthetic employment denied');
 await expect(dialog.getByLabel('Reason / context',{exact:true})).toHaveValue('Retain this reasoned change');
 expect(writes).toHaveLength(1);expect(writes[0]).toMatchObject({p_profile_id:employee.profile_id,p_reason:'Retain this reasoned change'});
});

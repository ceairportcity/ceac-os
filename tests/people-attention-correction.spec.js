import {test,expect} from '@playwright/test';
for(const width of [390,1440])test(`saved linked employment clears the roster warning and long queues scroll at ${width}`,async({page})=>{
 await page.setViewportSize({width,height:1000});
 const org='00000000-0000-4000-8000-000000000002';
 const employee={id:'employee',org_id:org,profile_id:'person',full_name:'Linked employee fixture',employment_type:'not_recorded',job_title:'Coordinator',employment_status:'active',identity_state:'linked',units:[{unit_id:'unit',unit_name:'Recorded-head unit',is_primary:true}]};
 let type='not_recorded';const writes=[];
 const current=()=>({employment_type:type,job_title:'Coordinator',employment_status:'active',membership_role:'staff',unit_id:'unit',unit_name:'Recorded-head unit'});
 await page.route('**/*',route=>{
  const request=route.request(),url=new URL(request.url());
  if(!url.pathname.includes('/rest/v1/'))return ['localhost','127.0.0.1'].includes(url.hostname)?route.continue():route.abort();
  const name=url.pathname.split('/').pop();
  if(name==='admin_update_employment'){writes.push(request.postDataJSON());type=request.postDataJSON().p_employment_type;return route.fulfill({contentType:'application/json',body:JSON.stringify({current:current(),history:[]})});}
  const data={
   admin_employee_roster_summary:[employee,...Array.from({length:30},(_,i)=>({...employee,id:'roster-'+i,profile_id:null,identity_state:'roster_only',full_name:'Roster colleague '+i}))],
   admin_people_summary:[{id:'person',full_name:employee.full_name,active:true,contract_type:type,unit_id:'unit',unit_name:'Recorded-head unit'},...Array.from({length:20},(_,i)=>({id:'account-'+i,full_name:'Unlinked account '+i,active:true}))],
   units:[{id:'unit',name:'Recorded-head unit',unit_memberships:[{profile_id:'head-account',role:'manager',profiles:{active:true}}]},...Array.from({length:30},(_,i)=>({id:'vacant-'+i,name:'Vacant-head unit '+i,unit_memberships:[]}))],
   admin_employee_roster_detail:{employee,units:employee.units},employee_roster:employee,admin_person_detail:{work:[],sessions:[],leave:[]},admin_employment_detail:{current:current(),history:[]},
  };
  return route.fulfill({contentType:'application/json',body:JSON.stringify(data[name]||[])});
 });
 await page.goto('/tests/fixtures/people-layout.html');
 await page.getByRole('tab',{name:'Needs attention',exact:true}).click();
 const gaps=page.getByRole('region',{name:'Employee record gaps',exact:true});
 await expect(gaps).toContainText('Linked employee fixture');
 for(const label of ['Employee record gaps','Accounts without employee links','Units without a recorded head']){
  const region=page.getByRole('region',{name:label,exact:true});await expect(region).toBeVisible();
  expect(await region.evaluate(node=>node.scrollHeight>node.clientHeight)).toBe(true);
  await region.focus();expect(await region.evaluate(node=>document.activeElement===node)).toBe(true);
 }
 await expect(page.getByRole('region',{name:'Units without a recorded head',exact:true})).not.toContainText('Recorded-head unit');
 await gaps.getByRole('button').filter({hasText:'Linked employee fixture'}).click();
 await page.getByRole('tab',{name:'Employment',exact:true}).click();
 await page.getByRole('button',{name:'Record change',exact:true}).click();
 const drawer=page.getByRole('dialog',{name:'Record employment change',exact:true});
 await drawer.getByLabel('Employment type',{exact:true}).selectOption('permanent');
 await drawer.getByRole('button',{name:'Record employment change',exact:true}).click();
 await expect(drawer).toHaveCount(0);expect(writes).toHaveLength(1);
 await page.getByRole('tab',{name:'Needs attention',exact:true}).click();
 await expect(gaps).not.toContainText('Linked employee fixture');
 await expect(gaps).toContainText('Roster colleague');
 await page.reload();await page.getByRole('tab',{name:'Needs attention',exact:true}).click();
 await expect(gaps).not.toContainText('Linked employee fixture');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
 await page.screenshot({path:`test-artifacts/reopened-people-${width}.png`,fullPage:true});
});

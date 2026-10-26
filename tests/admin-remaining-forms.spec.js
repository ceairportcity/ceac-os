import {test,expect} from '@playwright/test';
const isLocal=url=>['localhost','127.0.0.1'].includes(url.hostname);
for(const width of [390,1440]){
 test(`Admin Add employee uses modern drawer and preserves identity controls at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:1000});await page.emulateMedia({reducedMotion:'reduce'});const writes=[];
  await page.route('**/*',route=>{
   const req=route.request(),url=new URL(req.url());
   if(!url.pathname.includes('/rest/v1/'))return isLocal(url)?route.continue():route.abort();
   if(url.pathname.endsWith('/admin_create_roster_employee')){writes.push(req.postDataJSON());return route.fulfill({status:403,contentType:'application/json',body:JSON.stringify({message:'Synthetic employee creation denied'})});}
   return route.fulfill({status:200,contentType:'application/json',body:'[]'});
  });
  await page.goto('/tests/fixtures/hr-overview-review.html?audit=screen&screen=people');
  await page.getByRole('button',{name:'Add employee',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Add employee',exact:true});
  await expect(dialog).toHaveClass(/ev2c-composer-drawer/);
  await dialog.getByLabel('Employee full name',{exact:true}).fill('Synthetic new employee');
  await dialog.getByLabel('Employee creation reason',{exact:true}).fill('Synthetic documented appointment');
  await dialog.getByRole('button',{name:'Save employee',exact:true}).click();
  await expect(dialog).toContainText('Synthetic employee creation denied');
  await expect(dialog.getByRole('region',{name:'Employee creation error'})).toBeFocused();
  await expect(dialog.getByLabel('Employee full name',{exact:true})).toHaveValue('Synthetic new employee');
  await page.screenshot({path:`test-artifacts/admin-add-employee-${width}.png`,fullPage:true});
  expect(writes).toHaveLength(1);expect(writes[0]).toMatchObject({p_full_name:'Synthetic new employee',p_confirm_distinct_person:false});
 });
 test(`Admin unit setup does not close on an unconfirmed write at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:1000});await page.emulateMedia({reducedMotion:'reduce'});let count=0,saved=null;
  await page.route('**/*',route=>{
   const req=route.request(),url=new URL(req.url());
   if(!url.pathname.includes('/rest/v1/'))return isLocal(url)?route.continue():route.abort();
   if(url.pathname.endsWith('/units')&&req.method()==='POST'){
    count++;saved=count>1?{id:'unit',...req.postDataJSON()}:null;
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(saved)});
   }
   return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(url.pathname.endsWith('/units')&&saved?[saved]:[])});
  });
  await page.goto('/tests/fixtures/hr-overview-review.html?audit=screen&screen=units');
  await page.getByRole('button',{name:'Add unit',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Add unit',exact:true});
  await dialog.getByLabel('Unit name',{exact:true}).fill('Synthetic department');
  await dialog.getByRole('textbox',{name:/^Short code/}).fill('SYN');
  await dialog.getByRole('button',{name:'Create unit',exact:true}).click();
  await expect(dialog).toContainText('The unit setup could not be confirmed.');
  await expect(dialog.getByLabel('Unit name',{exact:true})).toHaveValue('Synthetic department');
  await page.screenshot({path:`test-artifacts/admin-unit-setup-${width}.png`,fullPage:true});
  await dialog.getByRole('button',{name:'Create unit',exact:true}).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('.admin-unit-card').filter({hasText:'Synthetic department'})).toBeVisible();
 });
 test(`Admin announcement record and rejected draft use modern surfaces at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:1000});await page.emulateMedia({reducedMotion:'reduce'});const writes=[];
  await page.route('**/*',route=>{
   const req=route.request(),url=new URL(req.url());
   if(!url.pathname.includes('/rest/v1/'))return isLocal(url)?route.continue():route.abort();
   const name=url.pathname.split('/').pop();
   if(name==='create_announcement'){writes.push(req.postDataJSON());return route.fulfill({status:403,contentType:'application/json',body:JSON.stringify({message:'Synthetic announcement denied'})});}
   const rows={announcements:[{id:'announcement',title:'Synthetic announcement',body:'Recorded fixture body',status:'draft',priority:'normal',announcement_receipts:[],announcement_audiences:[]}],announcement_audience_counts:[{target_count:0,read_count:0,acknowledged_count:0}]};
   return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(rows[name]||[])});
  });
  await page.goto('/tests/fixtures/hr-overview-review.html?audit=screen&screen=announcements');
  await page.getByRole('button',{name:/^Synthetic announcement/}).click();
  let dialog=page.getByRole('dialog',{name:'Synthetic announcement',exact:true});
  await expect(dialog).toHaveClass(/ev2c-composer-drawer/);await expect(dialog).toContainText('Recorded fixture body');
  await dialog.getByRole('button',{name:'Close',exact:true}).click();
  await page.getByRole('button',{name:'New announcement',exact:true}).click();
  dialog=page.getByRole('dialog',{name:'New announcement',exact:true});
  await dialog.getByLabel('Title *',{exact:true}).fill('Retained announcement');
  await dialog.getByLabel('Message *',{exact:true}).fill('Retained message draft');
  await dialog.getByRole('button',{name:'Save draft',exact:true}).click();
  await expect(dialog).toContainText('Synthetic announcement denied');
  await expect(dialog.getByLabel('Title *',{exact:true})).toHaveValue('Retained announcement');
  await page.screenshot({path:`test-artifacts/admin-announcement-${width}.png`,fullPage:true});
  expect(writes).toHaveLength(1);expect(writes[0]).toMatchObject({p_title:'Retained announcement',p_body:'Retained message draft',p_all_org:true});
 });
}

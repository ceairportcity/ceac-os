import {test,expect} from '@playwright/test';
for(const width of [390,1440])test(`Admin chooses duty venue visually and confirms its saved identity at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:1000});await page.emulateMedia({reducedMotion:'reduce'});
 const office={id:'office',name:'Saved CEAC office',lat:5.6,lng:-.2,radius_meters:100,is_primary:true};
 const venues=[office],writes=[];let deny=true;
 await page.route('**/*',route=>{
  const req=route.request(),url=new URL(req.url());
  if(!url.pathname.includes('/rest/v1/'))return ['localhost','127.0.0.1'].includes(url.hostname)?route.continue():route.abort();
  const name=url.pathname.split('/').pop();
  if(name==='office_locations'&&req.method()==='POST'){
   const row=req.postDataJSON();writes.push(row);
   if(deny)return route.fulfill({status:403,contentType:'application/json',body:JSON.stringify({message:'Synthetic venue denied'})});
   venues.push(row);return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({id:row.id,is_primary:false})});
  }
  return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(name==='office_locations'?venues:[])});
 });
 await page.goto('/tests/fixtures/control-center-design.html?tab=office-settings&setting=locations');
 const save=page.getByRole('button',{name:'Add authorised venue',exact:true});
 await page.getByLabel('Duty venue name',{exact:true}).fill('Synthetic programme venue');
 await expect(save).toBeDisabled();
 await expect(page.getByLabel('Duty venue latitude',{exact:true})).toHaveCount(0);
 await expect(page.getByLabel('Duty venue longitude',{exact:true})).toHaveCount(0);
 const map=page.getByRole('group',{name:'Venue map. Use arrow keys to move the map centre.',exact:true});
 await map.focus();await map.press('ArrowRight');
 await page.getByRole('button',{name:'Use map centre for this venue',exact:true}).click();
 await expect(page.getByText('Venue point chosen. Check the map before saving.',{exact:true})).toBeVisible();
 await page.getByLabel('Duty venue radius',{exact:true}).fill('9');await expect(save).toBeDisabled();
 await page.getByLabel('Duty venue radius',{exact:true}).fill('100');await save.click();
 await expect(page.getByRole('alert')).toContainText('The location save could not be confirmed.');
 await expect(page.getByLabel('Duty venue name',{exact:true})).toHaveValue('Synthetic programme venue');
 expect(writes).toHaveLength(1);expect(writes[0]).toMatchObject({name:'Synthetic programme venue',org_id:'synthetic-org',is_primary:false,radius_meters:100,set_by:'synthetic-admin'});
 expect(writes[0].lat).toBeCloseTo(office.lat,5);expect(writes[0].lng).toBeGreaterThan(office.lng);expect(writes[0].lng).toBeLessThan(office.lng+.02);
 deny=false;await save.click();await expect(page.getByText('The duty location was recorded.',{exact:false})).toBeVisible();
 await page.reload();await expect(page.locator('#duty-location-settings .admin-evidence-row').filter({hasText:'Synthetic programme venue'})).toBeVisible();
 await page.getByRole('button',{name:'Edit',exact:true}).click();await expect(page.getByLabel('Duty venue name',{exact:true})).toHaveValue('Synthetic programme venue');
 await expect(page.getByRole('button',{name:'Save venue changes',exact:true})).toBeEnabled();
 await page.screenshot({path:`test-artifacts/admin-duty-map-${width}.png`,fullPage:true});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
});
test('unverified duty locations expose neither a map nor a save action',async({page})=>{
 await page.route('**/*',route=>{
  const url=new URL(route.request().url());
  if(url.pathname.includes('/rest/v1/'))return route.fulfill({status:403,contentType:'application/json',body:JSON.stringify({message:'Synthetic catalogue denied'})});
  return ['localhost','127.0.0.1'].includes(url.hostname)?route.continue():route.abort();
 });
 await page.goto('/tests/fixtures/control-center-design.html?tab=office-settings&setting=locations');
 await expect(page.getByRole('alert')).toContainText('Authorised duty locations could not be loaded.');
 await expect(page.getByRole('region',{name:'Choose duty venue on street map',exact:true})).toHaveCount(0);
 await expect(page.getByText('No authorised locations are configured.',{exact:true})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Add authorised venue',exact:true})).toBeDisabled();
});
for(const width of [390,1440])test(`Leave settings opens authorised schedules and policy through reload and back at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:1000});
 await page.route('**/*',route=>{
  const url=new URL(route.request().url());
  if(url.pathname.includes('/rest/v1/'))return route.fulfill({status:200,contentType:'application/json',headers:{'content-range':'*/0','access-control-expose-headers':'content-range'},body:'[]'});
  return ['localhost','127.0.0.1'].includes(url.hostname)?route.continue():route.abort();
 });
 await page.goto('/tests/fixtures/control-center-design.html?tab=office-settings&setting=leave');
 await page.getByRole('button',{name:'Manage leave rules in Time & Leave',exact:true}).click();
 await expect(page).toHaveURL(/workforce=setup/);
 await expect(page.getByRole('tab',{name:'Schedules & policy',exact:true})).toHaveAttribute('aria-selected','true');
 await page.reload();await expect(page.getByRole('tab',{name:'Schedules & policy',exact:true})).toHaveAttribute('aria-selected','true');
 await page.goBack();await expect(page.getByRole('heading',{name:'Leave rules',exact:true})).toBeVisible();
});
test('a setup URL does not expose policy controls without workforce management permission',async({page})=>{
 await page.route('**/*',route=>{
  const url=new URL(route.request().url());
  if(url.pathname.includes('/rest/v1/'))return route.fulfill({status:200,contentType:'application/json',body:'[]'});
  return ['localhost','127.0.0.1'].includes(url.hostname)?route.continue():route.abort();
 });
 await page.goto('/tests/fixtures/control-center-design.html?tab=attendance&workforce=setup&access=limited');
 await expect(page.getByRole('tab',{name:'Today',exact:true})).toHaveAttribute('aria-selected','true');
 await expect(page.getByRole('tab',{name:'Schedules & policy',exact:true})).toHaveCount(0);
});

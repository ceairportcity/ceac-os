import {test,expect} from '@playwright/test';
async function mock(page,{failure=false}={}){
 const requests=[];
 await page.route('**/*',route=>{
  const req=route.request(),u=new URL(req.url()),name=u.pathname.split('/').pop();requests.push({method:req.method(),url:req.url()});
  if(!u.pathname.includes('/rest/v1/'))return ['localhost','127.0.0.1'].includes(u.hostname)?route.continue():route.abort();
  const now=new Date().toISOString();
  const rows={profiles:[{id:'person',full_name:'Synthetic Ama',active:true}],units:[{id:'unit',name:'IT'}],unit_memberships:[{profile_id:'person',unit_id:'unit'}],work_sessions:u.searchParams.get('select')?.includes('location_accuracy_m')?[{id:'session',profile_id:'person',started_at:now,place:'office',lat:5.6,lng:-.18}]:[],office_locations:{name:'CEAC office',lat:5.6,lng:-.18,is_primary:true}};
  if(failure&&name==='profiles')return route.fulfill({status:403,contentType:'application/json',body:JSON.stringify({message:'Synthetic denial'})});
  const data=rows[name]||[],count=Array.isArray(data)?data.length:1;
  return route.fulfill({contentType:'application/json',headers:{'content-range':`0-${Math.max(0,count-1)}/${count}`,'access-control-expose-headers':'content-range'},body:JSON.stringify(data)});
 });
 return requests;
}
for(const width of [390,1440])test(`Executive map follows priority panels and uses authorised account records ${width}`,async({page})=>{
 await page.setViewportSize({width,height:1000});await page.addInitScript({path:'tests/fixtures/google-maps-stub.js'});const requests=await mock(page);
 await page.goto('/tests/fixtures/executive-google-map.html');
 const map=page.getByRole('region',{name:"Today's workforce start locations",exact:true});
 await expect(map).toContainText('1 person with recorded starts');
 await expect(map.getByText('Synthetic Google Maps',{exact:true})).toBeVisible();
 const updates=page.getByRole('heading',{name:'Upcoming meetings',exact:true});
 expect((await map.boundingBox()).y).toBeGreaterThan((await updates.boundingBox()).y);
 await expect(map.locator('.ceac-office-reference')).toBeVisible();
 const before=await page.evaluate(()=>({maps:window.syntheticMaps,fits:window.syntheticMapFits}));
 await map.getByLabel('Recorded office starts').getByRole('button',{name:'Synthetic Ama',exact:true}).click();
 await expect(map.getByRole('region',{name:'Selected work start',exact:true})).toContainText('IT');
 expect(await page.evaluate(()=>({maps:window.syntheticMaps,fits:window.syntheticMapFits}))).toEqual(before);
 await expect(map.getByRole('button',{name:'View recorded work start for Synthetic Ama',exact:true})).toHaveClass(/is-selected/);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
 expect(requests.some(r=>r.method==='POST'||/admin_employee_roster|hr_private|payroll/.test(r.url))).toBe(false);
 const reads=requests.filter(r=>/rest\/v1\/(profiles|units|unit_memberships|work_sessions)/.test(r.url));
 expect(reads.every(r=>new URL(r.url).searchParams.get('org_id')==='eq.org')).toBe(true);
 await page.screenshot({path:`test-artifacts/executive-google-map-${width}.png`,fullPage:true});
});
test('Executive map fails independently without hiding decisions or claiming zero attendance',async({page})=>{
 await mock(page,{failure:true});await page.goto('/tests/fixtures/executive-google-map.html');
 await expect(page.getByText('Work-start records are unavailable. No attendance conclusion is implied.',{exact:true})).toBeVisible();
 await expect(page.getByRole('heading',{name:'Needs your attention',exact:true})).toBeVisible();
 await expect(page.getByText(/0 people with recorded starts/)).toHaveCount(0);
});
test('absent map credentials retain office identity access and do not request another provider',async({page})=>{
 const requests=await mock(page);await page.goto('/tests/fixtures/executive-google-map.html');
 await expect(page.getByText('Google Maps setup required',{exact:true})).toBeVisible();
 await page.getByLabel('Recorded office starts').getByRole('button',{name:'Synthetic Ama',exact:true}).click();
 await expect(page.getByRole('region',{name:'Selected work start'})).toContainText('Synthetic Ama');
 expect(requests.some(r=>/maps.googleapis.com|openstreetmap/.test(r.url))).toBe(false);
});

import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
async function mock(page,{failure=false,pair=false}={}){
 const requests=[];
 await page.route('**/*',route=>{
  const req=route.request(),u=new URL(req.url()),name=u.pathname.split('/').pop();requests.push({method:req.method(),url:req.url()});
  if(!u.pathname.includes('/rest/v1/'))return ['localhost','127.0.0.1'].includes(u.hostname)?route.continue():route.abort();
  const now=new Date().toISOString();
  const rows={profiles:[{id:'person',full_name:'Synthetic Ama',active:true},...(pair?[{id:'person2',full_name:'Synthetic Kofi',active:true}]:[])],units:[{id:'unit',name:'IT'}],unit_memberships:[{profile_id:'person',unit_id:'unit'},...(pair?[{profile_id:'person2',unit_id:'unit'}]:[])],work_sessions:u.searchParams.get('select')?.includes('location_accuracy_m')?[{id:'session',profile_id:'person',started_at:now,place:'office',lat:5.6,lng:-.18},...(pair?[{id:'session2',profile_id:'person2',started_at:now,place:'office',lat:5.6,lng:-.18}]:[])]:[],office_locations:{name:'CEAC office',lat:5.6,lng:-.18,is_primary:true}};
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
 if(width===390){const heights=await map.locator("button:visible").evaluateAll(nodes=>nodes.map(n=>n.getBoundingClientRect().height));for(const height of heights)expect(height).toBeGreaterThanOrEqual(44);}
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
test('MAP-DOWNLOAD exposes a Google road fallback without a key or staff names in the URL',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.addInitScript({path:'tests/fixtures/google-maps-stub.js'});
 await mock(page);await page.goto('/tests/fixtures/executive-google-map.html');
 await expect(page.getByText('Synthetic Google Maps',{exact:true})).toBeVisible();
 await page.evaluate(()=>window.dispatchEvent(new CustomEvent('ceac-google-map-error',{detail:{code:'MAP-DOWNLOAD'}})));
 await expect(page.getByText('Map check: MAP-DOWNLOAD',{exact:true})).toBeVisible();
 const alternative=page.getByTitle('Google Maps alternative road map');
 await expect(alternative).toBeVisible();
 const src=await alternative.getAttribute('src');
 const url=new URL(src);
 expect(url.origin).toBe('https://www.google.com');
 expect(url.pathname).toBe('/maps');
 expect(url.searchParams.get('q')).toBe('5.6,-0.18');
 expect(url.searchParams.get('output')).toBe('embed');
 expect(src).not.toMatch(/Synthetic|person|session|AIza|key=/i);
 await page.getByLabel('Recorded office starts').getByRole('button',{name:'Synthetic Ama',exact:true}).click();
 await expect(page.getByRole('region',{name:'Selected work start'})).toContainText('Synthetic Ama');
 await page.getByRole('button',{name:'Retry interactive map',exact:true}).click();
 await expect(alternative).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Fit staff start locations',exact:true})).toBeEnabled();
});
test('map opening failure preserves staff records and retry restores markers on phone',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.addInitScript({content:readFileSync('tests/fixtures/google-maps-stub.js','utf8')+';window.syntheticMapFail=true;'});
 await mock(page);await page.goto('/tests/fixtures/executive-google-map.html');
 await expect(page.getByText('Map check: MAP-INITIALISE',{exact:true})).toBeVisible();
 await page.getByLabel('Recorded office starts').getByRole('button',{name:'Synthetic Ama',exact:true}).click();
 await expect(page.getByRole('region',{name:'Selected work start'})).toContainText('Synthetic Ama');
 await page.evaluate(()=>{window.syntheticMapFail=false;});
 await page.getByRole('button',{name:'Retry Google Maps',exact:true}).click();
 await expect(page.getByText('Map check: MAP-INITIALISE',{exact:true})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'View recorded work start for Synthetic Ama',exact:true})).toBeVisible();
});
test('a Google policy block has a safe visible code; unrelated and report-only blocks do not hide streets',async({page})=>{
 await page.addInitScript({path:'tests/fixtures/google-maps-stub.js'});
 await mock(page);await page.goto('/tests/fixtures/executive-google-map.html');
 await expect(page.getByRole('button',{name:'Fit staff start locations',exact:true})).toBeEnabled();
 for(const event of [{blockedURI:'https://other.test/private',disposition:'enforce'},{blockedURI:'https://fonts.googleapis.com/css',disposition:'enforce'},{blockedURI:'https://maps.googleapis.com/maps/api/js?key=PRIVATE',disposition:'report'}]){
  await page.evaluate(data=>document.dispatchEvent(new SecurityPolicyViolationEvent('securitypolicyviolation',data)),event);
  await expect(page.getByRole('button',{name:'Fit staff start locations',exact:true})).toBeEnabled();
 }
 await page.evaluate(()=>document.dispatchEvent(new SecurityPolicyViolationEvent('securitypolicyviolation',{blockedURI:'https://maps.googleapis.com/maps/api/js?key=PRIVATE',disposition:'enforce'})));
 await expect(page.getByText('Map check: MAP-POLICY',{exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Fit staff start locations',exact:true})).toBeDisabled();
 await expect(page.getByRole('region',{name:'Recorded workforce work-start street map'})).not.toContainText('PRIVATE');
});
test('late streets recover from a tile timeout; authorisation rejection remains a failure',async({page})=>{
 await page.clock.install();
 const stub=readFileSync('tests/fixtures/google-maps-stub.js','utf8').replace("setTimeout(()=>{callback();},5)","setTimeout(()=>{callback();},name==='tilesloaded'?25000:5)");
 await page.addInitScript({content:stub});
 await mock(page);await page.goto('/tests/fixtures/executive-google-map.html');
 await expect(page.getByText('Loading Google Maps…',{exact:true})).toBeVisible();
 await page.clock.fastForward(21000);
 await expect(page.getByText('Map check: MAP-TILES-TIMEOUT',{exact:true})).toBeVisible();
 await page.clock.fastForward(5000);
 await expect(page.getByRole('button',{name:'Fit staff start locations',exact:true})).toBeEnabled();
 await page.getByRole('button',{name:'Hide street map',exact:true}).click();
 await page.getByRole('button',{name:'Show Google Maps',exact:true}).click();
 await expect(page.getByText('Loading Google Maps…',{exact:true})).toBeVisible();
 await page.evaluate(()=>window.dispatchEvent(new CustomEvent('ceac-google-map-error',{detail:{code:'MAP-AUTH'}})));
 await expect(page.getByText('Map check: MAP-AUTH',{exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Reload map configuration',exact:true})).toBeVisible();
 await page.clock.fastForward(30000);
 await expect(page.getByText('Map check: MAP-AUTH',{exact:true})).toBeVisible();
});

test('compact individual person pins and church office label at one recorded coordinate',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.addInitScript({path:'tests/fixtures/google-maps-stub.js'});
 await mock(page,{pair:true});await page.goto('/tests/fixtures/executive-google-map.html');
 const region=page.getByRole('region',{name:'Recorded workforce work-start street map'});
 await expect(region.locator('.ceac-office-reference')).toContainText('CEAC Church Office');
 const ama=region.getByRole('button',{name:'View recorded work start for Synthetic Ama'});
 const kofi=region.getByRole('button',{name:'View recorded work start for Synthetic Kofi'});
 await expect(ama.locator('.ceac-map-avatar')).toHaveText('SA');
 await expect(kofi.locator('.ceac-map-avatar')).toHaveText('SK');
 await expect(ama).toHaveAttribute('aria-pressed','false');
 const before=await page.evaluate(()=>window.syntheticMaps);
 await kofi.click();
 await expect(region.getByRole('region',{name:'Selected work start'})).toContainText('Synthetic Kofi');
 await expect(kofi).toHaveAttribute('aria-pressed','true');
 await ama.click();
 await expect(region.getByRole('region',{name:'Selected work start'})).toContainText('Synthetic Ama');
 expect(await page.evaluate(()=>window.syntheticMaps)).toBe(before);
 await expect(page.getByRole('region',{name:'Recorded staff attendance details'})).toContainText('Office selected');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
});

test('attendance panel reuses CEAC readable styles and identifies shared-location staff',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.addInitScript({path:'tests/fixtures/google-maps-stub.js'});
 await mock(page,{pair:true});
 await page.goto('/tests/fixtures/executive-google-map.html');
 const panel=page.getByRole('region',{name:'Recorded staff attendance details'});
 await expect(panel).toContainText('2 matching records');
 await expect(panel.getByRole('button',{name:/Synthetic Ama/})).toContainText('CEAC office');
 await expect(panel.getByRole('button',{name:/Synthetic Kofi/})).toContainText('Office selected');
 await panel.getByRole('button',{name:/Synthetic Kofi/}).click();
 await expect(page.getByRole('region',{name:'Selected work start'})).toContainText('Synthetic Kofi');
 const small=await panel.locator('*').evaluateAll(nodes=>nodes.filter(el=>{
  const style=getComputedStyle(el),rect=el.getBoundingClientRect();
  return style.display!=='none'&&rect.width>0&&rect.height>0&&[...el.childNodes].some(n=>n.nodeType===Node.TEXT_NODE&&n.textContent.trim())&&parseFloat(style.fontSize)<12;
 }).map(el=>({text:el.textContent.trim().slice(0,36),size:getComputedStyle(el).fontSize})));
 expect(small).toEqual([]);
});

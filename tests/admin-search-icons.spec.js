import {test,expect} from '@playwright/test';

async function searchFixture(page,{workDenied=false,holdMeetings=false}={}){
 let release;const held=new Promise(resolve=>{release=resolve;});
 await page.route('**/*',async route=>{
  const url=new URL(route.request().url()),name=url.pathname.split('/').pop();
  if(url.pathname.includes('/rest/v1/')){
   if(name==='meeting_sessions'&&holdMeetings)await held;
   if(name==='work_items'&&workDenied)return route.fulfill({status:403,contentType:'application/json',body:JSON.stringify({code:'42501',message:'Synthetic denied'})});
   const query=url.searchParams;
   const data=name==='work_items'&&query.has('ref')?[{id:'search-work',ref:'OPS-007',title:'Prepare the venue',status:'in_progress'}]
    :name==='profiles'?[{id:'search-person',full_name:'Ama Search',job_title:'Coordinator'}]
    :name==='projects'?[{id:'search-project',name:'Search conference',status:'active'}]
    :name==='units'?[{id:'search-unit',name:'Search department',code:'SRC'}]:[];
   return route.fulfill({status:200,contentType:'application/json',headers:{'access-control-expose-headers':'content-range','content-range':`*/${data.length}`},body:JSON.stringify(data)});
  }
  if(['localhost','127.0.0.1'].includes(url.hostname))return route.continue();
  return route.abort();
 });
 await page.goto('/tests/fixtures/hr-overview-review.html?audit=screen&screen=account');
 return release;
}
async function input(page,width){
 if(width<760)await page.getByRole('button',{name:'Search CEAC',exact:true}).click();
 return page.getByRole('textbox',{name:'Search CEAC',exact:true});
}
for(const width of [390,1440])test(`Admin work references, prompt people and preserved verified results at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:1000});
 const release=await searchFixture(page,{holdMeetings:true});
 try {
 const field=await input(page,width);await field.fill('OPS-007');
 const work=page.getByRole('region',{name:'Work',exact:true});
 await expect(work.getByRole('button',{name:/Prepare the venue/})).toBeVisible();
 await expect(page.getByRole('region',{name:'People',exact:true}).getByRole('button',{name:/Ama Search/})).toBeVisible();
 await work.getByRole('button',{name:/Prepare the venue/}).click();
 await expect(page.locator('output[aria-label="Fixture action"]')).toHaveText('work:search-work');
 release();
 if(width<760)await page.getByRole('button',{name:'Search CEAC',exact:true}).click();
 await page.getByRole('textbox',{name:'Search CEAC',exact:true}).fill('Ama');
 await page.getByRole('region',{name:'People',exact:true}).getByRole('button',{name:/Ama Search/}).click();
 await expect(page.locator('output[aria-label="Fixture action"]')).toHaveText('person:search-person');
 } finally { release(); }
});
test('a denied Work lookup does not erase independently verified people or organisation results',async({page})=>{
 await page.setViewportSize({width:1440,height:1000});await searchFixture(page,{workDenied:true});
 await (await input(page,1440)).fill('Search');
 await expect(page.getByText(/Work search could not be verified/)).toBeVisible();
 await expect(page.getByRole('region',{name:'People',exact:true}).getByRole('button',{name:/Ama Search/})).toBeVisible();
 await expect(page.getByRole('region',{name:'Organisation',exact:true}).getByRole('button',{name:/Search department/})).toBeVisible();
 await expect(page.getByText('No matching authorised results.',{exact:true})).toHaveCount(0);
});
test('Admin desktop symbols distinguish different destinations and phone More uses the same symbols',async({page})=>{
 await page.setViewportSize({width:1440,height:1000});await searchFixture(page);
 const nav=page.getByRole('navigation',{name:'Primary navigation'});
 const shape=label=>nav.getByRole('button',{name:label,exact:true}).locator('svg').first().innerHTML();
 expect(await shape('Finance')).not.toBe(await shape('Payroll'));
 expect(await shape('Reports')).not.toBe(await shape('Reviews & Development'));
 expect(await shape('My Hub')).not.toBe(await shape('Your account'));
 await page.screenshot({path:'test-artifacts/admin-distinct-icons-desktop.png',fullPage:false});
 await page.setViewportSize({width:390,height:844});
 await page.getByRole('button',{name:'More',exact:true}).click();
 await expect(page.getByRole('dialog')).toContainText('Payroll');
 await expect(page.getByRole('dialog')).toContainText('Reviews & Development');
 await page.screenshot({path:'test-artifacts/admin-distinct-icons-mobile.png',fullPage:false});
});

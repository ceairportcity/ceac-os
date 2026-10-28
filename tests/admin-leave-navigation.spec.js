import {test,expect} from '@playwright/test';

// Synthetic API presentation only: no production records or Auth session are used.
const day='2026-11-10';
const request=(id,status)=>({id,profile_id:id+'-person',kind:'annual',days:2,start_date:day,end_date:'2026-11-11',status,reason:'Family appointment',profiles:{full_name:id==='request-c'?'Kojo Review':'Ama Review'}});
async function intercept(page,{status='escalated',denied=false}={}){
 const writes=[];
 let savedStatus=status;
 await page.route('**/*',async route=>{
  const url=new URL(route.request().url());
  if(url.pathname.includes('/rest/v1/')){
   const endpoint=url.pathname.split('/').pop();
   if(endpoint==='workforce_leave_action'){
    const payload=route.request().postDataJSON();writes.push(payload);
    savedStatus=payload.p_action==='admin_approved'?'approved':'declined';
    return route.fulfill({status:200,contentType:'application/json',body:'null'});
   }
   if(endpoint==='leave_requests'&&denied)return route.fulfill({status:403,contentType:'application/json',body:JSON.stringify({message:'Not authorised'})});
   const data=endpoint==='leave_requests'?[request('request-a','pending'),request('request-c',savedStatus)]
    :endpoint==='employment_records'?[{profile_id:'request-c-person',employment_type:'permanent',profiles:{full_name:'Kojo Review',active:true},units:{name:'Operations'}}]
    :['office_locations','workforce_annual_leave_summary'].includes(endpoint)?null:[];
   return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
  }
  if(['127.0.0.1','localhost'].includes(url.hostname))return route.continue();
  return route.abort();
 });
 return writes;
}
for(const width of [390,1440])test(`Admin selected leave review and reasoned decision at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:1000});
 const writes=await intercept(page);
 await page.goto('/tests/fixtures/hr-overview-review.html?audit=admin&view=attendance&request=request-c');
 const inspector=page.getByRole('complementary',{name:'Leave selection and decisions'});
 await expect(inspector).toContainText('Selected request');
 if(width<760){await expect(page.locator('.timeleave-calendar')).toBeHidden();expect((await inspector.boundingBox()).y).toBeLessThan(500);}
 else await expect(page.locator('.timeleave-calendar')).toBeVisible();
 await expect(inspector).toContainText('Kojo Review');
 await expect(inspector).toContainText('Family appointment');
 await expect(inspector).toContainText('HR decision needed');
 await expect(page.getByRole('tab',{name:'Leave requests',exact:true})).toHaveAttribute('aria-selected','true');
 await expect(inspector.getByRole('button',{name:'Admin approve',exact:true})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
 await page.screenshot({path:`test-artifacts/admin-selected-leave-${width}.png`,fullPage:true});
 page.once('dialog',dialog=>dialog.accept('Reviewed manager approval and requested dates'));
 await inspector.getByRole('button',{name:'Admin approve',exact:true}).click();
 await expect.poll(()=>writes.length).toBe(1);
 expect(writes[0]).toMatchObject({p_leave_request_id:'request-c',p_action:'admin_approved',p_reason:'Reviewed manager approval and requested dates'});
 await expect(inspector).toContainText('Approved');
 await expect(inspector.getByRole('button',{name:'Admin approve',exact:true})).toHaveCount(0);
});
test('pending Manager approval cannot be approved by HR from the selected review',async({page})=>{
 const writes=await intercept(page,{status:'pending'});
 await page.goto('/tests/fixtures/hr-overview-review.html?audit=admin&view=attendance&request=request-c');
 const inspector=page.getByRole('complementary',{name:'Leave selection and decisions'});
 await expect(inspector).toContainText('Waiting for Manager approval');
 await expect(inspector.getByRole('button',{name:/Admin approve|Decline/})).toHaveCount(0);
 expect(writes).toHaveLength(0);
});
test('read-only Admin and denied records expose no decision controls',async({page})=>{
 const writes=await intercept(page);
 await page.goto('/tests/fixtures/hr-overview-review.html?audit=admin&view=attendance&request=request-c&access=limited');
 let inspector=page.getByRole('complementary',{name:'Leave selection and decisions'});
 await expect(inspector).toContainText('Kojo Review');
 await expect(inspector.getByRole('button',{name:/Admin approve|Decline/})).toHaveCount(0);
 expect(writes).toHaveLength(0);
 await page.unroute('**/*');
 const deniedWrites=await intercept(page,{denied:true});
 await page.reload();
 inspector=page.getByRole('complementary',{name:'Leave selection and decisions'});
 await expect(page.getByText('Leave records could not be verified.',{exact:false}).first()).toBeVisible();
 await expect(inspector).not.toContainText('Kojo Review');
 await expect(inspector.getByRole('button',{name:/Admin approve|Decline/})).toHaveCount(0);
 expect(deniedWrites).toHaveLength(0);
});

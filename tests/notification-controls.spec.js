import {test,expect} from '@playwright/test';
for(const width of [320,768,1440])test(`notification controls remain clear and usable at ${width}px`,async({page})=>{
 await page.context().grantPermissions(['notifications']);
 await page.setViewportSize({width,height:1000});
 await page.addInitScript(()=>{
  const subscription={endpoint:'https://fcm.googleapis.com/synthetic',toJSON(){return {endpoint:this.endpoint,keys:{}}}};
  Object.defineProperty(navigator,'serviceWorker',{value:{ready:Promise.resolve({pushManager:{getSubscription:async()=>subscription}})}});
 });
 let saved=null;
 await page.route('**/functions/v1/ceac-web-push?**',async route=>{
  const action=new URL(route.request().url()).searchParams.get('action');
  const result=action==='config'?{enabled:true,publicKey:'B'+'a'.repeat(86)}:action==='status'?{enabled:true,preview:false,preferences:{categories:{messages:true,work:true,calendar:true},quietStart:null,quietEnd:null,reminderMinutes:30}}:{saved:true,queued:true};
  if(action==='preferences')saved=route.request().postDataJSON();
  await route.fulfill({status:200,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,content-type','Access-Control-Allow-Methods':'GET,POST,OPTIONS'},body:JSON.stringify(result)});
 });
 await page.goto('/tests/fixtures/notification-controls.html');
 await expect(page.getByText('Notifications are enabled on this device.',{exact:false})).toBeVisible();
 await expect(page.getByText('New memo from Ama Example',{exact:true})).toBeVisible();
 await expect(page.getByText('Work is past due',{exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'Action needed',exact:false}).click();
 await expect(page.getByText('Work is past due',{exact:true})).toBeVisible();
 await page.getByLabel('Quiet hours · Ghana time').check();
 await page.getByRole('button',{name:'Save preferences',exact:true}).click();
 await expect(page.getByText('Notification preferences saved.',{exact:true})).toBeVisible();
 expect(saved.preferences.quietStart).toBe(21);expect(saved.preferences.quietEnd).toBe(7);
 await page.getByRole('button',{name:'Send a test notification',exact:true}).click();
 await expect(page.getByText('Test queued.',{exact:false})).toBeVisible();
 await page.getByRole('button',{name:'History',exact:true}).click();
 await expect(page.getByText('New Memo',{exact:true})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth)).toBe(false);
});

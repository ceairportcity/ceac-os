import {test,expect} from '@playwright/test';
for(const width of [320,768,1440])test(`mocked notification controls remain clear and usable at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:1000});
 await page.addInitScript(()=>{
  // This test verifies controls/layout, not native permission or phone receipt.
  window.PushManager=class {};
  window.Notification={permission:'granted',requestPermission:async()=> 'granted'};
  const subscription={endpoint:'https://fcm.googleapis.com/synthetic',toJSON(){return {endpoint:this.endpoint,keys:{}}}};
  Object.defineProperty(navigator,'serviceWorker',{value:{ready:Promise.resolve({pushManager:{getSubscription:async()=>subscription}})}});
  const nativeFetch=window.fetch.bind(window);
  window.__pushFixtureRequests=[];
  window.fetch=async(input,options)=>{
   const url=new URL(String(input),window.location.href);
   if(!url.pathname.endsWith('/functions/v1/ceac-web-push'))return nativeFetch(input,options);
   const action=url.searchParams.get('action');
   window.__pushFixtureRequests.push({action,body:options?.body?JSON.parse(options.body):null});
   const result=action==='config'?{enabled:true,publicKey:'B'+'a'.repeat(86)}:action==='status'?{enabled:true,preview:false,preferences:{categories:{messages:true,work:true,calendar:true,rooms:false},quietStart:null,quietEnd:null,reminderMinutes:30}}:{saved:true,queued:true};
   return new Response(JSON.stringify(result),{status:200,headers:{'Content-Type':'application/json'}});
  };
 });
 await page.goto('/tests/fixtures/notification-controls.html');

 await expect(page.getByText('New memo from Ama Example',{exact:true})).toBeVisible();
 await expect(page.getByText('Work is past due',{exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'Action needed',exact:false}).click();
 await expect(page.getByText('Work is past due',{exact:true})).toBeVisible();
 await expect(page.getByRole('link',{name:'Notification settings'})).toHaveAttribute('href','/?tab=account&preference=notifications');
 await page.goto('/tests/fixtures/notification-controls.html?settings=1');
 await expect(page.getByText('Notifications are enabled on this device.',{exact:false})).toBeVisible();
 await page.getByLabel('Quiet hours · Ghana time').check();
 await page.getByRole('button',{name:'Save preferences',exact:true}).click();
 await expect(page.getByText('Notification preferences saved.',{exact:true})).toBeVisible();
 const saved=await page.evaluate(()=>window.__pushFixtureRequests.find(request=>request.action==='preferences')?.body);
 expect(saved.preferences.quietStart).toBe(21);expect(saved.preferences.quietEnd).toBe(7);
 await page.getByRole('button',{name:'Send a test notification',exact:true}).click();
 await expect(page.getByText('Test queued.',{exact:false})).toBeVisible();
 await page.goto('/tests/fixtures/notification-controls.html');
 await page.getByRole('button',{name:'History',exact:true}).click();
 await expect(page.getByText('New Memo',{exact:true})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth)).toBe(false);
});

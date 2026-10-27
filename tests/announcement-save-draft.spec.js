import {test,expect} from '@playwright/test';

async function fixture(page,{deny=false,hold=false}={}){
 const writes=[];let release;
 const waiting=new Promise(resolve=>{release=resolve;});
 await page.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url()),name=url.pathname.split('/').pop();
  if(!url.pathname.includes('/rest/v1/')&&!url.pathname.includes('/auth/v1/'))return ['localhost','127.0.0.1'].includes(url.hostname)?route.continue():route.abort();
  const reply=(data,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
  if(['create_announcement','update_announcement'].includes(name)){
   writes.push({name,body:req.postDataJSON()});
   if(hold&&writes.length===1)await waiting;
   return deny?reply({message:'Synthetic save denied'},403):reply('saved-announcement');
  }
  return reply([]);
 });
 await page.goto('/tests/fixtures/owner-corrections.html?screen=announcements&actor=admin');
 await page.getByRole('button',{name:'New announcement',exact:true}).click();
 await page.getByLabel('Title *',{exact:true}).fill('Submitted title');
 await page.getByLabel('Message *',{exact:true}).fill('Submitted message');
 return {writes,release};
}

test('old announcement save cannot alter a different account draft',async({page})=>{
 const state=await fixture(page,{hold:true});
 await page.getByRole('button',{name:'Save draft',exact:true}).click();
 await expect.poll(()=>state.writes.length).toBe(1);
 // Harness-only account transition, analogous to the parent session changing
 // while a dialog is open; the ordinary modal correctly makes the page inert.
 await page.getByText('Switch fixture actor',{exact:true}).evaluate(button=>button.click());
 await page.getByRole('button',{name:'New announcement',exact:true}).click();
 await page.getByLabel('Title *',{exact:true}).fill('Different account draft');
 state.release();
 await expect(page.getByLabel('Title *',{exact:true})).toHaveValue('Different account draft');
 await expect(page.getByRole('status')).toHaveCount(0);
 await expect(page.getByRole('dialog',{name:'New announcement',exact:true})).toBeVisible();
});

for(const width of [390,1440]){
 test(`announcement confirmed save clears only its submitted draft at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:1000});const state=await fixture(page);
  await page.getByRole('button',{name:'Save draft',exact:true}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button',{name:'New announcement',exact:true}).click();
  await expect(page.getByLabel('Title *',{exact:true})).toHaveValue('');
  await expect(page.getByLabel('Message *',{exact:true})).toHaveValue('');
  expect(state.writes).toHaveLength(1);
 });
 test(`announcement late save keeps newer edits attached to the recorded draft at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:1000});const state=await fixture(page,{hold:true});
  await page.getByRole('button',{name:'Save draft',exact:true}).click();
  await expect.poll(()=>state.writes.length).toBe(1);
  await page.getByLabel('Title *',{exact:true}).fill('Later unsaved title');
  state.release();
  await expect(page.getByRole('button',{name:'Save changes',exact:true})).toBeEnabled();
  await expect(page.getByLabel('Title *',{exact:true})).toHaveValue('Later unsaved title');
  await expect(page.getByRole('status')).toContainText('later changes');
  await page.getByRole('button',{name:'Save changes',exact:true}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(state.writes.map(write=>write.name)).toEqual(['create_announcement','update_announcement']);
  expect(state.writes[1].body).toMatchObject({p_announcement_id:'saved-announcement',p_title:'Later unsaved title',p_body:'Submitted message'});
 });
 test(`announcement denied save retains the entered draft at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:1000});await fixture(page,{deny:true});
  await page.getByRole('button',{name:'Save draft',exact:true}).click();
  await expect(page.getByRole('dialog')).toContainText('Synthetic save denied');
  await expect(page.getByLabel('Title *',{exact:true})).toHaveValue('Submitted title');
  await expect(page.getByLabel('Message *',{exact:true})).toHaveValue('Submitted message');
 });
}

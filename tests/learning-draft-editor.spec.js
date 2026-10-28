import {test,expect} from '@playwright/test';
async function fixture(page,{deny=false,published=false,full=false}={}){
 const writes=[];
 const rows={learning_courses:[{id:'course',org_id:'org',title:'Synthetic course',summary:'Synthetic summary',state:published?'published':'draft'}],learning_modules:[{id:'module',org_id:'org',course_id:'course',position:1,title:'Synthetic module',summary:'Module summary',required:true}],learning_resources:[{id:'resource',org_id:'org',module_id:'module',position:1,resource_type:'text',title:'Synthetic resource',body_text:'Original course text'}]};
 await page.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url()),name=url.pathname.split('/').pop();
  if(!url.pathname.includes('/rest/v1/')&&!url.pathname.includes('/auth/v1/'))return ['localhost','127.0.0.1'].includes(url.hostname)?route.continue():route.abort();
  const reply=(data,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
  if(req.method()==='PATCH'){
   const body=req.postDataJSON();writes.push({name,body,query:url.search});
   if(deny)return reply({message:'Synthetic published or denied content update'},403);
   Object.assign(rows[name][0],body);return reply({id:rows[name][0].id});
  }
  return reply(rows[name]||[]);
 });
 await page.goto('/tests/fixtures/owner-corrections.html?screen=learning&actor=admin'+(full?'&full=1':''));
 await page.getByRole('button',{name:/Synthetic course.*modules/}).click();
 await expect(page.getByRole('region',{name:'Course builder'})).toBeVisible();
 return writes;
}
for(const width of [390,1440]){
 test(`draft course, module and resource can be edited with recorded identities at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:1000});const writes=await fixture(page,{full:true});
  await page.getByRole('button',{name:'Edit course details',exact:true}).click();
  await page.getByLabel('Draft content title',{exact:true}).fill('Updated course');
  await page.getByRole('button',{name:'Save changes',exact:true}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('heading',{name:'Updated course',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Edit module Synthetic module',exact:true}).click();
  await page.getByLabel('Draft content title',{exact:true}).fill('Updated module');
  await page.getByRole('button',{name:'Save changes',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Updated module',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Edit resource Synthetic resource',exact:true}).click();
  await page.getByLabel('Draft resource text',{exact:true}).fill('Updated learner text');
  await page.screenshot({path:`test-artifacts/learning-resource-editor-${width}.png`,fullPage:false,animations:"disabled"});
  await page.getByRole('button',{name:'Save changes',exact:true}).click();
  await expect(page.getByText('Updated learner text',{exact:true})).toBeVisible();
  expect(writes.map(w=>w.name)).toEqual(['learning_courses','learning_modules','learning_resources']);
  expect(writes.every(w=>w.query.includes('org_id=eq.org')&&w.query.includes('id=eq.'))).toBe(true);
  expect(writes[0].query).toContain('state=eq.draft');
  expect(writes[2].body).toMatchObject({body_text:'Updated learner text',resource_url:null,updated_by:'actor'});
  await page.getByRole('button',{name:'Learner preview',exact:true}).click();
  await expect(page.getByRole('button',{name:/^Edit (course|module|resource)/})).toHaveCount(0);
 });
 test(`a denied draft edit retains the typed resource at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:1000});await fixture(page,{deny:true,full:true});
  await page.getByRole('button',{name:'Edit resource Synthetic resource',exact:true}).click();
  await page.getByLabel('Draft resource text',{exact:true}).fill('Retained resource edits');
  await page.getByRole('button',{name:'Save changes',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('Synthetic published or denied');
  await expect(page.getByLabel('Draft resource text',{exact:true})).toHaveValue('Retained resource edits');
 });
 test(`published learning exposes no draft editors at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:1000});await fixture(page,{published:true,full:true});
  await expect(page.getByRole('heading',{name:'Synthetic module',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:/^Edit (course|module|resource)/})).toHaveCount(0);
 });
}

test('account transition closes an old draft editor before another account works',async({page})=>{
 await fixture(page);
 await page.getByRole('button',{name:'Edit course details',exact:true}).click();
 await page.getByLabel('Draft content title',{exact:true}).fill('Private unsaved course draft');
 await page.getByText('Switch fixture actor',{exact:true}).evaluate(button=>button.click());
 await expect(page.getByRole('dialog')).toHaveCount(0);
 await page.getByRole('button',{name:/Synthetic course.*modules/}).click();
 await expect(page.getByRole('button',{name:'Edit course details',exact:true})).toBeVisible();
});

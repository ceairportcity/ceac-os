import {test,expect} from '@playwright/test';

for(const width of [390,1440])test(`reference Learning builder selects modules and preserves section drafts at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:1100});
 const writes=[];
 const rows={
  learning_courses:[{id:'course',org_id:'org',title:'Getting started at CEAC',summary:'Learn how we work and where to find help.',state:'draft',estimated_minutes:25}],
  learning_modules:[{id:'welcome',org_id:'org',course_id:'course',position:1,title:'Welcome to CEAC',summary:'Our ministry purpose',required:true,estimated_minutes:8},{id:'working',org_id:'org',course_id:'course',position:2,title:'How we work',summary:'Working together',required:false,estimated_minutes:10}],
  learning_resources:[{id:'intro',module_id:'welcome',position:1,title:'CEAC introduction',resource_type:'text',body_text:'Welcome learner content'},{id:'video',module_id:'working',position:1,title:'Working together video',resource_type:'video',resource_url:'https://example.org/learning'}],
 };
 await page.route('**/*',route=>{
  const req=route.request(),url=new URL(req.url()),name=url.pathname.split('/').pop();
  if(!url.pathname.includes('/rest/v1/'))return ['localhost','127.0.0.1'].includes(url.hostname)?route.continue():route.abort();
  if(!['GET','HEAD'].includes(req.method())){writes.push({name,body:req.postDataJSON()});return route.fulfill({status:403,contentType:'application/json',body:JSON.stringify({message:'Synthetic edit denied'})});}
  return route.fulfill({contentType:'application/json',body:JSON.stringify(rows[name]||[])});
 });
 await page.goto('/tests/fixtures/owner-corrections.html?screen=learning&actor=admin&full=1');
 await page.getByRole('button',{name:/Getting started at CEAC.*Continue building/}).click();
 const outline=page.getByRole('region',{name:'Course outline',exact:true}),editor=page.getByRole('region',{name:'Selected module editor',exact:true});
 await expect(page.getByRole('navigation',{name:'Course building stages',exact:true}).getByRole('button')).toHaveText(['1 · Course details','2 · Modules & resources','3 · Audience','4 · Publish']);
 await expect(editor.getByRole('heading',{name:'Welcome to CEAC',exact:true})).toBeVisible();
 const header=page.getByRole('region',{name:'Course builder',exact:true}).locator('header').first();
 expect((await header.boundingBox()).height).toBeLessThan(width===390?260:180);
 await expect(editor.getByText('CEAC introduction',{exact:true})).toBeVisible();
 const first=await outline.boundingBox(),second=await editor.boundingBox();
 if(width===1440){expect(second.x).toBeGreaterThan(first.x+first.width-1);expect(Math.abs(first.y-second.y)).toBeLessThan(2);}
 else expect(second.y).toBeGreaterThan(first.y+first.height-1);
 await page.screenshot({path:`test-artifacts/learning-reference-builder-${width}.png`,fullPage:true,animations:'disabled'});
 await outline.getByRole('button',{name:/2 · How we work/}).click();
 await expect(editor.getByRole('heading',{name:'How we work',exact:true})).toBeVisible();
 await expect(editor.getByRole('link',{name:'Preview resource',exact:true})).toHaveAttribute('href','https://example.org/learning');
 await expect(editor.getByText('CEAC introduction',{exact:true})).toBeHidden();
 const selected=editor.locator('#learning-module-working');
 await selected.getByLabel('Draft content title',{exact:true}).fill('How we work together');
 await selected.getByRole('button',{name:'Save module',exact:true}).click();
 await expect(selected.getByRole('alert')).toContainText('Synthetic edit denied');
 await page.getByRole('button',{name:'3 · Audience',exact:true}).click();
 await expect(page.getByRole('region',{name:'Course audience',exact:true})).toContainText('Publish the course before creating an assignment');
 await expect(page.getByRole('button',{name:'Create assignment rule',exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'2 · Modules & resources',exact:true}).click();
 await expect(selected.getByLabel('Draft content title',{exact:true})).toHaveValue('How we work together');
 await page.getByRole('button',{name:'Learner preview',exact:true}).click();
 await expect(page.getByRole('button',{name:'Save module',exact:true}).filter({visible:true})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Review & publish',exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'Back to builder',exact:true}).click();
 await expect(selected.getByLabel('Draft content title',{exact:true})).toHaveValue('How we work together');
 await page.screenshot({path:`test-artifacts/learning-reference-denied-${width}.png`,fullPage:true,animations:'disabled'});
 await page.getByRole('button',{name:'Review & publish',exact:true}).click();
 await expect(page.getByRole('button',{name:'Publish course',exact:true})).toBeDisabled();
 await expect(page.getByRole('status').filter({hasText:'Save your course and module changes'})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
 expect(writes).toEqual([{name:'learning_modules',body:{title:'How we work together',summary:'Working together',estimated_minutes:10,required:false,updated_by:'actor'}}]);
});

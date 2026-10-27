import {test,expect} from '@playwright/test';
async function api(page,{deny=false,uploadDenied=false}={}){
 const calls=[];let recorded=null,fileActive=false;
 const year=new Date().getFullYear();
 await page.route('**/*',async route=>{
  const req=route.request(),u=new URL(req.url()),name=u.pathname.split('/').pop();
  if(!u.pathname.includes('/rest/v1/')&&!u.pathname.includes('/storage/v1/')&&!u.pathname.includes('/auth/v1/'))return ['127.0.0.1','localhost'].includes(u.hostname)?route.continue():route.abort();
  const reply=(data,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
  if(u.pathname.includes('/storage/v1/object/')&&req.method()==='POST'){
   calls.push({kind:'storage'});return uploadDenied?reply({message:'Synthetic upload denied',error:'Denied',statusCode:'403'},403):reply({Key:'receipt'});
  }
  if(name==='finance_requests'&&req.method()==='POST'){
   const body=req.postDataJSON();calls.push({kind:'request',body});
   if(deny)return reply({message:'Synthetic independent request denied'},403);
   recorded={...body,state:'submitted',independent_path:['finance','exec']};return reply(recorded);
  }
  if(name==='register_operational_file'){
   calls.push({kind:'register',body:req.postDataJSON()});
   return reply([{file_id:'receipt',storage_bucket:'ceac-operational-private',storage_path:'org/expense-receipt/spend/receipt/file.pdf'}]);
  }
  if(name==='finalize_operational_file'){calls.push({kind:'finalise',body:req.postDataJSON()});fileActive=true;return reply('receipt');}
  if(req.method()!=='GET')calls.push({kind:name});
  const rows={units:[{id:'unit',name:'Synthetic department',active:true}],unit_memberships:[{unit_id:'unit',role:'manager',units:{name:'Synthetic department',handles_finance:false}}],spend_lines:[{id:'spend',org_id:'org',unit_id:'unit',spent_on:`${year}-01-01`,description:'Synthetic recorded expense',amount_minor:12500,currency:'GHS'}],finance_requests:recorded?[recorded]:[],operational_file_links:fileActive?[{id:'link',relation:'expense_receipt',file:{id:'receipt',filename:'synthetic-receipt.pdf',mime_type:'application/pdf',size_bytes:4,storage_bucket:'ceac-operational-private',storage_path:'org/expense-receipt/spend/receipt/file.pdf',state:'active'}}]:[]};
  return reply(rows[name]||[]);
 });
 return calls;
}
for(const width of [390,1440]){
 test(`Admin funds form submits through independent path and starts clean at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:1000});const calls=await api(page);
  await page.goto('/tests/fixtures/owner-corrections.html?full=1&screen=finance&actor=admin');
  await page.getByRole('button',{name:'Request funds',exact:true}).click();
  const form=page.getByRole('dialog',{name:'Request funds',exact:true});
  await form.getByLabel('Funds request title',{exact:true}).fill('Synthetic new request');
  await form.getByLabel('Funds request amount',{exact:true}).fill('125.50');
  await page.screenshot({path:`test-artifacts/independent-funds-form-${width}.png`,fullPage:false,animations:"disabled"});
  await form.getByRole('button',{name:'Submit request',exact:true}).click();
  await expect(form).toHaveCount(0);
  await expect(page.getByRole('status')).toContainText('Finance, then the Group Pastor');
  expect(calls.filter(c=>c.kind==='request')).toHaveLength(1);
  expect(calls.find(c=>c.kind==='request').body).toMatchObject({amount_minor:12550,currency:'GHS',requested_by:'actor',unit_id:'unit'});
  await page.getByRole('button',{name:'My funds requests',exact:true}).click();
  await expect(page.getByRole('dialog',{name:'My funds requests',exact:true})).toContainText('Synthetic new request');
  await page.getByRole('dialog').getByRole('button',{name:/close/i}).click();
  await page.getByRole('button',{name:'Request funds',exact:true}).click();
  await expect(page.getByLabel('Funds request title',{exact:true})).toHaveValue('');
  await expect(page.getByLabel('Funds request amount',{exact:true})).toHaveValue('');
 });
 test(`denied independent request retains the draft at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:1000});await api(page,{deny:true});
  await page.goto('/tests/fixtures/owner-corrections.html?full=1&screen=finance&actor=admin');
  await page.getByRole('button',{name:'Request funds',exact:true}).click();
  await page.getByLabel('Funds request title',{exact:true}).fill('Retained request');
  await page.getByLabel('Funds request amount',{exact:true}).fill('10.999');
  await expect(page.getByRole('button',{name:'Submit request',exact:true})).toBeDisabled();
  await page.getByLabel('Funds request amount',{exact:true}).fill('10.50');
  await page.getByRole('button',{name:'Submit request',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('Synthetic independent request denied');
  await expect(page.getByLabel('Funds request title',{exact:true})).toHaveValue('Retained request');
 });
 test(`optional receipt performs register, private upload and finalisation at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:1000});const calls=await api(page);
  await page.goto('/tests/fixtures/owner-corrections.html?full=1&screen=cost&actor=admin');
  await page.getByRole('button',{name:'See spending',exact:true}).click();
  await page.getByRole('button',{name:'View receipts',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Expense receipts',exact:true});
  await expect(dialog).toContainText('Receipts are optional');
  await dialog.getByLabel('Upload file',{exact:true}).setInputFiles({name:'synthetic-receipt.pdf',mimeType:'application/pdf',buffer:Buffer.from('test')});
  await expect(dialog.getByRole('button',{name:/synthetic-receipt.pdf/})).toBeVisible();
  expect(calls.map(c=>c.kind)).toEqual(['register','storage','finalise']);
  await page.screenshot({path:`test-artifacts/expense-receipts-${width}.png`,fullPage:false,animations:"disabled"});
  expect(calls[0].body).toMatchObject({p_context_type:'spend_line',p_context_id:'spend',p_relation:'expense_receipt'});
 });
}

test('failed optional receipt upload does not finalise or re-record the expense',async({page})=>{
 const calls=await api(page,{uploadDenied:true});
 await page.goto('/tests/fixtures/owner-corrections.html?full=1&screen=cost&actor=admin');
 await page.getByRole('button',{name:'See spending',exact:true}).click();
 await page.getByRole('button',{name:'View receipts',exact:true}).click();
 await page.getByRole('dialog').getByLabel('Upload file',{exact:true}).setInputFiles({name:'synthetic-receipt.pdf',mimeType:'application/pdf',buffer:Buffer.from('test')});
 await expect(page.getByRole('alert')).toContainText('Synthetic upload denied');
 expect(calls.map(c=>c.kind)).toEqual(['register','storage']);
 await expect(page.getByRole('dialog').getByRole('button',{name:'Retry private files',exact:true})).toBeVisible();
});

test('real isolated Admin receipt stores and retrieves the same private bytes',async({browser})=>{
 const password=process.env.ROLE_FIXTURE_PASSWORD;
 test.skip(!password,'Requires the existing isolated role-fixture server; never run against production.');
 expect(process.env.SUPABASE_URL,'This mutating acceptance test requires the isolated loopback database').toMatch(/^http:\/\/(127\.0\.0\.1|localhost):/);
 const context=await browser.newContext();const page=await context.newPage();
 await page.goto('/');
 await page.getByPlaceholder('Work email').fill('admin@ceac.local.test');
 await page.getByPlaceholder('Password',{exact:true}).fill(password);
 await page.getByRole('button',{name:'Sign in',exact:true}).click();
 await expect(page.locator('.office-app')).toBeVisible();
 await page.goto('/?tab=cost');
 await page.getByRole('button',{name:'Record expenses',exact:true}).click();
 const title=`Isolated optional receipt ${Date.now()}`;
 await page.getByLabel('Expense department',{exact:true}).selectOption('20000000-0000-4000-8000-000000000011');
 await page.getByLabel('Expense 1 description',{exact:true}).fill(title);
 await page.getByLabel('Expense 1 amount',{exact:true}).fill('1.25');
 await page.getByRole('button',{name:'Save this batch',exact:true}).click();
 await expect(page.getByRole('dialog')).toHaveCount(0);
 await page.locator('.card').filter({has:page.getByText('Test Unit A',{exact:true})}).getByRole('button',{name:'See spending',exact:true}).click();
 await page.getByRole('row').filter({hasText:title}).getByRole('button',{name:'View receipts',exact:true}).click();
 const bytes=Buffer.from('%PDF-1.4\nCEAC isolated receipt bytes\n%%EOF');
 const filename=`isolated-receipt-${Date.now()}.pdf`;
 await page.getByRole('dialog').getByLabel('Upload file',{exact:true}).setInputFiles({name:filename,mimeType:'application/pdf',buffer:bytes});
 await expect(page.getByRole('dialog').getByRole('button',{name:new RegExp(filename)})).toBeVisible();
 const downloaded=await page.evaluate(async(name)=>{
  const {supabase}=await import('/src/lib/supabase.js');
  const links=await supabase.from('operational_files').select('storage_bucket,storage_path').eq('filename',name).single();
  if(links.error)throw links.error;
  const result=await supabase.storage.from(links.data.storage_bucket).download(links.data.storage_path);
  if(result.error)throw result.error;
  return {bytes:Array.from(new Uint8Array(await result.data.arrayBuffer())),...links.data};
 },filename);
 expect(Buffer.from(downloaded.bytes)).toEqual(bytes);
 const staffContext=await browser.newContext();const staff=await staffContext.newPage();
 await staff.goto('/');await staff.getByPlaceholder('Work email').fill('staff@ceac.local.test');
 await staff.getByPlaceholder('Password',{exact:true}).fill(password);await staff.getByRole('button',{name:'Sign in',exact:true}).click();
 await expect(staff.locator('.staff-app')).toBeVisible();
 const denied=await staff.evaluate(async(file)=>{
  const {supabase}=await import('/src/lib/supabase.js');
  const result=await supabase.storage.from(file.storage_bucket).download(file.storage_path);
  return Boolean(result.error)&&!result.data;
 },downloaded);
 expect(denied).toBe(true);
 await staffContext.close();await context.close();
});

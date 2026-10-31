import {test,expect} from '@playwright/test';
const projectRows=[{id:'project-a',name:'Service Setup',kind:'project',status:'active',lead_unit_id:'unit-a',purpose:'Prepare the service',starts_on:new Date().toISOString().slice(0,10),units:{name:'Operations'}},{id:'project-b',name:'Next Conference',kind:'project',status:'planned',lead_unit_id:'unit-a',purpose:'Prepare conference'}];
async function api(page,{denied=false,financeData=false}={}){
 const writes=[],reads=[];
 await page.route('**/*',async route=>{
  const request=route.request(),url=new URL(request.url()),name=url.pathname.split('/').pop();
  if(url.pathname.includes('/rest/v1/')){
   reads.push(url);
   if(!['GET','HEAD'].includes(request.method())){writes.push({name,body:request.postDataJSON()});return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(Array.isArray(request.postDataJSON())?request.postDataJSON().map((row,index)=>({...row,id:'saved-'+index})):{...request.postDataJSON(),id:'saved-budget'})});}
   if(denied)return route.fulfill({status:403,contentType:'application/json',body:JSON.stringify({message:'Not authorised'})});
   const single=request.headers().accept?.includes('object');
   let data=name==='projects'?(single?projectRows[0]:projectRows)
    :name==='units'?[{id:'unit-a',name:'Operations',code:'OPS'}]
    :name==='budgets'?[{id:'budget-a',unit_id:'unit-a',year:new Date().getFullYear(),amount_minor:100000,currency:'USD'}]
    :name==='income_lines'&&financeData?[{id:'in-a',received_on:`${new Date().getFullYear()}-02-01`,amount_minor:10000,currency:'USD',description:'Current income'},{id:'in-b',received_on:`${new Date().getFullYear()}-02-02`,amount_minor:2000,reverses_id:'in-a',currency:'USD',description:'Income correction'},{id:'in-old',received_on:`${new Date().getFullYear()-1}-02-01`,amount_minor:90000,currency:'USD',description:'Prior income'}]
    :name==='spend_lines'&&financeData?[{id:'out-a',spent_on:`${new Date().getFullYear()}-02-01`,amount_minor:2500,currency:'USD',unit_id:'unit-a',description:'Current spend'},{id:'out-old',spent_on:`${new Date().getFullYear()-1}-02-01`,amount_minor:30000,currency:'USD',unit_id:'unit-a',description:'Prior spend'}]
    :name==='policy_rule_definitions'?[{rule_key:'review_window',label:'Review window',domain:'administration',value_type:'integer',min_numeric:0,max_numeric:365,description:'Recorded review days'}]
    :name==='policy_rule_versions'?[{id:'future-rule',rule_key:'review_window',value:200,effective_on:'2099-01-01',reason:'Future change'},{id:'current-rule',rule_key:'review_window',value:100,effective_on:'2020-01-01',reason:'Current setting'}]
    :name==='objectives'?[{id:'objective-a',project_id:'project-a',status:'at_risk'}]
    :name==='project_units'?[{project_id:'project-a',unit_id:'unit-a',units:{name:'Operations'}}]
    :name==='work_items'?[{id:'work-a',title:'Prepare stage',ref:'OPS-001',status:'in_progress',kind:'task',due_at:new Date().toISOString(),assignee_id:'person-a',profiles:{full_name:'Ama Fixture'}}]
    :[];
   return route.fulfill({status:200,contentType:'application/json',headers:{'access-control-expose-headers':'content-range','content-range':`0-0/${Array.isArray(data)?data.length:1}`},body:JSON.stringify(data)});
  }
  if(['localhost','127.0.0.1'].includes(url.hostname))return route.continue();
  return route.abort();
 });return {writes,reads};
}
for(const width of [390,1440])test(`Admin project filters, calendar link and detail reload at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:1000});await api(page);
 await page.goto('/tests/fixtures/hr-overview-review.html?audit=screen&screen=projects');
 await page.getByRole('button',{name:/Planned projects/}).click();
 await expect(page.locator('.ev2p-context-list')).toContainText('Next Conference');
 await expect(page.locator('.ev2p-context-list')).not.toContainText('Service Setup');
 await page.getByRole('button',{name:/Need attention/}).click();
 await expect(page.locator('.ev2p-context-list')).toContainText('Service Setup');
 await expect(page.locator('.ev2p-context-list')).not.toContainText('Next Conference');
 await page.getByRole('button',{name:'Open project',exact:true}).click();
 await expect(page.locator('.ev2-project-workspace')).toContainText('Service Setup');
 await expect(page).toHaveURL(/project=project-a/);
 await page.reload();await page.getByRole('tab',{name:/^Work/}).click();await expect(page.locator('.ev2-project-workspace')).toContainText('Prepare stage');
 await page.getByRole('button',{name:'Back to Projects',exact:true}).click();
 await expect(page.locator('.ev2p-context-list')).toBeVisible();
 await page.goto('/tests/fixtures/hr-overview-review.html?audit=screen&screen=calendar');
 await page.getByRole('button',{name:/Service Setup starts/}).click();
 await expect(page.locator('.ev2-project-workspace')).toContainText('Service Setup');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
 await page.screenshot({path:`test-artifacts/admin-project-journey-${width}.png`,fullPage:true});
});
test('failed Admin project or expense reads do not become zero or empty evidence',async({page})=>{
 await api(page,{denied:true});
 await page.goto('/tests/fixtures/hr-overview-review.html?audit=screen&screen=projects');
 await expect(page.getByText('Projects could not finish loading',{exact:true})).toBeVisible();
 await expect(page.locator('.ev2p-summary')).toHaveCount(0);
 await expect(page.getByText('No projects recorded',{exact:true})).toHaveCount(0);
 await page.goto('/tests/fixtures/hr-overview-review.html?audit=screen&screen=cost');
 await expect(page.getByText('Expenses unavailable',{exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Record expenses',exact:true})).toHaveCount(0);
});
for(const width of [390,1440])test(`expense amount, draft and recorded currency safeguards at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:1000});const {writes,reads}=await api(page);
 await page.goto('/tests/fixtures/hr-overview-review.html?audit=screen&screen=cost');
 await page.getByRole('button',{name:'Change budget',exact:true}).click();
 let dialog=page.getByRole('dialog');await expect(dialog.getByLabel('Budget currency',{exact:true})).toHaveValue('USD');
 await dialog.getByRole('button',{name:'Cancel',exact:true}).click();
 await page.getByRole('button',{name:'Record expenses',exact:true}).click();dialog=page.getByRole('dialog');
 await dialog.getByLabel('Expense department',{exact:true}).selectOption('unit-a');
 await dialog.getByLabel('Expense 1 description',{exact:true}).fill('Test stationery');
 await dialog.getByLabel('Expense 1 amount',{exact:true}).fill('-25');
 await dialog.getByRole('button',{name:'Save this batch',exact:true}).click();
 await expect(dialog).toContainText('Enter non-negative amounts');expect(writes).toHaveLength(0);
 await expect(dialog.getByLabel('Expense 1 description',{exact:true})).toHaveValue('Test stationery');
 await dialog.getByLabel('Expense 1 amount',{exact:true}).fill('25.50');
 await dialog.getByLabel('Expense currency',{exact:true}).selectOption('USD');
 await page.screenshot({path:`test-artifacts/admin-expense-composer-${width}.png`,fullPage:true});
 await dialog.getByRole('button',{name:'Save this batch',exact:true}).click();
 await expect.poll(()=>writes.length).toBe(1);
 expect(writes[0]).toMatchObject({name:'spend_lines',body:[{amount_minor:2550,currency:'USD',description:'Test stationery',unit_id:'unit-a'}]});
 expect(reads.some(url=>url.pathname.endsWith('/spend_lines')&&url.searchParams.getAll('spent_on').some(value=>value===`gte.${new Date().getFullYear()}-01-01`))).toBe(true);
});

for(const width of [390,1440])test(`Finance year, reversals, chart table and safe amount entry at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:1000});const {writes}=await api(page,{financeData:true});
 await page.goto('/tests/fixtures/hr-overview-review.html?audit=screen&screen=finance');
 await expect(page.getByRole('button',{name:'Inspect money received',exact:true})).toContainText('USD 80.00');
 await expect(page.getByRole('button',{name:'Inspect money spent',exact:true})).toContainText('USD 25.00');
 await page.getByRole('button',{name:'Show monthly table',exact:true}).click();
 const table=page.getByRole('table').filter({has:page.getByRole('columnheader',{name:'Received (USD)',exact:true})});
 await expect(table.getByRole('row').filter({hasText:'February'})).toContainText('USD 80.00');
 await expect(table.getByRole('row').filter({hasText:'February'})).toContainText('USD 25.00');
 await page.getByRole('button',{name:'Show monthly chart',exact:true}).click();
 await expect(page.getByRole('img',{name:'Monthly recorded received and spent movement in USD',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Inspect money received',exact:true}).click();
 await expect(page.getByText('Prior income',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Record money received',exact:true}).click();
 let dialog=page.getByRole('dialog');await dialog.getByLabel('Income description',{exact:true}).fill('Test income');
 await dialog.getByLabel('Income amount',{exact:true}).fill('-25');await dialog.getByRole('button',{name:'Record income',exact:true}).click();
 await expect(dialog).toContainText('Enter a positive amount');expect(writes).toHaveLength(0);
 await dialog.getByRole('button',{name:'Cancel',exact:true}).click();
 await page.getByRole('button',{name:'Between departments',exact:true}).click();
 await page.getByRole('button',{name:'Record money sent',exact:true}).click();dialog=page.getByRole('dialog');
 await dialog.getByLabel('Sending department',{exact:true}).selectOption('unit-a');await dialog.getByLabel('Receiving department',{exact:true}).selectOption('unit-a');
 await dialog.getByLabel('Transfer amount',{exact:true}).fill('25.50');await dialog.getByLabel('Transfer purpose',{exact:true}).fill('Test transfer');
 await dialog.getByRole('button',{name:'Record transfer',exact:true}).click();await expect(dialog).toContainText('A department cannot send money to itself');expect(writes).toHaveLength(0);
 await dialog.getByLabel('Sending department',{exact:true}).selectOption('');await dialog.getByLabel('Transfer currency',{exact:true}).selectOption('USD');
 await page.screenshot({path:`test-artifacts/admin-finance-transfer-${width}.png`,fullPage:true});
 await dialog.getByRole('button',{name:'Record transfer',exact:true}).click();await expect.poll(()=>writes.length).toBe(1);
 expect(writes[0]).toMatchObject({name:'internal_transfers',body:{amount_minor:2550,currency:'USD',from_unit_id:null,to_unit_id:'unit-a'}});
});

test('rule reviews distinguish future versions and do not truncate invalid whole-number input',async({page})=>{
 const {writes}=await api(page);await page.goto('/tests/fixtures/hr-overview-review.html?audit=screen&screen=policies');
 await expect(page.getByText('Current: 100',{exact:true})).toBeVisible();
 await expect(page.getByText('Current: 200',{exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'Show version history',exact:true}).click();
 await expect(page.getByText('Scheduled',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Record new version',exact:true}).click();
 const dialog=page.getByRole('dialog');await dialog.getByLabel('Policy rule value',{exact:true}).fill('1.5');await dialog.getByLabel('Policy reason',{exact:true}).fill('Test rule');
 await dialog.getByRole('button',{name:'Record new version',exact:true}).click();
 await expect(page.getByText('Enter a valid value within this rule’s recorded limits.',{exact:false})).toBeVisible();expect(writes).toHaveLength(0);
 await expect(dialog.getByLabel('Policy rule value',{exact:true})).toHaveValue('1.5');
 await dialog.getByRole('button',{name:'Cancel',exact:true}).click();
});

for(const width of [390,1440])test(`Admin department project opens the authorised workspace at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:1000});const {writes}=await api(page);
 await page.goto('/tests/fixtures/hr-overview-review.html?audit=screen&screen=units');
 await page.getByRole('button',{name:'Open Operations',exact:true}).click();
 await page.getByRole('navigation',{name:'Unit workspace'}).getByRole('tab',{name:'Projects',exact:true}).click();
 await page.getByRole('button',{name:/^Service Setup/}).click();
 await expect(page).toHaveURL(/screen=projects.*project=project-a/);
 await expect(page.locator('.ev2-project-workspace')).toContainText('Service Setup');
 await page.reload();await page.getByRole('tab',{name:/^Work/}).click();await expect(page.locator('.ev2-project-workspace')).toContainText('Prepare stage');
 expect(writes).toHaveLength(0);
});

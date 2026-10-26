import {test,expect} from '@playwright/test';
const org='10000000-0000-4000-8000-000000000010',unit='20000000-0000-4000-8000-000000000012',person='31000000-0000-4000-8000-000000000005';
async function api(page){
 const writes=[];let created=null;
 const project={id:'25000000-0000-4000-8000-000000000025',org_id:org,kind:'project',name:'Synthetic HR project',status:'planned',lead_unit_id:unit,purpose:'Synthetic coordination',units:{name:'Other department'}};
 const room={id:'26000000-0000-4000-8000-000000000025',kind:'unit',unit_id:unit,units:{name:'Other department'}};
 await page.route('**/*',route=>{
  const req=route.request(),url=new URL(req.url());
  if(!url.pathname.includes('/rest/v1/'))return ['localhost','127.0.0.1'].includes(url.hostname)?route.continue():route.abort();
  const name=url.pathname.split('/').pop(),single=(req.headers().accept||'').includes('vnd.pgrst.object');let data=[];
  if(req.method()==='POST'){
   const body=req.postDataJSON();writes.push({name,body});
   if(name==='create_project_with_participants'){created={...project,name:body.p_name};data=created.id;}
   if(name==='send_room_message')data='27000000-0000-4000-8000-000000000025';
   if(name==='create_task_with_checklist')return route.fulfill({status:403,contentType:'application/json',body:JSON.stringify({message:'Synthetic assignment denied'})});
  }else if(name==='units')data=[{id:unit,name:'Other department',active:true}];
  else if(name==='projects')data=single?(created||project):[created||project];
  else if(name==='project_units')data=[{project_id:project.id,unit_id:unit,role:'lead',units:{name:'Other department'}}];
  else if(name==='profiles')data=[{id:person,full_name:'Other Department Person',active:true,unit_memberships:[{unit_id:unit,role:'manager',units:{name:'Other department'}}]}];
  else if(name==='unit_memberships')data=[{profile_id:person,unit_id:unit,role:'manager',profiles:{full_name:'Other Department Person',active:true}}];
  else if(name==='rooms')data=single?room:[room];
  else if(name==='room_reads')data=single?null:[];
  else if(name==='capabilities')data=single?null:[];
  return route.fulfill({status:200,contentType:'application/json',headers:{'access-control-expose-headers':'content-range','content-range':`0-0/${Array.isArray(data)?data.length:1}`},body:JSON.stringify(data)});
 });return writes;
}
for(const width of [390,1440]){
 test(`HR without department membership can open rooms and address a person at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:1000});const writes=await api(page);
  await page.goto('/tests/fixtures/hr-operations-repair.html');
  await page.getByRole('tab',{name:'Rooms',exact:true}).click();
  await page.getByRole('button',{name:/Other department/}).click();
  await expect(page.getByPlaceholder('Message your unit')).toBeVisible();
  await page.getByRole('button',{name:'Back from Room',exact:true}).click();
  await page.getByRole('tab',{name:'People',exact:true}).click();
  await page.getByRole('button',{name:/Other Department Person/}).click();
  const input=page.getByPlaceholder('Message your unit');
  await expect(input).toHaveValue('@Other Department Person ');
  await input.pressSequentially('Synthetic coordination only');
  await expect(input).toHaveValue('@Other Department Person Synthetic coordination only');
  await page.getByRole('button',{name:'Send',exact:true}).click();
  await expect.poll(()=>writes.filter(x=>x.name==='send_room_message').length).toBe(1);
  expect(writes.find(x=>x.name==='send_room_message').body).toMatchObject({p_room_id:'26000000-0000-4000-8000-000000000025',p_mention_ids:[person]});
 });
 test(`HR chooses any active department and retains a denied work draft at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:1000});const writes=await api(page);
  await page.goto('/tests/fixtures/hr-operations-repair.html?screen=assign');
  await page.getByLabel('Assignment department',{exact:true}).selectOption(unit);
  const dialog=page.getByRole('dialog');
  await dialog.getByLabel('Work to complete',{exact:true}).pressSequentially('Synthetic cross department work');
  await dialog.getByLabel('Responsible person',{exact:true}).selectOption(person);
  await dialog.getByLabel('Due date *',{exact:true}).fill('2026-11-01T12:00');
  await dialog.getByLabel('Why this matters *',{exact:true}).fill('Synthetic coordination purpose');
  await dialog.getByText('Subtasks',{exact:true}).click();
  await dialog.getByLabel('No steps needed',{exact:true}).check();
  await dialog.getByRole('button',{name:'Give it out',exact:true}).click();
  await expect(dialog).toContainText('Synthetic assignment denied');
  await expect(dialog.getByLabel('Work to complete',{exact:true})).toHaveValue('Synthetic cross department work');
  expect(writes.find(x=>x.name==='create_task_with_checklist').body).toMatchObject({p_unit_id:unit,p_assignee_id:person,p_origin:'assigned'});
 });
 test(`HR creates a project and opens its full workspace at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:1000});const writes=await api(page);
  await page.goto('/tests/fixtures/hr-operations-repair.html?screen=projects');
  await page.getByRole('button',{name:'Create project',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Create project',exact:true});
  await dialog.getByLabel('Project name',{exact:true}).pressSequentially('Synthetic new HR project');
  await expect(dialog.getByLabel('Project name',{exact:true})).toBeFocused();
  await dialog.getByRole('combobox',{name:'Lead department',exact:true}).selectOption(unit);
  await dialog.getByRole('button',{name:'Create project',exact:true}).click();
  await expect(page.locator('.ev2-project-workspace')).toContainText('Synthetic new HR project');
  await expect(page.getByRole('tab',{name:/^Objectives/})).toBeVisible();
  await page.getByRole('tab',{name:/^Objectives/}).click();
  await expect(page.getByRole('button',{name:'Add objective',exact:true})).toBeVisible();
  await page.reload();
  await expect(page.locator('.ev2-project-workspace')).toContainText('Synthetic new HR project');
  expect(writes.filter(x=>x.name==='create_project_with_participants')).toHaveLength(1);
  expect(writes.find(x=>x.name==='create_project_with_participants').body).toMatchObject({p_lead_unit_id:unit,p_name:'Synthetic new HR project'});
 });
}

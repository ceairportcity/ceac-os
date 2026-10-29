import {test,expect} from '@playwright/test';
const people=[{id:'sender',full_name:'Gabriel Rockson',job_title:'IT Head',managed_units:['it'],member_units:['it']},{id:'pastor',full_name:'Group Pastor',job_title:'Group Pastor',is_group_pastor:true,managed_units:[],member_units:[]},{id:'copied',full_name:'Media Head',job_title:'Media Head',managed_units:['media'],member_units:['media']}];
async function mock(page,{denySend=false}={}){
 const writes=[];let status='pending_decision';let versions=[{id:'version',memo_id:'memo',version_no:1,subject:'Media Team Digital Transformation Initiative',body:'Dear Pastor,\n**Digital transformation proposal**\nPlease review the attached initiative.',sent_at:'2026-10-28T12:00:00Z'}];
 let messages=[{id:'other',room_id:'room',author_id:'copied',body:'Please review the latest proposal.',created_at:'2026-10-28T10:00:00Z',profiles:{full_name:'Media Head'},room_message_refs:[],room_mentions:[]},{id:'own',room_id:'room',author_id:'sender',body:'I will share the supporting documents.',created_at:'2026-10-28T10:01:00Z',profiles:{full_name:'Gabriel Rockson'},room_message_refs:[],room_mentions:[]}];
 const room={id:'room',kind:'unit',unit_id:'it',units:{name:'IT & Systems'},name:'IT & Systems',last_body:'Latest proposal',last_author:'Gabriel',last_at:'2026-10-28T10:01:00Z',unread_count:1};
 const recipients=[{memo_id:'memo',profile_id:'pastor',kind:'to'},{memo_id:'memo',profile_id:'copied',kind:'cc'}];
 const memo=()=>({id:'memo',org_id:'org',sender_id:'sender',status,decision_required:true,decision_scope:'cross_department',unit_id:null,decision_maker_id:'pastor',current_version_id:'version',created_at:'2026-10-28T12:00:00Z',updated_at:'2026-10-28T12:00:00Z',memo_versions:versions,memo_recipients:recipients});
 await page.routeWebSocket('**',socket=>socket.close());
 await page.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url()),name=url.pathname.split('/').pop();
  if(!url.pathname.includes('/rest/v1/')&&!url.pathname.includes('/auth/v1/'))return ['127.0.0.1','localhost'].includes(url.hostname)?route.continue():route.abort();
  const object=(req.headers().accept||'').includes('vnd.pgrst.object');
  const reply=(data,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data),headers:{'content-range':`0-0/${Array.isArray(data)?data.length:1}`}});
  if(req.method()==='POST')writes.push({name,body:req.postDataJSON()});
  if(name==='send_room_message'){
   if(denySend)return reply({message:'Synthetic send denied'},403);
   messages.push({id:'sent',room_id:'room',author_id:'sender',body:req.postDataJSON().p_body,created_at:'2026-10-28T12:03:00Z',profiles:{full_name:'Gabriel Rockson'},room_message_refs:[],room_mentions:[]});return reply('sent');
  }
  if(name==='remove_own_room_message'){messages=messages.filter(m=>m.id!==req.postDataJSON().p_message_id);return reply(null);}
  if(name==='save_memo_draft')return reply({version_id:'draft-version',updated_at:'2026-10-28T12:02:00Z'});
  if(name==='send_memo')return denySend?reply({message:'Synthetic memo send denied'},403):reply(null);
  if(name==='respond_to_memo'){status=req.postDataJSON().p_action;return reply(req.postDataJSON().p_exchange_id);}
  const rows={my_room_directory:[room],rooms:object?room:[room],room_reads:object?null:[],room_messages:messages,unit_memberships:[{profile_id:'sender'},{profile_id:'copied'}],profiles:people,units:[{id:'it',name:'IT & Systems'},{id:'media',name:'Media'}],work_items:[],projects:[],operational_file_links:[],mark_room_read:null,memo_recipient_directory:people,memos:object?memo():[memo()],memo_exchanges:[],mark_memo_read:null,capabilities:object?null:[]};
  return reply(name in rows?rows[name]:[]);
 });return writes;
}
for(const width of [1440,390,320])test(`Rooms timeline, composer, own removal and back navigation at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:960});const writes=await mock(page);
 await page.goto('/tests/fixtures/messages-workspace.html');
 await page.getByRole('button',{name:/IT & Systems/}).click();
 await expect(page.getByText('Please review the latest proposal.',{exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Delete',exact:true})).toHaveCount(1);
 await page.getByRole('button',{name:'Room details',exact:true}).click();await expect(page.getByRole('complementary',{name:'Room details'})).toBeVisible();
 await page.getByRole('button',{name:'Close Room details',exact:true}).click();
 const input=page.getByRole('textbox',{name:'Room message'});const before=await input.evaluate(el=>el.clientHeight);
 await input.fill('A long message\nwith a second line\nand a third line\nand a fourth line');expect(await input.evaluate(el=>el.clientHeight)).toBeGreaterThan(before);
 await input.fill('Synthetic new message');await page.getByRole('button',{name:'Send',exact:true}).click();await expect(page.getByText('Synthetic new message',{exact:true})).toBeVisible();
 page.on('dialog',dialog=>dialog.accept());await page.locator('.room-message').filter({hasText:'I will share the supporting documents.'}).getByRole('button',{name:'Delete',exact:true}).click();
 await expect(page.getByText('I will share the supporting documents.',{exact:true})).toHaveCount(0);
 expect(writes.some(w=>w.name==='remove_own_room_message'&&w.body.p_message_id==='own')).toBeTruthy();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
 expect(await page.locator('input[type="file"]').count()).toBeGreaterThan(0);
 await expect(page.getByRole('button',{name:/Speak|microphone/i})).toHaveCount(0);
 await page.screenshot({path:`test-artifacts/messages-rooms-${width}.png`,fullPage:true});
 await page.getByRole('button',{name:'Back from Room'}).click();await expect(page.getByRole('searchbox',{name:'Search Rooms'})).toBeVisible();
});
test('failed Room send retains the draft',async({page})=>{
 await mock(page,{denySend:true});await page.goto('/tests/fixtures/messages-workspace.html');await page.getByRole('button',{name:/IT & Systems/}).click();
 const input=page.getByRole('textbox',{name:'Room message'});await input.fill('Retained message');await page.getByRole('button',{name:'Send',exact:true}).click();await expect(input).toHaveValue('Retained message');await expect(page.getByText('Synthetic send denied')).toBeVisible();
});
for(const actor of ['copied','pastor'])test(`Memo decision controls respect ${actor} authority`,async({page})=>{
 const writes=await mock(page);await page.goto(`/tests/fixtures/messages-workspace.html?actor=${actor}`);await page.getByRole('button',{name:'Memos',exact:true}).click();await page.getByRole('button',{name:/Media Team Digital Transformation Initiative/}).click();
 await expect(page.getByText('Digital transformation proposal',{exact:true})).toBeVisible();
 if(actor==='copied'){await expect(page.getByRole('button',{name:'Approve proposal',exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:'Send reply'})).toBeVisible();}
 else {await page.getByRole('button',{name:'Approve proposal',exact:true}).click();await expect(page.locator('.memo-status')).toHaveText('Approved');expect(writes.filter(w=>w.name==='respond_to_memo')).toHaveLength(1);}
});
for(const width of [1440,390,320])test(`Memo composition retains failed send and restricts decision recipient at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:960});const writes=await mock(page,{denySend:true});await page.goto('/tests/fixtures/messages-workspace.html');await page.getByRole('button',{name:'New Memo',exact:true}).click();
 await page.getByLabel('To',{exact:true}).fill('Pastor');await page.getByRole('button',{name:/Group Pastor Group Pastor/}).click();
 await page.getByLabel('Subject',{exact:true}).fill('Digital initiative');await page.getByLabel('Message',{exact:true}).fill('A proposal for review.');
 await page.getByLabel('Decision required',{exact:true}).check();await page.getByLabel('Proposal scope').selectOption('cross_department');await page.getByLabel('Decision-maker').selectOption('pastor');
 await page.screenshot({path:`test-artifacts/messages-memo-compose-${width}.png`,fullPage:true});
 if(width<=390)expect(await page.getByRole('button',{name:'Send Memo',exact:true}).evaluate(el=>el.clientWidth)).toBeLessThan(180);
 await page.getByRole('button',{name:'Send Memo',exact:true}).click();await expect(page.getByText('Synthetic memo send denied')).toBeVisible();await expect(page.getByLabel('Subject',{exact:true})).toHaveValue('Digital initiative');
 const saved=writes.find(w=>w.name==='save_memo_draft');expect(saved.body.p_to).toEqual(['pastor']);expect(saved.body.p_decision_scope).toBe('cross_department');expect(saved.body.p_decision_maker_id).toBe('pastor');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
});

test('Memo refresh retains a clarification draft and section changes protect unsaved composition',async({page})=>{
 await mock(page);await page.goto('/tests/fixtures/messages-workspace.html?actor=pastor');
 await page.getByRole('button',{name:'Memos',exact:true}).click();
 await page.getByRole('button',{name:/Media Team Digital Transformation Initiative/}).click();
 const response=page.getByRole('textbox',{name:/Reply or clarification/});
 await response.fill('Please retain this clarification while refreshing.');
 const refreshed=page.waitForResponse(r=>r.url().includes('/rpc/mark_memo_read'));
 await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
 await refreshed;
 await expect(response).toBeFocused();
 await expect(response).toHaveValue('Please retain this clarification while refreshing.');
 await response.fill('');
 await page.getByRole('button',{name:'New Memo',exact:true}).first().click();
 await page.getByRole('textbox',{name:'Subject',exact:true}).fill('Unsaved composition');
 page.on('dialog',dialog=>dialog.dismiss());
 await page.getByRole('button',{name:'Rooms',exact:true}).click();
 await expect(page.getByRole('textbox',{name:'Subject',exact:true})).toHaveValue('Unsaved composition');
});

for(const width of [1440,320])test(`Memo reader keeps document and authorised actions proportionate at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:960});await mock(page);
 await page.goto('/tests/fixtures/messages-workspace.html?actor=pastor');
 await page.getByRole('button',{name:'Memos',exact:true}).click();
 await page.getByRole('button',{name:/Media Team Digital Transformation Initiative/}).click();
 await expect(page.getByRole('button',{name:'Approve proposal',exact:true})).toBeVisible();
 const document=await page.locator('.memo-document').boundingBox(),actions=await page.locator('.memo-response').boundingBox();
 expect(document).toBeTruthy();expect(actions).toBeTruthy();
 if(width>1100){expect(actions.x).toBeGreaterThanOrEqual(document.x+document.width);expect(actions.width).toBeLessThanOrEqual(260);}
 else{expect(actions.y).toBeGreaterThanOrEqual(document.y+document.height-1);expect(document.width).toBeGreaterThan(250);}
 const sender=await page.locator('.memo-parties strong').boundingBox(),date=await page.locator('.memo-parties small').first().boundingBox();
 expect(date.y).toBeGreaterThan(sender.y);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
 await page.screenshot({path:`test-artifacts/messages-memo-reader-${width}.png`,fullPage:true});
});

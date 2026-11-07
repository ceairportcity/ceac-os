import {test,expect} from '@playwright/test';
import fs from 'node:fs';
test.use({launchOptions:process.env.CEAC_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.CEAC_CHROMIUM_EXECUTABLE_PATH}:undefined});
const person='11111111-1111-4111-8111-111111111111',org='22222222-2222-4222-8222-222222222222',unit='33333333-3333-4333-8333-333333333333';
async function mock(page,{failTaskUpdate=false,notesSeed=[]}={}){
 const requests=[],writes=[];let responses=[],notes=[...notesSeed];let privateTask={id:'private-task',title:'Prepare privately',plan_date:'2026-11-07',completed_at:null};
 const meeting={id:'meeting-a',org_id:org,title:'Media preparation',starts_at:'2026-11-07T09:00:00Z',ends_at:'2026-11-07T10:30:00Z',status:'scheduled',scope:'unit',created_by:person,unit_id:unit,provider:'external',join_url:'https://meet.google.com/example',location:'Church office',meeting_participants:[{profile_id:person,role:'organiser'}]};
 await page.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url());
  if(!url.pathname.includes('/rest/v1/'))return ['127.0.0.1','localhost'].includes(url.hostname)?route.continue():route.abort();
  const name=url.pathname.split('/').pop();requests.push({name,url:req.url(),method:req.method()});
  const reply=(data,status=200)=>route.fulfill({status,contentType:'application/json',headers:{'content-range':Array.isArray(data)?`0-${Math.max(0,data.length-1)}/${data.length}`:'*/1'},body:JSON.stringify(data)});
  if(req.method()!=='GET'&&req.method()!=='HEAD'){
   const body=req.postDataJSON();writes.push({name,body});
   if(name==='meeting_sessions'){Object.assign(meeting,body);return reply(meeting);}
   if(name==='meeting_responses'){responses=[{...body,meeting_starts_at:meeting.starts_at,meeting_ends_at:meeting.ends_at}];return reply(responses[0]);}
   if(name==='personal_day_notes'){
    const id=url.searchParams.get('id')?.replace('eq.','');
    if(req.method()==='POST'){
     const record={...body,id:'note-'+(notes.length+1),created_at:'2026-11-07T12:00:00Z',updated_at:'2026-11-07T12:00:00Z'};
     notes.push(record);return reply(record);
    }
    if(req.method()==='PATCH'){
     const index=notes.findIndex(note=>note.id===id);
     if(index<0)return reply({code:'PGRST116',message:'No row'},406);
     notes[index]={...notes[index],...body,updated_at:'2026-11-07T12:00:00Z'};return reply(notes[index]);
    }
    if(req.method()==='DELETE'){
     const index=notes.findIndex(note=>note.id===id);
     if(index<0)return reply({code:'PGRST116',message:'No row'},406);
     return reply(notes.splice(index,1)[0]);
    }
   }
   if(name==='personal_day_tasks'&&req.method()==='PATCH'){if(failTaskUpdate)return reply({code:'42501',message:'Synthetic task update refused'},403);privateTask={...privateTask,...body};return reply(privateTask);}
   return reply(null);
  }
  if(name==='meeting_responses')return reply(responses);
  if(name==='personal_day_notes'){
   let found=notes.filter(note=>{
    const filters=url.searchParams.getAll('note_date');const date=note.note_date||note.dated_for;
    if(filters.some(v=>v==='is.null')&&date)return false;
    if(filters.some(v=>v==='not.is.null')&&!date)return false;
    const lower=filters.find(v=>v.startsWith('gte.'))?.slice(4), upper=filters.find(v=>v.startsWith('lt.'))?.slice(3);
    return (!lower||date>=lower)&&(!upper||date<upper);
   });
   const pattern=url.searchParams.get('or');
   const exactDate=pattern?.match(/note_date\.eq\.(\d{4}-\d{2}-\d{2}),dated_for\.eq\.\1/)?.[1];
   if(exactDate)found=found.filter(note=>note.note_date===exactDate||note.dated_for===exactDate);
   if(pattern?.includes('note_date.not.is.null'))found=found.filter(note=>note.note_date||note.dated_for);
   if(pattern){const match=pattern.match(/title\.ilike\.%(.*?)%/);const term=match?.[1]?.toLowerCase();if(term)found=found.filter(note=>(note.title||'').toLowerCase().includes(term)||(note.body||'').toLowerCase().includes(term));}
   return reply(found);
  }
  if(name==='meeting_sessions')return reply(url.searchParams.has('id')?meeting:[meeting,{...meeting,id:'meeting-b',title:'Overlapping planning',starts_at:'2026-11-07T10:00:00Z',ends_at:'2026-11-07T11:00:00Z'}]);
  if(name==='meeting_participants')return reply([{profile_id:person,role:'organiser',profiles:{full_name:'Synthetic Planner'}}]);
  if(name==='meeting_private_notes')return reply(url.searchParams.has('meeting_id')&&req.headers().accept?.includes('object')?null:[]);
  if(name==='work_items')return reply(url.searchParams.get('kind')==='eq.routine'?[]:[{id:'work-review',org_id:org,unit_id:unit,assignee_id:person,ref:'IT-001',title:'Publicity awaiting review',kind:'task',status:'in_review',due_at:'2026-11-07T12:00:00Z'}]);
  if(name==='unit_memberships')return reply([{profile_id:person,unit_id:unit,role:'manager'}]);
  if(name==='leave_requests')return reply([{id:'leave',profile_id:person,kind:'annual',start_date:'2026-11-06',end_date:'2026-11-09',status:'approved',profiles:{full_name:'Synthetic Planner'}}]);
  if(name==='personal_day_tasks')return reply(url.searchParams.get('plan_date')==='is.null'||url.searchParams.get('plan_date')?.startsWith('lt.')?[]:[privateTask]);
  if(name==='projects')return reply([]);
  if(name==='profiles')return reply([{id:person,full_name:'Synthetic Planner',active:true}]);
  if(name==='units')return reply([{id:unit,name:'Synthetic IT',active:true}]);
  return reply([]);
 });
 return {requests,writes,getNotes:()=>notes};
}
for(const [role,width] of [['staff',390],['staff',1024],['manager',390],['manager',1024],['manager',1440],['admin',390],['admin',1024],['executive',390],['executive',1024],['executive',1440]])test(`${role} Calendar views, layers, date context and phone containment at ${width}`,async({page})=>{
 await page.clock.setFixedTime(new Date("2026-11-07T12:00:00Z"));
 await page.setViewportSize({width,height:950});const data=await mock(page);
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto(`/tests/fixtures/calendar-planning.html?role=${role}`);
 await expect(page.getByRole('heading',{name:'Calendar',exact:true})).toBeVisible();
 await expect(page.getByRole('grid')).toBeVisible();
 // Compare neighbouring *visible* pieces: role scope tabs and genuine
 // notices must not be misclassified as unused whitespace.
 const spacing=await page.evaluate(()=>{
  const explorer=document.querySelector('.ceac-calendar-explorer');
  const elements=[...explorer.parentElement.children];
  const before=elements.slice(0,elements.indexOf(explorer)+1).filter(el=>{
   const rect=el.getBoundingClientRect();
   return rect.height>0&&getComputedStyle(el).display!=='none';
  });
  const gaps=before.slice(1).map((el,i)=>el.getBoundingClientRect().top-before[i].getBoundingClientRect().bottom);
  return {largestUnusedGap:Math.max(0,...gaps),notices:[...document.querySelectorAll('.ev2cal-role-page .product-notice-error')].map(n=>n.innerText)};
 });
 if(spacing.notices.length)console.log('CALENDAR_NOTICES '+role+' '+width+' '+JSON.stringify(spacing.notices));
 expect(spacing.largestUnusedGap,'Calendar must not insert empty space between visible controls').toBeLessThanOrEqual(24);
 if(width<600){
  await expect(page.getByRole('button',{name:'Show full month'})).toBeVisible();
  await expect(page.locator('.ev2cal-day:visible')).toHaveCount(7);
  const day=await page.locator('.phase6-day-workspace,.ev2cal-agenda').first().boundingBox();
  expect(day.y).toBeLessThan(950);
  await page.getByRole('button',{name:'Show full month'}).click();
  expect(await page.locator('.ev2cal-day:visible').count()).toBeGreaterThan(7);
  await page.getByRole('button',{name:'Collapse month'}).click();
  await expect(page.locator('.ev2cal-day:visible')).toHaveCount(7);
 }
 await page.getByRole('tab',{name:'Week',exact:true}).click();
 await expect(page.getByLabel('Weekly time schedule, Africa/Accra')).toBeVisible();
 const appointments=page.locator('.ceac-calendar-time-event');await expect(appointments).toHaveCount(2);
 if(width<600)expect(await page.getByLabel('Weekly time schedule, Africa/Accra').evaluate(node=>node.scrollWidth-node.clientWidth)).toBeLessThanOrEqual(1);
 const a=await appointments.nth(0).boundingBox(),b=await appointments.nth(1).boundingBox();expect(a.x+a.width).toBeLessThanOrEqual(b.x+1);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
 await page.getByRole('button',{name:/^Filter/}).click();
 await page.getByRole('checkbox',{name:'Meetings',exact:true}).uncheck();await expect(appointments).toHaveCount(0);
 if(role==='staff')await expect(page.locator('.phase6-calendar-coming-up').getByText('Media preparation',{exact:true})).toHaveCount(0);
 await page.getByRole('checkbox',{name:'Meetings',exact:true}).check();await expect(appointments).toHaveCount(2);
 await page.getByRole('button',{name:'Done',exact:true}).click();
 await page.getByRole('tab',{name:'Agenda',exact:true}).click();
 await expect(page.locator('.ev2cal-timeline').getByText('Media preparation',{exact:true})).toBeVisible();
 if(role==='manager')await expect(page.getByText('Waiting for approval',{exact:true}).first()).toBeVisible();
 await page.reload();await expect(page.getByRole('tab',{name:'Agenda',exact:true})).toHaveAttribute('aria-selected','true');
 await page.getByRole('tab',{name:'Month',exact:true}).click();
 if(width<600)await page.getByRole('button',{name:'Show full month'}).click();
 await page.locator('.ev2cal-day-button').nth(15).click();
 const selected=await page.locator('.ev2cal-day-button[aria-pressed="true"]').getAttribute('aria-label');
 await page.reload();await expect(page.locator('.ev2cal-day-button[aria-pressed="true"]')).toHaveAttribute('aria-label',selected);
 expect(errors).toEqual([]);
 const dateReads=data.requests.filter(r=>['meeting_sessions','leave_requests'].includes(r.name));expect(dateReads.length).toBeGreaterThan(0);for(const read of dateReads)expect(read.url).toMatch(/(?:starts_at|start_date)=lt\./);
 fs.mkdirSync('test-artifacts',{recursive:true});await page.screenshot({path:`test-artifacts/calendar-${role}-${width}.png`,fullPage:true});
});
test('private completion updates one row without reloading shared calendar',async({page})=>{
 await page.clock.setFixedTime(new Date('2026-11-07T12:00:00Z'));
 const data=await mock(page);await page.goto('/tests/fixtures/calendar-planning.html');
 await page.getByRole('tab',{name:'Tasks',exact:true}).click();
 const checkbox=page.locator('.phase6-private-task-card').filter({hasText:'Prepare privately'}).getByRole('checkbox');
 await expect(checkbox).toBeVisible();const reads=data.requests.filter(r=>r.method==='GET'&&r.name==='meeting_sessions').length;
 await checkbox.check();await expect(checkbox).toBeChecked();
 expect(data.writes.filter(r=>r.name==='personal_day_tasks')).toHaveLength(1);
 expect(data.requests.filter(r=>r.method==='GET'&&r.name==='meeting_sessions')).toHaveLength(reads);
});
test('failed private completion restores the previous state and preserves the plan',async({page})=>{
 await page.clock.setFixedTime(new Date('2026-11-07T12:00:00Z'));
 await mock(page,{failTaskUpdate:true});await page.goto('/tests/fixtures/calendar-planning.html');
 await page.getByRole('tab',{name:'Tasks',exact:true}).click();
 const checkbox=page.locator('.phase6-private-task-card').filter({hasText:'Prepare privately'}).getByRole('checkbox');
 await checkbox.click();await expect(page.getByRole('alert').filter({hasText:'Could not load Calendar'})).toBeVisible();await expect(checkbox).not.toBeChecked();
});
test('meeting response persists, calendar export is a real file, preparation note remains private',async({page})=>{
 await page.clock.setFixedTime(new Date('2026-11-07T07:00:00Z'));
 const data=await mock(page);await page.goto('/tests/fixtures/calendar-planning.html?role=meeting');
 await page.getByRole('button',{name:'Accept',exact:true}).click();await expect(page.getByRole('button',{name:'Accept',exact:true})).toHaveAttribute('aria-pressed','true');
 await page.locator('.meeting-private-notes textarea').fill('Private preparation');await page.getByRole('button',{name:'Save my notes'}).click();
 expect(data.writes.find(w=>w.name==='meeting_private_notes').body.author_id).toBe(person);
 await page.getByRole('button',{name:'Edit meeting',exact:true}).click();await page.getByLabel('Starts · Accra time',{exact:true}).fill('2026-11-07T09:30');await page.getByRole('button',{name:'Save changes',exact:true}).click();
 await expect(page.getByText('The meeting time changed. Please respond to the new time.',{exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Accept',exact:true})).toHaveAttribute('aria-pressed','false');
 await page.getByText('Add to another calendar',{exact:true}).click();
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'Download calendar event'}).click();expect((await download).suggestedFilename()).toBe('ceac-meeting.ics');
});

test('saved journal is discoverable by date and protected when leaving personal Calendar',async({page})=>{
 await page.clock.setFixedTime(new Date('2026-11-07T12:00:00Z'));
 const source={id:'saved-journal',note_date:'2026-11-08',note_kind:'daily',title:null,
   body:'Saved for Sunday rather than Saturday',updated_at:'2026-11-07T00:42:00Z',created_at:'2026-11-07T00:42:00Z'};
 const fixture=await mock(page,{notesSeed:[source]});
 await page.goto('/tests/fixtures/calendar-planning.html?role=manager');
 await page.getByRole('tab',{name:'My calendar',exact:true}).click();
 await page.getByRole('button',{name:'Notes',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Notes',exact:true})).toBeVisible();
 await page.getByLabel('Search private notes').fill('8 Nov 2026');
 await expect.poll(()=>fixture.requests.some(req=>req.name==='personal_day_notes'&&
   new URL(req.url).searchParams.get('or')?.includes('note_date.eq.2026-11-08'))).toBe(true);
 await expect(page.getByText('For 8 Nov 2026')).toBeVisible();
 await page.locator('.phase6-note-card').filter({hasText:'Saved for Sunday'}).click();
 await expect(page.getByRole('tab',{name:'Notes',exact:true}).last()).toHaveAttribute('aria-selected','true');
 const journal=page.getByLabel('Private day notes');
 await expect(journal).toHaveValue('Saved for Sunday rather than Saturday');
 await journal.fill('An unsaved journal edit');
 page.once('dialog',dialog=>dialog.dismiss());
 await page.locator('.ev2cal-day-button').nth(15).click();
 await expect(journal).toHaveValue('An unsaved journal edit');
 page.once('dialog',dialog=>dialog.dismiss());
 await page.getByRole('tab',{name:'Unit calendar',exact:true}).click();
 await expect(journal).toHaveValue('An unsaved journal edit');
 await page.getByRole('button',{name:'Save journal'}).click();
 await expect(journal).toHaveValue('An unsaved journal edit');
 expect(fixture.getNotes()[0].body).toBe('An unsaved journal edit');
 expect(fixture.getNotes()[0].note_date).toBe('2026-11-08');
});
test('dated and standalone notes save separately, search by title, and can be moved',async({page})=>{
 await page.clock.setFixedTime(new Date('2026-11-07T12:00:00Z'));
 const fixture=await mock(page);
 await page.goto('/tests/fixtures/calendar-planning.html?role=staff');
 for(const title of ['First dated note','Second dated note']){
  await page.getByRole('button',{name:'+ Add'}).click();
  await page.getByRole('tab',{name:'Note',exact:true}).click();
  await page.getByLabel('Planning title').fill(title);
  await page.getByLabel('Planning details').fill('Private information for the eighth');
  await page.getByLabel('Planning date').fill('2026-11-08');
  await page.getByRole('button',{name:'Save note'}).click();
 }
 expect(fixture.getNotes().filter(note=>note.dated_for==='2026-11-08')).toHaveLength(2);
 await page.getByRole('button',{name:'+ Add'}).click();
 await page.getByRole('tab',{name:'Note',exact:true}).click();
 await page.getByLabel('Note type').selectOption('standalone');
 await expect(page.getByLabel('Planning date')).toHaveCount(0);
 await page.getByLabel('Planning title').fill('Undated preparation');
 await page.getByLabel('Planning details').fill('Searchable standalone text');
 await page.getByRole('button',{name:'Save note'}).click();
 expect(fixture.getNotes().find(note=>note.title==='Undated preparation').dated_for).toBeNull();
 await page.getByLabel('Search private notes').fill('Undated preparation');
 await expect(page.locator('.phase6-note-card').filter({hasText:'Undated preparation'})).toBeVisible();
 await page.getByLabel('Search private notes').fill('2026-11-08');
 const library=page.getByLabel('Saved private notes');
 await expect(library.getByText('First dated note',{exact:true})).toBeVisible();
 await expect(library.getByText('Second dated note',{exact:true})).toBeVisible();
 await expect(library.getByText('Undated preparation',{exact:true})).toHaveCount(0);
 for(const width of [390,1024,1440]){
  await page.setViewportSize({width,height:950});
  await expect(page.getByLabel('Search private notes')).toBeVisible();
  const panel=await page.getByRole('dialog').boundingBox();
  expect(panel.x).toBeGreaterThanOrEqual(0);
  expect(panel.x+panel.width).toBeLessThanOrEqual(width+1);
 }
 await page.getByLabel('Search private notes').fill('');
 await page.getByRole('tab',{name:'Dated',exact:true}).click();
 await page.getByLabel('Search private notes').fill('Undated preparation');
 await expect(page.getByText('No saved notes match this view.')).toBeVisible();
 await page.getByLabel('Search private notes').fill('');
 await page.locator('[aria-label="Saved private notes"] button.phase6-note-card').filter({hasText:'First dated note'}).click();
 await page.getByLabel('Edit note date').fill('2026-11-09');
 await page.getByRole('button',{name:'Save changes'}).click();
 expect(fixture.getNotes().find(note=>note.title==='First dated note').dated_for).toBe('2026-11-09');
 const noteReads=fixture.requests.filter(req=>req.name==='personal_day_notes'&&req.method==='GET');
 expect(noteReads.every(req=>req.url.includes('profile_id=eq.'))).toBe(true);
});

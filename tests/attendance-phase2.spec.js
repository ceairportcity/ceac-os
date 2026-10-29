import {test,expect} from '@playwright/test';
import {mkdirSync} from 'node:fs';
import {createClient} from '@supabase/supabase-js';

test.describe.configure({mode:'serial'});
async function open(browser,email,width=1366){
 const context=await browser.newContext({viewport:{width,height:900}}),page=await context.newPage();
 await page.goto('/');await page.getByPlaceholder('Work email').fill(email);await page.getByPlaceholder('Password').fill(process.env.ROLE_FIXTURE_PASSWORD);
 await page.getByRole('button',{name:'Sign in to CEAC OS',exact:true}).click();await expect(page.locator('.app')).toBeVisible({timeout:15000});
 await page.goto('/?tab=attendance');await expect(page.getByRole('heading',{name:'Today’s work location evidence',exact:true})).toBeVisible({timeout:15000});
 await expect(page.getByText('Loading attendance evidence…')).toHaveCount(0);return {context,page};
}
let operationalReason;
test('Phase 2 Staff records a temporary permission and its return without a work session',async({browser})=>{
 const {context,page}=await open(browser,'staff@ceac.local.test',390);
 operationalReason='Phase 2 browser permission '+Date.now();
 await page.route('**/rest/v1/rpc/attendance_day_evidence',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'Simulated evidence reload failure'})}));
 await page.getByRole('button',{name:'Record attendance notice',exact:true}).click();
 const dialog=page.getByRole('dialog');await dialog.getByLabel('Attendance notice type').selectOption('temporary_permission');
 await dialog.getByLabel('Attendance notice starts').fill(new Date(Date.now()-60000).toISOString().slice(0,16));
 await dialog.getByLabel('Attendance expected return').fill(new Date(Date.now()+1800000).toISOString().slice(0,16));
 await dialog.getByLabel('Attendance operational reason').fill(operationalReason);await dialog.getByRole('button',{name:'Submit notice',exact:true}).click();
 await expect(page.getByText('Attendance notice recorded. Its response history is preserved.',{exact:true})).toBeVisible();
 await expect(page.getByText('The change was recorded, but evidence could not refresh. Use Refresh evidence.',{exact:true})).toBeVisible();
 await page.unroute('**/rest/v1/rpc/attendance_day_evidence');
 await page.reload();await expect(page.getByText('Loading attendance evidence…')).toHaveCount(0);
 const details=page.locator('details').filter({has:page.getByText(operationalReason,{exact:true})});
 await details.locator('summary').click();await expect(details).toContainText('Waiting for response');
 await details.getByRole('button',{name:'Record my return',exact:true}).click();
 await expect(page.getByText('Return recorded as a self report. It is separate from verified location.',{exact:true})).toBeVisible();
 await expect(details).toContainText('(self report)');
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);expect(overflow).toBeLessThanOrEqual(1);
 mkdirSync('test-artifacts',{recursive:true});await page.screenshot({path:'test-artifacts/phase2-attendance-staff-phone.png',fullPage:true});await context.close();
});
test('Phase 2 Manager responds through the existing Request history and staff can reload the decision',async({browser})=>{
 const {context,page}=await open(browser,'manager@ceac.local.test');
 const details=page.locator('details').filter({has:page.getByText(operationalReason,{exact:true})});await details.locator('summary').click();
 await details.getByRole('button',{name:'Approve permission',exact:true}).click();
 await page.getByRole('dialog').getByLabel('Attendance response reason').fill('Approved browser operational context');
 await page.getByRole('dialog').getByRole('button',{name:'Confirm response',exact:true}).click();
 await expect(page.getByText('Response recorded with its actor and time.',{exact:true})).toBeVisible();
 await expect(details).toContainText('Approved');
 await page.screenshot({path:'test-artifacts/phase2-attendance-manager-desktop.png',fullPage:true});await context.close();
 const staff=await open(browser,'staff@ceac.local.test');
 const own=staff.page.locator('details').filter({has:staff.page.getByText(operationalReason,{exact:true})});await own.locator('summary').click();
 await expect(own).toContainText('Approved browser operational context');await expect(own).toContainText('Recorded decision actor');await staff.context.close();
});
test('Phase 2 medical notification has no medical-narrative controls and persists dates/status',async({browser})=>{
 const {context,page}=await open(browser,'staff@ceac.local.test');await page.getByRole('button',{name:'Record attendance notice',exact:true}).click();
 const dialog=page.getByRole('dialog');await dialog.getByLabel('Attendance notice type').selectOption('medical_absence');
 await expect(dialog.getByLabel('Attendance operational reason')).toHaveCount(0);await expect(dialog.getByLabel('Attendance notice note')).toHaveCount(0);
 await dialog.getByLabel('Attendance notice starts').fill(new Date(Date.now()+86400000).toISOString().slice(0,16));
 await dialog.getByRole('button',{name:'Submit notice',exact:true}).click();await expect(page.getByText('Attendance notice recorded. Its response history is preserved.',{exact:true})).toBeVisible();
 await page.reload();await expect(page.getByText('Loading attendance evidence…')).toHaveCount(0);
 await expect(page.locator('summary').filter({hasText:'Medical absence notice'}).last()).toContainText('Upcoming · Waiting for response');await context.close();
});

test('Phase 2 foreground pre-close records unavailable permission without blocking an older open session',async({browser})=>{
 test.setTimeout(60000);
 const url=process.env.SUPABASE_URL;
 expect(url).toMatch(/^http:\/\/(127\.0\.0\.1|localhost):54321\/?$/);
 const api=email=>{const client=createClient(url,process.env.SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});return client.auth.signInWithPassword({email,password:process.env.ROLE_FIXTURE_PASSWORD}).then(result=>{expect(result.error).toBeNull();return client;});};
 const admin=await api('admin@ceac.local.test'),staff=await api('sameunit@ceac.local.test');
 const today=new Date().toISOString().slice(0,10),key=['sun','mon','tue','wed','thu','fri','sat'][new Date().getUTCDay()];
 const end=new Date(Math.min(Date.now()+1800000,Date.parse(today+'T23:59:59Z'))).toISOString().slice(11,19);
 const day=await admin.rpc('workforce_record_day_type',{p_id:null,p_name:'Phase 2 foreground fixture '+Date.now(),p_description:null,p_session_expected:true,p_leave_overlay_allowed:true,p_active:true});expect(day.error).toBeNull();
 const pattern=await admin.rpc('workforce_record_pattern',{p_profile_id:'31000000-0000-4000-8000-000000000006',p_unit_id:'20000000-0000-4000-8000-000000000011',p_effective_from:today,p_effective_to:today,p_day_map:{[key]:day.data},p_clock_map:{[key]:{start:'00:00:00',end}},p_reason:'Isolated foreground pre-close acceptance',p_supersedes_id:null});expect(pattern.error).toBeNull();
 const session=await staff.from('work_sessions').insert({org_id:'10000000-0000-4000-8000-000000000010',profile_id:'31000000-0000-4000-8000-000000000006',place:'elsewhere',started_at:new Date(Date.now()-86400000).toISOString(),lat:0,lng:0,location_accuracy_m:20,location_captured_at:new Date().toISOString(),device_time:new Date().toISOString(),flags:{offsite_location_name:'Synthetic earlier off-site session'}}).select('id').single();expect(session.error).toBeNull();
 const {context,page}=await open(browser,'sameunit@ceac.local.test');
 await expect.poll(async()=>{const r=await staff.from('work_session_checkpoints').select('id').eq('work_session_id',session.data.id).eq('checkpoint_type','pre_close');expect(r.error).toBeNull();return r.data.length;},{timeout:15000}).toBe(1);
 const evidence=await staff.from('work_session_checkpoints').select('*').eq('work_session_id',session.data.id).eq('checkpoint_type','pre_close').single();expect(evidence.error).toBeNull();
 expect(evidence.data.lat).toBeNull();expect(evidence.data.geofence).toBe('not_verified');expect(evidence.data.failure).toMatch(/permission/i);expect(evidence.data.schedule_version_id).toBe(pattern.data);
 const stillOpen=await staff.from('work_sessions').select('ended_at').eq('id',session.data.id).single();expect(stillOpen.data.ended_at).toBeNull();
 await page.getByRole('button',{name:'Refresh evidence',exact:true}).click();await expect(page.locator('summary').filter({hasText:'Presence check history'})).toBeVisible();
 const endResult=await staff.rpc('end_work_session_with_location',{p_session_id:session.data.id,p_lat:null,p_lng:null,p_accuracy_m:null,p_captured_at:null,p_device_time:new Date().toISOString(),p_failure:'Isolated denied endpoint'});expect(endResult.error).toBeNull();expect(endResult.data.ended_at).not.toBeNull();await context.close();
});

import {test,expect} from '@playwright/test';
import {mkdirSync} from 'node:fs';

test.describe.configure({mode:'serial'});
async function open(browser,email,width=1366){
 const context=await browser.newContext({viewport:{width,height:900}}),page=await context.newPage();
 await page.goto('/');await page.getByPlaceholder('Work email').fill(email);await page.getByPlaceholder('Password').fill(process.env.ROLE_FIXTURE_PASSWORD);
 await page.getByRole('button',{name:'Sign in',exact:true}).click();await expect(page.locator('.app')).toBeVisible({timeout:15000});
 await page.goto('/?tab=attendance');await expect(page.getByRole('heading',{name:'Today’s work location evidence',exact:true})).toBeVisible({timeout:15000});
 await expect(page.getByText('Loading attendance evidence…')).toHaveCount(0);return {context,page};
}
let operationalReason;
test('Phase 2 Staff records a temporary permission and its return without a work session',async({browser})=>{
 const {context,page}=await open(browser,'staff@ceac.local.test',390);
 operationalReason='Phase 2 browser permission '+Date.now();
 await page.getByRole('button',{name:'Record attendance notice',exact:true}).click();
 const dialog=page.getByRole('dialog');await dialog.getByLabel('Attendance notice type').selectOption('temporary_permission');
 await dialog.getByLabel('Attendance notice starts').fill(new Date(Date.now()-60000).toISOString().slice(0,16));
 await dialog.getByLabel('Attendance expected return').fill(new Date(Date.now()+1800000).toISOString().slice(0,16));
 await dialog.getByLabel('Attendance operational reason').fill(operationalReason);await dialog.getByRole('button',{name:'Submit notice',exact:true}).click();
 await expect(page.getByText('Attendance notice recorded. Its response history is preserved.',{exact:true})).toBeVisible();
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
 await dialog.getByLabel('Attendance notice starts').fill(new Date().toISOString().slice(0,16));
 await dialog.getByRole('button',{name:'Submit notice',exact:true}).click();await expect(page.getByText('Attendance notice recorded. Its response history is preserved.',{exact:true})).toBeVisible();
 await page.reload();await expect(page.getByText('Loading attendance evidence…')).toHaveCount(0);
 await expect(page.locator('summary').filter({hasText:'Medical absence notice'}).last()).toContainText('Waiting for response');await context.close();
});

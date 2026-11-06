import fs from 'node:fs';
import {test,expect} from '@playwright/test';
const staff='11111111-1111-4111-8111-111111111111',manager='22222222-2222-4222-8222-222222222222';
for(const width of [320,768,1440])test(`shared Work oversight controls and milestones at ${width}px`,async({page})=>{
 // Real React controls, synthetic RPC responses; server authority is tested separately in work_oversight_gate.sql.
 await page.setViewportSize({width,height:1050});
 await page.goto('/tests/fixtures/work-oversight.html');
 await page.getByRole('button',{name:/Registration preparation/}).click();
 await expect(page.getByRole('heading',{name:'Shared work conversation'})).toBeVisible();
 await expect(page.getByRole('button',{name:'Follow up',exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Share update',exact:true})).toHaveCount(0);
 await page.getByLabel('Fixture role').selectOption(staff);
 await page.getByRole('button',{name:/Registration preparation/}).click();
 await page.getByRole('button',{name:'Share update',exact:true}).click();
 await page.getByRole('textbox',{name:'Progress update'}).fill('The desk is ready.');
 await page.getByRole('button',{name:'Save and share'}).click();
 await expect(page.getByText('Update shared. No approval request was created.',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Request milestone review'}).click();
 await page.getByRole('textbox',{name:'Milestone for review'}).fill('Please review the completed desk arrangement.');
 await page.getByRole('button',{name:'Save and share'}).click();
 await expect(page.getByRole('region',{name:'Shared oversight'}).getByText('1 awaiting a response',{exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Accept milestone'})).toHaveCount(0);
 await page.getByLabel('Fixture role').selectOption(manager);
 await page.getByRole('button',{name:/Registration preparation/}).click();
 await page.getByRole('button',{name:'Accept milestone'}).click();
 await page.getByRole('textbox',{name:'Milestone accepted'}).fill('Accepted. Continue to the next milestone.');
 await page.getByRole('button',{name:'Save and share'}).click();
 await expect(page.getByText('Milestone accepted',{exact:true})).toBeVisible();
 const writes=await page.evaluate(()=>window.__oversightFixture.requests.filter(r=>r.name==='add_work_oversight_entry'));
 expect(writes.map(r=>r.args.p_kind)).toEqual(['update','milestone','accepted']);
 expect(writes[2].args.p_reply_to).toBe(writes[1].args.p_request_id);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
 fs.mkdirSync('test-artifacts',{recursive:true});
 await page.screenshot({path:`test-artifacts/work-oversight-${width}.png`,fullPage:true});
});

// Installed iPhones can retain a wide layout viewport while the device screen is narrow.
// Preserve the conversation's one-column reading layout in that situation.
test('shared Work oversight uses one column on a physical iPhone with wide layout viewport', async ({browser}) => {
 const context=await browser.newContext({viewport:{width:980,height:844},screen:{width:390,height:844},deviceScaleFactor:3,isMobile:true,hasTouch:true});
 try {
  const page=await context.newPage();
  await page.goto('/tests/fixtures/work-oversight.html');
  await page.getByRole('button',{name:/Registration preparation/}).click();
  const columns=await page.locator('.cw-oversight-columns.has-selection').evaluate(node=>getComputedStyle(node).gridTemplateColumns.split(' ').filter(Boolean).length);
  expect(await page.evaluate(()=>matchMedia('(max-device-width: 720px)').matches)).toBe(true);
  expect(columns).toBe(1);
  await expect(page.getByRole('heading',{name:'Shared work conversation'})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
 } finally {await context.close();}
});

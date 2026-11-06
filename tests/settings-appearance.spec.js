import {test,expect} from '@playwright/test';
for(const role of ['staff','manager','admin','executive','compliance','technical_support'])test(`Settings is personal and appearance works for ${role}`,async({page})=>{
 await page.emulateMedia({colorScheme:'light'});
 await page.goto('/tests/fixtures/settings-controls.html?role='+role);
 await expect(page.getByRole('heading',{name:'Settings',exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:/Organisation settings/})).toHaveCount(role==='admin'?1:0);
 await page.getByRole('button',{name:/Appearance/}).click();
 await page.getByRole('radio',{name:'Dark',exact:true}).check();
 await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
 const colors=await page.locator('.ceac-settings-detail>section').evaluate(el=>({bg:getComputedStyle(el).backgroundColor,color:getComputedStyle(el).color}));
 expect(colors.bg).toBe('rgb(28, 31, 36)');expect(colors.color).toBe('rgb(232, 236, 241)');
 await page.reload();await expect(page.getByRole('radio',{name:'Dark',exact:true})).toBeChecked();
 await page.getByRole('radio',{name:'Use device setting',exact:true}).check();
 await page.emulateMedia({colorScheme:'dark'});await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
 await page.emulateMedia({colorScheme:'light'});await expect(page.locator('html')).toHaveAttribute('data-theme','light');
});
for(const width of [320,768,1440])test(`Settings navigation and sign out at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:1000});await page.goto('/tests/fixtures/settings-controls.html');
 await page.getByRole('button',{name:/Appearance/}).click();await page.getByRole('radio',{name:'Dark',exact:true}).check();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
 if(width<=700)await page.getByRole('button',{name:'Settings',exact:true}).click();
 await page.getByRole('button',{name:'Sign out',exact:true}).click();
 expect(await page.evaluate(()=>window.__signedOut)).toBeUndefined();
 await page.getByRole('button',{name:'Stay signed in'}).click();
 await page.getByRole('button',{name:'Sign out',exact:true}).click();
 await page.getByRole('button',{name:'Sign out on this device',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>window.__signedOut)).toBe(true);
});

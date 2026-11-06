import {execFileSync} from 'node:child_process';
import {readdirSync,readFileSync} from 'node:fs';
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
 await page.screenshot({path:`test-artifacts/settings-dark-${role}.png`,fullPage:true});
 await page.reload();await expect(page.getByRole('radio',{name:'Dark',exact:true})).toBeChecked();
 await page.getByRole('radio',{name:'Use device setting',exact:true}).check();
 await page.emulateMedia({colorScheme:'dark'});await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
 await page.emulateMedia({colorScheme:'light'});await expect(page.locator('html')).toHaveAttribute('data-theme','light');
});
for(const width of [320,768,1440])test(`Settings navigation and sign out at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:1000});await page.goto('/tests/fixtures/settings-controls.html');
 await page.getByRole('button',{name:/Appearance/}).click();await page.getByRole('radio',{name:'Dark',exact:true}).check();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
 await page.screenshot({path:`test-artifacts/settings-dark-${width}.png`,fullPage:true});
 if(width<=700)await page.getByRole('button',{name:'Settings',exact:true}).click();
 await page.getByRole('button',{name:'Sign out',exact:true}).click();
 expect(await page.evaluate(()=>window.__signedOut)).toBeUndefined();
 await page.getByRole('button',{name:'Stay signed in'}).click();
 await page.getByRole('button',{name:'Sign out',exact:true}).click();
 await page.getByRole('button',{name:'Sign out on this device',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>window.__signedOut)).toBe(true);
});

test('production-compiled colours follow manual and automatic appearance',async({page})=>{
 test.setTimeout(120000);
 // The browser build can transpile light-dark() into compatibility variables.
 // Verify those emitted bytes, not only Vite's development styles.
 execFileSync('npm',['run','build'],{encoding:'utf8',stdio:'pipe',env:process.env});
 const css=readdirSync('dist/assets').filter(name=>name.endsWith('.css')&&(name.startsWith('index-')||name.startsWith('Settings-'))).map(name=>readFileSync('dist/assets/'+name,'utf8')).join('\n');
 await page.emulateMedia({colorScheme:'light'});
 await page.goto('/tests/fixtures/settings-controls.html');
 await page.addStyleTag({content:css});
 await page.getByRole('button',{name:/Appearance/}).click();
 await page.getByRole('radio',{name:'Dark',exact:true}).check();
 const panel=page.locator('.ceac-settings-detail>section');
 await expect(panel).toHaveCSS('background-color','rgb(28, 31, 36)');
 await expect(panel).toHaveCSS('color','rgb(232, 236, 241)');
 const actionContrast=await page.evaluate(()=>{
  const button=document.createElement('button');button.className='btn';button.textContent='Example action';document.body.append(button);
  const style=getComputedStyle(button);
  const luminance=value=>{const channels=value.match(/[\d.]+/g).slice(0,3).map(Number).map(n=>n/(value.startsWith('color(')?1:255)).map(n=>n<=.04045?n/12.92:((n+.055)/1.055)**2.4);return channels[0]*.2126+channels[1]*.7152+channels[2]*.0722;};
  const foreground=luminance(style.color),background=luminance(style.backgroundColor);button.remove();return (Math.max(foreground,background)+.05)/(Math.min(foreground,background)+.05);
 });
 expect(actionContrast,'primary action stays readable in Dark appearance').toBeGreaterThanOrEqual(4.5);
 await page.screenshot({path:'test-artifacts/settings-production-dark.png',fullPage:true});
 await page.getByRole('radio',{name:'Light',exact:true}).check();
 await expect(panel).toHaveCSS('background-color','rgb(255, 255, 255)');
 await page.getByRole('radio',{name:'Use device setting',exact:true}).check();
 await page.emulateMedia({colorScheme:'dark'});
 await expect(panel).toHaveCSS('background-color','rgb(28, 31, 36)');
 await page.emulateMedia({colorScheme:'light'});
 await expect(panel).toHaveCSS('background-color','rgb(255, 255, 255)');
});

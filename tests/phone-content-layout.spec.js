import fs from 'node:fs';
import {test,expect} from '@playwright/test';

for(const viewportWidth of [390,980])test(`original compact phone survives Light/Dark at ${viewportWidth}px CSS viewport`,async({browser})=>{
  const context=await browser.newContext({viewport:{width:viewportWidth,height:844},screen:{width:viewportWidth,height:844},isMobile:viewportWidth===390,hasTouch:true,userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148'});
  try{
    await context.addInitScript(()=>{
      Object.defineProperty(screen,'width',{configurable:true,value:390});
      Object.defineProperty(screen,'height',{configurable:true,value:844});
      if(visualViewport)Object.defineProperty(visualViewport,'width',{configurable:true,value:390});
    });
    const page=await context.newPage();
    await page.goto('/tests/fixtures/phone-content.html');
    await expect(page.locator('.fpg9-home-hero')).toBeVisible();
    await expect(page.getByRole('button',{name:'Start work',exact:true})).toBeEnabled();
    expect(await page.evaluate(()=>matchMedia('(min-width: 900px)').matches)).toBe(viewportWidth===980);
    const compositions=[],colours=[];
    for(const mode of ['light','dark','light']){
      await page.evaluate(async mode=>{const {applyAppearance}=await import('/src/lib/appearance.js');applyAppearance(mode);},mode);
      await expect(page.locator('html')).toHaveAttribute('data-theme',mode);
      await expect(page.locator('.fpg9-mobile-shortcuts')).toBeVisible();
      for(const selector of ['.fpg9-home-impact','.fpg9-home-hero-action','.fpg9-workspace-previews','.fpg9-module-strip','.fpg9-calendar-card'])await expect(page.locator(selector)).toBeHidden();
      await expect(page.locator('.fpg9-home-hero h1')).toHaveCSS('font-size','22px');
      await expect(page.getByText('Work is past due',{exact:true})).toBeVisible();
      const geometry=await page.evaluate(()=>{
        const rect=s=>document.querySelector(s).getBoundingClientRect().toJSON();
        return {hero:rect('.fpg9-home-hero'),shortcuts:rect('.fpg9-mobile-shortcuts'),
          groups:[...document.querySelectorAll('.ceac-day-group')].map(e=>e.getBoundingClientRect().toJSON()),
          notice:rect('.ceac-glass-copy strong'),noticeLine:parseFloat(getComputedStyle(document.querySelector('.ceac-glass-copy strong')).lineHeight),
          workDescription:rect('.ev2w-header p'),nextVisual:rect('.fpg9-next-visual'),
          colour:getComputedStyle(document.querySelector('.ceac-day')).backgroundImage};
      });
      for(const box of [...geometry.groups,geometry.workDescription]){
        expect(box.width,'original phone content must remain readable').toBeGreaterThan(250);
        expect(box.right,'content must fit the physical phone').toBeLessThanOrEqual(391);
      }
      expect(geometry.groups[1].y).toBeGreaterThanOrEqual(geometry.groups[0].bottom);
      expect(geometry.notice.width).toBeGreaterThan(140);
      expect(geometry.notice.height).toBeLessThanOrEqual(geometry.noticeLine*3);
      expect(geometry.workDescription.height).toBeLessThan(100);
      expect(geometry.nextVisual.width).toBe(92);
      colours.push(geometry.colour);delete geometry.colour;compositions.push(geometry);
      fs.mkdirSync('test-artifacts',{recursive:true});
      await page.locator('.app').screenshot({path:`test-artifacts/original-phone-${viewportWidth}-${mode}.png`});
    }
    expect(compositions[1]).toEqual(compositions[0]);
    expect(compositions[2]).toEqual(compositions[0]);
    expect(colours[1]).not.toBe(colours[0]);
    await page.reload();
    await expect(page.locator('.fpg9-home-impact')).toBeHidden();
    await expect(page.locator('.fpg9-mobile-shortcuts')).toBeVisible();
  }finally{await context.close();}
});

for(const width of [768,1440])test(`iPad and laptop keep their overview composition at ${width}px`,async({browser})=>{
  const context=await browser.newContext({viewport:{width,height:1000},screen:{width,height:1000},hasTouch:width===768,userAgent:width===768?'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X)':'Mozilla/5.0 (Macintosh; Intel Mac OS X)'});
  try{
    const page=await context.newPage();
    await page.goto('/tests/fixtures/phone-content.html');
    await expect(page.locator('html')).not.toHaveClass(/ceac-physical-phone/);
    await expect(page.locator('.fpg9-home-impact')).toBeVisible();
    await expect(page.locator('.fpg9-mobile-shortcuts')).toBeHidden();
    await expect(page.locator('.fpg9-workspace-previews')).toBeVisible();
    const columns=await page.locator('.fpg9-workspace-previews').evaluate(e=>getComputedStyle(e).gridTemplateColumns.split(' ').length);
    expect(columns).toBeGreaterThan(1);
  }finally{await context.close();}
});

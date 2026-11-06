import fs from 'node:fs';
import {test,expect} from '@playwright/test';

for(const viewportWidth of [390,980])test(`phone page content remains readable with ${viewportWidth}px CSS viewport`,async({browser})=>{
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
    expect(await page.evaluate(()=>matchMedia('(min-width: 900px)').matches)).toBe(viewportWidth===980);
    await expect(page.getByText('Work is past due',{exact:true})).toBeVisible();
    const geometry=await page.evaluate(()=>{
      const rect=s=>document.querySelector(s).getBoundingClientRect().toJSON();
      return {hero:rect('.fpg9-home-hero'),copy:rect('.fpg9-home-hero-copy'),impact:rect('.fpg9-home-impact'),
        groups:[...document.querySelectorAll('.ceac-day-group')].map(e=>e.getBoundingClientRect().toJSON()),
        notice:rect('.ceac-glass-copy strong'),noticeLine:parseFloat(getComputedStyle(document.querySelector('.ceac-glass-copy strong')).lineHeight),
        previews:[...document.querySelectorAll('.fpg9-preview-card')].map(e=>e.getBoundingClientRect().toJSON()),
        workDescription:rect('.ev2w-header p')};
    });
    expect(geometry.impact.y).toBeGreaterThanOrEqual(geometry.copy.bottom);
    for(const box of [...geometry.groups,...geometry.previews,geometry.workDescription]){
      expect(box.width,'content should use the phone width rather than a desktop column').toBeGreaterThan(250);
      expect(box.right,'content must fit without clipping').toBeLessThanOrEqual(391);
    }
    expect(geometry.groups[1].y).toBeGreaterThanOrEqual(geometry.groups[0].bottom);
    expect(geometry.notice.width).toBeGreaterThan(140);
    expect(geometry.notice.height).toBeLessThanOrEqual(geometry.noticeLine*3);
    expect(geometry.workDescription.height).toBeLessThan(100);
    fs.mkdirSync('test-artifacts',{recursive:true});
    await page.locator('.app').screenshot({path:`test-artifacts/phone-content-${viewportWidth}.png`});
  }finally{await context.close();}
});

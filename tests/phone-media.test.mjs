import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {phoneMediaQuery,createPhoneMedia} from '../src/lib/phoneMedia.js';

test('phone selects compact rules without replacing colour, motion or print conditions',()=>{
  assert.equal(phoneMediaQuery('(max-width:599px)',390),'(min-width: 0px)');
  assert.equal(phoneMediaQuery('(min-width:721px) and (max-width:899px)',390),'(max-width: 0px) and (min-width: 0px)');
  assert.equal(phoneMediaQuery('screen and (max-device-width:720px), print',390),'screen and (min-width: 0px), print');
  const themed='(max-width:720px) and (prefers-color-scheme:dark) and (prefers-reduced-motion:reduce)';
  assert.equal(phoneMediaQuery(themed,390),'(min-width: 0px) and (prefers-color-scheme:dark) and (prefers-reduced-motion:reduce)');
  assert.equal(phoneMediaQuery(themed,null),themed);
});

test('original rules survive rotation, lazy route CSS and return to non-phone presentation',()=>{
  const compact={type:4,media:{mediaText:'(max-width:599px)'},cssRules:[]};
  const desktop={type:4,media:{mediaText:'(min-width:900px)'},cssRules:[]};
  const document={styleSheets:[{cssRules:[compact,{type:12,cssRules:[desktop]}]}]};
  const media=createPhoneMedia(document);
  media.sync(null);
  assert.equal(compact.media.mediaText,'(max-width:599px)');
  media.sync(390);
  assert.equal(compact.media.mediaText,'(min-width: 0px)');
  assert.equal(desktop.media.mediaText,'(max-width: 0px)');
  const lazy={type:4,media:{mediaText:'(max-width:760px)'},cssRules:[]};
  document.styleSheets.push({cssRules:[lazy]});
  media.sync(390,true);
  assert.equal(lazy.media.mediaText,'(min-width: 0px)');
  media.sync(844);
  assert.equal(compact.media.mediaText,'(max-width: 0px)');
  media.sync(390);
  assert.equal(compact.media.mediaText,'(min-width: 0px)');
  media.sync(null);
  assert.equal(compact.media.mediaText,'(max-width:599px)');
  assert.equal(desktop.media.mediaText,'(min-width:900px)');
  assert.equal(lazy.media.mediaText,'(max-width:760px)');
});

test('all current source width-query forms are covered; other media are preserved',()=>{
  const files=[];
  function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){
    const p=path.join(dir,e.name);if(e.isDirectory())walk(p);else if(p.endsWith('.css'))files.push(p);
  }}
  walk('src');
  let widths=0;
  for(const file of files)for(const match of fs.readFileSync(file,'utf8').matchAll(/@media\s*([^{}]+)\{/g)){
    const query=match[1].trim();
    const resolved=phoneMediaQuery(query,390);
    if(/(?:device-)?width\s*:/.test(query)){
      widths++;
      assert.doesNotMatch(resolved,/(?:min-|max-)?(?:device-)?width\s*:\s*(?!0px)\d+/,`${file}: ${query}`);
    }else assert.equal(resolved,query);
  }
  assert.ok(widths>100,'audit the actual app styles, including lazy routes');
});

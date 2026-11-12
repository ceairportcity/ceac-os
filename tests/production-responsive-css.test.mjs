import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {minifyProductionCss} from '../scripts/build/production-css.mjs';

test('build refuses media ranges instead of silently deleting their phone rules',()=>{
  for(const query of ['(width<=720px)','(width>=900px)','(721px<=width<=899px)'])
    assert.throws(()=>minifyProductionCss('@media '+query+'{.phone-proof{display:grid}}'),/Unsupported media-range/);
});
test('supported phone, desktop, device, colour and print media survive the final compressor',()=>{
  for(const query of ['(max-width:720px)','(min-width:900px)','screen and (max-device-width:720px)','(prefers-color-scheme:dark)','print']){
    const out=minifyProductionCss('@media '+query+'{.responsive-proof{display:grid}}');
    assert.ok(out.includes(query), 'Preserve the original media query ' + query);
    assert.match(out,/responsive-proof/);assert.match(out,/display:grid/);
  }
});
test('actual compact Manager phone rules survive production compression',()=>{
  const out=minifyProductionCss(fs.readFileSync('src/experience-v2/manager-overview/manager-overview.css','utf8'));
  assert.match(out,/@media[^{}]*max-width:599px/);
  assert.match(out,/fpg9-mobile-shortcuts\{[^{}]*display:grid/);
  assert.match(out,/fpg9-workspace-previews[^{}]*\{[^{}]*display:none/);
});

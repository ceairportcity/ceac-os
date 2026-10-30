import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

// Execute the actual loader with a fake DOM/clock, without contacting Google or
// putting any real key, location, identity or browser log in test output.
function harness(){
 const scripts=[],events=[],timers=new Map();let next=0;
 const window={dispatchEvent:e=>events.push(e)};
 const context={window,document:{createElement:()=>({remove(){this.removed=true;}}),head:{appendChild:s=>scripts.push(s)}},URLSearchParams,CustomEvent:class{constructor(type,options){this.type=type;this.detail=options?.detail;}},setTimeout:callback=>{timers.set(++next,callback);return next;},clearTimeout:id=>timers.delete(id)};
 const code=readFileSync(new URL('../src/lib/googleMaps.js',import.meta.url),'utf8').replaceAll('import.meta.env.VITE_GOOGLE_MAPS_API_KEY',JSON.stringify('synthetic-key')).replaceAll('export ','');
 runInNewContext(code+';window.loader={loadGoogleMaps,googleMapFailure};',context);
 return {window,scripts,events,timers,...window.loader};
}

test('concurrent maps share a download; a failed request can be retried successfully',async()=>{
 const h=harness(),first=h.loadGoogleMaps(),shared=h.loadGoogleMaps();
 assert.equal(first,shared);assert.equal(h.scripts.length,1);
 const rejected=assert.rejects(first,{code:'MAP-DOWNLOAD'});
 h.scripts[0].onerror();await rejected;
 const retry=h.loadGoogleMaps();assert.equal(h.scripts.length,2);
 h.window.google={maps:{Map:class{}}};h.window.__ceacGoogleMapsReady();
 assert.equal(await retry,h.window.google.maps);assert.equal(h.timers.size,0);
});
test('SDK timeout has a distinct safe code and clears its pending request',async()=>{
 const h=harness(),result=h.loadGoogleMaps();
 const rejected=assert.rejects(result,{code:'MAP-SDK-TIMEOUT'});
 [...h.timers.values()][0]();await rejected;
 assert.equal(h.scripts[0].removed,true);
 assert.equal(h.events[0].detail.code,'MAP-SDK-TIMEOUT');
});
test('late Google authorisation failure is retained and cannot become ready on retry',async()=>{
 const h=harness(),result=h.loadGoogleMaps();
 h.window.google={maps:{Map:class{}}};h.window.__ceacGoogleMapsReady();await result;
 h.window.gm_authFailure();
 h.scripts[0].onerror();
 assert.equal(h.events.at(-1).detail.code,'MAP-AUTH');
 await assert.rejects(h.loadGoogleMaps(),{code:'MAP-AUTH'});
 assert.equal(h.scripts.length,1);
});
test('diagnostics discard arbitrary SDK errors, keys, private URLs and data',()=>{
 const h=harness();
 for(const error of [{message:'private URL?key=SECRET',code:'SECRET'},new Error('EMPLOYEE SECRET'),null]){
  const issue=h.googleMapFailure(error);
  assert.equal(issue.code,'MAP-INITIALISE');assert.doesNotMatch(JSON.stringify(issue),/SECRET|EMPLOYEE|private/);
 }
});

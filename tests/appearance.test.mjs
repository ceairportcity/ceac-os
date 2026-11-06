import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
const source=fs.readFileSync(new URL('../src/lib/appearance.js',import.meta.url),'utf8').replace(/export /g,'');
function environment({stored=null,dark=false,blocked=false}={}) {
 const events={},mediaEvents={};let value=stored;
 const media={matches:dark,addEventListener:(name,fn)=>{mediaEvents[name]=fn;}};
 const storage={getItem(){if(blocked)throw Error('blocked');return value;},setItem(k,v){if(blocked)throw Error('blocked');value=v;},removeItem(){value=null;}};
 const document={documentElement:{dataset:{},style:{}}};
 const window={matchMedia:()=>media,addEventListener:(name,fn)=>{events[name]=fn;},dispatchEvent(){}};
 const context=vm.createContext({document,window,localStorage:storage,Event:class {}});vm.runInContext(source,context);
 return {context,document,media,events,mediaEvents,value:()=>value};
}
test('device preference is the default, explicit choices persist, and system follows live OS changes',()=>{
 const e=environment({dark:true});vm.runInContext('initialiseAppearance()',e.context);assert.equal(e.document.documentElement.dataset.theme,'dark');
 vm.runInContext("applyAppearance('light')",e.context);assert.equal(e.value(),'light');e.media.matches=true;e.mediaEvents.change();assert.equal(e.document.documentElement.dataset.theme,'light');
 vm.runInContext("applyAppearance('system')",e.context);assert.equal(e.value(),null);e.media.matches=false;e.mediaEvents.change();assert.equal(e.document.documentElement.dataset.theme,'light');
});
test('corrupt or blocked storage never prevents use and choices apply without persistence',()=>{
 for(const options of [{stored:'unexpected'},{blocked:true}]){const e=environment(options);assert.equal(vm.runInContext('readAppearance()',e.context),'system');assert.doesNotThrow(()=>vm.runInContext("initialiseAppearance();applyAppearance('dark')",e.context));assert.equal(e.document.documentElement.dataset.theme,'dark');}
});
test('another tab clearing or changing storage updates the interface',()=>{
 const e=environment({stored:'dark'});vm.runInContext('initialiseAppearance()',e.context);vm.runInContext("localStorage.setItem('ceac.appearance','light')",e.context);e.events.storage({key:'ceac.appearance'});assert.equal(e.document.documentElement.dataset.theme,'light');
 vm.runInContext('localStorage.removeItem()',e.context);e.events.storage({key:null});assert.equal(e.document.documentElement.dataset.appearance,'system');
});

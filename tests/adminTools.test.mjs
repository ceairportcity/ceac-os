import test from 'node:test';
import assert from 'node:assert/strict';
import {getAdministrationTools,getShellNavigation,getSecondaryNavigation,getMobilePrimaryNavigation} from '../src/experience-v2/shell/navigation.js';
const grants=['performance.admin','learning.manage','compliance.manage'].map(capability=>({capability,scope_unit_id:null}));
test('organisation grants expose existing Administration tools in desktop and More, preserving the dock',()=>{
 const context={isAdmin:true,me:{capabilities:grants.map(x=>x.capability),capability_grants:grants}};
 for(const key of ['performance','learning','compliance']){
  assert.ok(getShellNavigation(context).some(x=>x.key===key));
  assert.ok(getSecondaryNavigation(context).some(x=>x.key===key));
 }
 assert.deepEqual(getMobilePrimaryNavigation(context).map(x=>x.key),['home','attendance','finance']);
});
test('flat or unit-scoped capabilities cannot become organisation tool access',()=>{
 assert.deepEqual(getAdministrationTools({capabilities:grants.map(x=>x.capability)}),[]);
 assert.deepEqual(getAdministrationTools({capability_grants:grants.map(x=>({...x,scope_unit_id:'unit'}))}),[]);
 for(const context of [{isExec:true},{isManager:true},{}])
  assert.ok(!getShellNavigation({...context,me:{capability_grants:grants}}).some(x=>['performance','learning','compliance'].includes(x.key)));
});

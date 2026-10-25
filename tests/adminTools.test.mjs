import test from 'node:test';
import './complianceReviewQueue.test.mjs';
import assert from 'node:assert/strict';
import {getAdministrationTools,getShellNavigation,getSecondaryNavigation,getMobilePrimaryNavigation} from '../src/experience-v2/shell/navigation.js';
const grants=['performance.admin','learning.manage','compliance.manage'].map(capability=>({capability,scope_unit_id:null}));
test('organisation grants expose existing Administration tools in desktop and More, preserving the dock',()=>{
 const context={isAdmin:true,me:{capabilities:grants.map(x=>x.capability),capability_grants:grants}};
 for(const key of ['performance','learning']){
  assert.ok(getShellNavigation(context).some(x=>x.key===key));
  assert.ok(getSecondaryNavigation(context).some(x=>x.key===key));
 }
 assert.deepEqual(getMobilePrimaryNavigation(context).map(x=>x.key),['home','attendance','finance']);
 assert.ok(!getShellNavigation(context).some(x=>x.key==='compliance'));
 assert.ok(!getSecondaryNavigation(context).some(x=>x.key==='compliance'));
});
test('flat or unit-scoped capabilities cannot become organisation tool access',()=>{
 assert.deepEqual(getAdministrationTools({capabilities:grants.map(x=>x.capability)}),[]);
 assert.deepEqual(getAdministrationTools({capability_grants:grants.map(x=>({...x,scope_unit_id:'unit'}))}),[]);
 for(const context of [{isExec:true},{isManager:true},{}])
  assert.ok(!getShellNavigation({...context,me:{capability_grants:grants}}).some(x=>['performance','learning'].includes(x.key)));
});

test('Compliance operators reach their independent workspace on desktop and mobile without HR authority',()=>{
 for(const context of [{isManager:true},{}]) {
  const scoped={...context,me:{capability_grants:[{capability:'compliance.manage',scope_unit_id:null}]}};
  assert.equal(getShellNavigation(scoped).filter(x=>x.key==='compliance').length,1);
  assert.ok(getSecondaryNavigation(scoped).some(x=>x.key==='compliance'));
  assert.ok(!getShellNavigation(scoped).some(x=>['people','settings','protected-hr','payroll','performance'].includes(x.key)));
 }
});

test('Compliance department identity alone and flat or unit grants do not expose the operating workspace',()=>{
 for(const me of [
  {unit_name:'Compliance',role:'manager'},
  {capabilities:['compliance.manage']},
  {capability_grants:[{capability:'compliance.manage',scope_unit_id:'unit'}]},
 ]) assert.ok(!getShellNavigation({isManager:true,me}).some(x=>x.key==='compliance'));
 assert.ok(!getShellNavigation({isExec:true,me:{capability_grants:grants}}).some(x=>x.key==='compliance'));
});

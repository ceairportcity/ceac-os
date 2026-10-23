import test from 'node:test';
import assert from 'node:assert/strict';
import {confirmedLeaveSplitRules,hasConfirmedLeaveSplit,leavePoolLabel} from '../src/lib/leavePools.js';

test('owner correction creates exactly two allowance rules and preserves protected policies',()=>{
 const maternity={leave_kind:'maternity',entitlement_amount:12,entitlement_unit:'weeks',complete:true};
 const paternity={leave_kind:'paternity',entitlement_amount:null,complete:false};
 const rules=confirmedLeaveSplitRules([
  {leave_kind:'annual',entitlement_amount:24}, {leave_kind:'sick',entitlement_amount:12},
  {leave_kind:'study',entitlement_amount:9}, {leave_kind:'shared_other',entitlement_amount:18},maternity,paternity,
 ]);
 assert.deepEqual(rules.slice(0,2),[maternity,paternity]);
 assert.deepEqual(rules.slice(2).map(r=>[r.leave_kind,r.entitlement_amount,r.accrual_rate]),[['annual',15,3.75],['shared_other',9,2.25]]);
 assert.equal(rules.filter(r=>r.leave_kind==='shared_other').length,1);
 assert.equal(rules.slice(2).reduce((sum,r)=>sum+r.entitlement_amount,0),24);
 assert.equal(rules.slice(2).reduce((sum,r)=>sum+r.accrual_rate,0),6);
 assert.equal(hasConfirmedLeaveSplit(rules),false,'unactivated payload must not appear as an active complete policy');
 assert.equal(hasConfirmedLeaveSplit(rules.map(r=>({...r,complete:true}))),true);
 assert.equal(leavePoolLabel('shared_other'),'Shared sick/study allowance');
});

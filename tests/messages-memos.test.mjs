import test from 'node:test';
import assert from 'node:assert/strict';
import {canSelfCertifyOwnWork,outstandingActivityActions} from '../src/lib/workCompletion.js';
import {eligibleMemoDecisionMakers,memoInView,roomContext} from '../src/lib/memos.js';
const me={id:'gabriel',role:'sub_team_lead',unit_id:'media',memberships:[{unit_id:'support',role:'manager'},{unit_id:'media',role:'sub_team_lead'}]};
const own={id:'task',assignee_id:'gabriel',assigned_by:'gabriel',origin:'self_created',unit_id:'support'};
test('switching to a second department does not remove own-work self-certification',()=>{
 assert.equal(canSelfCertifyOwnWork(me,own),true);
 assert.equal(canSelfCertifyOwnWork({...me,unit_id:'support',role:'manager'},own),true);
 assert.equal(canSelfCertifyOwnWork(me,{...own,unit_id:'media'}),false);
});
test('ordinary managerial context cannot self-certify another person or Executive assignment',()=>{
 assert.equal(canSelfCertifyOwnWork(me,{...own,assignee_id:'other'}),false);
 assert.equal(canSelfCertifyOwnWork(me,{...own,origin:'assigned_by_exec'}),false);
 assert.equal(canSelfCertifyOwnWork({...me,memberships:[]},own),false);
 assert.equal(canSelfCertifyOwnWork(me,{...own,origin:'assigned',assigned_by:'other'}),false);
});
test('completed activities retain dated next actions and correction chains clear superseded actions',()=>{
 const records=[{id:'old',next_action:'Already followed up',next_action_on:'2026-10-01'}, {id:'new',supersedes_id:'old',next_action:null}, {id:'active',activity_state:'done',next_action:'Call next week',next_action_on:'2026-11-02'}, {id:'undated',next_action:'Inspect'}];
 assert.deepEqual(outstandingActivityActions(records).map(r=>r.id),['active','undated']);assert.equal(records[2].activity_state,'done');
});
const people=[{id:'pastor',is_group_pastor:true,managed_units:[]},{id:'head',managed_units:['it']},{id:'copied-head',managed_units:['it']},{id:'lead',managed_units:[]},{id:'sender',managed_units:['it']}];
test('cross-department decisions require Group Pastor as a primary recipient',()=>{
 assert.deepEqual(eligibleMemoDecisionMakers(people,{scope:'cross_department',unitId:'it',to:['head','pastor'],senderId:'sender'}).map(p=>p.id),['pastor']);
 assert.deepEqual(eligibleMemoDecisionMakers(people,{scope:'cross_department',unitId:'it',to:['head'],senderId:'sender'}),[]);
});
test('department authority is scoped; Cc, team lead and self receive no decision powers',()=>{
 assert.deepEqual(eligibleMemoDecisionMakers(people,{scope:'department',unitId:'it',to:['head','lead','sender'],senderId:'sender'}).map(p=>p.id),['head']);
 assert.deepEqual(eligibleMemoDecisionMakers(people,{scope:'department',unitId:'media',to:['head'],senderId:'sender'}),[]);
});
test('memo views separate ordinary correspondence, drafts and pending decisions',()=>{
 assert.equal(memoInView({sender_id:'sender',status:'draft'},'received','head'),false);
 assert.equal(memoInView({sender_id:'sender',status:'draft'},'drafts','sender'),true);
 assert.equal(memoInView({sender_id:'sender',status:'approved'},'awaiting','head'),false);
 assert.equal(memoInView({sender_id:'sender',status:'closed'},'completed','head'),true);
});
test('project and sub-team Rooms retain their actual routing context',()=>{
 assert.deepEqual(roomContext({kind:'project',project_id:'p'}),{kind:'project',projectId:'p'});
 assert.deepEqual(roomContext({kind:'sub_team',sub_team_id:'s'}),{kind:'sub_team',subTeamId:'s'});
});

// These verbs are emitted by existing project/report/blocker write paths.
import {EXECUTIVE_EXCEPTION_VERBS} from '../src/lib/executiveExceptions.js';
test('Executive significant updates include existing events and exclude routine work noise',()=>{
 for(const verb of ['project_created','reopened','report_submitted','blocker_raised']) assert.ok(EXECUTIVE_EXCEPTION_VERBS.includes(verb));
 for(const verb of ['work_started','work_completed','activity_recorded']) assert.equal(EXECUTIVE_EXCEPTION_VERBS.includes(verb),false);
});

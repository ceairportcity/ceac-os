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
test('manager may finish own Executive assignment without gaining authority for someone else',()=>{
 assert.equal(canSelfCertifyOwnWork(me,{...own,assignee_id:'other'}),false);
 assert.equal(canSelfCertifyOwnWork(me,{...own,origin:'assigned_by_exec',assigned_by:'exec'}),true);
 assert.equal(canSelfCertifyOwnWork({...me,memberships:[]},own),false);
 assert.equal(canSelfCertifyOwnWork(me,{...own,unit_id:'media',assigned_by:'exec'}),false);
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

import {readFileSync as readContract} from 'node:fs';
const source=path=>readContract(path,'utf8');
test('Memos show attachments to authorised recipients with independent download actions',()=>{
 const memo=source('src/screens/Memos.jsx'),media=source('src/components/OperationalFiles.jsx'),files=source('src/lib/operationalFiles.js');
 assert.match(memo,/visibleAttachments\.length>0/);
 assert.match(memo,/aria-label="Memo attachments"/);
 assert.match(media,/aria-label=\{`Download \$\{file\.filename\}`\}/);
 assert.match(files,/signedOperationalDownloadUrl/);
 assert.match(files,/download: file\.filename/);
 assert.match(files,/if \(!isCurrent\(\)\)/);
});
test('Room-only files do not masquerade as delivered filename messages and transient failures are retried',()=>{
 const room=source('src/screens/Room.jsx'),files=source('src/lib/operationalFiles.js');
 assert.doesNotMatch(room,/Files: " \+ pendingFiles/);
 assert.match(room,/Attachment pending — not yet delivered/);
 assert.match(room,/Retry attachments/);
 assert.match(files,/uploadOperationalFileWithRetry/);
 assert.match(files,/attempt < 3/);
 assert.match(files,/options\.retryState \|\| \{\}/);
});
test('Memo sending validates recipients, labels progress and protects encrypted offline drafts',()=>{
 const memo=source('src/screens/Memos.jsx'),drafts=source('src/lib/memoLocalDrafts.js');
 assert.match(memo,/if\(!form\?\.to\?\.length\)/);
 assert.match(memo,/Complete these details before sending/);
 assert.match(memo,/Sending Memo…/);
 assert.match(memo,/readLocalMemoDraft/);
 assert.match(drafts,/AES-GCM/);
 assert.match(drafts,/clearLocalMemoDraft/);
 assert.doesNotMatch(drafts,/localStorage/);
});

test('Room writing is recoverable per conversation and cleared on sign-out',()=>{
 const room=source('src/screens/Room.jsx'),drafts=source('src/lib/memoLocalDrafts.js'),app=source('src/App.jsx');
 assert.match(room,/readLocalRoomDraft/);
 assert.match(room,/saveLocalRoomDraft/);
 assert.match(room,/clearRoomDraft/);
 assert.match(drafts,/clearAccountCommunicationDrafts/);
 assert.match(app,/clearAccountCommunicationDrafts/);
});

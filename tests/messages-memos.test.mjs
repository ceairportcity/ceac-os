import test from 'node:test';
import assert from 'node:assert/strict';
import {canSelfCertifyOwnWork,outstandingActivityActions} from '../src/lib/workCompletion.js';
import {eligibleMemoDecisionMakers,memoInView,roomContext} from '../src/lib/memos.js';
const me={id:'gabriel',role:'sub_team_lead',unit_id:'media',memberships:[{unit_id:'support',role:'manager'},{unit_id:'media',role:'sub_team_lead'}]};
const own={id:'task',assignee_id:'gabriel',assigned_by:'gabriel',origin:'self_created',unit_id:'support'};
test('multi-department managers submit their own work for independent review',()=>{
 assert.equal(canSelfCertifyOwnWork(me,own),false);
 assert.equal(canSelfCertifyOwnWork({...me,unit_id:'support',role:'manager'},own),false);
 assert.equal(canSelfCertifyOwnWork(me,{...own,unit_id:'media'}),false);
});
test('Executive-assigned manager work cannot be certified by its assignee',()=>{
 assert.equal(canSelfCertifyOwnWork(me,{...own,assignee_id:'other'}),false);
 assert.equal(canSelfCertifyOwnWork(me,{...own,origin:'assigned_by_exec',assigned_by:'exec'}),false);
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
 assert.match(memo,/entry\.files\.length>0/);
 assert.match(memo,/memo-thread-files/);
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

test('Room composer cannot accept text before verified room identity clears loading state',()=>{
 const room=source('src/screens/Room.jsx');
 assert.match(room,/disabled=\{sending \|\| Boolean\(attachmentMessageId\) \|\| !room\?\.id\}/);
 assert.match(room,/placeholder=\{!room\?\.id \? "Opening Room…"/);
 assert.match(room,/if \(!targetRoomId\) \{/);
});


import {memoCurrentSubject,memoConversationGroups,memoCorrespondentId,memoPersonIdentity} from '../src/lib/memos.js';
test('memo correspondence groups by person or subject without merging formal records',()=>{
  const item=(id,person,subject,time)=>({id,sender_id:person,status:'sent',updated_at:time,current_version_id:id+'v',
    memo_recipients:[{profile_id:'exec',kind:'to'}],memo_versions:[{id:id+'v',version_no:1,subject}]});
  const rows=[item('a','gabriel','Weekly report','2026-11-04T07:00:00Z'),
    item('b','gabriel','Weekly report','2026-11-03T07:00:00Z'),
    item('c','becky','Weekly report','2026-11-02T07:00:00Z'),
    item('d','gabriel','Equipment','2026-11-01T07:00:00Z')];
  assert.equal(memoCurrentSubject(rows[0]),'Weekly report');
  const byPerson=memoConversationGroups(rows,'exec','person');
  assert.equal(byPerson.length,2);
  assert.deepEqual(byPerson[0].items.map(row=>row.id),['a','b','d']);
  const bySubject=memoConversationGroups(rows,'exec','subject');
  assert.equal(bySubject.length,3);
  assert.deepEqual(bySubject[0].items.map(row=>row.id),['a','b']);
  assert.notEqual(bySubject[0].key,bySubject.find(group=>group.items.some(row=>row.id==='c')).key);
});
test('sender identity uses authorised directory role and unit, not a generic member label',()=>{
  const person={full_name:'Gabriel Rockson',job_title:'Technical Support Head',managed_units:['support'],member_units:['support']};
  assert.deepEqual(memoPersonIdentity(person,[{id:'support',name:'Technical Support'}]),{
    name:'Gabriel Rockson',role:'Technical Support Head',department:'Technical Support',
    detail:'Technical Support Head · Technical Support'
  });
  assert.equal(memoPersonIdentity(null,[]).name,'Sender unavailable');
});
test('Memos are first in communication navigation and Rooms are still accessible',()=>{
  const inbox=source('src/screens/Inbox.jsx');
  assert.ok(inbox.indexOf('aria-label="Memos" aria-current=')<inbox.indexOf('aria-label="Rooms" aria-current='));
  assert.match(inbox,/\? "rooms" : "memos"/);
  const room=source('src/screens/Room.jsx');
  assert.match(room,/memo_recipient_directory/);
  assert.doesNotMatch(room,/"CEAC member"/);
});


test('correspondence participant sets are direction-independent but Cc boundaries stay separate',()=>{
 const inbound={sender_id:'gabriel',memo_recipients:[{profile_id:'pastor',kind:'to'}]};
 const outgoing={sender_id:'pastor',memo_recipients:[{profile_id:'gabriel',kind:'to'}]};
 assert.equal(memoCorrespondentId(inbound,'pastor'),memoCorrespondentId(outgoing,'pastor'));
 assert.notEqual(memoCorrespondentId(inbound,'pastor'),memoCorrespondentId({
   ...inbound,memo_recipients:[...inbound.memo_recipients,{profile_id:'becky',kind:'cc'}]
 },'pastor'));
});
test('All correspondence includes incoming and outgoing sent records, but not drafts',()=>{
 assert.equal(memoInView({sender_id:'pastor',status:'sent'},'all','pastor'),true);
 assert.equal(memoInView({sender_id:'gabriel',status:'sent'},'all','pastor'),true);
 assert.equal(memoInView({sender_id:'pastor',status:'draft'},'all','pastor'),false);
});
test('continue subject prepares a separate new Memo, without modifying old approvals or attachments',()=>{
 const memo=source('src/screens/Memos.jsx');
 assert.match(memo,/function continueSubject\(memo\)/);
 assert.match(memo,/setForm\(\{\.\.\.fresh\(\),subject:memoCurrentSubject\(memo\)/);
 assert.match(memo,/decisionRequired:false/);
 assert.match(memo,/memo-thread-timeline/);
 assert.match(memo,/Finish or discard your recovered draft/);
});

test('Room fallback polling is bounded while realtime provides active message delivery',()=>{
 const room=source('src/screens/Room.jsx');
 assert.ok(room.includes('window.setInterval(refresh, 180000)'));
 assert.match(room,/postgres_changes/);
});

// Room sender context is shared and bounded, not a new request for every message.
test('Room sender role and department appear without per-message directory requests',()=>{
  const room=source('src/screens/Room.jsx');
  assert.match(room,/memoPersonIdentity\(person,units\)\.detail/);
  assert.match(room,/authorDirectoryRef\.current/);
  assert.match(room,/showAuthorDetails && authorDetails\[message\.author_id\]/);
  assert.match(room,/authorUnitsRef\.current/);
});

test('each Memo is shown as a distinct conversation with chronological entries and scoped replies',()=>{
 const memo=source('src/screens/Memos.jsx');
 assert.match(memo,/memo-conversation-list/);
 assert.match(memo,/memo-thread-timeline/);
 assert.match(memo,/\.\.\.active\.exchanges\.map/);
 assert.match(memo,/\.\.\.active\.versions\.filter/);
 assert.match(memo,/Date\.parse\(a\.at\)-Date\.parse\(b\.at\)/);
 assert.match(memo,/Send reply to thread/);
 assert.doesNotMatch(memo,/subjectThread\?/);
 assert.match(memo,/respond_to_memo/);
});


test("Work-to-Memo drafting preserves private Work and existing drafts without extra backend tables",()=>{
 const app=source("src/App.jsx"),item=source("src/screens/Item.jsx"),inbox=source("src/screens/Inbox.jsx"),memo=source("src/screens/Memos.jsx");
 assert.match(item,/item.visibility === "unit" && !item.confidential/);
 assert.match(item,/Write a Memo about this work/);
 assert.match(app,/setMemoWorkContext\(null\)/);
 assert.match(inbox,/relatedWork=\{memoWorkContext\}/);
 assert.match(memo,/if\(recoveredDraft\?\.form\)/);
 assert.match(memo,/Choose your Memo recipients/);
 assert.match(memo,/Open linked Work/);
 assert.ok(memo.includes("tab=work&item="));
 assert.doesNotMatch(memo,/dangerouslySetInnerHTML/);
});

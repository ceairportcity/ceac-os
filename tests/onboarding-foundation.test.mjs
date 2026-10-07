import test from 'node:test';
import assert from 'node:assert/strict';
import {authRedirect} from '../src/lib/authRedirect.js';
import {getPositionOnce} from '../src/lib/locationEvidence.js';
import {passwordUpdateErrorMessage,recoveryErrorMessage,secureLinkErrorMessage,signInErrorMessage} from '../src/lib/signInError.js';
test('sign-in distinguishes credential rejection from rate, service, network and verification errors',()=>{
  assert.match(signInErrorMessage({code:'invalid_credentials'}),/did not match/);
  assert.match(signInErrorMessage({code:'email_not_confirmed'}),/verification/);
  assert.match(signInErrorMessage({status:429}),/Too many/);
  assert.match(signInErrorMessage({status:503,name:'AuthRetryableFetchError'}),/temporarily unavailable/);
  assert.match(signInErrorMessage(new TypeError('secret request payload')),/connection/);
  assert.match(signInErrorMessage({code:'email_provider_disabled'}),/Email sign-in is unavailable/);
  assert.match(signInErrorMessage({code:'user_banned'}),/cannot sign in/);
  assert.doesNotMatch(signInErrorMessage({message:'private server detail',code:'unknown'}),/private|did not match/);
});
test('activation redirects use the canonical application regardless of browser origin',()=>{
  assert.equal(authRedirect('/activate'), 'https://ceac-os-git.vercel.app/activate');
  assert.equal(authRedirect('/reset','https://ceac.example/'),'https://ceac.example/reset');
  for(const origin of ['http://ceac.example','https://user:secret@ceac.example','https://ceac.example/preview','https://ceac.example/?token=x']) assert.throws(()=>authRedirect('/activate',origin));
});
test('permission denial and thrown device errors produce evidence failure without rejection',async()=>{
  assert.match((await getPositionOnce(null)).failure,/unavailable/);
  assert.match((await getPositionOnce({getCurrentPosition:(_,fail)=>fail({code:1})})).failure,/denied/);
  assert.match((await getPositionOnce({getCurrentPosition:()=>{throw Error('blocked')}})).failure,/could not/);
});
test('fresh zero coordinates are valid; stale or out-of-range evidence is rejected',async()=>{
  const position=(lat,lng,age=0)=>({getCurrentPosition:ok=>ok({coords:{latitude:lat,longitude:lng,accuracy:12},timestamp:Date.now()-age})});
  const valid=await getPositionOnce(position(0,0));
  assert.equal(valid.lat,0); assert.equal(valid.lng,0); assert.equal(valid.accuracy,12); assert.ok(valid.capturedAt);
  assert.ok((await getPositionOnce(position(5,-.1,121000))).failure);
  assert.ok((await getPositionOnce(position(91,0))).failure);
});

test('recovery and password flows never surface raw auth errors',()=>{
  assert.match(recoveryErrorMessage({status:429,message:'private'}),/Too many recovery/);
  assert.match(recoveryErrorMessage(new TypeError('secret transport detail')),/connection/);
  assert.doesNotMatch(recoveryErrorMessage({code:'unknown',message:'private recovery detail'}),/private/);

  assert.match(secureLinkErrorMessage({status:503,message:'database detail'}),/temporarily unavailable/);
  assert.doesNotMatch(secureLinkErrorMessage({code:'unknown',message:'private link detail'}),/private/);

  assert.match(passwordUpdateErrorMessage({code:'weak_password'}),/stronger password/);
  assert.match(passwordUpdateErrorMessage({code:'same_password'}),/different/);
  assert.match(passwordUpdateErrorMessage({status:429}),/Too many password-change/);
  assert.doesNotMatch(passwordUpdateErrorMessage({code:'unknown',message:'private password detail'}),/private/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {authRedirect} from '../src/lib/authRedirect.js';
import {getPositionOnce} from '../src/lib/locationEvidence.js';
import {authErrorMessage} from '../src/lib/signInError.js';
test('sign-in distinguishes credential rejection from rate, service, network and verification errors',()=>{
  assert.match(authErrorMessage({code:'invalid_credentials'}),/did not match/);
  assert.match(authErrorMessage({code:'email_not_confirmed'}),/verification/);
  assert.match(authErrorMessage({status:429}),/Too many/);
  assert.match(authErrorMessage({status:503,name:'AuthRetryableFetchError'}),/temporarily unavailable/);
  assert.match(authErrorMessage(new TypeError('secret request payload')),/connection/);
  assert.match(authErrorMessage({code:'email_provider_disabled'}),/Email sign-in is unavailable/);
  assert.match(authErrorMessage({code:'user_banned'}),/cannot sign in/);
  assert.doesNotMatch(authErrorMessage({message:'private server detail',code:'unknown'}),/private|did not match/);
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
  assert.match(authErrorMessage({status:429,message:'private'},'recovery'),/Too many attempts/);
  assert.match(authErrorMessage(new TypeError('secret transport detail'),'recovery'),/connection/);
  assert.doesNotMatch(authErrorMessage({code:'unknown',message:'private recovery detail'},'recovery'),/private/);

  assert.match(authErrorMessage({status:503,message:'database detail'},'link'),/temporarily unavailable/);
  assert.doesNotMatch(authErrorMessage({code:'unknown',message:'private link detail'},'link'),/private/);

  assert.match(authErrorMessage({code:'weak_password'},'password'),/stronger password/);
  assert.match(authErrorMessage({code:'same_password'},'password'),/different/);
  assert.match(authErrorMessage({status:429},'password'),/Too many attempts/);
  assert.doesNotMatch(authErrorMessage({code:'unknown',message:'private password detail'},'password'),/private/);
});

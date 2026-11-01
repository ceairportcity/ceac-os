import {test} from 'node:test';import assert from 'node:assert/strict';import{readFileSync}from'node:fs';
test('HR can create and optionally invite once without duplicating an existing Auth login',()=>{
const form=readFileSync('src/components/HRCreateRosterEmployee.jsx','utf8');
const page=readFileSync('src/screens/People.jsx','utf8');
assert.match(form,/inviteAfterSave && form.email.trim\(\) && form.primaryUnit && !matchingAccount/);
assert.match(form,/await inviteByEmail\(/);
assert.match(form,/await onCreated\?\.\(record,\{invitationState\}\)/);
assert.match(form,/This person already has a CEAC login/);
assert.match(page,/initialAccount=\{accountForEmployee\}/);
assert.match(page,/>Add HR record<\/button>/);
assert.match(page,/Invitation delivery was not confirmed/);
});

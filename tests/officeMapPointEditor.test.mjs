import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
test('Office Settings saves an explicitly selected Google map centre rather than guessing a church coordinate',()=>{
 const office=readFileSync('src/screens/OfficeSettings.jsx','utf8');
 const map=readFileSync('src/components/WorkforceStreetMap.jsx','utf8');
 assert.match(office,/<WorkforceStreetMap key=\{office\?\.id/);
 assert.match(office,/onChooseLocation=\{\(\{lat:chosenLat,lng:chosenLng\}\)=>/);
 assert.match(office,/chooseLabel="Use this office position"/);
 assert.match(map,/onChooseLocation\(\{lat:p\.lat\(\),lng:p\.lng\(\)\}\)/);
 assert.match(office,/saveOffice\(\)/);
});

test('Every map button has explicit non-submit type inside Office Settings form',()=>{
 const map=readFileSync('src/components/WorkforceStreetMap.jsx','utf8');
 const buttons=[...map.matchAll(/<button\\b([^>]*?)>/g)];
 assert.ok(buttons.length>=8);
 assert.ok(buttons.every(entry=>entry[1].includes('type="button"')));
});

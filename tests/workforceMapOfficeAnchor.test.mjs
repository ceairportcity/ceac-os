import {test} from "node:test";import assert from "node:assert/strict";import {readFileSync} from "node:fs";
test("church office pin anchors to its actual map point across zoom levels",()=>{
 const css=readFileSync("src/components/WorkforceStreetMap.css","utf8");
 const map=readFileSync("src/components/WorkforceStreetMap.jsx","utf8");
 assert.match(css,/\.ceac-street-map-marker\.ceac-office-reference\{[^}]*transform:translate\(-50%,-50%\)/);
 assert.doesNotMatch(css,/translate\(14px,-74px\)/);
 assert.match(map,/googleMapPoint\(maps\.current,map\.current,office,node\)/);
 assert.match(map,/ceac-map-privacy/);
 assert.match(map,/Shows recorded starts, not live tracking/);
});

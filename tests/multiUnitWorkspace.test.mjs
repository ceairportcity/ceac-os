import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const app=readFileSync("src/App.jsx","utf8");
test("manager workspace identity survives switching to a staff department",()=>{
 assert.match(app,/me\.memberships \|\| \[\]\)\.some\(membership => membership\.role === "manager"\)/);
 assert.match(app,/const managesCurrentUnit/);
 assert.match(app,/if \(tab === "team"\) return \(isAdmin \|\| managesCurrentUnit\)/);
 assert.match(app,/setMe\(\(current\) =>/);
 assert.match(app,/go\("home"\)/);
});

test("switching a department preserves the current workspace and clears stale details",()=>{
 const app=readFileSync("src/App.jsx","utf8");
 const start=app.indexOf("function switchUnit("),end=app.indexOf("const authPath",start);
 assert.ok(start>=0 && end>start);
 const source=app.slice(start,end);
 assert.match(source,/navigate\(\{ tab: nextTab \}, \{ replace: true \}\)/);
 assert.match(source,/membership\.role !== "manager"/);
 assert.doesNotMatch(source,/go\("home"\)/);
});

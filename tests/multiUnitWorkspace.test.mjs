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

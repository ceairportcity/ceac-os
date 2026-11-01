import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const c=readFileSync("src/screens/Compliance.jsx","utf8");
const r=readFileSync("src/components/CompliancePeriodReport.jsx","utf8");
test("five specialist sections retain case evidence and policies",()=>{for(const name of ['["overview","Overview"]','["attendance","Attendance"]','["reviews","Reviews"]','["policies","Policies"]','["reports","Reports"]'])assert.ok(c.includes(name));assert.match(c,/primaryTab==="reviews"/);assert.match(c,/primaryTab==="policies"/);assert.match(r,/allowMemo&&period==="month"/);});

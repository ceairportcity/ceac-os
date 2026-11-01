import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const code=readFileSync("src/components/PersonalContributions.jsx","utf8");
const hub=readFileSync("src/screens/Me.jsx","utf8");
test("department contributions are person-scoped, version-aware and not attendance",()=>{
 for(const term of ['.eq("org_id",me.org_id)','.eq("contributor_id",me.id)','supersedes_id','work_items_unit_id_fkey','group.dates.size'])
  assert.ok(code.includes(term),term);
 assert.match(code,/not additional attendance days/);
 assert.match(code,/a.count>200/);
 assert.match(hub,/showContributions&&<PersonalContributions/);
});

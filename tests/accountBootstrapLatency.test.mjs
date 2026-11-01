import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const source=readFileSync("src/lib/supabase.js","utf8");
test("account and authority reads share one network wait after authenticated identity",()=>{
 const auth=source.indexOf('const { data: auth, error: authError } = await supabase.auth.getUser()');
 const profile=source.indexOf('const [\n    { data: p, error: profileError }');
 const parallel=source.indexOf('] = await Promise.all([', profile);
 const accountCheck=source.indexOf('if (!p.active) throw new Error',profile);
 const membershipCheck=source.indexOf('if (membershipError) throw membershipError;',profile);
 assert.ok(auth>=0 && profile>auth && parallel>profile && accountCheck>parallel && membershipCheck>accountCheck);
 for(const table of ["profiles","unit_memberships","capability_grants","sub_teams"])
  assert.ok(source.slice(parallel, accountCheck).includes('supabase.from("'+table+'")'));
 assert.match(source,/resolveCapabilityGrantRead\(/);
 assert.match(source,/readServerVerifiedLegacyGrants\(/);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const home = readFileSync("src/screens/ManagerHome.jsx","utf8");
test("Manager overview reads independent summaries concurrently", () => {
  assert.match(home, /const \[requestResult, routineResult, financePositionResult\] = await Promise\.all\(\[/);
  assert.match(home, /supabase\.from\("work_requests"\)/);
  assert.match(home, /supabase\.from\("recurring_operations"\)/);
  assert.match(home, /supabase\.rpc\("unit_budget_position"/);
  for (const name of ["requestResult", "routineResult", "financePositionResult"])
    assert.match(home, new RegExp("requireResult\\("+name+","));
  assert.doesNotMatch(home, /const requestResult = await supabase/);
  assert.doesNotMatch(home, /const routineResult = await supabase/);
  assert.doesNotMatch(home, /const financePositionResult = await supabase/);
});

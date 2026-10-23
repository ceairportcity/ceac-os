import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

for (const role of ["Manager","Admin","Executive"]) {
  test(`${role} Work discards stale cross-account loads and stale visible history`, () => {
    const code = readFileSync(`src/screens/${role}Work.jsx`, "utf8");
    assert.match(code,/const readGeneration = useRef\(0\)/);
    assert.match(code,/loadedScope !== actorScope/);
    assert.match(code,/const request = \+\+readGeneration\.current/);
    assert.match(code,/readGeneration\.current \+= 1/);
    assert.match(code,/request !== readGeneration\.current\) return/);
    assert.match(code,/if \(request === readGeneration\.current\)/);
    assert.match(code,/setLoadedScope\(requestedScope\)/);
    assert.match(code,/setAddingMyWork\(false\)/);
    assert.match(code,/!scopedLoading && !error && <WorkRegisterLayout/);
    assert.match(code,/addingMyWork && !scopedLoading && <SelfWorkComposer/);
  });
}
test("manager work reads only the actor's organisation and current managed units", () => {
  const code = readFileSync("src/screens/ManagerWork.jsx", "utf8");
  assert.match(code,/managedUnitIds\.length \? supabase\.from/);
  assert.match(code,/\.eq\("org_id", me\.org_id\)\.in\("unit_id", managedUnitIds\)/);
  assert.match(code,/managedUnitIds\.join\(","\)/);
  assert.match(code,/Promise\.resolve\(\{ data: \[\], error: null \}\)/);
});

test("App remounts Work for every role when actor, tenant or active unit changes", () => {
  const app = readFileSync("src/App.jsx", "utf8");
  assert.match(app, /const managerScopeKey = \`\$\{me\.org_id\}:\$\{me\.id\}:\$\{me\.unit_id \|\| "none"\}\`/);
  for (const surface of ["ExecutiveWork", "AdminWork", "ManagerWork", "Work"]) {
    const route = new RegExp("<" + surface + " key=\\{managerScopeKey\\} me=\\{me\\}");
    assert.match(app, route);
  }
});

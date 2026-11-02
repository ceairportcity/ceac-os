import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const app=readFileSync("src/App.jsx","utf8");
test("initial auth event does not restart the already running account boot",()=>{
 const effect=app.indexOf("  useEffect(() => {\n    boot();");
 const sub=app.indexOf("supabase.auth.onAuthStateChange((event) => {",effect);
 const guard=app.indexOf('if (event === "INITIAL_SESSION") return;',sub);
 const security=app.indexOf('if (UNIVERSAL_TOTP_CUTOVER)',sub);
 assert.ok(effect>=0&&sub>effect&&guard>sub&&security>guard);
 assert.match(app,/\["SIGNED_OUT", "SIGNED_IN", "PASSWORD_RECOVERY", "USER_UPDATED"\]/);
 assert.match(app,/const \[assurance, factors, claims\] = await Promise\.all/);
 assert.match(app,/const m = await loadMe\(\)/);
 assert.match(app,/Supabase Auth callbacks hold their own session lock/);
 assert.match(app,/else \{\s*\/\/ Supabase Auth callbacks[\s\S]*setTimeout\(\(\) => boot\(\), 0\);/);
});

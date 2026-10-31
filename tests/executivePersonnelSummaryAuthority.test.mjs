import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const source=path=>readFileSync(path,"utf8");

test("Executive staffing reads a narrow invoker-verified RPC, never raw HR tables",()=>{
 const home=source("src/screens/ExecutiveHome.jsx");
 const directory=source("src/screens/ExecutiveOrganisation.jsx");
 assert.ok(home.includes('rpc("executive_personnel_directory"'));
 assert.ok(directory.includes('rpc("executive_personnel_directory"'));
 assert.ok(directory.includes('rpc("executive_personnel_leave"'));
 assert.ok(!directory.includes('.from("employment_records")'));
 assert.ok(!directory.includes('.from("leave_requests")'));
});
test("Executive read-only projection guards role and organisation without granting table select",()=>{
 const sql=source("supabase/migrations/20261031021300_executive_personnel_read_summary.sql");
 assert.match(sql,/auth\.uid\(\) IS NULL OR NOT public\.app_is_exec\(\)/);
 assert.match(sql,/e\.org_id = public\.app_org_id\(\)/);
 assert.match(sql,/l\.org_id = public\.app_org_id\(\)/);
 assert.match(sql,/REVOKE ALL ON FUNCTION public\.executive_personnel_directory/);
 assert.match(sql,/REVOKE ALL ON FUNCTION public\.executive_personnel_leave/);
 assert.match(sql,/GRANT EXECUTE ON FUNCTION public\.executive_personnel_leave/);
 assert.ok(!sql.includes("GRANT SELECT ON TABLE"));
 assert.ok(!sql.includes("e.salary"));
 assert.ok(!sql.includes("e.payroll"));
 assert.ok(!sql.includes("l.reason"));
 assert.ok(!sql.includes("l.kind"));
});

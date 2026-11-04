import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read=path=>readFileSync(new URL(path,import.meta.url),"utf8");
const sql=read("../supabase/migrations/20261102142000_workforce_map_roster_parity.sql");
const shared=read("../src/components/RoleWorkforceMap.jsx");
const executive=read("../src/components/ExecutiveWorkforceToday.jsx");
const hr=read("../src/experience-v2/admin-overview/AdminOverviewV2.jsx");
const compliance=read("../src/components/ComplianceOverview.jsx");
const screen=read("../src/components/AdminWorkforceToday.jsx");

test("All three maps share the exact same restricted roster and session feed",()=>{
 assert.match(shared,/supabase\.rpc\("workforce_map_day",\{p_date:selectedDay\}\)/);
 assert.match(hr,/<RoleWorkforceMap me=\{me\}/);
 assert.match(executive,/<RoleWorkforceMap me=\{me\}/);
 assert.match(compliance,/<RoleWorkforceMap me=\{me\} roleLabel="Compliance" date=\{date\}/);
 assert.match(shared,/Array\.isArray\(data\.roster\)/);
 assert.match(shared,/data\.roster_count===data\.roster\.length/);
 assert.match(screen,/adminWorkforceToday\(roster,sessions,operationalProfiles,startChoice\)/);
 assert.doesNotMatch(executive,/\.from\(['"]profiles['"]\)/);
 assert.doesNotMatch(compliance,/workforceMapRows/);
});

test("Map SQL is org-bound and denies ordinary employee access",()=>{
 assert.match(sql,/emp\.org_id = v_org/);
 assert.match(sql,/s\.org_id = v_org/);
 assert.match(sql,/p\.org_id = v_org/);
 assert.match(sql,/public\.app_stage2_universal_aal_allowed\(\)/);
 assert.match(sql,/public\.app_is_admin\(\) OR public\.app_is_exec\(\)/);
 assert.match(sql,/public\.app_has_capability\('compliance\.manage', NULL\)/);
 assert.match(sql,/REVOKE ALL ON FUNCTION public\.workforce_map_day\(date\) FROM PUBLIC, anon, authenticated/);
 assert.match(sql,/GRANT EXECUTE ON FUNCTION public\.workforce_map_day\(date\) TO authenticated/);
 assert.match(sql,/emp\.employment_status = 'active'/);
 assert.match(sql,/FROM public\.employee_roster emp/);
 assert.match(sql,/FROM public\.work_sessions s/);
 assert.match(sql,/v_start := p_date::timestamp AT TIME ZONE 'Africa\/Accra'/);
 for(const privateField of ['hr_contact_email','salary','payroll','medical_reason','personal_phone','date_of_birth']){
  assert.doesNotMatch(sql,new RegExp("'"+privateField+"'"));
 }
});

test("Work starts without roster identity are still labelled rather than dropped",()=>{
 assert.match(sql,/NOT EXISTS \(SELECT 1 FROM public\.employee_roster emp/);
 assert.match(sql,/'operationalProfiles', v_unlinked/);
 assert.match(sql,/'profile_id', p\.id, 'full_name', p\.full_name/);
 assert.match(shared,/read\.data\.operationalProfiles/);
});

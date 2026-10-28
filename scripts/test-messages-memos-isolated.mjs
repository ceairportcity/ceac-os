const {PGlite}=await import(process.env.CEAC_PGLITE_MODULE || '@electric-sql/pglite');
import fs from 'node:fs';
const db=new PGlite();
try {
await db.exec(fs.readFileSync('tests/fixtures/messages-memos-schema.sql','utf8'));
const files=fs.readFileSync('supabase/migrations/20261005133253_108_operational_files_and_exec_rooms.sql','utf8');
await db.exec(files.slice(files.indexOf('create table public.operational_files'),files.indexOf('alter table public.operational_files enable')));
for(const name of ['app_can_read_operational_context','app_can_write_operational_context','app_can_access_operational_file','register_operational_file','link_operational_file']) {
 const start=files.indexOf('create or replace function public.'+name+'('), end=files.indexOf('\n$$;',start)+4;
 await db.exec(files.slice(start,end));
}
await db.exec(files.slice(files.indexOf('create policy operational_files_read'),files.indexOf('create or replace function public.register_operational_file')));
const project=fs.readFileSync('supabase/migrations/20260920201736_064_atomic_multirow_application_writes.sql','utf8');
const start=project.indexOf('create or replace function public.create_project_with_participants('),end=project.indexOf('\n$$;',start)+4;
await db.exec(project.slice(start,end));
await db.exec(fs.readFileSync('supabase/migrations/20261028181026_messages_memos_work_followups.sql','utf8'));
await db.exec(`INSERT INTO organisations(id) VALUES ('10000000-0000-4000-8000-000000000010');
INSERT INTO units(id,org_id,name) VALUES ('20000000-0000-4000-8000-000000000011','10000000-0000-4000-8000-000000000010','Test A');
INSERT INTO profiles(id,org_id,full_name,job_title,is_admin,is_exec) SELECT ('31000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'10000000-0000-4000-8000-000000000010','Fixture '||i,'Fixture',i=3,i=4 FROM generate_series(1,7) i;
INSERT INTO unit_memberships(profile_id,org_id,unit_id,role) SELECT id,org_id,'20000000-0000-4000-8000-000000000011',CASE WHEN full_name='Fixture 2' THEN 'manager' ELSE 'staff' END FROM profiles;
INSERT INTO rooms(id,org_id,kind,unit_id) VALUES ('50000000-0000-4000-8000-000000000028','10000000-0000-4000-8000-000000000010','unit','20000000-0000-4000-8000-000000000011');`);
console.log('PASS: forward migration compiled and applied to isolated PGlite schema fixture');
await db.exec(fs.readFileSync('supabase/tests/messages_memos_gate.sql','utf8').replace(/^\\set.*$/gm,''));
console.log('PASS: messages_memos_gate.sql (all assertions, transaction rolled back)');
await db.close();

} catch(error) {console.error(error.message,error.code,error.where || "",error.query?.slice(0,250));await db.close();process.exitCode=1;}

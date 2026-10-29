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

await db.exec(`ALTER TABLE public.work_items ADD COLUMN assignee_id uuid, ADD COLUMN unit_id uuid, ADD COLUMN origin text, ADD COLUMN visibility text DEFAULT 'unit', ADD COLUMN confidential boolean DEFAULT false, ADD COLUMN status text DEFAULT 'in_progress', ADD COLUMN title text, ADD COLUMN purpose text, ADD COLUMN expected_outcome text, ADD COLUMN instructions text, ADD COLUMN last_movement_at timestamptz;
ALTER TABLE public.work_activity_records ADD COLUMN org_id uuid,ADD COLUMN work_item_id uuid,ADD COLUMN contributor_id uuid,ADD COLUMN supersedes_id uuid;
CREATE OR REPLACE FUNCTION public.app_can_see_item(p_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$ SELECT EXISTS(SELECT 1 FROM public.work_items w WHERE w.id=p_id AND w.org_id=public.app_org_id() AND (w.assignee_id=auth.uid() OR (w.visibility<>'private' AND w.unit_id IN(SELECT public.app_my_units())))) $$;
ALTER TABLE public.work_items ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.work_items TO authenticated;
CREATE POLICY fixture_work_read ON public.work_items FOR SELECT TO authenticated USING(public.app_can_see_item(id));
`);
await db.exec(fs.readFileSync('supabase/migrations/20261007093000_120_phase6_private_day_planning.sql','utf8'));
await db.exec(`ALTER TABLE public.personal_day_tasks ALTER COLUMN plan_date DROP NOT NULL,ADD COLUMN linked_work_item_id uuid REFERENCES public.work_items(id);`);
await db.exec(fs.readFileSync('tests/fixtures/phase1-support-schema.sql','utf8'));
const supportSource=fs.readFileSync('supabase/migrations/20261011130000_133_technical_support_v1_backend.sql','utf8');
const insertGuardStart=supportSource.indexOf('CREATE OR REPLACE FUNCTION public.support_case_insert_guard()');
const insertGuardEnd=supportSource.indexOf('\n$$;',insertGuardStart)+4;
if(insertGuardStart<0 || insertGuardEnd<4)throw new Error('Reviewed Support insert guard is missing.');
await db.exec(supportSource.slice(insertGuardStart,insertGuardEnd));
await db.exec(`REVOKE ALL ON FUNCTION public.support_case_insert_guard() FROM public,anon,authenticated; CREATE TRIGGER support_case_insert_guard BEFORE INSERT ON public.support_cases FOR EACH ROW EXECUTE FUNCTION public.support_case_insert_guard();`);

await db.exec(fs.readFileSync('supabase/migrations/20261029112823_work_activity_evidence_followup_and_edit.sql','utf8'));
await db.exec(fs.readFileSync('tests/fixtures/phase1-work-gate.sql','utf8'));
await db.exec(fs.readFileSync('tests/fixtures/phase1-support-gate.sql','utf8'));
console.log('PASS: isolated SQL work edit, stale edit, audit, file contexts, own follow-up, idempotency, private RLS, completion independence and Support intake/identity/revocation');
await db.close();
} catch(error) {console.error(error.message,error.code,error.where || '',error.query?.slice(0,250));await db.close();process.exitCode=1;}

// Optional test-only PostgreSQL runtime; never used by the application.
// CEAC_PGLITE_MODULE may point to an existing PGlite module URL.
const {PGlite}=await import(process.env.CEAC_PGLITE_MODULE || '@electric-sql/pglite');
import fs from 'node:fs';
const db=new PGlite();
try {
await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
CREATE SCHEMA auth; CREATE SCHEMA private;
GRANT USAGE ON SCHEMA auth,public,private TO authenticated;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
CREATE TABLE public.organisations(id uuid PRIMARY KEY,universal_totp_required boolean default false);
CREATE TABLE public.profiles(id uuid PRIMARY KEY,org_id uuid);
CREATE TABLE public.work_items(id uuid PRIMARY KEY,org_id uuid,ref text,unit_id uuid,assignee_id uuid,assigned_by uuid,title text,status text);
CREATE FUNCTION public.app_org_id() RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER AS $$ SELECT org_id FROM public.profiles WHERE id=auth.uid() $$;
CREATE TABLE public.office_locations(id uuid primary key,org_id uuid,is_primary boolean,set_at timestamptz,lat float8,lng float8,radius_meters int);
CREATE TABLE public.work_sessions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), org_id uuid, profile_id uuid, work_item_id uuid, place text, started_at timestamptz default now(), ended_at timestamptz, end_reason text, corrected_by uuid,corrected_at timestamptz,last_confirmed_at timestamptz,
 lat float8,lng float8,location_accuracy_m float8,location_captured_at timestamptz,device_time timestamptz,server_received_at timestamptz,
 office_location_id uuid,start_geofence text,flags jsonb default '{}'::jsonb,end_lat float8,end_lng float8,end_accuracy_m float8,end_location_captured_at timestamptz,end_location_status text,end_location_failure text,end_device_time timestamptz);
CREATE UNIQUE INDEX work_sessions_one_open_per_profile ON public.work_sessions(profile_id) WHERE ended_at IS NULL;
ALTER TABLE public.work_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY sessions_own_insert ON public.work_sessions FOR INSERT WITH CHECK(profile_id=auth.uid() AND org_id=public.app_org_id());
CREATE POLICY sessions_own_read ON public.work_sessions FOR SELECT USING(profile_id=auth.uid() AND org_id=public.app_org_id());
GRANT SELECT,INSERT ON public.work_sessions TO authenticated;
GRANT SELECT ON public.work_items TO authenticated;
ALTER TABLE public.work_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_work ON public.work_items FOR SELECT USING(org_id=public.app_org_id() AND assignee_id=auth.uid());
INSERT INTO public.organisations VALUES('10000000-0000-4000-8000-000000000010',false);
INSERT INTO public.profiles VALUES('31000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000010'),('31000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000010');`);
// Execute the actual existing office/location trigger, not a mocked guard.
const original=fs.readFileSync('supabase/migrations/20261014211500_140_attendance_code_location_scope.sql','utf8');
const begin=original.indexOf('create or replace function public.guard_office_session_location(');
const end=original.indexOf('\n$$;',begin)+4;
if(begin<0||end<begin)throw new Error('Cannot locate actual office guard');
await db.exec(original.slice(begin,end));
await db.exec('CREATE TRIGGER work_sessions_office_location_guard BEFORE INSERT ON public.work_sessions FOR EACH ROW EXECUTE FUNCTION public.guard_office_session_location();');
await db.exec(fs.readFileSync('supabase/migrations/20261028182309_offsite_location_optional_responsibility.sql','utf8'));
console.log('PASS: forward migration with actual office guard in isolated PostgreSQL/PGlite fixture');
await db.exec(fs.readFileSync('supabase/tests/offsite_location_optional_responsibility_gate.sql','utf8').replace(/^\\set.*$/gm,''));
console.log('PASS: 2 valid attendance inserts, 14 negative direct-insert cases, internal-function privilege checks; transaction rolled back');
await db.exec(`CREATE TABLE public.work_session_events(org_id uuid,work_session_id uuid,actor_id uuid,action text,effective_at timestamptz,note text);
CREATE TABLE public.activity_events(org_id uuid,actor_id uuid,verb text,object_type text,object_id uuid,meta jsonb);`);
await db.exec(fs.readFileSync('supabase/migrations/20260920182250_053_fix_stale_session_continue.sql','utf8'));
const recovery=fs.readFileSync('supabase/migrations/20261006021138_111_onboarding_access_presence_foundation.sql','utf8');
const rb=recovery.indexOf('create or replace function public.continue_work_session_with_location('),re=recovery.indexOf('grant execute on function public.continue_work_session_with_location',rb);
await db.exec(recovery.slice(rb,re)+recovery.slice(re,recovery.indexOf(';',re)+1));
for(const flags of [{},{offsite_location_name:'Historical synthetic remote office'}]) {
 await db.exec(`SELECT set_config('request.jwt.claim.sub','',false);INSERT INTO public.work_sessions(org_id,profile_id,place,started_at,last_confirmed_at,flags) VALUES('10000000-0000-4000-8000-000000000010','31000000-0000-4000-8000-000000000001','elsewhere',now()-interval '1 day',now()-interval '1 day','${JSON.stringify(flags)}');
 SET ROLE authenticated;SELECT set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000001',false);`);
 const {rows:[row]}=await db.query(`SELECT * FROM public.continue_work_session_with_location((SELECT id FROM public.work_sessions WHERE ended_at IS NULL),0,0,14,now())`);
 if(!row.flags.continued_from_session_id || row.lat!==0 || (flags.offsite_location_name&&row.flags.offsite_location_name!==flags.offsite_location_name))throw new Error('Historical reconciliation lost trusted location/name');
 await db.exec(`RESET ROLE;SELECT set_config('request.jwt.claim.sub','',false);UPDATE public.work_sessions SET ended_at=now() WHERE ended_at IS NULL;`);
}
console.log('PASS: actual server recovery RPC continues both legacy unnamed and new named off-site sessions');
} catch(e){console.error(e.message,e.code,e.where||'');process.exitCode=1;} finally{await db.close();}

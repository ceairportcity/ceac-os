\set ON_ERROR_STOP on
BEGIN READ ONLY;
-- psql -v duplicate_profile_id='reviewed UUID' -f this-file
-- READ ONLY. Resolve the exact retiring identity privately before supplying it.
SELECT id,full_name,email,active FROM public.profiles WHERE id=:'duplicate_profile_id'::uuid;
SELECT 'assigned_work' AS dependency,count(*) FROM public.work_items WHERE assignee_id=:'duplicate_profile_id'::uuid
UNION ALL SELECT 'sessions',count(*) FROM public.work_sessions WHERE profile_id=:'duplicate_profile_id'::uuid
UNION ALL SELECT 'activities',count(*) FROM public.work_activity_records WHERE contributor_id=:'duplicate_profile_id'::uuid
UNION ALL SELECT 'messages',count(*) FROM public.room_messages WHERE author_id=:'duplicate_profile_id'::uuid
UNION ALL SELECT 'projects',count(*) FROM public.projects WHERE created_by=:'duplicate_profile_id'::uuid OR delivery_owner_id=:'duplicate_profile_id'::uuid OR sponsor_profile_id=:'duplicate_profile_id'::uuid
UNION ALL SELECT 'led_teams',count(*) FROM public.sub_teams WHERE lead_id=:'duplicate_profile_id'::uuid
UNION ALL SELECT 'auth_sessions',count(*) FROM auth.sessions WHERE user_id=:'duplicate_profile_id'::uuid;
-- Inventory EVERY foreign-key dependency before any permanent identity deletion.
-- Retirement preserves these records; it does not cascade-delete an account.
SELECT n.nspname AS schema_name,c.relname AS table_name,a.attname AS column_name
FROM pg_constraint f JOIN pg_class c ON c.oid=f.conrelid
JOIN pg_namespace n ON n.oid=c.relnamespace
JOIN LATERAL unnest(f.conkey) k(attnum) ON true
JOIN pg_attribute a ON a.attrelid=c.oid AND a.attnum=k.attnum
WHERE f.contype='f' AND f.confrelid='public.profiles'::regclass ORDER BY 1,2,3;

COMMIT;

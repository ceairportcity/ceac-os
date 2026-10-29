\set ON_ERROR_STOP on
-- Disposable seeded local database only. No production execution.
BEGIN;
UPDATE public.profiles SET job_title='Group Pastor' WHERE id='31000000-0000-4000-8000-000000000004';
SELECT set_config('ceac.memo_test.room',(SELECT id::text FROM public.rooms WHERE kind='unit' AND unit_id='20000000-0000-4000-8000-000000000011' LIMIT 1),true);
INSERT INTO public.room_messages(id,room_id,org_id,author_id,body) VALUES
 ('51000000-0000-4000-8000-000000000028',current_setting('ceac.memo_test.room')::uuid,'10000000-0000-4000-8000-000000000010','31000000-0000-4000-8000-000000000001','Synthetic own message removal'),
 ('51000000-0000-4000-8000-000000000029',current_setting('ceac.memo_test.room')::uuid,'10000000-0000-4000-8000-000000000010','31000000-0000-4000-8000-000000000002','Unrelated message retained');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"31000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1","amr":[{"method":"password"}]}',true);
SELECT set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000001',true);
DO $own$
DECLARE v uuid;
BEGIN
 PERFORM public.remove_own_room_message('51000000-0000-4000-8000-000000000028');
 PERFORM public.remove_own_room_message('51000000-0000-4000-8000-000000000028');
 IF EXISTS(SELECT 1 FROM public.room_messages WHERE id='51000000-0000-4000-8000-000000000028') THEN RAISE EXCEPTION 'Removed content remains visible'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.room_messages WHERE id='51000000-0000-4000-8000-000000000029') THEN RAISE EXCEPTION 'Unrelated message disappeared'; END IF;
 BEGIN PERFORM public.remove_own_room_message('51000000-0000-4000-8000-000000000029');RAISE EXCEPTION 'Deleted another sender message';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 v:=(public.save_memo_draft('52000000-0000-4000-8000-000000000028',NULL,'Media Team Digital Transformation Initiative','Synthetic proposal version one',ARRAY['31000000-0000-4000-8000-000000000004'::uuid],ARRAY['31000000-0000-4000-8000-000000000002'::uuid],true,'cross_department',NULL,'31000000-0000-4000-8000-000000000004')->>'version_id')::uuid;
 PERFORM set_config('ceac.memo_test.version',v::text,true);
 BEGIN
  PERFORM public.save_memo_draft('52000000-0000-4000-8000-000000000028',v,'Stale editor','Attempt stale overwrite',ARRAY['31000000-0000-4000-8000-000000000004'::uuid],ARRAY['31000000-0000-4000-8000-000000000002'::uuid],true,'cross_department',NULL,'31000000-0000-4000-8000-000000000004','2000-01-01T00:00:00Z');
  RAISE EXCEPTION 'Stale draft editor overwrote current version';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM='Stale draft editor overwrote current version' THEN RAISE;END IF;END;
 PERFORM public.register_operational_file('memo_version',v,'memo_attachment','proposal.pdf','application/pdf',100::bigint);
 IF NOT EXISTS(SELECT 1 FROM public.operational_file_links WHERE context_type='memo_version' AND context_id=v) THEN RAISE EXCEPTION 'Failed pending upload is hidden from draft sender'; END IF;
 BEGIN PERFORM public.send_memo('52000000-0000-4000-8000-000000000028',v);RAISE EXCEPTION 'Memo sent with incomplete upload';EXCEPTION WHEN raise_exception THEN IF SQLERRM='Memo sent with incomplete upload' THEN RAISE;END IF;END;
 PERFORM public.remove_memo_draft_attachment((SELECT id FROM public.operational_file_links WHERE context_type='memo_version' AND context_id=v LIMIT 1));

 IF NOT public.app_can_access_memo('52000000-0000-4000-8000-000000000028') THEN RAISE EXCEPTION 'Sender cannot access draft'; END IF;
 BEGIN UPDATE public.memos SET decision_maker_id=auth.uid() WHERE id='52000000-0000-4000-8000-000000000028';RAISE EXCEPTION 'Direct memo authority write succeeded';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
END; $own$;
-- Intended recipient cannot see an unsent draft.
SELECT set_config('request.jwt.claims','{"sub":"31000000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal1"}',true);
SELECT set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000004',true);
DO $$ BEGIN IF public.app_can_access_memo('52000000-0000-4000-8000-000000000028') OR EXISTS(SELECT 1 FROM public.memo_versions WHERE memo_id='52000000-0000-4000-8000-000000000028') THEN RAISE EXCEPTION 'Recipient read unsent confidential draft';END IF; END; $$;
SELECT set_config('request.jwt.claims','{"sub":"31000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);
SELECT set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000001',true);
SELECT public.send_memo('52000000-0000-4000-8000-000000000028',current_setting('ceac.memo_test.version')::uuid);
SELECT public.send_memo('52000000-0000-4000-8000-000000000028',current_setting('ceac.memo_test.version')::uuid);
DO $$ BEGIN
 BEGIN PERFORM public.register_operational_file('memo_version',current_setting('ceac.memo_test.version')::uuid,'memo_attachment','late.pdf','application/pdf',100::bigint);RAISE EXCEPTION 'Sent attachment set changed';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
END; $$;
-- Cc department head can read/respond, but cannot approve cross-department work.
SELECT set_config('request.jwt.claims','{"sub":"31000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}',true);
SELECT set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000002',true);
DO $$ BEGIN
 IF NOT public.app_can_access_memo('52000000-0000-4000-8000-000000000028') THEN RAISE EXCEPTION 'Cc lost correspondence';END IF;
 BEGIN PERFORM public.respond_to_memo('52000000-0000-4000-8000-000000000028',current_setting('ceac.memo_test.version')::uuid,gen_random_uuid(),'approved','Copied head attempt');RAISE EXCEPTION 'Cc gained decision power';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 PERFORM public.respond_to_memo('52000000-0000-4000-8000-000000000028',current_setting('ceac.memo_test.version')::uuid,'53000000-0000-4000-8000-000000000028','reply','Synthetic clarification');
END; $$;
-- HR is not a participant and has no ambient confidential-content access.
SELECT set_config('request.jwt.claims','{"sub":"31000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}',true);
SELECT set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000003',true);
DO $$ BEGIN
 IF public.app_can_access_memo('52000000-0000-4000-8000-000000000028') OR EXISTS(SELECT 1 FROM public.memos WHERE id='52000000-0000-4000-8000-000000000028') OR EXISTS(SELECT 1 FROM public.memo_exchanges WHERE memo_id='52000000-0000-4000-8000-000000000028') THEN RAISE EXCEPTION 'HR gained confidential memo access';END IF;
 BEGIN PERFORM public.remove_own_room_message('51000000-0000-4000-8000-000000000029');RAISE EXCEPTION 'HR deleted another sender message';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
END; $$;
SELECT set_config('request.jwt.claims','{"sub":"31000000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal1"}',true);
SELECT set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000004',true);
SELECT public.respond_to_memo('52000000-0000-4000-8000-000000000028',current_setting('ceac.memo_test.version')::uuid,'53000000-0000-4000-8000-000000000029','changes_requested','Please revise the proposal.');
SELECT set_config('request.jwt.claims','{"sub":"31000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);
SELECT set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000001',true);
SELECT set_config('ceac.memo_test.version2',(public.save_memo_draft('52000000-0000-4000-8000-000000000028',current_setting('ceac.memo_test.version')::uuid,'Media Team Digital Transformation Initiative','Revised proposal version two',ARRAY['31000000-0000-4000-8000-000000000004'::uuid],ARRAY['31000000-0000-4000-8000-000000000002'::uuid],true,'cross_department',NULL,'31000000-0000-4000-8000-000000000004',(SELECT updated_at FROM public.memos WHERE id='52000000-0000-4000-8000-000000000028'))->>'version_id'),true);
DO $$ BEGIN
 IF (SELECT body FROM public.memo_versions WHERE id=current_setting('ceac.memo_test.version')::uuid)<>'Synthetic proposal version one' THEN RAISE EXCEPTION 'Original proposal was overwritten';END IF;
END; $$;
SELECT public.send_memo('52000000-0000-4000-8000-000000000028',current_setting('ceac.memo_test.version2')::uuid);
SELECT set_config('request.jwt.claims','{"sub":"31000000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal1"}',true);
SELECT set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000004',true);
DO $$ BEGIN
 BEGIN PERFORM public.respond_to_memo('52000000-0000-4000-8000-000000000028',current_setting('ceac.memo_test.version')::uuid,gen_random_uuid(),'approved','Stale approval');RAISE EXCEPTION 'Stale proposal approved';EXCEPTION WHEN raise_exception THEN IF SQLERRM='Stale proposal approved' THEN RAISE;END IF;END;
 PERFORM public.respond_to_memo('52000000-0000-4000-8000-000000000028',current_setting('ceac.memo_test.version2')::uuid,'53000000-0000-4000-8000-000000000030','approved','Approved in principle only.');
 PERFORM public.respond_to_memo('52000000-0000-4000-8000-000000000028',current_setting('ceac.memo_test.version2')::uuid,'53000000-0000-4000-8000-000000000030','approved','Approved in principle only.');
 IF (SELECT project_id FROM public.memos WHERE id='52000000-0000-4000-8000-000000000028') IS NOT NULL THEN RAISE EXCEPTION 'Approval automatically created a project';END IF;
 IF (SELECT count(*) FROM public.memo_exchanges WHERE kind='approved' AND memo_id='52000000-0000-4000-8000-000000000028')<>1 THEN RAISE EXCEPTION 'Duplicate approval recorded';END IF;
END; $$;
-- Explicit project conversion reuses existing capability + managed-unit checks.
RESET ROLE;
INSERT INTO public.capabilities(org_id,profile_id,capability)
 VALUES('10000000-0000-4000-8000-000000000010','31000000-0000-4000-8000-000000000002','create_project') ON CONFLICT DO NOTHING;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"31000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}',true);
SELECT set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000002',true);
DO $$ DECLARE first_id uuid; second_id uuid; BEGIN
 first_id:=public.create_project_from_memo('52000000-0000-4000-8000-000000000028',current_setting('ceac.memo_test.version2')::uuid,'20000000-0000-4000-8000-000000000011','{}','Approved media initiative','Reviewed shareable project charter');
 second_id:=public.create_project_from_memo('52000000-0000-4000-8000-000000000028',current_setting('ceac.memo_test.version2')::uuid,'20000000-0000-4000-8000-000000000011','{}','Approved media initiative','Reviewed shareable project charter');
 IF first_id IS DISTINCT FROM second_id THEN RAISE EXCEPTION 'Duplicate project created';END IF;
 IF (SELECT purpose FROM public.projects WHERE id=first_id) IS DISTINCT FROM 'Reviewed shareable project charter' THEN RAISE EXCEPTION 'Confidential proposal copied into project';END IF;
END; $$;
-- Ordinary Memos use the same lifecycle, without a decision-maker.
SELECT set_config('request.jwt.claims','{"sub":"31000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);
SELECT set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000001',true);
DO $$ DECLARE v uuid; BEGIN
 v:=(public.save_memo_draft('52000000-0000-4000-8000-000000000029',NULL,'Information only','Ordinary correspondence',ARRAY['31000000-0000-4000-8000-000000000002'::uuid],'{}',false,'department',NULL,NULL)->>'version_id')::uuid;
 PERFORM public.send_memo('52000000-0000-4000-8000-000000000029',v);
 IF (SELECT status FROM public.memos WHERE id='52000000-0000-4000-8000-000000000029')<>'sent' THEN RAISE EXCEPTION 'Ordinary memo requires decision fields'; END IF;
 PERFORM public.respond_to_memo('52000000-0000-4000-8000-000000000029',v,gen_random_uuid(),'closed','Correspondence complete');
END; $$;
-- Department decisions require the actual department head; even a copied
-- Group Pastor has no approval action unless designated as the To decision-maker.
DO $$ DECLARE v uuid; BEGIN
 v:=(public.save_memo_draft('52000000-0000-4000-8000-000000000030',NULL,'Department proposal','Scoped departmental proposal',ARRAY['31000000-0000-4000-8000-000000000007'::uuid],ARRAY['31000000-0000-4000-8000-000000000004'::uuid],true,'department','20000000-0000-4000-8000-000000000011','31000000-0000-4000-8000-000000000007')->>'version_id')::uuid;
 BEGIN PERFORM public.send_memo('52000000-0000-4000-8000-000000000030',v); RAISE EXCEPTION 'Another department manager gained authority'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 v:=(public.save_memo_draft('52000000-0000-4000-8000-000000000030',v,'Department proposal','Scoped departmental proposal',ARRAY['31000000-0000-4000-8000-000000000002'::uuid],ARRAY['31000000-0000-4000-8000-000000000004'::uuid],true,'department','20000000-0000-4000-8000-000000000011','31000000-0000-4000-8000-000000000002',(SELECT updated_at FROM public.memos WHERE id='52000000-0000-4000-8000-000000000030'))->>'version_id')::uuid;
 PERFORM set_config('ceac.memo_test.department_version',v::text,true);
 PERFORM public.send_memo('52000000-0000-4000-8000-000000000030',v);
END; $$;
SELECT set_config('request.jwt.claims','{"sub":"31000000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal1"}',true);
SELECT set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000004',true);
DO $$ BEGIN
 BEGIN PERFORM public.respond_to_memo('52000000-0000-4000-8000-000000000030',current_setting('ceac.memo_test.department_version')::uuid,gen_random_uuid(),'approved','Copied executive attempt'); RAISE EXCEPTION 'Copied Group Pastor gained authority'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END; $$;
SELECT set_config('request.jwt.claims','{"sub":"31000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}',true);
SELECT set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000002',true);
SELECT public.respond_to_memo('52000000-0000-4000-8000-000000000030',current_setting('ceac.memo_test.department_version')::uuid,gen_random_uuid(),'approved','Department head approval');
RESET ROLE;
DO $$ BEGIN
 IF (SELECT count(*) FROM private.room_message_removals WHERE message_id='51000000-0000-4000-8000-000000000028')<>1 OR NOT EXISTS(SELECT 1 FROM public.room_messages WHERE id='51000000-0000-4000-8000-000000000028') THEN RAISE EXCEPTION 'Removal audit or original message lost';END IF;
 IF has_table_privilege('authenticated','private.room_message_removals','INSERT') OR has_table_privilege('anon','public.memos','SELECT') THEN RAISE EXCEPTION 'Direct or anonymous privilege escaped';END IF;
END; $$;
ROLLBACK;

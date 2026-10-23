\set ON_ERROR_STOP on
-- Stage 2 occurrence review authority: isolated rollback-only role fixture.
-- Historical occurrences and all 11 production users remain untouched.
BEGIN;
UPDATE public.organisations SET universal_totp_required=false
 WHERE id='10000000-0000-4000-8000-000000000010';

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"31000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1","amr":[{"method":"password"}]}',true);
SELECT set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000001',true);
SELECT set_config('ceac.test.review_work',public.create_typed_work(
 p_kind=>'routine',p_unit_id=>'20000000-0000-4000-8000-000000000011',
 p_assignee_id=>'31000000-0000-4000-8000-000000000001',
 p_title=>'Rollback-only independently reviewed venue routine',
 p_expected_outcome=>'Confirm the venue is safe',
 p_details=>jsonb_build_object('origin','self_created','schedule_kind','daily',
    'starts_on',current_date)
)::text,true);
SELECT set_config('ceac.test.review_occurrence',
 public.record_routine_occurrence(
   current_setting('ceac.test.review_work')::uuid,current_date,NULL,'Staff inspection recorded'
 )::text,true);

DO $staff$
BEGIN
 BEGIN
  INSERT INTO public.routine_occurrence_reviews(org_id,occurrence_id,reviewer_id,decision)
   VALUES('10000000-0000-4000-8000-000000000010',
          current_setting('ceac.test.review_occurrence')::uuid,auth.uid(),'accepted');
  RAISE EXCEPTION 'Author was allowed to independently approve their own occurrence';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END;
$staff$;

-- Unit Manager is a different person and has real manager membership.
SELECT set_config('request.jwt.claims','{"sub":"31000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1","amr":[{"method":"password"}]}',true);
SELECT set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000002',true);
WITH reviewed AS (
 INSERT INTO public.routine_occurrence_reviews(org_id,occurrence_id,reviewer_id,decision,note,reviewed_at)
 VALUES('10000000-0000-4000-8000-000000000010',
        current_setting('ceac.test.review_occurrence')::uuid,
        '31000000-0000-4000-8000-000000000001',
        'accepted','Reviewed the evidence','2001-01-01T00:00:00Z')
 RETURNING id
)
SELECT set_config('ceac.test.review_record',(SELECT id FROM reviewed)::text,true);

DO $manager$
BEGIN
 IF NOT EXISTS (
   SELECT 1 FROM public.routine_occurrence_reviews
    WHERE id=current_setting('ceac.test.review_record')::uuid
      AND reviewer_id=auth.uid()
      AND reviewed_at > clock_timestamp()-interval '3 minutes'
 ) THEN RAISE EXCEPTION 'Manager review actor/time not independently stamped'; END IF;
 BEGIN
   UPDATE public.routine_occurrence_reviews SET decision='changes_requested'
    WHERE id=current_setting('ceac.test.review_record')::uuid;
   RAISE EXCEPTION 'Append-only review UPDATE permitted';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
   DELETE FROM public.routine_occurrence_reviews
    WHERE id=current_setting('ceac.test.review_record')::uuid;
   RAISE EXCEPTION 'Append-only review DELETE permitted';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END;
$manager$;

-- An unrelated manager, executive and same-unit colleague cannot review.
SELECT set_config('request.jwt.claims','{"sub":"31000000-0000-4000-8000-000000000007","role":"authenticated","aal":"aal1"}',true);
SELECT set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000007',true);
DO $other_manager$
BEGIN
 BEGIN
  INSERT INTO public.routine_occurrence_reviews(org_id,occurrence_id,reviewer_id,decision)
   VALUES('10000000-0000-4000-8000-000000000010',
          current_setting('ceac.test.review_occurrence')::uuid,auth.uid(),'accepted');
  RAISE EXCEPTION 'Other-unit Manager approved unauthorised routine';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END;
$other_manager$;
SELECT set_config('request.jwt.claims','{"sub":"31000000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal1"}',true);
SELECT set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000004',true);
DO $executive$
BEGIN
 BEGIN
  INSERT INTO public.routine_occurrence_reviews(org_id,occurrence_id,reviewer_id,decision)
   VALUES('10000000-0000-4000-8000-000000000010',
          current_setting('ceac.test.review_occurrence')::uuid,auth.uid(),'accepted');
  RAISE EXCEPTION 'Executive inherited Manager review authority';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END;
$executive$;
SELECT set_config('request.jwt.claims','{"sub":"31000000-0000-4000-8000-000000000006","role":"authenticated","aal":"aal1"}',true);
SELECT set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000006',true);
DO $colleague$
BEGIN
 BEGIN
  INSERT INTO public.routine_occurrence_reviews(org_id,occurrence_id,reviewer_id,decision)
   VALUES('10000000-0000-4000-8000-000000000010',
          current_setting('ceac.test.review_occurrence')::uuid,auth.uid(),'accepted');
  RAISE EXCEPTION 'Colleague independently reviewed a different member';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END;
$colleague$;

-- Administration/HR can leave a later, attributable clarification request.
SELECT set_config('request.jwt.claims','{"sub":"31000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}',true);
SELECT set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000003',true);
INSERT INTO public.routine_occurrence_reviews(org_id,occurrence_id,reviewer_id,decision,note)
 VALUES('10000000-0000-4000-8000-000000000010',
        current_setting('ceac.test.review_occurrence')::uuid,
        auth.uid(),'changes_requested','Provide the door inspection photograph.');
DO $admin$
BEGIN
 IF (SELECT count(*) FROM public.routine_occurrence_reviews
       WHERE occurrence_id=current_setting('ceac.test.review_occurrence')::uuid) <> 2
 THEN RAISE EXCEPTION 'Review history was not append-only'; END IF;
 IF (SELECT count(*) FROM public.operation_occurrences
       WHERE id=current_setting('ceac.test.review_occurrence')::uuid) <> 1
 THEN RAISE EXCEPTION 'Reviews rewrote or duplicated the original occurrence'; END IF;
END;
$admin$;

SELECT set_config('request.jwt.claims','{"sub":"31000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);
SELECT set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000001',true);
DO $author_read$
BEGIN
 IF (SELECT count(*) FROM public.routine_occurrence_reviews
       WHERE occurrence_id=current_setting('ceac.test.review_occurrence')::uuid) <> 2
 THEN RAISE EXCEPTION 'Author cannot see their authorised operational feedback'; END IF;
END;
$author_read$;
RESET ROLE;
ROLLBACK;
